console.log('Background service worker loaded');

let networkRecording = {};
let recordingTabs = new Set();
let recordingStates = {}; // Track recording states per tab

// Listen for extension icon clicks
chrome.action.onClicked.addListener(async (tab) => {
  console.log('Extension icon clicked');
});

// Listen for messages from popup and content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Background received message:', request);
  
  if (request.action === 'regionSelected') {
    console.log('Region selected:', request.data);
    
    let message = 'Bug region selected!';
    if (request.data.ownerId) {
      message += ` Owner: ${request.data.ownerId}`;
    }
    if (request.data.teamName) {
      message += ` (${request.data.teamName})`;
    }
    if (request.data.managerName) {
      message += ` - Manager: ${request.data.managerName}`;
    }
    
    // Show notification with enhanced info
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icons/bug.png',
      title: 'Sumo Bug Logger',
      message: message
    });
    
    sendResponse({ success: true });
  }
  
  if (request.action === 'getRecordingState') {
    const tabId = request.tabId;
    const isRecording = recordingTabs.has(tabId);
    sendResponse({ 
      isRecording: isRecording,
      recordingState: recordingStates[tabId] || null 
    });
  }
  
  if (request.action === 'startNetworkRecording') {
    startNetworkRecording(request.tabId)
      .then(() => {
        recordingStates[request.tabId] = {
          startTime: new Date().toISOString(),
          status: 'recording'
        };
        sendResponse({ success: true });
      })
      .catch(error => sendResponse({ success: false, error: error.message }));
    
    return true;
  }
  
  if (request.action === 'stopNetworkRecording') {
    stopNetworkRecording(request.tabId)
      .then(networkCalls => {
        delete recordingStates[request.tabId];
        chrome.storage.local.set({ networkData: networkCalls }, () => {
          sendResponse({ success: true, networkCalls: networkCalls });
        });
      })
      .catch(error => sendResponse({ success: false, error: error.message }));
    
    return true;
  }
  
  if (request.action === 'clearNetworkData') {
    networkRecording = {};
    recordingTabs.clear();
    recordingStates = {};
    sendResponse({ success: true });
  }
});

async function startNetworkRecording(tabId) {
  console.log('Starting network recording for tab:', tabId);
  
  try {
    await chrome.debugger.attach({ tabId: tabId }, "1.0");
    await chrome.debugger.sendCommand({ tabId: tabId }, "Network.enable");
    
    networkRecording[tabId] = [];
    recordingTabs.add(tabId);
    
    console.log('Network recording started for tab:', tabId);
    
    // Show persistent notification
    chrome.notifications.create(`recording-${tabId}`, {
      type: 'basic',
      iconUrl: 'icons/bug.png',
      title: 'Sumo Bug Logger',
      message: '🔴 Recording network activity... Click extension to stop.'
    });
    
  } catch (error) {
    console.error('Error starting network recording:', error);
    throw error;
  }
}

async function stopNetworkRecording(tabId) {
  console.log('Stopping network recording for tab:', tabId);
  
  try {
    await chrome.debugger.sendCommand({ tabId: tabId }, "Network.disable");
    await chrome.debugger.detach({ tabId: tabId });
    
    const recordedCalls = networkRecording[tabId] || [];
    
    delete networkRecording[tabId];
    recordingTabs.delete(tabId);
    
    console.log('Network recording stopped. Captured calls:', recordedCalls.length);
    
    // Clear the recording notification
    chrome.notifications.clear(`recording-${tabId}`);
    
    // Show completion notification
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icons/bug.png',
      title: 'Sumo Bug Logger',
      message: `✅ Recording stopped. Captured ${recordedCalls.length} network calls with 'search' in URL.`
    });
    
    return recordedCalls;
  } catch (error) {
    console.error('Error stopping network recording:', error);
    throw error;
  }
}

// Listen for debugger events
chrome.debugger.onEvent.addListener((source, method, params) => {
  const tabId = source.tabId;
  
  if (recordingTabs.has(tabId)) {
    if (method === 'Network.requestWillBeSent') {
      const request = params.request;
      
      if (request.url.toLowerCase().includes('search')) {
        const networkCall = {
          requestId: params.requestId,
          url: request.url,
          method: request.method,
          headers: request.headers,
          timestamp: new Date().toISOString(),
          type: 'request'
        };
        
        networkRecording[tabId].push(networkCall);
        console.log('Captured network request:', request.url);
        
        // Update recording count in notification
        const currentCount = networkRecording[tabId].length;
        chrome.notifications.update(`recording-${tabId}`, {
          message: `🔴 Recording... ${currentCount} search calls captured. Click extension to stop.`
        });
      }
    }
    
    if (method === 'Network.responseReceived') {
      const response = params.response;
      
      if (response.url.toLowerCase().includes('search')) {
        const requests = networkRecording[tabId];
        const requestIndex = requests.findIndex(req => req.requestId === params.requestId);
        
        if (requestIndex !== -1) {
          requests[requestIndex].status = response.status;
          requests[requestIndex].statusText = response.statusText;
          requests[requestIndex].responseHeaders = response.headers;
          requests[requestIndex].mimeType = response.mimeType;
        }
        
        console.log('Captured network response:', response.url, response.status);
      }
    }
  }
});

// Clean up when tab is closed
chrome.tabs.onRemoved.addListener((tabId) => {
  if (recordingTabs.has(tabId)) {
    recordingTabs.delete(tabId);
    delete networkRecording[tabId];
    delete recordingStates[tabId];
    chrome.notifications.clear(`recording-${tabId}`);
  }
});

// Handle debugger detach (e.g., when user navigates away or refreshes)
chrome.debugger.onDetach.addListener((source, reason) => {
  const tabId = source.tabId;
  if (recordingTabs.has(tabId)) {
    console.log(`Debugger detached from tab ${tabId}, reason: ${reason}`);
    recordingTabs.delete(tabId);
    delete networkRecording[tabId];
    delete recordingStates[tabId];
    chrome.notifications.clear(`recording-${tabId}`);
  }
});