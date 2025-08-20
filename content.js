console.log('Sumo Bug Logger content script loaded on:', window.location.href);

// Import owner info constants
const OWNER_INFO = {
    "@Sanyaku/ui-observability": {
        managerName: 'Ayan Ghatak',
        teamName: "Ui Observability",
    }
};

let isSelecting = false;
let selectionOverlay = null;
let startX = 0, startY = 0;
let selectionBox = null;

// Signal that content script is ready
try {
  chrome.runtime.sendMessage({ action: 'contentScriptReady' }).catch(() => {
    console.log('Background script not ready yet');
  });
} catch (error) {
  console.log('Error signaling ready:', error);
}

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Content script received message:', request);
  
  if (request.action === 'startRegionSelection') {
    try {
      startRegionSelection();
      sendResponse({ success: true });
    } catch (error) {
      console.error('Error starting region selection:', error);
      sendResponse({ success: false, error: error.message });
    }
  }
  
  return true;
});

function startRegionSelection() {
  console.log('Starting region selection...');
  
  // Clean up any existing selection first
  cleanupSelection();
  
  // Create overlay for selection
  createSelectionOverlay();
  
  // Add event listeners for mouse interactions
  document.addEventListener('mousedown', handleMouseDown, true);
  document.addEventListener('mousemove', handleMouseMove, true);
  document.addEventListener('mouseup', handleMouseUp, true);
  
  // Add escape key to cancel
  document.addEventListener('keydown', handleEscapeKey, true);
  
  isSelecting = true;
  
  // Show instructions
  showInstructions('Click and drag to select the buggy region. Press ESC to cancel.');
}

function createSelectionOverlay() {
  // Remove existing overlay if any
  const existing = document.getElementById('sumo-bug-logger-overlay');
  if (existing) {
    existing.remove();
  }
  
  selectionOverlay = document.createElement('div');
  selectionOverlay.id = 'sumo-bug-logger-overlay';
  selectionOverlay.style.cssText = `
    position: fixed !important;
    top: 0 !important;
    left: 0 !important;
    width: 100% !important;
    height: 100% !important;
    background-color: rgba(0, 0, 0, 0.3) !important;
    z-index: 2147483647 !important;
    cursor: crosshair !important;
    pointer-events: all !important;
  `;
  
  selectionBox = document.createElement('div');
  selectionBox.style.cssText = `
    position: absolute !important;
    border: 2px dashed #ff6b6b !important;
    background-color: rgba(255, 107, 107, 0.2) !important;
    display: none !important;
    pointer-events: none !important;
    z-index: 2147483648 !important;
  `;
  
  selectionOverlay.appendChild(selectionBox);
  document.body.appendChild(selectionOverlay);
  
  console.log('Selection overlay created');
}

function handleMouseDown(e) {
  if (!isSelecting) return;
  
  console.log('Mouse down detected');
  e.preventDefault();
  e.stopPropagation();
  
  startX = e.clientX;
  startY = e.clientY;
  
  selectionBox.style.left = startX + 'px';
  selectionBox.style.top = startY + 'px';
  selectionBox.style.width = '0px';
  selectionBox.style.height = '0px';
  selectionBox.style.display = 'block';
}

function handleMouseMove(e) {
  if (!isSelecting || !selectionBox || selectionBox.style.display === 'none') return;
  
  e.preventDefault();
  e.stopPropagation();
  
  const currentX = e.clientX;
  const currentY = e.clientY;
  
  const left = Math.min(startX, currentX);
  const top = Math.min(startY, currentY);
  const width = Math.abs(currentX - startX);
  const height = Math.abs(currentY - startY);
  
  selectionBox.style.left = left + 'px';
  selectionBox.style.top = top + 'px';
  selectionBox.style.width = width + 'px';
  selectionBox.style.height = height + 'px';
}

function handleMouseUp(e) {
  if (!isSelecting) return;
  
  console.log('Mouse up detected');
  e.preventDefault();
  e.stopPropagation();
  
  const rect = selectionBox.getBoundingClientRect();
  
  if (rect.width > 10 && rect.height > 10) {
    // Valid selection made
    processSelectedRegion(rect);
  } else {
    showInstructions('Selection too small. Please try again.');
    setTimeout(() => {
      cleanupSelection();
    }, 2000);
    return;
  }
  
  cleanupSelection();
}

function handleEscapeKey(e) {
  if (e.key === 'Escape' && isSelecting) {
    cleanupSelection();
    showInstructions('Region selection cancelled.');
  }
}

function processSelectedRegion(rect) {
  console.log('Processing selected region:', rect);
  
  // Convert screen coordinates to document coordinates
  const scrollX = window.pageXOffset || document.documentElement.scrollLeft;
  const scrollY = window.pageYOffset || document.documentElement.scrollTop;
  
  const regionData = {
    x: Math.round(rect.left + scrollX),
    y: Math.round(rect.top + scrollY),
    width: Math.round(rect.width),
    height: Math.round(rect.height)
  };
  
  console.log('Region data:', regionData);
  
  // Find elements within the selected region
  const elementsInRegion = findElementsInRegion(regionData);
  console.log('Elements found in region:', elementsInRegion.length);
  
  // Look for data-owner attribute only
  const ownerInfo = findOwnerFromDataAttribute(elementsInRegion);
  
  // Store the bug region data
  const bugData = {
    ...regionData,
    ownerId: ownerInfo.ownerId,
    managerName: ownerInfo.managerName,
    teamName: ownerInfo.teamName,
    timestamp: new Date().toISOString(),
    elementsFound: elementsInRegion.length,
    url: window.location.href
  };
  
  console.log('Bug data to save:', bugData);
  
  // Save to storage
  chrome.storage.local.set({ bugRegionData: bugData }, () => {
    console.log('Bug region data saved:', bugData);
    
    let message = '✅ Region selected!';
    if (ownerInfo.ownerId) {
      message += ` Found owner: ${ownerInfo.ownerId}`;
      if (ownerInfo.teamName) {
        message += ` (${ownerInfo.teamName})`;
      }
      if (ownerInfo.managerName) {
        message += ` - Manager: ${ownerInfo.managerName}`;
      }
    } else {
      message += ' No data-owner attribute found';
    }
    
    showInstructions(message);
    
    // Send message to background script
    chrome.runtime.sendMessage({
      action: 'regionSelected',
      data: bugData
    }).catch((error) => {
      console.error('Error sending message to background:', error);
    });
  });
}

function findOwnerFromDataAttribute(elementsInRegion) {
  let ownerId = null;
  let managerName = null;
  let teamName = null;
  
  // Look for data-owner attributes in the elements
  for (const element of elementsInRegion) {
    // Check for data-owner attribute only
    const owner = element.getAttribute('data-owner');
    if (owner) {
      ownerId = owner;
      console.log('Found data-owner:', ownerId);
      break;
    }
    
    // Also check parent elements up to 10 levels
    let parent = element.parentElement;
    let depth = 0;
    while (parent && !ownerId && depth < 10) {
      const parentOwner = parent.getAttribute('data-owner');
      if (parentOwner) {
        ownerId = parentOwner;
        console.log('Found data-owner in parent:', ownerId);
        break;
      }
      parent = parent.parentElement;
      depth++;
    }
    
    if (ownerId) break;
  }
  
  // If we found an owner ID, look it up in the OWNER_INFO constants
  if (ownerId && OWNER_INFO[ownerId]) {
    const info = OWNER_INFO[ownerId];
    managerName = info.managerName;
    teamName = info.teamName;
    console.log('Found owner info in constants:', info);
  } else if (ownerId) {
    console.log('Owner ID found but no info in constants:', ownerId);
  }
  
  return {
    ownerId,
    managerName,
    teamName
  };
}

function findElementsInRegion(regionData) {
  const elements = [];
  const allElements = document.querySelectorAll('*');
  
  for (const element of allElements) {
    const rect = element.getBoundingClientRect();
    const scrollX = window.pageXOffset || document.documentElement.scrollLeft;
    const scrollY = window.pageYOffset || document.documentElement.scrollTop;
    
    const elementData = {
      left: rect.left + scrollX,
      top: rect.top + scrollY,
      right: rect.right + scrollX,
      bottom: rect.bottom + scrollY
    };
    
    // Check if element is within or overlaps the selected region
    if (elementData.left < regionData.x + regionData.width &&
        elementData.right > regionData.x &&
        elementData.top < regionData.y + regionData.height &&
        elementData.bottom > regionData.y) {
      elements.push(element);
    }
  }
  
  return elements;
}

function cleanupSelection() {
  console.log('Cleaning up selection');
  isSelecting = false;
  
  // Remove event listeners
  document.removeEventListener('mousedown', handleMouseDown, true);
  document.removeEventListener('mousemove', handleMouseMove, true);
  document.removeEventListener('mouseup', handleMouseUp, true);
  document.removeEventListener('keydown', handleEscapeKey, true);
  
  // Remove overlay
  if (selectionOverlay) {
    selectionOverlay.remove();
    selectionOverlay = null;
    selectionBox = null;
  }
  
  // Remove instructions after a delay
  setTimeout(() => {
    hideInstructions();
  }, 5000);
}

function showInstructions(text) {
  // Remove existing instructions
  hideInstructions();
  
  const instructions = document.createElement('div');
  instructions.id = 'sumo-bug-logger-instructions';
  instructions.style.cssText = `
    position: fixed !important;
    top: 20px !important;
    left: 50% !important;
    transform: translateX(-50%) !important;
    background-color: #333 !important;
    color: white !important;
    padding: 12px 20px !important;
    border-radius: 6px !important;
    z-index: 2147483647 !important;
    font-family: Arial, sans-serif !important;
    font-size: 14px !important;
    box-shadow: 0 4px 12px rgba(0,0,0,0.3) !important;
    max-width: 500px !important;
    text-align: center !important;
    line-height: 1.4 !important;
  `;
  instructions.textContent = text;
  
  document.body.appendChild(instructions);
  
  // Auto-remove success messages
  if (text.includes('✅') || text.includes('cancelled')) {
    setTimeout(hideInstructions, 5000);
  }
}

function hideInstructions() {
  const existing = document.getElementById('sumo-bug-logger-instructions');
  if (existing) {
    existing.remove();
  }
}

// Add some debugging
console.log('Content script setup complete');
console.log('Available owner info:', OWNER_INFO);