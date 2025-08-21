console.log("Sumo Bug Logger background service worker loaded");

// Hot Reload for Development
if (!chrome.runtime.getManifest().update_url) {
  // We're in development mode, enable hot reload
  const RELOAD_DELAY = 1000;
  let reloadTimer = null;

  function scheduleReload() {
    if (reloadTimer) clearTimeout(reloadTimer);
    reloadTimer = setTimeout(() => {
      console.log("🔄 Hot reloading extension...");
      chrome.runtime.reload();
    }, RELOAD_DELAY);
  }

  // Auto-reloader for file changes
  class ExtensionReloader {
    constructor() {
      this.watchInterval = 2000;
      this.files = [
        "manifest.json",
        "popup.js",
        "content.js",
        "background.js",
        "index.html",
      ];
      this.timestamps = new Map();
      this.init();
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
          // Ignore errors
        }
      }
    }

    startWatching() {
      setInterval(() => {
        this.checkForChanges();
      }, this.watchInterval);
      console.log(`� Watching for file changes...`);
    }
  }

  new ExtensionReloader();
}

// Global state management
let networkRecording = {};
let consoleRecording = {};
let recordingTabs = new Set();
let recordingStates = {};

// Chrome runtime startup
chrome.runtime.onStartup.addListener(() => {
  console.log("Extension startup");
});

chrome.runtime.onInstalled.addListener(() => {
  console.log("Extension installed/updated");
});

// Listen for messages from popup and content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log("Background received message:", request);

  switch (request.action) {
    case "componentSelected":
      handleComponentSelected(request, sendResponse);
      break;

    case "getRecordingState":
      handleGetRecordingState(request, sendResponse);
      break;

    case "startNetworkRecording":
      handleStartNetworkRecording(request, sendResponse);
      break;

    case "stopNetworkRecording":
      handleStopNetworkRecording(request, sendResponse);
      break;

    case "startConsoleRecording":
      handleStartConsoleRecording(request, sendResponse);
      break;

    case "stopConsoleRecording":
      handleStopConsoleRecording(request, sendResponse);
      break;

    case "getRecordingStats":
      handleGetRecordingStats(request, sendResponse);
      break;

    case "clearAllData":
      handleClearAllData(request, sendResponse);
      break;

    case "openPopupToStep2":
      handleOpenPopupToStep2(request, sendResponse);
      break;

    case "contentScriptReady":
      console.log("Content script ready on tab:", sender.tab?.id);
      sendResponse({ success: true });
      break;

    default:
      console.warn("Unknown action:", request.action);
      sendResponse({ success: false, error: "Unknown action" });
  }

  return true; // Keep message channel open for async responses
});

// Component Selection Handler
function handleComponentSelected(request, sendResponse) {
  try {
    console.log("Component selected:", request.data);

    let message = "Bug component selected!";
    if (request.data && request.data.componentName) {
      message += ` Component: ${request.data.componentName}`;
    }
    if (request.data && request.data.teamOwner) {
      message += ` (${request.data.teamOwner})`;
    }

    // Show notification
    chrome.notifications.create({
      type: "basic",
      iconUrl: "icons/bug.png",
      title: "Sumo Bug Logger",
      message: message,
    }, (notificationId) => {
      if (chrome.runtime.lastError) {
        console.error('Notification error:', chrome.runtime.lastError);
      } else {
        console.log('Notification created:', notificationId);
      }
    });

    console.log('Sending success response to content script');
    sendResponse({ success: true });
  } catch (error) {
    console.error('Error in handleComponentSelected:', error);
    sendResponse({ success: false, error: error.message });
  }
}

// Recording State Handler
function handleGetRecordingState(request, sendResponse) {
  const tabId = request.tabId;
  const isRecording = recordingTabs.has(tabId);

  sendResponse({
    isRecording: isRecording,
    recordingState: recordingStates[tabId] || null,
  });
}

// Network Recording Handlers
async function handleStartNetworkRecording(request, sendResponse) {
  const tabId = request.tabId;

  try {
    console.log("Starting network recording for tab:", tabId);

    // Check if already recording for this tab
    if (networkRecording[tabId]) {
      console.log("Already recording for this tab");
      sendResponse({ success: true });
      return;
    }

    // Enable debugger for network monitoring
    await chrome.debugger.attach({ tabId: tabId }, "1.3");

    // Enable network domain
    await chrome.debugger.sendCommand({ tabId: tabId }, "Network.enable");

    // Enable all network events
    await chrome.debugger.sendCommand(
      { tabId: tabId },
      "Network.clearBrowserCache"
    );

    // Initialize recording state
    networkRecording[tabId] = {
      startTime: Date.now(),
      requests: [],
      responses: [],
    };

    recordingTabs.add(tabId);
    recordingStates[tabId] = {
      networkRecording: true,
      startTime: Date.now(),
    };

    // Ensure we have the network event listener
    if (!chrome.debugger.onEvent.hasListener(onNetworkEvent)) {
      chrome.debugger.onEvent.addListener(onNetworkEvent);
    }

    console.log(`Network recording initialized for tab ${tabId}`);

    sendResponse({ success: true });
  } catch (error) {
    console.error("Error starting network recording:", error);
    sendResponse({ success: false, error: error.message });
  }
}

async function handleStopNetworkRecording(request, sendResponse) {
  const tabId = request.tabId;

  try {
    console.log("Stopping network recording for tab:", tabId);

    // Disable debugger
    await chrome.debugger.detach({ tabId: tabId });

    // Get recorded data
    const recordedData = networkRecording[tabId];

    // Combine requests and responses into a single array
    let networkCalls = [];
    if (recordedData) {
      // Add all requests
      networkCalls = [...(recordedData.requests || [])];
      // Add all responses
      networkCalls = [...networkCalls, ...(recordedData.responses || [])];

      console.log(
        `Retrieved ${networkCalls.length} network events (${
          recordedData.requests?.length || 0
        } requests, ${recordedData.responses?.length || 0} responses)`
      );
    }

    // Clean up recording state
    delete networkRecording[tabId];
    recordingTabs.delete(tabId);
    if (recordingStates[tabId]) {
      recordingStates[tabId].networkRecording = false;
    }

    sendResponse({
      success: true,
      networkCalls: networkCalls,
      duration: recordedData ? Date.now() - recordedData.startTime : 0,
    });
  } catch (error) {
    console.error("Error stopping network recording:", error);
    sendResponse({ success: false, error: error.message });
  }
}

// Console Recording Handlers
async function handleStartConsoleRecording(request, sendResponse) {
  const tabId = request.tabId;

  try {
    console.log("Starting console recording for tab:", tabId);

    // Initialize console recording
    consoleRecording[tabId] = {
      startTime: Date.now(),
      logs: [],
    };

    if (recordingStates[tabId]) {
      recordingStates[tabId].consoleRecording = true;
    }

    // Inject console monitoring script
    await chrome.scripting.executeScript({
      target: { tabId: tabId },
      func: injectConsoleMonitor,
    });

    sendResponse({ success: true });
  } catch (error) {
    console.error("Error starting console recording:", error);
    sendResponse({ success: false, error: error.message });
  }
}

async function handleStopConsoleRecording(request, sendResponse) {
  const tabId = request.tabId;

  try {
    console.log("Stopping console recording for tab:", tabId);

    // Get console logs from injected script
    const results = await chrome.scripting.executeScript({
      target: { tabId: tabId },
      func: getConsoleData,
    });

    const consoleLogs = results[0]?.result || [];

    // Clean up console recording state
    delete consoleRecording[tabId];
    if (recordingStates[tabId]) {
      recordingStates[tabId].consoleRecording = false;
    }

    sendResponse({
      success: true,
      consoleLogs: consoleLogs,
    });
  } catch (error) {
    console.error("Error stopping console recording:", error);
    sendResponse({ success: false, error: error.message });
  }
}

// Recording Stats Handler
function handleGetRecordingStats(request, sendResponse) {
  const tabId = request.tabId;
  const networkData = networkRecording[tabId];
  const consoleData = consoleRecording[tabId];

  let stats = {
    networkCount: 0,
    errorCount: 0,
    warningCount: 0,
  };

  if (networkData) {
    stats.networkCount = networkData.requests.length;
  }

  if (consoleData) {
    stats.errorCount = consoleData.logs.filter(
      (log) => log.level === "error"
    ).length;
    stats.warningCount = consoleData.logs.filter(
      (log) => log.level === "warning"
    ).length;
  }

  sendResponse(stats);
}

// Clear Data Handler
async function handleClearAllData(request, sendResponse) {
  try {
    // Stop all recordings
    for (const tabId of recordingTabs) {
      try {
        await chrome.debugger.detach({ tabId: parseInt(tabId) });
      } catch (error) {
        console.warn("Error detaching debugger from tab:", tabId, error);
      }
    }

    // Clear all state
    networkRecording = {};
    consoleRecording = {};
    recordingTabs.clear();
    recordingStates = {};

    sendResponse({ success: true });
  } catch (error) {
    console.error("Error clearing all data:", error);
    sendResponse({ success: false, error: error.message });
  }
}

// Open Popup Handler
async function handleOpenPopupToStep2(request, sendResponse) {
  try {
    // Get the current active tab
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });

    if (tab) {
      // Start recording automatically
      await handleStartRecording({ tabId: tab.id }, () => {});

      // Store the step navigation intent
      await chrome.storage.local.set({
        navigateToStep: 2,
        autoStartedRecording: true,
        recordingTabId: tab.id,
      });

      console.log("Successfully started recording for toast-initiated session");
    }

    sendResponse({ success: true });
  } catch (error) {
    console.error("Error starting recording from toast:", error);
    sendResponse({ success: false, error: error.message });
  }
}

// Network Event Handler
function onNetworkEvent(debuggeeId, method, params) {
  const tabId = debuggeeId.tabId;

  if (!networkRecording[tabId]) {
    console.log(
      `Network event ${method} received but no recording for tab ${tabId}`
    );
    return;
  }

  console.log(`Network event: ${method} for tab ${tabId}`);

  if (method === "Network.requestWillBeSent") {
    const request = {
      requestId: params.requestId,
      url: params.request.url,
      method: params.request.method,
      headers: params.request.headers,
      timestamp: params.timestamp,
      type: "request",
    };

    networkRecording[tabId].requests.push(request);
    console.log(`Added request: ${request.method} ${request.url}`);
  }

  if (method === "Network.responseReceived") {
    const response = {
      requestId: params.requestId,
      url: params.response.url,
      status: params.response.status,
      statusText: params.response.statusText,
      headers: params.response.headers,
      mimeType: params.response.mimeType,
      timestamp: params.timestamp,
      type: "response",
    };

    networkRecording[tabId].responses.push(response);
    console.log(`Added response: ${response.status} ${response.url}`);
  }

  if (method === "Network.loadingFailed") {
    const failure = {
      requestId: params.requestId,
      errorText: params.errorText,
      timestamp: params.timestamp,
      type: "failure",
    };

    networkRecording[tabId].requests.push(failure);
    console.log(`Added failure: ${failure.errorText}`);
  }
}

// Console monitoring functions (injected into pages)
function injectConsoleMonitor() {
  // Store original console methods
  window.sumoOriginalConsole = {
    log: console.log,
    warn: console.warn,
    error: console.error,
    info: console.info,
  };

  // Array to store console logs
  window.sumoConsoleLogs = window.sumoConsoleLogs || [];

  // Override console methods
  ["log", "warn", "error", "info"].forEach((method) => {
    console[method] = function (...args) {
      // Call original method
      window.sumoOriginalConsole[method].apply(console, args);

      // Store log entry
      window.sumoConsoleLogs.push({
        level: method,
        message: args
          .map((arg) =>
            typeof arg === "object" ? JSON.stringify(arg) : String(arg)
          )
          .join(" "),
        timestamp: Date.now(),
        url: window.location.href,
      });

      // Limit log entries to prevent memory issues
      if (window.sumoConsoleLogs.length > 1000) {
        window.sumoConsoleLogs = window.sumoConsoleLogs.slice(-500);
      }
    };
  });

  // Listen for uncaught errors
  window.addEventListener("error", (event) => {
    window.sumoConsoleLogs.push({
      level: "error",
      message: `Uncaught Error: ${event.error?.message || event.message}`,
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
      timestamp: Date.now(),
      url: window.location.href,
    });
  });

  // Listen for unhandled promise rejections
  window.addEventListener("unhandledrejection", (event) => {
    window.sumoConsoleLogs.push({
      level: "error",
      message: `Unhandled Promise Rejection: ${event.reason}`,
      timestamp: Date.now(),
      url: window.location.href,
    });
  });
}

function getConsoleData() {
  return window.sumoConsoleLogs || [];
}

// Tab cleanup
chrome.tabs.onRemoved.addListener((tabId) => {
  // Clean up recording state for closed tabs
  if (recordingTabs.has(tabId)) {
    recordingTabs.delete(tabId);
    delete networkRecording[tabId];
    delete consoleRecording[tabId];
    delete recordingStates[tabId];
  }
});

// Extension lifecycle
chrome.runtime.onSuspend.addListener(() => {
  console.log("Extension suspending, cleaning up...");
  // Clean up any active debugger sessions
  for (const tabId of recordingTabs) {
    try {
      chrome.debugger.detach({ tabId: parseInt(tabId) });
    } catch (error) {
      console.warn("Error detaching debugger during suspend:", error);
    }
  }
});
