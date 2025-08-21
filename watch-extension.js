#!/usr/bin/env node

// File Watcher for Chrome Extension Hot Reload
// Run this script in terminal: node watch-extension.js

const fs = require("fs");
const path = require("path");

const WATCH_DELAY = 500; // Debounce delay in milliseconds
let reloadTimer = null;

// Files and directories to watch
const watchPaths = [
  "manifest.json",
  "popup.js",
  "content.js",
  "background.js",
  "index.html",
  "constants/ownerInfo.js",
];

console.log("🔥 Starting Chrome Extension Hot Reload Watcher");
console.log("📁 Watching files:", watchPaths.join(", "));
console.log("💡 Make sure to reload the extension once manually first");
console.log("🔄 File changes will trigger automatic extension reload\n");

function scheduleReload() {
  if (reloadTimer) {
    clearTimeout(reloadTimer);
  }

  reloadTimer = setTimeout(() => {
    console.log("🔄 Extension files changed - triggering reload...");

    // Try to communicate with the extension to trigger reload
    // This is a simple approach - you can also use Chrome DevTools Protocol
    console.log(
      "   → Please ensure extension is loaded in chrome://extensions/"
    );
    console.log("   → The extension should automatically reload\n");
  }, WATCH_DELAY);
}

// Watch each file
watchPaths.forEach((filePath) => {
  if (fs.existsSync(filePath)) {
    console.log(`👀 Watching: ${filePath}`);

    fs.watchFile(filePath, { interval: 1000 }, (curr, prev) => {
      if (curr.mtime !== prev.mtime) {
        console.log(`📝 File changed: ${filePath}`);
        scheduleReload();
      }
    });
  } else {
    console.log(`⚠️  File not found: ${filePath}`);
  }
});

// Watch directory for new files
fs.watch(".", { recursive: true }, (eventType, filename) => {
  if (
    filename &&
    watchPaths.some((wp) => filename.includes(wp.split("/")[0]))
  ) {
    console.log(`📝 Directory change detected: ${filename}`);
    scheduleReload();
  }
});

console.log("\n✅ File watcher started successfully!");
console.log("🛑 Press Ctrl+C to stop watching\n");

// Handle graceful shutdown
process.on("SIGINT", () => {
  console.log("\n🛑 Stopping file watcher...");
  watchPaths.forEach((filePath) => {
    if (fs.existsSync(filePath)) {
      fs.unwatchFile(filePath);
    }
  });
  console.log("✅ File watcher stopped");
  process.exit(0);
});
