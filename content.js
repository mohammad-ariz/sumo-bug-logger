console.log("Sumo Bug Logger content script loaded on:", window.location.href);

// Prevent multiple script injections
if (window.sumoDebuggerLoaded) {
  console.log("Content script already loaded, skipping");
} else {
  window.sumoDebuggerLoaded = true;

  // Import owner info constants - this will be loaded from constants/ownerInfo.js
  let isSelecting = false;
  let selectionOverlay = null;
  let startX = 0,
    startY = 0;
  let selectionBox = null;
  let toastElement = null;

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

    if (request.action === "startRegionSelection") {
      try {
        startRegionSelection();
        sendResponse({ success: true });
      } catch (error) {
        console.error("Error starting region selection:", error);
        sendResponse({ success: false, error: error.message });
      }
    }

    return true;
  });

  // Load owner info constants
  async function loadOwnerInfo() {
    try {
      const url = chrome.runtime.getURL("constants/ownerInfo.js");
      console.log("Loading owner info from:", url);

      if (!url || url.includes("invalid")) {
        console.warn("Invalid extension URL, using fallback data");
        return getFallbackOwnerInfo();
      }

      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const text = await response.text();
      console.log("Owner info file content loaded, length:", text.length);

      // Extract the OWNER_INFO object from the file
      // Try multiple regex patterns to match the file format
      let match = text.match(/const OWNER_INFO = ({[\s\S]*?});?\s*$/);
      if (!match) {
        match = text.match(/OWNER_INFO = ({[\s\S]*?})\s*;?/);
      }
      if (!match) {
        // Try to find just the object part
        match = text.match(/({[\s\S]*})/);
      }

      if (match) {
        console.log("Found OWNER_INFO pattern, parsing...");
        let objectStr = match[1];

        try {
          // Instead of eval, use JSON.parse with a safer approach
          // First, convert JavaScript object syntax to JSON
          let jsonStr = objectStr
            .replace(/(\w+):/g, '"$1":') // Add quotes around keys
            .replace(/'/g, '"') // Replace single quotes with double quotes
            .replace(/,\s*}/g, "}") // Remove trailing commas
            .replace(/,\s*]/g, "]"); // Remove trailing commas in arrays

          const result = JSON.parse(jsonStr);
          console.log("Successfully parsed owner info:", Object.keys(result));
          return result;
        } catch (parseError) {
          console.warn("JSON parse error, using fallback:", parseError);
          // If JSON parsing fails, return fallback data
          return getFallbackOwnerInfo();
        }
      }
      throw new Error("Could not find OWNER_INFO pattern in file");
    } catch (error) {
      console.warn("Could not load owner info:", error);
      return getFallbackOwnerInfo();
    }
  }

  function getFallbackOwnerInfo() {
    // Fallback data
    return {
      hash1: {
        teamName: "Frontend Team",
        teamJiraLabel: "UI Issue",
        managerName: "John Doe",
        managerId: "john.doe@company.com",
        slackChannel: "#frontend-bugs",
        slackChannelId: "C1234567890",
      },
      hash2: {
        teamName: "Backend Team",
        teamJiraLabel: "API Issue",
        managerName: "Jane Smith",
        managerId: "jane.smith@company.com",
        slackChannel: "#backend-bugs",
        slackChannelId: "C9876543210",
      },
    };
  }

  function startRegionSelection() {
    console.log("Starting region selection...");

    // Clean up any existing selection first
    cleanupSelection();

    // Create overlay for selection
    createSelectionOverlay();

    isSelecting = true;

    // Add event listeners for selection
    document.addEventListener("mousedown", handleMouseDown);
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    document.addEventListener("keydown", handleKeyDown);

    // Show instructions banner
    showInstructionsBanner();
  }

  function createSelectionOverlay() {
    selectionOverlay = document.createElement("div");
    selectionOverlay.id = "sumo-selection-overlay";
    selectionOverlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    background: rgba(0, 0, 0, 0.5);
    z-index: 999999;
    cursor: crosshair;
    pointer-events: all;
  `;

    document.body.appendChild(selectionOverlay);
  }

  function showInstructionsBanner() {
    const banner = document.createElement("div");
    banner.id = "sumo-instructions-banner";
    banner.style.cssText = `
    position: fixed;
    top: 20px;
    left: 50%;
    transform: translateX(-50%);
    background: #007bff;
    color: white;
    padding: 12px 24px;
    border-radius: 8px;
    font-family: 'Segoe UI', sans-serif;
    font-size: 14px;
    font-weight: 500;
    z-index: 1000000;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    animation: slideInTop 0.3s ease-out;
  `;

    banner.textContent =
      "🎯 Draw a rectangle around the buggy area • Press ESC to cancel";

    // Add animation styles
    const style = document.createElement("style");
    style.textContent = `
    @keyframes slideInTop {
      from { transform: translateX(-50%) translateY(-20px); opacity: 0; }
      to { transform: translateX(-50%) translateY(0); opacity: 1; }
    }
    @keyframes checkmark {
      0% { transform: scale(0); }
      50% { transform: scale(1.2); }
      100% { transform: scale(1); }
    }
  `;
    document.head.appendChild(style);

    document.body.appendChild(banner);
  }

  function handleMouseDown(e) {
    if (!isSelecting) return;

    e.preventDefault();
    e.stopPropagation();

    startX = e.clientX;
    startY = e.clientY;

    // Create selection box
    selectionBox = document.createElement("div");
    selectionBox.id = "sumo-selection-box";
    selectionBox.style.cssText = `
    position: fixed;
    border: 2px dashed #007bff;
    background: rgba(0, 123, 255, 0.1);
    z-index: 1000000;
    pointer-events: none;
  `;

    document.body.appendChild(selectionBox);

    // Show coordinates tooltip
    showCoordinatesTooltip(e.clientX, e.clientY);
  }

  function handleMouseMove(e) {
    if (!isSelecting || !selectionBox) return;

    e.preventDefault();

    const currentX = e.clientX;
    const currentY = e.clientY;

    const left = Math.min(startX, currentX);
    const top = Math.min(startY, currentY);
    const width = Math.abs(currentX - startX);
    const height = Math.abs(currentY - startY);

    selectionBox.style.left = left + "px";
    selectionBox.style.top = top + "px";
    selectionBox.style.width = width + "px";
    selectionBox.style.height = height + "px";

    // Update coordinates tooltip
    updateCoordinatesTooltip(currentX, currentY);
  }

  async function handleMouseUp(e) {
    if (!isSelecting || !selectionBox) return;

    e.preventDefault();
    e.stopPropagation();

    const endX = e.clientX;
    const endY = e.clientY;

    const left = Math.min(startX, endX);
    const top = Math.min(startY, endY);
    const width = Math.abs(endX - startX);
    const height = Math.abs(endY - startY);

    // Minimum selection size
    if (width < 10 || height < 10) {
      cleanupSelection();
      startRegionSelection();
      return;
    }

    // Show completion animation
    showCompletionAnimation(left, top, width, height);

    // Capture screenshot of the selected area
    const screenshot = await captureSelectedArea(left, top, width, height);

    // Extract owner information from DOM elements in the selected area
    const ownerInfo = extractOwnerInfo(left, top, width, height);

    // Get team information from owner hash
    const teamInfo = await getTeamInfo(ownerInfo.ownerId);

    // Save the region data
    const regionData = {
      x: left,
      y: top,
      width: width,
      height: height,
      screenshot: screenshot,
      ownerId: ownerInfo.ownerId,
      teamInfo: teamInfo,
      url: window.location.href,
      timestamp: Date.now(),
      elements: ownerInfo.elements,
    };

    console.log("CONTENT: Saving region data to storage:", regionData);
    await chrome.storage.local.set({ bugRegionData: regionData });
    console.log("CONTENT: Region data saved successfully");

    // Show toast notification
    showToastNotification(teamInfo);

    // Clean up selection UI
    setTimeout(() => {
      cleanupSelection();
    }, 1000);
  }

  function handleKeyDown(e) {
    if (e.key === "Escape" && isSelecting) {
      cleanupSelection();
    }
  }

  function showCoordinatesTooltip(x, y) {
    let tooltip = document.getElementById("sumo-coordinates-tooltip");
    if (!tooltip) {
      tooltip = document.createElement("div");
      tooltip.id = "sumo-coordinates-tooltip";
      tooltip.style.cssText = `
      position: fixed;
      background: rgba(0, 0, 0, 0.8);
      color: white;
      padding: 4px 8px;
      border-radius: 4px;
      font-family: monospace;
      font-size: 11px;
      z-index: 1000001;
      pointer-events: none;
    `;
      document.body.appendChild(tooltip);
    }

    tooltip.textContent = `X: ${x}, Y: ${y}`;
    tooltip.style.left = x + 10 + "px";
    tooltip.style.top = y - 30 + "px";
  }

  function updateCoordinatesTooltip(x, y) {
    const tooltip = document.getElementById("sumo-coordinates-tooltip");
    if (tooltip) {
      tooltip.textContent = `X: ${x}, Y: ${y}`;
      tooltip.style.left = x + 10 + "px";
      tooltip.style.top = y - 30 + "px";
    }
  }

  function showCompletionAnimation(left, top, width, height) {
    const checkmark = document.createElement("div");
    checkmark.style.cssText = `
    position: fixed;
    left: ${left + width / 2 - 20}px;
    top: ${top + height / 2 - 20}px;
    width: 40px;
    height: 40px;
    background: #28a745;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000001;
    animation: checkmark 0.5s ease-out;
  `;
    checkmark.innerHTML = "✓";
    checkmark.style.color = "white";
    checkmark.style.fontSize = "24px";
    checkmark.style.fontWeight = "bold";

    document.body.appendChild(checkmark);

    setTimeout(() => {
      if (checkmark.parentNode) {
        checkmark.parentNode.removeChild(checkmark);
      }
    }, 500);
  }

  async function captureSelectedArea(left, top, width, height) {
    try {
      // Use html2canvas to capture the selected area
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");

      canvas.width = width;
      canvas.height = height;

      // For now, create a placeholder screenshot
      // In a real implementation, you would use html2canvas or similar
      ctx.fillStyle = "#f0f0f0";
      ctx.fillRect(0, 0, width, height);
      ctx.fillStyle = "#333";
      ctx.font = "14px Arial";
      ctx.fillText("Screenshot Placeholder", 10, 30);
      ctx.fillText(`Area: ${width}x${height}`, 10, 50);
      ctx.fillText(`Position: ${left}, ${top}`, 10, 70);

      return canvas.toDataURL("image/png");
    } catch (error) {
      console.error("Error capturing screenshot:", error);
      return null;
    }
  }

  function extractOwnerInfo(left, top, width, height) {
    const elementsInArea = [];
    let ownerId = null;

    // Get all elements in the selected area
    const allElements = document.querySelectorAll("*");

    for (const element of allElements) {
      const rect = element.getBoundingClientRect();

      // Check if element is within selected area
      if (
        rect.left >= left &&
        rect.top >= top &&
        rect.right <= left + width &&
        rect.bottom <= top + height
      ) {
        // Look for data-owner attribute
        const dataOwner = element.getAttribute("data-owner");
        if (dataOwner && !ownerId) {
          ownerId = dataOwner;
        }

        // Also check parent elements for data-owner
        let parent = element.parentElement;
        while (parent && !ownerId) {
          const parentOwner = parent.getAttribute("data-owner");
          if (parentOwner) {
            ownerId = parentOwner;
            break;
          }
          parent = parent.parentElement;
        }

        elementsInArea.push({
          tagName: element.tagName,
          className: element.className,
          id: element.id,
          dataOwner: element.getAttribute("data-owner"),
        });
      }
    }

    return {
      ownerId: ownerId || "unknown",
      elements: elementsInArea.slice(0, 10), // Limit to first 10 elements
    };
  }

  async function getTeamInfo(ownerId) {
    try {
      const ownerInfo = await loadOwnerInfo();

      if (ownerInfo[ownerId]) {
        return ownerInfo[ownerId];
      }

      // Fallback for unknown owner
      return {
        teamName: "Unknown Team",
        teamJiraLabel: "Bug Report",
        managerName: "Unknown Manager",
        managerId: "unknown@company.com",
        slackChannel: "#general-bugs",
        slackChannelId: "C0000000000",
      };
    } catch (error) {
      console.error("Error getting team info:", error);
      return null;
    }
  }

  function showToastNotification(teamInfo) {
    // Remove any existing toast
    const existingToast = document.getElementById("sumo-toast-notification");
    if (existingToast) {
      existingToast.remove();
    }

    toastElement = document.createElement("div");
    toastElement.id = "sumo-toast-notification";
    toastElement.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: #28a745;
    color: white;
    padding: 16px 20px;
    border-radius: 8px;
    font-family: 'Segoe UI', sans-serif;
    font-size: 13px;
    z-index: 1000000;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
    max-width: 320px;
    animation: slideInRight 0.3s ease-out;
  `;

    const closeBtn = document.createElement("button");
    closeBtn.style.cssText = `
    position: absolute;
    top: 8px;
    right: 8px;
    background: none;
    border: none;
    color: white;
    font-size: 16px;
    cursor: pointer;
    padding: 0;
    width: 20px;
    height: 20px;
    display: flex;
    align-items: center;
    justify-content: center;
  `;
    closeBtn.innerHTML = "×";
    closeBtn.onclick = () => toastElement.remove();

    const startRecordingBtn = document.createElement("button");
    startRecordingBtn.style.cssText = `
    background: rgba(255, 255, 255, 0.2);
    border: 1px solid rgba(255, 255, 255, 0.3);
    color: white;
    padding: 6px 12px;
    border-radius: 4px;
    font-size: 12px;
    cursor: pointer;
    margin-top: 12px;
    width: 100%;
    transition: background 0.2s ease;
  `;
    startRecordingBtn.textContent = "🎬 Start Recording";
    startRecordingBtn.onmouseover = () => {
      startRecordingBtn.style.background = "rgba(255, 255, 255, 0.3)";
    };
    startRecordingBtn.onmouseout = () => {
      startRecordingBtn.style.background = "rgba(255, 255, 255, 0.2)";
    };
    startRecordingBtn.onclick = async () => {
      // Show loading state
      startRecordingBtn.textContent = "⏳ Starting Recording...";
      startRecordingBtn.style.background = "rgba(255, 255, 255, 0.1)";
      startRecordingBtn.disabled = true;

      try {
        // Send message to start recording
        const response = await chrome.runtime.sendMessage({
          action: "openPopupToStep2",
        });

        if (response.success) {
          // Update toast to show success
          toastElement.innerHTML = `
          <div style="font-weight: 600; margin-bottom: 8px; color: #28a745;">🎬 Recording Started!</div>
          <div style="font-size: 12px; line-height: 1.4;">
            <div>✅ Network monitoring active</div>
            <div>✅ Console logging active</div>
            <div style="margin-top: 8px; font-style: italic;">
              Open the extension popup to continue...
            </div>
          </div>
        `;

          // Auto-hide toast after 3 seconds
          setTimeout(() => {
            if (toastElement && toastElement.parentNode) {
              toastElement.remove();
            }
          }, 3000);
        } else {
          throw new Error("Failed to start recording");
        }
      } catch (error) {
        console.error("Error starting recording:", error);
        startRecordingBtn.textContent = "❌ Failed - Try Again";
        startRecordingBtn.style.background = "rgba(220, 53, 69, 0.8)";
        setTimeout(() => {
          startRecordingBtn.textContent = "🎬 Start Recording";
          startRecordingBtn.style.background = "rgba(255, 255, 255, 0.2)";
          startRecordingBtn.disabled = false;
        }, 2000);
      }
    };

    const content = `
    <div style="font-weight: 600; margin-bottom: 8px;">✅ Bug Area Captured!</div>
    <div style="font-size: 12px; line-height: 1.4;">
      <div><strong>👥 Team:</strong> ${teamInfo?.teamName || "Unknown"}</div>
      <div><strong>👤 Manager:</strong> ${
        teamInfo?.managerName || "Unknown"
      }</div>
      <div><strong>📋 Jira Label:</strong> ${
        teamInfo?.teamJiraLabel || "Unknown"
      }</div>
      <div><strong>💬 Slack:</strong> ${
        teamInfo?.slackChannel || "Unknown"
      }</div>
    </div>
    <div style="margin-top: 8px; font-size: 11px; opacity: 0.9;">
      Ready to record reproducible steps?
    </div>
  `;

    toastElement.innerHTML = content;
    toastElement.appendChild(closeBtn);
    toastElement.appendChild(startRecordingBtn);

    // Add animation styles
    const style = document.createElement("style");
    style.textContent = `
    @keyframes slideInRight {
      from { transform: translateX(100%); opacity: 0; }
      to { transform: translateX(0); opacity: 1; }
    }
  `;
    document.head.appendChild(style);

    document.body.appendChild(toastElement);

    // Auto-dismiss after 5 seconds
    setTimeout(() => {
      if (toastElement && toastElement.parentNode) {
        toastElement.style.animation = "slideInRight 0.3s ease-out reverse";
        setTimeout(() => {
          if (toastElement.parentNode) {
            toastElement.remove();
          }
        }, 300);
      }
    }, 5000);
  }

  function cleanupSelection() {
    isSelecting = false;

    // Remove event listeners
    document.removeEventListener("mousedown", handleMouseDown);
    document.removeEventListener("mousemove", handleMouseMove);
    document.removeEventListener("mouseup", handleMouseUp);
    document.removeEventListener("keydown", handleKeyDown);

    // Remove overlay
    if (selectionOverlay) {
      selectionOverlay.remove();
      selectionOverlay = null;
    }

    // Remove selection box
    if (selectionBox) {
      selectionBox.remove();
      selectionBox = null;
    }

    // Remove instructions banner
    const banner = document.getElementById("sumo-instructions-banner");
    if (banner) {
      banner.remove();
    }

    // Remove coordinates tooltip
    const tooltip = document.getElementById("sumo-coordinates-tooltip");
    if (tooltip) {
      tooltip.remove();
    }
  }

  // Clean up on page unload
  window.addEventListener("beforeunload", cleanupSelection);

  // Video recording variables for persistence
  let mediaRecorder = null;
  let videoStream = null;
  let recordedChunks = [];

  // Video recording functions
  async function startVideoRecording() {
    try {
      console.log("Starting video recording in content script");

      // Get screen capture stream
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { mediaSource: "screen" },
        audio: true,
      });

      videoStream = stream;
      recordedChunks = [];

      // Create MediaRecorder
      mediaRecorder = new MediaRecorder(stream, { mimeType: "video/webm" });

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          recordedChunks.push(event.data);
          console.log("Video chunk received, size:", event.data.size);
        }
      };

      mediaRecorder.onstop = async () => {
        console.log(
          "MediaRecorder stopped, total chunks:",
          recordedChunks.length
        );

        if (recordedChunks.length > 0) {
          const videoBlob = new Blob(recordedChunks, { type: "video/webm" });
          console.log("Video blob created, size:", videoBlob.size);

          // Stop all tracks
          if (videoStream) {
            videoStream.getTracks().forEach((track) => track.stop());
          }

          // Store video blob in content script memory (persists when popup closes)
          window.currentVideoBlob = videoBlob;

          // Save metadata to Chrome storage
          try {
            await chrome.storage.local.set({
              videoData: {
                hasVideo: true,
                size: videoBlob.size,
                type: videoBlob.type,
                timestamp: Date.now(),
              },
            });
            console.log(
              "Video metadata saved to storage, actual video size:",
              videoBlob.size
            );
          } catch (error) {
            console.error("Error saving video metadata:", error);
          }
        }

        // Clean up
        mediaRecorder = null;
        videoStream = null;
        recordedChunks = [];
      };

      // Start recording
      mediaRecorder.start();
      console.log("MediaRecorder started in content script");

      return true;
    } catch (error) {
      console.error("Error starting video recording:", error);
      throw error;
    }
  }

  async function stopVideoRecording() {
    try {
      console.log("Stopping video recording in content script");

      if (mediaRecorder && mediaRecorder.state === "recording") {
        mediaRecorder.stop();
        console.log("MediaRecorder stop() called");
      } else {
        console.log("MediaRecorder not active or not available");
      }

      return true;
    } catch (error) {
      console.error("Error stopping video recording:", error);
      throw error;
    }
  }

  // Add video recording message handlers
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log("Content script received message:", request);

    if (request.action === "startRegionSelection") {
      try {
        startRegionSelection();
        sendResponse({ success: true });
      } catch (error) {
        console.error("Error starting region selection:", error);
        sendResponse({ success: false, error: error.message });
      }
      return true;
    }

    if (request.action === "startVideoRecording") {
      startVideoRecording()
        .then(() => {
          sendResponse({ success: true });
        })
        .catch((error) => {
          console.error("Error starting video recording:", error);
          sendResponse({ success: false, error: error.message });
        });
      return true; // Keep the message channel open for async response
    }

    if (request.action === "stopVideoRecording") {
      stopVideoRecording()
        .then(() => {
          sendResponse({ success: true });
        })
        .catch((error) => {
          console.error("Error stopping video recording:", error);
          sendResponse({ success: false, error: error.message });
        });
      return true; // Keep the message channel open for async response
    }

    if (request.action === "getVideoBlob") {
      console.log("Handling getVideoBlob request");
      console.log("Current video blob exists?", !!window.currentVideoBlob);

      // Return the video blob if available
      if (window.currentVideoBlob) {
        console.log("Video blob size:", window.currentVideoBlob.size);
        console.log("Video blob type:", window.currentVideoBlob.type);
        sendResponse({
          success: true,
          hasVideo: true,
          size: window.currentVideoBlob.size,
          type: window.currentVideoBlob.type,
        });
      } else {
        console.log("No video blob found");
        sendResponse({ success: true, hasVideo: false });
      }
      return true;
    }

    if (request.action === "downloadVideo") {
      // Handle video download from content script
      if (window.currentVideoBlob) {
        try {
          const url = URL.createObjectURL(window.currentVideoBlob);
          const a = document.createElement("a");
          a.style.display = "none";
          a.href = url;
          a.download = `bug-video-${Date.now()}.webm`;
          document.body.appendChild(a);
          a.click();
          URL.revokeObjectURL(url);
          document.body.removeChild(a);
          sendResponse({ success: true });
        } catch (error) {
          console.error("Error downloading video:", error);
          sendResponse({ success: false, error: error.message });
        }
      } else {
        sendResponse({ success: false, error: "No video available" });
      }
      return true;
    }

    return true;
  });
} // End of sumoDebuggerLoaded check
