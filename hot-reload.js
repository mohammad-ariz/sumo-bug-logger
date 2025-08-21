// Hot Reload Script for Chrome Extension Development
// This script watches for file changes and automatically reloads the extension

const RELOAD_DELAY = 1000; // 1 second delay to avoid rapid reloads
let reloadTimer = null;

// Watch for changes in the extension files
function setupHotReload() {
  const extensionId = chrome.runtime.id;

  // List of files to watch for changes
  const watchFiles = [
    "manifest.json",
    "popup.js",
    "content.js",
    "background.js",
    "index.html",
    "constants/ownerInfo.js",
  ];

  // Store file modification times
  const fileTimestamps = new Map();

  // Function to check file modifications
  async function checkForChanges() {
    try {
      for (const file of watchFiles) {
        const response = await fetch(chrome.runtime.getURL(file));
        const lastModified = response.headers.get("last-modified");

        if (lastModified) {
          const timestamp = new Date(lastModified).getTime();
          const previousTimestamp = fileTimestamps.get(file);

          if (previousTimestamp && timestamp > previousTimestamp) {
            console.log(`File changed: ${file}`);
            scheduleReload();
            return;
          }

          fileTimestamps.set(file, timestamp);
        }
      }
    } catch (error) {
      // Silently handle errors (file might not exist or be accessible)
    }
  }

  // Schedule a reload with debouncing
  function scheduleReload() {
    if (reloadTimer) {
      clearTimeout(reloadTimer);
    }

    reloadTimer = setTimeout(() => {
      console.log("🔄 Hot reloading extension...");
      chrome.runtime.reload();
    }, RELOAD_DELAY);
  }

  // Initialize file timestamps
  async function initializeTimestamps() {
    for (const file of watchFiles) {
      try {
        const response = await fetch(chrome.runtime.getURL(file));
        const lastModified = response.headers.get("last-modified");
        if (lastModified) {
          fileTimestamps.set(file, new Date(lastModified).getTime());
        }
      } catch (error) {
        // File might not exist, skip
      }
    }
  }

  // Start watching
  initializeTimestamps().then(() => {
    // Check for changes every 2 seconds
    setInterval(checkForChanges, 2000);
    console.log("🔥 Hot reload enabled - watching for file changes...");
  });
}

// Only enable hot reload in development
if (
  chrome.runtime.getManifest().name.includes("Dev") ||
  !("update_url" in chrome.runtime.getManifest())
) {
  setupHotReload();
}
