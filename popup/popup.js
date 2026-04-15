const deleteSiteDataButton = document.getElementById("deleteSiteDataButton");
const statusMessage = document.getElementById("statusMessage");

function setStatus(text, isError = false) {
  statusMessage.textContent = text;
  statusMessage.style.color = isError ? "#b3261e" : "#1f1f1f";
}

async function deleteCurrentSiteData() {
  deleteSiteDataButton.disabled = true;
  setStatus("Deleting site data...");
  window.close();

  try {
    const response = await chrome.runtime.sendMessage({
      type: "DELETE_CURRENT_SITE_DATA"
    });

    if (!response || !response.ok) {
      throw new Error(response?.error || "Unknown deletion error.");
    }

    setStatus("Site data removed successfully.");
  } catch (error) {
    setStatus(error.message || "Deletion failed.", true);
  } finally {
    deleteSiteDataButton.disabled = false;
  }
}

deleteSiteDataButton.addEventListener("click", deleteCurrentSiteData);
