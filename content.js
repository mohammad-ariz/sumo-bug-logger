console.log("Sumo Bug Logger content script loaded on:", window.location.href);

// State variables
let isSelecting = false;
let componentTooltip = null;
let highlightedElement = null;
let toastElement = null;

// Component info mapping
const COMPONENT_INFO = {
  queryEditor: "@Sanyaku/ui-observability",
  messageTable: "@Sanyaku/ui-observability", 
  logInspector: "@Sanyaku/ui-observability",
  searchBar: "@Sanyaku/ui-observability",
  filterPanel: "@Sanyaku/ui-observability",
  dashboardWidget: "@Frontend/core",
  navigationBar: "@Frontend/core",
  sidePanel: "@Frontend/core",
  userProfile: "@Security/auth",
  loginForm: "@Security/auth",
  apiConnector: "@Backend/api",
  dataProcessor: "@Backend/api",
  systemStatus: "@Platform/infrastructure",
  serverMetrics: "@Platform/infrastructure"
};

// Signal that content script is ready
try {
  chrome.runtime.sendMessage({ action: "contentScriptReady" }).catch(() => {
    console.log("Background script not ready yet");
  });
} catch (error) {
  console.log("Error signaling ready:", error);
}

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log("Content script received message:", request);

  if (request.action === "startComponentSelection") {
    try {
      startComponentSelection();
      sendResponse({ success: true });
    } catch (error) {
      console.error('Error starting component selection:', error);
      sendResponse({ success: false, error: error.message });
    }
  }

  return true;
});

// Start component selection mode
function startComponentSelection() {
  console.log("Starting component selection mode");
  
  if (isSelecting) {
    console.log("Already in selection mode, stopping first");
    stopComponentSelection();
  }

  isSelecting = true;
  document.body.style.cursor = 'pointer';
  
  // Add simple event listeners for component detection
  document.addEventListener('mouseover', handleMouseOver, true);
  document.addEventListener('mouseout', handleMouseOut, true);
  document.addEventListener('click', handleComponentClick, true);
  document.addEventListener('keydown', handleKeydown, true);
  
  // Show toast notification
  showToast("Hover over elements to find components and click to select", "info");
  
  console.log("Component selection mode activated - hover over elements to see highlights");
}

// Simple mouse over handler
function handleMouseOver(event) {
  if (!isSelecting) return;
  
  const element = event.target;
  const componentElement = findComponentElement(element);
  
  if (!componentElement) return;
  
  const componentName = componentElement.getAttribute('data-bug-logger-id');
  if (!componentName) return;
  
  // Don't re-highlight the same element
  if (highlightedElement === componentElement) return;
  
  console.log('Highlighting component:', componentName);
  
  // Remove previous highlight
  removeHighlight();
  removeTooltip();
  
  // Highlight current element
  highlightedElement = componentElement;
  
  // Store original styles
  const originalStyles = {
    outline: componentElement.style.outline,
    outlineOffset: componentElement.style.outlineOffset,
    boxShadow: componentElement.style.boxShadow
  };
  
  componentElement._originalStyles = originalStyles;
  
  // Apply highlight styles
  componentElement.style.outline = '2px solid #ff0000';
  componentElement.style.outlineOffset = '2px';
  componentElement.style.boxShadow = '0 0 0 4px rgba(255, 0, 0, 0.2)';
  
  // Show tooltip with lock button
  showTooltip(event, componentName, componentElement);
}

// Simple mouse out handler
function handleMouseOut(event) {
  if (!isSelecting) return;
  
  const element = event.target;
  const relatedTarget = event.relatedTarget;
  
  // Don't remove highlight/tooltip if moving to the tooltip or its children
  if (relatedTarget && (
    relatedTarget.closest('.component-tooltip') || 
    relatedTarget.id === 'sumo-select-component-btn'
  )) {
    return;
  }
  
  const componentElement = findComponentElement(element);
  
  // Only remove highlight if we're leaving the highlighted component
  if (highlightedElement && componentElement !== highlightedElement) {
    // Add a small delay to prevent flickering when moving to tooltip
    setTimeout(() => {
      // Check again if we're not hovering over tooltip
      const hoveredElement = document.querySelector('.component-tooltip:hover');
      if (!hoveredElement && isSelecting) {
        removeHighlight();
        removeTooltip();
      }
    }, 100);
  }
}

// Simple click handler
function handleComponentClick(event) {
  if (!isSelecting) return;
  
  // If clicking on the select button, let that handler take care of it
  if (event.target.id === 'sumo-select-component-btn') {
    return;
  }
  
  const element = event.target;
  const componentElement = findComponentElement(element);
  
  if (!componentElement) return;
  
  const componentName = componentElement.getAttribute('data-bug-logger-id');
  if (!componentName) return;
  
  // Prevent default click behavior
  event.preventDefault();
  event.stopPropagation();
  
  console.log(`Direct click - Component selected: ${componentName}`);
  
  // Get team owner info
  const teamOwner = COMPONENT_INFO[componentName] || "Unknown Team";
  
  // Capture screenshot of the selected component
  captureComponentScreenshot(componentElement, componentName, teamOwner);
}

// Simple keydown handler
function handleKeydown(event) {
  if (!isSelecting) return;
  
  if (event.key === 'Escape') {
    event.preventDefault();
    stopComponentSelection();
    showToast("Component selection cancelled", "info");
  }
}

// Stop component selection mode
function stopComponentSelection() {
  console.log("Stopping component selection mode");
  
  isSelecting = false;
  document.body.style.cursor = '';
  
  // Remove simple event listeners
  document.removeEventListener('mouseover', handleMouseOver, true);
  document.removeEventListener('mouseout', handleMouseOut, true);
  document.removeEventListener('click', handleComponentClick, true);
  document.removeEventListener('keydown', handleKeydown, true);
  
  // Clean up UI elements
  removeHighlight();
  removeTooltip();
  removeToast();
}

// Find element with data-bug-logger-id attribute by traversing up the DOM tree
function findComponentElement(startElement) {
  let element = startElement;
  let maxDepth = 10; // Prevent infinite loops
  let depth = 0;
  
  while (element && element !== document.body && depth < maxDepth) {
    // Ensure element has getAttribute method and actually has the data-bug-logger-id attribute
    if (element.getAttribute && typeof element.getAttribute === 'function') {
      const componentAttr = element.getAttribute('data-bug-logger-id');
      
      if (componentAttr && componentAttr.trim() !== '') {
        return element;
      }
    }
    element = element.parentElement;
    depth++;
  }
  
  return null;
}

// Show tooltip with component information
function showTooltip(event, componentName, componentElement) {
  removeTooltip(); // Remove any existing tooltip first
  
  const moduleOwner = COMPONENT_INFO[componentName] || "Unknown Team";
  
  componentTooltip = document.createElement('div');
  componentTooltip.className = 'component-tooltip';
  componentTooltip.innerHTML = `
    <div style="
      position: fixed;
      background: white;
      color: black;
      padding: 10px 12px;
      border-radius: 2px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 13px;
      z-index: 2147483647;
      pointer-events: all;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
      max-width: 250px;
      word-wrap: break-word;
      border: 1px solid #ccc;
    ">
      <div style="color: black; font-weight: bold; margin-bottom: 2px;">Component Name: ${componentName}</div>
      <div style="color: #666666; font-weight: bold; font-size: 11px; margin-bottom: 8px;">Module Owner: ${moduleOwner}</div>
      <button id="sumo-select-component-btn" style="
        background: #2063d6;
        color: white;
        border: none;
        padding: 4px 8px;
        border-radius: 3px;
        font-size: 11px;
        cursor: pointer;
        font-family: inherit;
      ">Select Component</button>
    </div>
  `;
  
  // Position tooltip near mouse cursor but in a more accessible location
  const tooltip = componentTooltip.firstElementChild;
  const mouseX = event.clientX;
  const mouseY = event.clientY;
  
  // Calculate position with boundary checks - position below and to the right for easier access
  let left = mouseX + 15;
  let top = mouseY + 15;
  
  // Check right boundary
  if (left + 220 > window.innerWidth) {
    left = mouseX - 235; // Position to the left
  }
  
  // Check bottom boundary
  if (top + 80 > window.innerHeight) {
    top = mouseY - 95; // Position above
  }
  
  // Ensure minimum distance from edges
  left = Math.max(10, Math.min(left, window.innerWidth - 230));
  top = Math.max(10, Math.min(top, window.innerHeight - 90));
  
  tooltip.style.left = left + 'px';
  tooltip.style.top = top + 'px';
  
  document.body.appendChild(componentTooltip);
  
  // Add mouse event handlers to tooltip to keep it stable
  const tooltipDiv = componentTooltip.firstElementChild;
  tooltipDiv.addEventListener('mouseenter', function() {
    // Keep tooltip stable when hovering over it
    clearTimeout(window.tooltipRemovalTimeout);
  });
  
  tooltipDiv.addEventListener('mouseleave', function() {
    // Remove tooltip when leaving it (with small delay)
    window.tooltipRemovalTimeout = setTimeout(() => {
      if (isSelecting) {
        removeHighlight();
        removeTooltip();
      }
    }, 200);
  });
  
  // Add click handler to the select button
  const selectBtn = document.getElementById('sumo-select-component-btn');
  if (selectBtn) {
    selectBtn.addEventListener('click', function(e) {
      e.preventDefault();
      e.stopPropagation();
      console.log(`Button clicked - selecting component: ${componentName}`);
      console.log(`Component element:`, componentElement);
      console.log(`Module owner:`, moduleOwner);
      
      try {
        // Capture screenshot of the selected component
        captureComponentScreenshot(componentElement, componentName, moduleOwner);
      } catch (error) {
        console.error('Error in button click handler:', error);
        showToast('Error selecting component. Please try again.', 'error');
      }
    });
  }
}

// Remove tooltip
function removeTooltip() {
  // Clear any pending removal timeout
  if (window.tooltipRemovalTimeout) {
    clearTimeout(window.tooltipRemovalTimeout);
    window.tooltipRemovalTimeout = null;
  }
  
  if (componentTooltip) {
    componentTooltip.remove();
    componentTooltip = null;
  }
}

// Remove highlight from element
function removeHighlight() {
  if (highlightedElement) {
    const element = highlightedElement;
    const originalStyles = element._originalStyles;
    
    if (originalStyles) {
      // Restore original styles
      element.style.outline = originalStyles.outline || '';
      element.style.outlineOffset = originalStyles.outlineOffset || '';
      element.style.boxShadow = originalStyles.boxShadow || '';
      
      // Clean up stored properties
      delete element._originalStyles;
    }
    
    highlightedElement = null;
  }
}

// Show toast notification
function showToast(message, type = 'info') {
  removeToast();
  
  toastElement = document.createElement('div');
  toastElement.innerHTML = `
    <div style="
      position: fixed;
      top: 20px;
      right: 20px;
      background: ${type === 'success' ? '#4CAF50' : type === 'error' ? '#f44336' : '#2196F3'};
      color: white;
      padding: 12px 20px;
      border-radius: 4px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 14px;
      z-index: 10002;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      max-width: 400px;
      word-wrap: break-word;
      animation: slideInRight 0.3s ease-out;
    ">
      ${message}
    </div>
  `;
  
  // Add CSS animation
  if (!document.getElementById('toast-styles')) {
    const style = document.createElement('style');
    style.id = 'toast-styles';
    style.textContent = `
      @keyframes slideInRight {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
      }
    `;
    document.head.appendChild(style);
  }
  
  document.body.appendChild(toastElement);
  
  // Auto remove after 3 seconds
  setTimeout(() => {
    removeToast();
  }, 3000);
}

// Remove toast notification
function removeToast() {
  if (toastElement) {
    toastElement.remove();
    toastElement = null;
  }
}

// Capture screenshot of selected component
async function captureComponentScreenshot(element, componentName, teamOwner) {
  try {
    console.log(`📸 Starting screenshot capture for component: ${componentName}`);
    console.log(`Element:`, element);
    console.log(`Team owner:`, teamOwner);
    
    if (!element) {
      throw new Error('No element provided for screenshot');
    }
    
    // Get element position and dimensions
    const rect = element.getBoundingClientRect();
    console.log(`Element rect:`, rect);
    
    // Create team info based on team owner
    const teamInfo = {
      teamName: teamOwner.replace('@', '').split('/')[1] || "Unknown Team",
      teamJiraLabel: "Component Bug",
      managerName: "Team Lead",
      managerId: `${teamOwner.replace('@', '').toLowerCase()}@company.com`,
      slackChannel: teamOwner,
      slackChannelId: "C0000000000",
    };
    
    console.log(`Team info created:`, teamInfo);
    
    const elementInfo = {
      x: rect.left + window.scrollX,
      y: rect.top + window.scrollY,
      width: rect.width,
      height: rect.height,
      componentName: componentName,
      teamOwner: teamOwner,
      teamInfo: teamInfo,
      url: window.location.href,
      timestamp: new Date().toISOString(),
      selector: getElementSelector(element),
      screenshot: generateComponentScreenshot(rect)
    };
    
    console.log(`Element info created:`, elementInfo);
    
    // Stop selection mode
    stopComponentSelection();
    
    console.log(`📤 Sending component data to background script...`);
    
    // Check if chrome.runtime is available
    if (!chrome || !chrome.runtime) {
      throw new Error('Chrome extension context not available');
    }
    
    // Store component data first (this always works)
    chrome.storage.local.set({ bugComponentData: elementInfo }, (result) => {
      if (chrome.runtime.lastError) {
        console.error('Error saving to storage:', chrome.runtime.lastError);
        showToast('Error saving component data. Please try again.', 'error');
        return;
      } else {
        console.log('✅ Component data saved to storage');
        showToast(`Component "${componentName}" selected successfully!`, 'success');
      }
    });
    
    // Try to notify background script (but don't fail if it doesn't work)
    try {
      chrome.runtime.sendMessage({
        action: 'componentSelected',
        data: elementInfo
      }, (response) => {
        if (chrome.runtime.lastError) {
          console.log('Background script notification failed (this is OK):', chrome.runtime.lastError.message);
        } else {
          console.log('Background script notified successfully:', response);
        }
      });
    } catch (error) {
      console.log('Could not notify background script (this is OK):', error.message);
    }
    
  } catch (error) {
    console.error('❌ Error capturing component screenshot:', error);
    console.error('Error stack:', error.stack);
    showToast(`Error: ${error.message}`, 'error');
    stopComponentSelection();
  }
}

// Generate a simple screenshot placeholder for the component
function generateComponentScreenshot(rect) {
  try {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    canvas.width = Math.max(200, rect.width);
    canvas.height = Math.max(100, rect.height);
    
    // Create a placeholder screenshot
    ctx.fillStyle = '#f8f9fa';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Add border
    ctx.strokeStyle = '#ff0000';
    ctx.lineWidth = 2;
    ctx.strokeRect(0, 0, canvas.width, canvas.height);
    
    // Add text
    ctx.fillStyle = '#333';
    ctx.font = '14px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('Component Screenshot', canvas.width / 2, canvas.height / 2 - 10);
    ctx.fillText(`${Math.round(rect.width)}x${Math.round(rect.height)}`, canvas.width / 2, canvas.height / 2 + 10);
    
    return canvas.toDataURL('image/png');
  } catch (error) {
    console.error('Error generating component screenshot:', error);
    return null;
  }
}

// Generate a unique CSS selector for an element
function getElementSelector(element) {
  if (element.id) {
    return `#${element.id}`;
  }
  
  if (element.className) {
    const classes = Array.from(element.classList).join('.');
    if (classes) {
      return `.${classes}`;
    }
  }
  
  // Fallback to tag name with data-bug-logger-id attribute
  const componentName = element.getAttribute('data-bug-logger-id');
  if (componentName) {
    return `${element.tagName.toLowerCase()}[data-bug-logger-id="${componentName}"]`;
  }
  
  return element.tagName.toLowerCase();
}

// Helper function to send messages with retry logic
function sendMessageWithRetry(message, maxRetries = 3, delay = 500) {
  return new Promise((resolve, reject) => {
    let attempts = 0;
    
    function attemptSend() {
      attempts++;
      console.log(`Attempt ${attempts}/${maxRetries} to send message:`, message);
      
      try {
        chrome.runtime.sendMessage(message, (response) => {
          if (chrome.runtime.lastError) {
            console.error(`Attempt ${attempts} failed:`, chrome.runtime.lastError);
            
            if (attempts < maxRetries) {
              console.log(`Retrying in ${delay}ms...`);
              setTimeout(attemptSend, delay);
            } else {
              reject(new Error(`Failed after ${maxRetries} attempts: ${chrome.runtime.lastError.message}`));
            }
          } else {
            console.log(`Message sent successfully on attempt ${attempts}`);
            resolve(response);
          }
        });
      } catch (error) {
        console.error(`Attempt ${attempts} threw error:`, error);
        
        if (attempts < maxRetries) {
          console.log(`Retrying in ${delay}ms...`);
          setTimeout(attemptSend, delay);
        } else {
          reject(error);
        }
      }
    }
    
    attemptSend();
  });
}

// Clean up when page unloads
window.addEventListener('beforeunload', () => {
  if (isSelecting) {
    stopComponentSelection();
  }
});

console.log("Sumo Bug Logger content script initialized");
