const fs = require("node:fs");
const path = require("node:path");

const root = __dirname;

const requiredFiles = [
  "manifest.json",
  "config.json",
  "popup/popup.html",
  "popup/popup.css",
  "popup/popup.js",
  "src/background.js"
];

function assertFileExists(relativePath) {
  const fullPath = path.join(root, relativePath);
  if (!fs.existsSync(fullPath)) {
    throw new Error(`Missing required file: ${relativePath}`);
  }
}

function validateManifest() {
  const manifestPath = path.join(root, "manifest.json");
  const manifestRaw = fs.readFileSync(manifestPath, "utf8");
  const manifest = JSON.parse(manifestRaw);

  if (manifest.manifest_version !== 3) {
    throw new Error("Manifest must be version 3.");
  }

  const expectedPermissions = ["activeTab", "tabs", "browsingData", "scripting"];
  for (const permission of expectedPermissions) {
    if (!manifest.permissions.includes(permission)) {
      throw new Error(`Missing permission: ${permission}`);
    }
  }

  if (manifest.action?.default_popup !== "popup/popup.html") {
    throw new Error("Popup path is not set correctly.");
  }

  if (manifest.background?.service_worker !== "src/background.js") {
    throw new Error("Background service worker path is not set correctly.");
  }
}

function runChecks() {
  for (const file of requiredFiles) {
    assertFileExists(file);
  }
  validateManifest();
}

try {
  runChecks();
  console.log("Debug check passed: extension structure looks valid.");
} catch (error) {
  console.error(`Debug check failed: ${error.message}`);
  process.exitCode = 1;
}
