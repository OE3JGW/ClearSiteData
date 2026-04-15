const DELETE_MESSAGE_TYPE = "DELETE_CURRENT_SITE_DATA";

const defaultConfig = {
  useConfig: true,
  reloadAfterDelete: true,
  dataToRemove: {
    appcache: true,
    cache: true,
    cacheStorage: true,
    cookies: true,
    fileSystems: true,
    indexedDB: true,
    localStorage: true,
    serviceWorkers: true,
    webSQL: true
  }
};

let cachedConfig = null;

async function getConfig() {
  if (cachedConfig) {
    return cachedConfig;
  }

  try {
    const configUrl = chrome.runtime.getURL("config.json");
    const configResponse = await fetch(configUrl);
    if (!configResponse.ok) {
      cachedConfig = defaultConfig;
      return cachedConfig;
    }

    const fileConfig = await configResponse.json();
    if (!fileConfig || fileConfig.useConfig !== true) {
      cachedConfig = defaultConfig;
      return cachedConfig;
    }

    cachedConfig = {
      ...defaultConfig,
      ...fileConfig,
      dataToRemove: {
        ...defaultConfig.dataToRemove,
        ...(fileConfig.dataToRemove || {})
      }
    };
    return cachedConfig;
  } catch (error) {
    cachedConfig = defaultConfig;
    return cachedConfig;
  }
}

function getActiveTab() {
  return new Promise((resolve, reject) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }

      const [tab] = tabs;
      if (!tab) {
        reject(new Error("No active tab found."));
        return;
      }

      resolve(tab);
    });
  });
}

function removeBrowserDataForOrigin(origin, dataToRemove) {
  const options = {
    origins: [origin]
  };

  return new Promise((resolve, reject) => {
    chrome.browsingData.remove(options, dataToRemove, () => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }

      resolve();
    });
  });
}

async function clearInPageStorage(tabId) {
  const scriptFn = () => {
    const jobs = [];

    jobs.push(
      Promise.resolve().then(() => {
        try {
          localStorage.clear();
        } catch (error) {
          // Ignore unavailable storage contexts.
        }
      })
    );

    jobs.push(
      Promise.resolve().then(() => {
        try {
          sessionStorage.clear();
        } catch (error) {
          // Ignore unavailable storage contexts.
        }
      })
    );

    jobs.push(
      Promise.resolve().then(async () => {
        try {
          if ("caches" in globalThis) {
            const keys = await caches.keys();
            await Promise.all(keys.map((key) => caches.delete(key)));
          }
        } catch (error) {
          // Ignore cache API failures.
        }
      })
    );

    jobs.push(
      Promise.resolve().then(async () => {
        try {
          if ("indexedDB" in globalThis && indexedDB.databases) {
            const databases = await indexedDB.databases();
            const dbNames = databases
              .map((db) => db && db.name)
              .filter((name) => typeof name === "string");
            await Promise.all(dbNames.map((name) => indexedDB.deleteDatabase(name)));
          }
        } catch (error) {
          // Ignore IndexedDB API failures.
        }
      })
    );

    jobs.push(
      Promise.resolve().then(async () => {
        try {
          if ("serviceWorker" in navigator) {
            const registrations = await navigator.serviceWorker.getRegistrations();
            await Promise.all(registrations.map((registration) => registration.unregister()));
          }
        } catch (error) {
          // Ignore service worker API failures.
        }
      })
    );

    return Promise.allSettled(jobs);
  };

  return new Promise((resolve, reject) => {
    chrome.scripting.executeScript(
      {
        target: { tabId, allFrames: true },
        func: scriptFn
      },
      () => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }

        resolve();
      }
    );
  });
}

async function deleteCurrentSiteData() {
  const tab = await getActiveTab();
  const url = tab.url || "";
  const config = await getConfig();

  if (!url.startsWith("http://") && !url.startsWith("https://")) {
    throw new Error("Current tab is not an http/https page.");
  }

  const origin = new URL(url).origin;

  await removeBrowserDataForOrigin(origin, config.dataToRemove);
  await clearInPageStorage(tab.id);

  if (config.reloadAfterDelete === true) {
    await new Promise((resolve, reject) => {
      chrome.tabs.reload(tab.id, {}, () => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }

        resolve();
      });
    });
  }
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!message || message.type !== DELETE_MESSAGE_TYPE) {
    return;
  }

  (async () => {
    try {
      await deleteCurrentSiteData();
      sendResponse({ ok: true });
    } catch (error) {
      sendResponse({
        ok: false,
        error: error?.message || "Failed to clear site data."
      });
    }
  })();

  return true;
});
