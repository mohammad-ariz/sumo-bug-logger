# Hot Reload Setup Guide

## Overview

Your Sumo Bug Logger extension now includes **automatic hot reload** functionality that will automatically refresh the extension when you make changes to the code files. No more manual "Reload" button clicking! 🎉

## How It Works

The extension includes built-in file watching that monitors these files for changes:

- `manifest.json`
- `popup.js`
- `content.js`
- `background.js`
- `index.html`
- `constants/ownerInfo.js`

When any of these files are modified, the extension automatically reloads itself within 2 seconds.

## Setup Instructions

### Option 1: Built-in Auto-Reload (Recommended)

1. **Load the extension** in Chrome:

   ```
   1. Open chrome://extensions/
   2. Enable "Developer mode"
   3. Click "Load unpacked"
   4. Select your extension folder
   ```

2. **Open Chrome DevTools** to see reload messages:

   ```
   1. Right-click on extension icon → "Inspect popup"
   2. OR open chrome://extensions/ → Click "background page" under your extension
   3. Watch the console for reload messages
   ```

3. **Start developing**:
   - Make changes to any watched file
   - Save the file
   - Extension automatically reloads within 2 seconds
   - You'll see "🔄 File changed: filename - Reloading extension..." in console

### Option 2: External File Watcher (Alternative)

If you prefer an external watcher, you can use the Node.js version:

1. **Install Node.js** (if not already installed)

2. **Run the watcher**:

   ```bash
   cd /path/to/sumo-bug-logger
   npm run watch
   # OR
   node watch-extension.js
   ```

3. **Keep the terminal open** while developing

## Development Workflow

1. **Initial Setup**:

   - Load extension in Chrome (Developer mode)
   - Open extension DevTools console (optional, to see reload messages)

2. **Development Loop**:

   ```
   Edit file → Save → Extension auto-reloads → Test changes
   ```

3. **No manual intervention needed!** ✨

## Troubleshooting

### Hot Reload Not Working?

1. **Check file permissions**: Ensure files are writable
2. **Verify console messages**: Look for reload logs in extension DevTools
3. **Manual reload**: If stuck, manually reload extension once
4. **File system delays**: Some editors may take a moment to save files

### Console Messages to Look For

```
🔥 Extension Auto-Reloader initialized
👀 Watching for file changes...
🔄 File changed: popup.js - Reloading extension...
```

### Common Issues

- **Editor autosave**: Make sure your editor actually saves files (some have delayed autosave)
- **File locks**: Close any programs that might lock the files
- **Network drives**: Hot reload works best with local file systems

## Performance Notes

- Hot reload only activates in development mode (when `update_url` is not present in manifest)
- File checking happens every 2 seconds to balance responsiveness and performance
- Only watches essential extension files, not all project files

## Benefits

✅ **Faster development** - No manual reloading
✅ **Immediate feedback** - See changes within seconds  
✅ **Consistent state** - Extension properly reinitializes
✅ **Error visibility** - Console shows what changed
✅ **Zero configuration** - Works out of the box

Now you can develop your extension with lightning-fast iteration cycles! 🚀
