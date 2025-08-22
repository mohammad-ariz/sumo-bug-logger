# Component Selection Troubleshooting Guide

## Current Issue
Component selection was working earlier but is now not functioning properly.

## Recent Changes Made
1. ✅ Added `showTooltip()` function that was missing
2. ✅ Updated manifest.json to include `localhost:8080` 
3. ✅ Updated popup.js URL validation to allow `localhost:8080`
4. ✅ Started HTTP server on port 8080 for testing
5. ✅ Added comprehensive debug logging

## Troubleshooting Steps

### Step 1: Reload the Extension
Since we modified `manifest.json`, the extension needs to be reloaded:
1. Open Chrome and navigate to `chrome://extensions/`
2. Find "Sumo Bug Logger" extension
3. Click the reload button (🔄) or toggle off/on
4. Verify extension shows as "Enabled"

### Step 2: Test on Correct URL
- ❌ Don't test on `file://` URLs (not supported)
- ✅ Test on `http://localhost:8080/component-test.html`
- The HTTP server should be running: `python3 -m http.server 8080`

### Step 3: Check Console Logs
Open Chrome DevTools (F12) and check Console tab for:

**Expected Content Script Logs:**
```
Sumo Bug Logger content script loaded on: http://localhost:8080/component-test.html
Content script version: 2025-08-21
```

**Expected Message Flow:**
1. Click "Select Buggy Component" in popup
2. Console should show:
```
📨 Content script received message: {action: "startComponentSelection"}
🎯 Processing startComponentSelection request
🎯 Starting component selection mode
Current URL: http://localhost:8080/component-test.html
✅ Cursor set to pointer
✅ Page interactions disabled
✅ Selection overlay created
✅ Toast notification shown
🚀 Component selection mode activated
```

### Step 4: Check for Error Messages

**Common Issues:**

1. **"Error: Could not establish connection"**
   - Content script not loaded
   - Wrong URL or extension not reloaded
   - Check if URL matches manifest patterns

2. **"Extension context invalidated"**
   - Extension was reloaded while popup was open
   - Close popup and try again

3. **No hover effects or tooltips**
   - Check if overlay was created: `document.getElementById('sumo-component-selection-overlay')`
   - Check if event listeners are attached
   - Look for JavaScript errors in console

### Step 5: Test Component Detection
1. Open test page: `http://localhost:8080/component-test.html`
2. Open Chrome DevTools Console
3. Click extension popup and "Select Buggy Component"
4. Move mouse over colored components
5. Should see console logs when hovering over components

### Step 6: Manual Debug Commands
In Chrome DevTools Console, run:

```javascript
// Check if content script loaded
console.log('Content script loaded:', typeof startComponentSelection);

// Check if overlay exists
console.log('Overlay exists:', !!document.getElementById('sumo-component-selection-overlay'));

// Check if selection mode is active  
console.log('Selection mode:', window.isSelecting);

// Manually start selection (for testing)
if (typeof startComponentSelection === 'function') {
  startComponentSelection();
}
```

## Files Modified for Fix

1. **`manifest.json`** - Added `localhost:8080` to content_scripts and host_permissions
2. **`popup.js`** - Added `localhost:8080` to URL validation  
3. **`content.js`** - Added comprehensive debug logging
4. **HTTP Server** - Started on port 8080 instead of using file:// URLs

## Expected Working Flow

1. 🌐 Navigate to `http://localhost:8080/component-test.html`
2. 🔌 Click extension icon to open popup
3. 🎯 Click "Select Buggy Component" button
4. 🔄 Popup closes after 1 second
5. 🎨 Move mouse over colored component containers
6. 🔴 Should see red outlines with shadow effects
7. 💬 Should see tooltips with component name and team info
8. 👆 Click on highlighted component to select it
9. ✅ Should see success toast and selection completes

## Next Steps If Still Not Working

1. Check Chrome extension permissions
2. Try in incognito mode
3. Check if other extensions are interfering
4. Clear browser cache and cookies
5. Try a different browser profile
