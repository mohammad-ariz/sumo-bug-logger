document.addEventListener('DOMContentLoaded', () => {
  const selectRegionBtn = document.getElementById('selectRegionBtn');
  const recordNetworkBtn = document.getElementById('recordNetworkBtn');
  const clearDataBtn = document.getElementById('clearDataBtn');
  const infoContent = document.getElementById('infoContent');
  const status = document.getElementById('status');
  const recordingIndicator = document.getElementById('recordingIndicator');
  
  let isRecording = false;
  let currentTabId = null;
  
  // Initialize popup
  initializePopup();
  
  async function initializePopup() {
    try {
      // Get current tab
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      currentTabId = tab.id;
      
      // Check if recording is already in progress
      const response = await chrome.runtime.sendMessage({ 
        action: 'getRecordingState', 
        tabId: currentTabId 
      });
      
      if (response && response.isRecording) {
        // Recording is in progress, update UI
        isRecording = true;
        recordNetworkBtn.textContent = '⏹️ Stop Recording Network Session';
        recordNetworkBtn.className = 'button danger-btn';
        recordingIndicator.classList.remove('hidden');
        showStatus('🔴 Recording in progress...', 'info');
        
        if (response.recordingState) {
          console.log('Recording state:', response.recordingState);
        }
      }
      
      // Load existing data
      await loadExistingData();
      
    } catch (error) {
      console.error('Error initializing popup:', error);
    }
  }
  
  selectRegionBtn.addEventListener('click', async () => {
    showStatus('Initializing region selection...', 'info');
    
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      if (!tab.url.includes('sumologic.com') && !tab.url.includes('localhost')) {
        showStatus('Please navigate to a Sumo Logic page first', 'error');
        return;
      }
      
      console.log('Attempting to send message to tab:', tab.id);
      
      // First try to inject content script manually
      try {
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ['content.js']
        });
        console.log('Content script injected successfully');
        
        // Wait a bit for the script to initialize
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (injectError) {
        console.log('Content script injection failed (might already be injected):', injectError);
      }
      
      // Now try to send message to content script
      try {
        const response = await chrome.tabs.sendMessage(tab.id, { 
          action: 'startRegionSelection' 
        });
        
        if (response && response.success) {
          showStatus('✅ Region selection started! Draw a rectangle around the buggy area.', 'success');
          // Close popup to allow user interaction with page
          setTimeout(() => window.close(), 1000);
        } else {
          showStatus('Error: Failed to start region selection', 'error');
        }
      } catch (messageError) {
        console.error('Error sending message:', messageError);
        showStatus('Error: Could not communicate with page. Please refresh and try again.', 'error');
      }
      
    } catch (error) {
      console.error('Error starting region selection:', error);
      showStatus('Error: ' + error.message, 'error');
    }
  });
  
  recordNetworkBtn.addEventListener('click', async () => {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      if (!isRecording) {
        // Start recording
        showStatus('Starting network recording...', 'info');
        const response = await chrome.runtime.sendMessage({ 
          action: 'startNetworkRecording',
          tabId: tab.id 
        });
        
        if (response && response.success) {
          isRecording = true;
          recordNetworkBtn.textContent = '⏹️ Stop Recording Network Session';
          recordNetworkBtn.className = 'button danger-btn';
          recordingIndicator.classList.remove('hidden');
          showStatus('✅ Network recording started! You can now close this popup and interact with the page.', 'success');
        } else {
          showStatus('Error: Could not start network recording', 'error');
        }
      } else {
        // Stop recording
        showStatus('Stopping network recording...', 'info');
        const response = await chrome.runtime.sendMessage({ 
          action: 'stopNetworkRecording',
          tabId: tab.id 
        });
        
        if (response && response.success) {
          isRecording = false;
          recordNetworkBtn.textContent = '🌐 Record Network Session';
          recordNetworkBtn.className = 'button secondary-btn';
          recordingIndicator.classList.add('hidden');
          showStatus(`✅ Recording stopped. Captured ${response.networkCalls.length} network calls`, 'success');
          
          // Update info box with network data
          await updateInfoBox();
        } else {
          showStatus('Error: Could not stop network recording', 'error');
        }
      }
    } catch (error) {
      console.error('Error with network recording:', error);
      showStatus('Error: ' + error.message, 'error');
      
      // Reset recording state
      isRecording = false;
      recordNetworkBtn.textContent = '🌐 Record Network Session';
      recordNetworkBtn.className = 'button secondary-btn';
      recordingIndicator.classList.add('hidden');
    }
  });
  
  clearDataBtn.addEventListener('click', async () => {
    try {
      await chrome.storage.local.clear();
      await chrome.runtime.sendMessage({ action: 'clearNetworkData' });
      
      infoContent.innerHTML = '<p style="color: #666; text-align: center;">Select a buggy region to start</p>';
      recordNetworkBtn.disabled = true;
      recordNetworkBtn.textContent = '🌐 Record Network Session';
      recordNetworkBtn.className = 'button secondary-btn';
      isRecording = false;
      recordingIndicator.classList.add('hidden');
      
      showStatus('✅ All data cleared successfully', 'success');
    } catch (error) {
      showStatus('Error clearing data: ' + error.message, 'error');
    }
  });
  
  async function loadExistingData() {
    try {
      const result = await chrome.storage.local.get(['bugRegionData', 'networkData']);
      
      if (result.bugRegionData || result.networkData) {
        await updateInfoBox();
        if (result.bugRegionData) {
          recordNetworkBtn.disabled = false;
        }
      }
    } catch (error) {
      console.error('Error loading data:', error);
    }
  }
  
  async function updateInfoBox() {
    try {
      const result = await chrome.storage.local.get(['bugRegionData', 'networkData']);
      let content = '';
      
      if (result.bugRegionData) {
        const data = result.bugRegionData;
        
        content += `
          <div class="info-item">
            <strong>🎯 Owner ID:</strong> ${data.ownerId || 'Not found'}
          </div>
        `;
        
        if (data.teamName) {
          content += `
            <div class="info-item">
              <strong>👥 Team Name:</strong> ${data.teamName}
            </div>
          `;
        }
        
        if (data.managerName) {
          content += `
            <div class="info-item">
              <strong>👤 Manager:</strong> ${data.managerName}
            </div>
          `;
        }
        
        content += `
          <div class="info-item">
            <strong>📍 Region:</strong> ${data.width}x${data.height} at (${data.x}, ${data.y})
          </div>
          <div class="info-item">
            <strong>🕒 Selected:</strong> ${new Date(data.timestamp).toLocaleString()}
          </div>
        `;
        
        recordNetworkBtn.disabled = false;
      }
      
      if (result.networkData && result.networkData.length > 0) {
        // Show network calls as a single object instead of list
        content += `
          <div class="info-item">
            <strong>🌐 Network Calls:</strong> 
            <br>
            <div style="background-color: #f5f5f5; padding: 10px; border-radius: 4px; margin-top: 8px; max-height: 200px; overflow-y: auto; font-family: monospace; font-size: 11px; white-space: pre-wrap;">${JSON.stringify(result.networkData, null, 2)}</div>
          </div>
        `;
      }
      
      if (content) {
        infoContent.innerHTML = content;
      } else {
        infoContent.innerHTML = '<p style="color: #666; text-align: center;">No data collected yet</p>';
      }
    } catch (error) {
      console.error('Error updating info box:', error);
    }
  }
  
  function showStatus(message, type) {
    status.textContent = message;
    status.className = `status ${type}`;
    status.classList.remove('hidden');
    
    setTimeout(() => {
      status.classList.add('hidden');
    }, type === 'success' ? 3000 : 5000);
  }
  
  // Listen for storage changes to update UI
  chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'local') {
      updateInfoBox();
    }
  });
});