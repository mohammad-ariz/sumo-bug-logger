// Chrome Extension Auto-Reloader
// Add this script to your background.js for automatic reloading during development

class ExtensionReloader {
  constructor() {
    this.isEnabled = !chrome.runtime.getManifest().update_url; // Only in dev mode
    this.watchInterval = 2000; // Check every 2 seconds
    this.files = [
      "manifest.json",
      "popup.js",
      "content.js",
      "background.js",
      "index.html",
      "constants/ownerInfo.js",
    ];
    this.timestamps = new Map();

    if (this.isEnabled) {
      this.init();
    }
  }

  async init() {
    console.log("🔥 Extension Auto-Reloader initialized");
    await this.recordInitialTimestamps();
    this.startWatching();
  }

  async recordInitialTimestamps() {
    for (const file of this.files) {
      try {
        const response = await fetch(chrome.runtime.getURL(file));
        const lastModified = response.headers.get("last-modified");
        if (lastModified) {
          this.timestamps.set(file, new Date(lastModified).getTime());
          console.log(`📄 Tracking: ${file}`);
        }
      } catch (error) {
        // File might not exist, continue
      }
    }
  }

  async checkForChanges() {
    for (const file of this.files) {
      try {
        const response = await fetch(
          chrome.runtime.getURL(file) + "?t=" + Date.now()
        );
        const lastModified = response.headers.get("last-modified");

        if (lastModified) {
          const currentTimestamp = new Date(lastModified).getTime();
          const previousTimestamp = this.timestamps.get(file);

          if (previousTimestamp && currentTimestamp > previousTimestamp) {
            console.log(`🔄 File changed: ${file} - Reloading extension...`);
            chrome.runtime.reload();
            return;
          }

          this.timestamps.set(file, currentTimestamp);
        }
      } catch (error) {
        // Ignore errors (file might be temporarily unavailable)
      }
    }
  }

  startWatching() {
    setInterval(() => {
      this.checkForChanges();
    }, this.watchInterval);

    console.log(`👀 Watching ${this.files.length} files for changes...`);
  }
}

// Auto-start the reloader if in development mode
if (typeof module === "undefined") {
  // We're in the browser extension context
  new ExtensionReloader();
}

// Export for Node.js if needed
if (typeof module !== "undefined") {
  module.exports = ExtensionReloader;
}
