// Import functions will be available globally since they're loaded via manifest.json

document.addEventListener("DOMContentLoaded", () => {
  console.log("POPUP SCRIPT LOADED - DOM ready");

  // Step buttons
  const selectRegionBtn = document.getElementById("selectRegionBtn");
  const recordNetworkBtn = document.getElementById("recordNetworkBtn");
  const reportBugBtn = document.getElementById("reportBugBtn");
  const clearDataBtn = document.getElementById("clearDataBtn");

  // Status texts
  const step1Status = document.getElementById("step1Status");
  const step2Status = document.getElementById("step2Status");

  // Recording indicators
  const recordingIndicators = document.getElementById("recordingIndicators");
  const recordingTimer = document.getElementById("recordingTimer");
  const networkCounter = document.getElementById("networkCounter");
  const consoleCounter = document.getElementById("consoleCounter");
  const videoStatus = document.getElementById("videoStatus");

  // Info panels
  const teamInfoPanel = document.getElementById("teamInfoPanel");
  const evidencePanel = document.getElementById("evidencePanel");

  // Team info elements
  const teamName = document.getElementById("teamName");
  const managerName = document.getElementById("managerName");
  const jiraLabel = document.getElementById("jiraLabel");
  const slackChannel = document.getElementById("slackChannel");

  // Evidence elements
  const videoEvidence = document.getElementById("videoEvidence");
  const networkEvidence = document.getElementById("networkEvidence");
  const consoleEvidence = document.getElementById("consoleEvidence");
  const downloadScreenshot = document.getElementById("downloadScreenshot");
  const downloadHar = document.getElementById("downloadHar");
  const downloadLogs = document.getElementById("downloadLogs");

  // Form elements
  const bugDescription = document.getElementById("bugDescription"); // title // summary
  const severityLevel = document.getElementById("severityLevel");
  const stepsToReproduce = document.getElementById("stepsToReproduce"); // descritpion
  const descriptionCounter = document.getElementById("descriptionCounter");

  // Footer elements

  // Modal elements
  const confirmModal = document.getElementById("confirmModal");
  const modalCancel = document.getElementById("modalCancel");
  const modalConfirm = document.getElementById("modalConfirm");

  // State variables
  let isRecording = false;
  let currentTabId = null;
  let recordingStartTime = null;
  let timerInterval = null;
  let currentStep = 1;
  let bugComponentData = null;
  let networkData = [];
  let consoleData = [];
  let videoBlob = null;
  let mediaRecorder = null;

  // Function to collect browser and system information
  function getBrowserInfo() {
    const userAgent = navigator.userAgent;
    let browserName = "Unknown";
    let browserVersion = "Unknown";
    let osInfo = "Unknown";

    // Detect browser
    if (userAgent.includes("Chrome") && !userAgent.includes("Edg")) {
      browserName = "Google Chrome";
      const chromeMatch = userAgent.match(/Chrome\/([0-9.]+)/);
      browserVersion = chromeMatch ? chromeMatch[1] : "Unknown";
    } else if (userAgent.includes("Firefox")) {
      browserName = "Mozilla Firefox";
      const firefoxMatch = userAgent.match(/Firefox\/([0-9.]+)/);
      browserVersion = firefoxMatch ? firefoxMatch[1] : "Unknown";
    } else if (userAgent.includes("Safari") && !userAgent.includes("Chrome")) {
      browserName = "Apple Safari";
      const safariMatch = userAgent.match(/Version\/([0-9.]+)/);
      browserVersion = safariMatch ? safariMatch[1] : "Unknown";
    } else if (userAgent.includes("Edg")) {
      browserName = "Microsoft Edge";
      const edgeMatch = userAgent.match(/Edg\/([0-9.]+)/);
      browserVersion = edgeMatch ? edgeMatch[1] : "Unknown";
    }

    // Detect OS
    if (userAgent.includes("Windows NT")) {
      const windowsMatch = userAgent.match(/Windows NT ([0-9.]+)/);
      const version = windowsMatch ? windowsMatch[1] : "";
      const windowsVersions = {
        "10.0": "Windows 10/11",
        6.3: "Windows 8.1",
        6.2: "Windows 8",
        6.1: "Windows 7",
      };
      osInfo = windowsVersions[version] || "Windows " + version;
    } else if (userAgent.includes("Mac OS X")) {
      const macMatch = userAgent.match(/Mac OS X ([0-9_]+)/);
      if (macMatch) {
        const version = macMatch[1].replace(/_/g, ".");
        osInfo = "macOS " + version;
      } else {
        osInfo = "macOS";
      }
    } else if (userAgent.includes("Linux")) {
      osInfo = "Linux";
    } else if (userAgent.includes("Android")) {
      const androidMatch = userAgent.match(/Android ([0-9.]+)/);
      osInfo = androidMatch ? "Android " + androidMatch[1] : "Android";
    } else if (userAgent.includes("iPhone") || userAgent.includes("iPad")) {
      const iosMatch = userAgent.match(/OS ([0-9_]+)/);
      if (iosMatch) {
        const version = iosMatch[1].replace(/_/g, ".");
        osInfo = userAgent.includes("iPad")
          ? "iPadOS " + version
          : "iOS " + version;
      } else {
        osInfo = userAgent.includes("iPad") ? "iPadOS" : "iOS";
      }
    }

    return {
      browser: browserName,
      version: browserVersion,
      os: osInfo,
      userAgent: userAgent,
    };
  }

  // Function to format browser info for summary
  function formatBrowserInfo() {
    const info = getBrowserInfo();
    return `**Environment Information:**
- Browser: ${info.browser}
- Browser Version: ${info.version}
- Operating System: ${info.os}

**Summary:**
`;
  }

  // Function to ensure browser info stays at the top of summary
  function handleSummaryInput() {
    const currentValue = stepsToReproduce.value;
    const browserInfoSection = formatBrowserInfo();

    // Check if browser info is missing from the start
    if (!currentValue.startsWith("**Environment Information:**")) {
      // Find if there's any user content after the browser info
      const userContent = currentValue.replace(
        /^\*\*Environment Information:\*\*[\s\S]*?\*\*Summary:\*\*\s*/,
        ""
      );

      // Reconstruct with browser info at top and user content after
      stepsToReproduce.value = browserInfoSection + userContent;

      // Move cursor to end of user content
      const endPosition = stepsToReproduce.value.length;
      stepsToReproduce.setSelectionRange(endPosition, endPosition);
    }

    updateCharCounter();
    validateForm();
  }

  // Initialize popup
  console.log("CALLING initializePopup()");
  initializePopup();

  async function initializePopup() {
    console.log("INSIDE initializePopup()");
    try {
      // Get current tab
      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });
      currentTabId = tab.id;

      // Check URL validation
      if (
        !tab.url.includes("sumologic.net") &&
        !tab.url.includes("localhost:8443")
      ) {
        step1Status.textContent = "Please navigate to a Sumo Logic page first";
        selectRegionBtn.disabled = true;
        return;
      }

      // Check if we should navigate to step 2 (from toast click)
      const { navigateToStep, autoStartedRecording } =
        await chrome.storage.local.get([
          "navigateToStep",
          "autoStartedRecording",
        ]);

      if (navigateToStep === 2) {
        // Clear the navigation flag
        await chrome.storage.local.remove([
          "navigateToStep",
          "autoStartedRecording",
        ]);
        // Set current step to 2
        currentStep = 2;
        if (autoStartedRecording) {
          isRecording = true;
          startRecordingUI();
        }
      }

      // Check if recording is in progress
      const recordingState = await chrome.runtime.sendMessage({
        action: "getRecordingState",
        tabId: currentTabId,
      });

      if (recordingState && recordingState.isRecording) {
        isRecording = true;
        currentStep = Math.max(currentStep, 2); // Ensure we're at least on step 2

        // Get the original recording start time from background
        const stats = await chrome.runtime.sendMessage({
          action: "getRecordingStats",
          tabId: currentTabId,
        });

        if (stats && stats.startTime) {
          recordingStartTime = stats.startTime;
          console.log(
            "Restored recording start time:",
            new Date(recordingStartTime)
          );
        } else {
          // Fallback: use current time minus a reasonable default
          recordingStartTime = Date.now() - 10000; // Assume 10 seconds ago
          console.log(
            "No start time found, using fallback:",
            new Date(recordingStartTime)
          );
        }

        startRecordingUI(true); // Preserve start time

        // Don't start new recording, just restore UI state
        console.log("Recording already in progress, restoring UI state");
      }

      // Check for existing video recording and restore blob
      const storedVideo = await chrome.storage.local.get(["videoData"]);
      if (storedVideo.videoData && !videoBlob) {
        try {
          // Restore video blob from stored array buffer
          if (storedVideo.videoData.data) {
            const uint8Array = new Uint8Array(storedVideo.videoData.data);
            videoBlob = new Blob([uint8Array], {
              type: storedVideo.videoData.type || "video/webm",
            });
            console.log("Video blob restored during initialization");
          }
        } catch (error) {
          console.warn("Could not restore video blob:", error);
        }
      }

      // Load existing data (only if we didn't clear due to navigation)
      await loadExistingData();

      // If no region data found, try again after a short delay
      // This handles timing issues where content script just saved data

      console.log("CALLING updateUI()");
      updateUI();

      // Initialize browser info in summary if it's empty
      if (stepsToReproduce && stepsToReproduce.value.trim() === "") {
        stepsToReproduce.value = formatBrowserInfo();
        updateCharCounter();
      }
    } catch (error) {
      console.error("Error initializing popup:", error);
    }
  }

  // Event Listeners
  selectRegionBtn.addEventListener("click", handleComponentSelection);
  recordNetworkBtn.addEventListener("click", handleRecording);
  reportBugBtn.addEventListener("click", handleReportBug);
  clearDataBtn.addEventListener("click", showClearDataModal);

  // Form event listeners
  bugDescription.addEventListener("input", updateCharCounter);
  bugDescription.addEventListener("input", validateForm);
  stepsToReproduce.addEventListener("input", handleSummaryInput);
  severityLevel.addEventListener("change", validateForm);

  // Modal event listeners
  modalCancel.addEventListener("click", hideClearDataModal);
  modalConfirm.addEventListener("click", handleClearData);

  // Evidence thumbnail listeners

  document
    .getElementById("downloadVideo")
    .addEventListener("click", downloadVideo);
  downloadHar.addEventListener("click", downloadHarFile);
  downloadLogs.addEventListener("click", downloadLogsFile);

  // Component Selection Handler
  async function handleComponentSelection() {
    try {
      step1Status.textContent = "Hover over module and click to select";
      selectRegionBtn.textContent = "Module Selection Active...";
      selectRegionBtn.className = "button warning-btn";
      selectRegionBtn.disabled = true;

      // Inject and execute content script
      await chrome.scripting.executeScript({
        target: { tabId: currentTabId },
        files: ["content.js"],
      });

      // Wait for injection to complete
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Start component selection
      const response = await chrome.tabs.sendMessage(currentTabId, {
        action: "startComponentSelection",
      });

      if (response && response.success) {
        // Close popup to allow user interaction
        setTimeout(() => window.close(), 1000);
      } else {
        throw new Error("Failed to start component selection");
      }
    } catch (error) {
      console.error("Error starting component selection:", error);
      step1Status.textContent =
        "Error: Could not start selection. Please refresh and try again.";
      selectRegionBtn.textContent = "Select Module";
      selectRegionBtn.className = "button primary-btn";
      selectRegionBtn.disabled = false;
    }
  }

  // Recording Handler
  async function handleRecording() {
    try {
      if (!isRecording) {
        await startRecording();
      } else {
        await stopRecording();
      }
    } catch (error) {
      console.error("Error handling recording:", error);
      stopRecordingUI();
    }
  }

  async function startRecording() {
    // Start network recording
    const networkResponse = await chrome.runtime.sendMessage({
      action: "startNetworkRecording",
      tabId: currentTabId,
    });

    if (!networkResponse || !networkResponse.success) {
      throw new Error("Failed to start network recording");
    }

    // Start console recording immediately after network recording
    console.log("Starting console recording for tab:", currentTabId);
    const consoleResponse = await chrome.runtime.sendMessage({
      action: "startConsoleRecording",
      tabId: currentTabId,
    });
    console.log("Console recording start response:", consoleResponse);

    if (!consoleResponse || !consoleResponse.success) {
      console.warn("Failed to start console recording:", consoleResponse);
    }

    // Start video recording in content script (persists when popup closes)
    try {
      console.log("Starting video recording via content script...");

      const videoResponse = await chrome.tabs.sendMessage(currentTabId, {
        action: "startVideoRecording",
      });

      if (videoResponse && videoResponse.success) {
        console.log("Video recording started successfully in content script");
      } else {
        throw new Error("Failed to start video recording in content script");
      }

      // Start the timer UI only after video recording actually starts
      startRecordingUI();

      // Notify background script that video recording started
      await chrome.runtime.sendMessage({
        action: "startVideoRecording",
        tabId: currentTabId,
      });
    } catch (videoError) {
      console.warn("Video recording failed:", videoError);
      // Start UI anyway if video fails - still have network/console recording
      startRecordingUI();
    }

    // Note: startRecordingUI() is now called only when video recording actually starts
  }

  async function stopRecording() {
    // Stop network recording
    const networkResponse = await chrome.runtime.sendMessage({
      action: "stopNetworkRecording",
      tabId: currentTabId,
    });

    if (networkResponse && networkResponse.success) {
      networkData = networkResponse.networkCalls || [];
      console.log(
        `Stopped network recording: ${networkData.length} events captured`
      );
      console.log("Network data:", networkData);
    } else {
      console.log("Network recording failed:", networkResponse);
    }

    // Stop console recording
    console.log("Stopping console recording for tab:", currentTabId);
    const consoleResponse = await chrome.runtime.sendMessage({
      action: "stopConsoleRecording",
      tabId: currentTabId,
    });
    console.log("Console recording stop response:", consoleResponse);

    if (consoleResponse && consoleResponse.success) {
      consoleData = consoleResponse.consoleLogs || [];
      console.log("Retrieved console data:", consoleData.length, "logs");
      console.log("Console data sample:", consoleData.slice(0, 3)); // Show first 3 logs
    } else {
      console.log("Console recording stop failed or no data");
      console.log("Console response:", consoleResponse);
    }

    // Stop video recording via content script
    try {
      console.log("=== STOP VIDEO RECORDING FUNCTION CALLED ===");

      // Show processing status immediately
      updateUI();

      // Stop video recording in content script
      const videoResponse = await chrome.tabs.sendMessage(currentTabId, {
        action: "stopVideoRecording",
      });

      if (videoResponse && videoResponse.success) {
        console.log("Video recording stopped successfully in content script");
      } else {
        console.error("Failed to stop video recording in content script");
      }

      // Notify background script that video recording stopped
      await chrome.runtime.sendMessage({
        action: "stopVideoRecording",
        tabId: currentTabId,
      });
    } catch (videoError) {
      console.warn("Error stopping video recording:", videoError);
    }

    // Save recording data
    console.log("=== SAVING RECORDING DATA ===");
    console.log("Network data to save:", networkData.length, "events");
    console.log("Console data to save:", consoleData.length, "logs");
    console.log("Console data sample:", consoleData.slice(0, 3));

    await chrome.storage.local.set({
      networkData: networkData,
      consoleData: consoleData,
      recordingTimestamp: Date.now(),
    });

    console.log("Recording data saved to storage");

    stopRecordingUI();
    currentStep = 3;
    updateUI();
  }
  function startRecordingUI(preserveStartTime = false) {
    console.log("Starting recording UI, preserveStartTime:", preserveStartTime);
    isRecording = true;

    // Only set new start time if not preserving existing one
    if (!preserveStartTime || !recordingStartTime) {
      recordingStartTime = Date.now();
      console.log(
        "Set new recording start time:",
        new Date(recordingStartTime)
      );
    } else {
      console.log(
        "Preserving existing start time:",
        new Date(recordingStartTime)
      );
    }

    recordNetworkBtn.textContent = "⏹️ Stop Recording";
    recordNetworkBtn.className = "button danger-btn";
    step2Status.textContent = "Recording in progress - reproduce the bug now";
    recordingIndicators.classList.remove("hidden");

    // Clear any existing timer before starting new one
    if (timerInterval) {
      console.log("Clearing existing timer interval");
      clearInterval(timerInterval);
    }

    // Start timer
    console.log("Starting timer interval");
    timerInterval = setInterval(updateRecordingTimer, 1000);

    // Immediately update timer once
    updateRecordingTimer();

    // Start counters update
    setInterval(updateRecordingCounters, 2000);

    // Immediately update counters once
    updateRecordingCounters();
  }

  function stopRecordingUI() {
    isRecording = false;
    recordingStartTime = null;

    recordNetworkBtn.textContent = "✅ Recording Complete";
    recordNetworkBtn.className = "button success-btn";
    recordNetworkBtn.disabled = true;
    recordNetworkBtn.style.cursor = "not-allowed";
    step2Status.textContent = "Evidence collection completed successfully";
    recordingIndicators.classList.add("hidden");

    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }
  }

  async function updateRecordingTimer() {
    if (!isRecording) {
      console.log("Timer update called but not recording");
      return;
    }

    try {
      // Get elapsed time from background script
      const response = await chrome.runtime.sendMessage({
        action: "getRecordingStats",
        tabId: currentTabId,
      });

      if (response && response.startTime) {
        const elapsed = Math.floor((Date.now() - response.startTime) / 1000);
        const minutes = Math.floor(elapsed / 60)
          .toString()
          .padStart(2, "0");
        const seconds = (elapsed % 60).toString().padStart(2, "0");
        recordingTimer.textContent = `${minutes}:${seconds}`;
        console.log("Timer updated from background:", `${minutes}:${seconds}`);
      } else {
        throw new Error("No background stats available");
      }
    } catch (error) {
      console.log("Background timer failed, using fallback:", error.message);
      // Fallback to local calculation if background call fails
      if (recordingStartTime) {
        const elapsed = Math.floor((Date.now() - recordingStartTime) / 1000);
        const minutes = Math.floor(elapsed / 60)
          .toString()
          .padStart(2, "0");
        const seconds = (elapsed % 60).toString().padStart(2, "0");
        recordingTimer.textContent = `${minutes}:${seconds}`;
        console.log("Timer updated from fallback:", `${minutes}:${seconds}`);
      } else {
        console.error("No recording start time available for timer");
        recordingTimer.textContent = "00:00";
      }
    }
  }

  async function updateRecordingCounters() {
    if (!isRecording) return;

    try {
      const response = await chrome.runtime.sendMessage({
        action: "getRecordingStats",
        tabId: currentTabId,
      });

      if (response) {
        console.log("🐛 updateRecordingCounters response:", response);

        networkCounter.textContent = `${response.networkCount || 0} requests`;
        consoleCounter.textContent = `${response.consoleCount || 0} logs`;

        console.log("🐛 Console count:", response.consoleCount || 0);
      }
    } catch (error) {
      console.warn("Failed to update recording counters:", error);
    }
  }

  // Report Bug Handler
  async function handleReportBug() {
    if (!validateForm()) {
      return;
    }

    try {
      reportBugBtn.textContent = "Creating Jira ticket...";
      reportBugBtn.disabled = true;
      const projectId = "10057"; // sumo project ID
      const priority = "3"; // Medium priority
      const componentName = "Query editor";
      const parentKey = "SUMO-268781"; // hack sumo issue epic
      const componentId = "10702"; // logs/metric UI

      // Collect all data
      const bugReport = {
        bugComponentData: bugComponentData,
        networkData: networkData,
        consoleData: consoleData,
        videoBlob: videoBlob,

        description: stepsToReproduce.value,
        title: componentName + " - " + (bugDescription.value || "Bug Report"),

        severity: severityLevel.value,
        timestamp: Date.now(),
        url: (await chrome.tabs.get(currentTabId)).url,
        userAgent: navigator.userAgent,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      };

      // Save the complete report
      await chrome.storage.local.set({ bugReport: bugReport });

      // Future: Send to Jira and Slack
      // await createJiraTicket(bugReport);
      // await notifySlackChannel(bugReport);

      window.jiraService
        .getCurrentUser()
        .then((res) => {
          const reporterId = res.accountId;
          const assigneeId = "61d857c2e67ea2006bf76275";

          return window.jiraService.createJiraIssue({
            assigneeId: assigneeId,
            componentId: componentId,
            description: bugReport.description,
            projectId: projectId,
            reporterId: reporterId,
            summary: bugReport.title,

            priority,
            parentKey,
          });
        })
        .then(async (res) => {
          const harBlob = window.utils.createHarBlob(networkData);
          const consoleBlob = window.utils.createConsoleBlob(consoleData);
          const recordingRes = await chrome.tabs.sendMessage(currentTabId, {
            action: "getRecordingBlob",
          });
          const uint8Array = new Uint8Array(recordingRes.videoData);

          videoBlob = new Blob([uint8Array], {
            type: "video/webm",
          });
          return window.jiraService.attachFilesToJira(
            res.key,
            harBlob,
            consoleBlob,
            videoBlob
          );
        })
        .then((jiraLink) => {
          return window.jiraService
            .reportIssueInSlack(jiraLink, bugReport.title)
            .then(() => jiraLink);
        })
        .then((jiraLink) => {
          // For now, just show success (Jira integration will be added later)
          document.querySelector(
            "#afterJiraAddition"
          ).innerHTML = `Your Jira is created and posted in <b><a href="https://sumologic.enterprise.slack.com/archives/C08MQ8GENEN" target="_blank">Slack</a></b>`;
          reportBugBtn.textContent = "✅ Bug Reported Successfully";
          reportBugBtn.className = "button success-btn btn-width";
        });
    } catch (error) {
      console.error("Error reporting bug:", error);
      reportBugBtn.textContent = "Error - Try Again";
      reportBugBtn.disabled = false;
    }
  }

  // Clear Data Handlers
  function showClearDataModal() {
    confirmModal.classList.remove("hidden");
  }

  function hideClearDataModal() {
    confirmModal.classList.add("hidden");
  }

  async function handleClearData() {
    try {
      // Clear all Chrome storage
      await chrome.storage.local.clear();

      // Clear runtime state
      await chrome.runtime.sendMessage({ action: "clearAllData" });

      // Reset UI state
      currentStep = 1;
      bugComponentData = null;
      networkData = [];
      consoleData = [];
      videoBlob = null;
      isRecording = false;

      // Reset form
      bugDescription.value = "";
      // Keep default severity as 'medium' since dropdown no longer has empty option
      severityLevel.value = "medium";
      stepsToReproduce.value = formatBrowserInfo();

      // Update character counter after resetting summary
      updateCharCounter();

      // Reset button states
      selectRegionBtn.textContent = "🎯 Start Selection";
      selectRegionBtn.className = "button primary-btn";
      selectRegionBtn.disabled = false;

      recordNetworkBtn.textContent = "🎬 Record Evidence";
      recordNetworkBtn.className = "button primary-btn";
      recordNetworkBtn.disabled = true;

      // Hide panels
      teamInfoPanel.classList.add("hidden");
      evidencePanel.classList.add("hidden");

      // Reset status messages
      step1Status.textContent = "Click to start selecting the buggy component";
      step2Status.textContent = "Record your steps to reproduce the bug";

      // Update UI
      updateUI();
      hideClearDataModal();
    } catch (error) {
      console.error("Error clearing data:", error);
    }
  }

  // Load Existing Data
  async function loadExistingData() {
    try {
      const result = await chrome.storage.local.get([
        "bugComponentData",
        "networkData",
        "consoleData",
        "videoData",
        "bugReport",
      ]);

      if (result.bugComponentData) {
        bugComponentData = result.bugComponentData;
        currentStep = Math.max(currentStep, 2);
        console.log(
          "Loaded bugRegionData, setting currentStep to:",
          currentStep
        );

        // Show team info
        if (bugComponentData.teamInfo) {
          displayTeamInfo(bugComponentData.teamInfo);
        }
      }

      if (result.networkData && result.networkData.length > 0) {
        networkData = result.networkData;
        currentStep = Math.max(currentStep, 3);
      }

      if (result.consoleData && result.consoleData.length > 0) {
        console.log("=== RESTORING CONSOLE DATA FROM STORAGE ===");
        console.log(
          "Console data from storage:",
          result.consoleData.length,
          "logs"
        );
        console.log("Console data sample:", result.consoleData.slice(0, 3));
        consoleData = result.consoleData;
        currentStep = Math.max(currentStep, 3);
      } else {
        console.log("=== NO CONSOLE DATA IN STORAGE, CHECKING BACKGROUND ===");
        // Try to get console logs from background script (like video does)
        try {
          const consoleResponse = await chrome.runtime.sendMessage({
            action: "getConsoleLogs",
          });

          if (
            consoleResponse &&
            consoleResponse.success &&
            consoleResponse.consoleLogs &&
            consoleResponse.consoleLogs.length > 0
          ) {
            console.log(
              "Retrieved console logs from background:",
              consoleResponse.consoleLogs.length,
              "logs"
            );
            consoleData = consoleResponse.consoleLogs;
            currentStep = Math.max(currentStep, 3);
          } else {
            console.log("No console logs found in background either");
          }
        } catch (error) {
          console.warn("Error retrieving console logs from background:", error);
        }
      }

      // Restore video blob if available
      if (result.videoData && !videoBlob) {
        try {
          // Restore video blob from stored array buffer
          if (result.videoData.data) {
            const uint8Array = new Uint8Array(result.videoData.data);
            videoBlob = new Blob([uint8Array], {
              type: result.videoData.type || "video/webm",
            });
            console.log("Video blob restored from storage");
            currentStep = Math.max(currentStep, 3);
          }
        } catch (error) {
          console.warn("Could not restore video blob:", error);
        }
      }

      updateUI();
    } catch (error) {
      console.error("Error loading existing data:", error);
    }
  }

  // UI Update Functions
  function updateUI() {
    console.log("Updating UI for currentStep:", bugComponentData);
    // step 1
    if (bugComponentData) {
      selectRegionBtn.textContent = "Component Selected";
      selectRegionBtn.className = "button success-btn";
      selectRegionBtn.disabled = true;
      selectRegionBtn.style.cursor = "not-allowed";
      step1Status.textContent = `Module ${bugComponentData?.componentName} captured successfully`;
    } else {
      selectRegionBtn.textContent = "🎯 Start Selection";
      selectRegionBtn.className = "button primary-btn";
      selectRegionBtn.disabled = false;
      selectRegionBtn.style.cursor = "pointer";
    }

    // Update record button state (step 2) with clear precedence:
    // 1) If currently recording -> enabled (stop)
    // 2) If recording completed (currentStep >= 3 and not recording) -> disabled success
    // 3) If step 1 completed -> enabled and secondary
    // 4) Otherwise -> disabled
    if (isRecording) {
      recordNetworkBtn.disabled = false;
      recordNetworkBtn.textContent = "⏹️ Stop Recording";
      recordNetworkBtn.className = "button danger-btn";
      recordNetworkBtn.style.cursor = "pointer";
      step2Status.textContent = "Recording in progress - reproduce the bug now";
    } else if (currentStep >= 3) {
      // Recording finished - disabled success
      recordNetworkBtn.disabled = true;
      recordNetworkBtn.textContent = " Recording Complete";
      recordNetworkBtn.className = "button success-btn";
      recordNetworkBtn.style.cursor = "not-allowed";
      step2Status.textContent = "Evidence collection completed successfully";
    } else if (bugComponentData) {
      // Step 1 done, ready to start recording - secondary button
      recordNetworkBtn.disabled = false;
      recordNetworkBtn.textContent = "🔴 Start Recording";
      recordNetworkBtn.className = "button primary-btn";
      recordNetworkBtn.style.cursor = "pointer";
      step2Status.textContent = "Click to start recording reproducible steps";
    } else {
      // Default: disabled
      recordNetworkBtn.disabled = true;
      recordNetworkBtn.textContent = "🎬 Record Evidence";
      recordNetworkBtn.className = "button primary-btn";
      recordNetworkBtn.style.cursor = "not-allowed";
      step2Status.textContent = "Record your steps to reproduce the bug";
    }

    // Update step 2
    if (networkData.length > 0 || consoleData.length > 0) {
      currentStep = Math.max(currentStep, 3);
    }

    // Update step 3 visibility
    if (currentStep >= 3) {
      displayEvidencePanel();
      validateForm();
    }
  }

  function displayTeamInfo(teamInfo) {
    teamName.textContent = teamInfo.teamName || "Unknown";
    managerName.textContent = teamInfo.managerName || "Unknown";
    jiraLabel.textContent = teamInfo.teamJiraLabel || "Unknown";
    slackChannel.textContent = teamInfo.slackChannel || "Unknown";
    slackChannel.href = teamInfo.slackChannelId || "#";
    teamInfoPanel.classList.remove("hidden");
  }

  function displayEvidencePanel() {
    evidencePanel.classList.remove("hidden");

    videoEvidence.classList.remove("hidden");
    networkEvidence.classList.remove("hidden");
    consoleEvidence.classList.remove("hidden");

    // Handle video evidence
    console.log(
      "Checking video evidence - videoBlob exists:",
      !!videoBlob,
      "isRecording:",
      isRecording
    );
    if (videoBlob) {
      // Calculate and show file size
      const sizeInMB = (videoBlob.size / (1024 * 1024)).toFixed(2);
      document.getElementById(
        "videoDuration"
      ).textContent = `${sizeInMB} MB video file`;

      // Enable download button
      const downloadBtn = document.getElementById("downloadVideo");
      downloadBtn.disabled = false;
      downloadBtn.textContent = "⬇️ Download";
      downloadBtn.style.opacity = "1";
      downloadBtn.style.cursor = "pointer";
    } else if (isRecording) {
      // Currently recording
      document.getElementById("videoDuration").textContent =
        "Recording in progress...";
      const downloadBtn = document.getElementById("downloadVideo");
      downloadBtn.disabled = true;
      downloadBtn.textContent = "🔄 Recording...";
      downloadBtn.style.opacity = "0.5";
      downloadBtn.style.cursor = "not-allowed";
    } else {
      // Check if video is available in content script
      console.log("Trying to restore video from content script...");

      // Async function to handle video restoration
      (async () => {
        try {
          console.log("Current tab ID:", currentTabId);

          console.log("Sending getVideoBlob message to content script...");
          const response = await chrome.tabs.sendMessage(currentTabId, {
            action: "getVideoBlob",
          });

          console.log("Content script response:", response);

          if (response && response.success && response.hasVideo) {
            console.log("Content script has video blob, size:", response.size);

            // Show video is available
            const sizeInMB = (response.size / (1024 * 1024)).toFixed(2);
            document.getElementById(
              "videoDuration"
            ).textContent = `${sizeInMB} MB video file`;

            const downloadBtn = document.getElementById("downloadVideo");
            downloadBtn.disabled = false;
            downloadBtn.textContent = "⬇️ Download";
            downloadBtn.style.opacity = "1";
            downloadBtn.style.cursor = "pointer";
          } else {
            throw new Error("No video available in content script");
          }
        } catch (error) {
          console.log("Could not get video from content script:", error);

          // Fallback: Check storage for metadata only
          chrome.storage.local.get(["videoData"]).then((result) => {
            console.log("Storage result for videoData:", result);
            if (result.videoData && result.videoData.hasVideo) {
              console.log(
                "Found video metadata in storage, size:",
                result.videoData.size
              );

              // Show that video was recorded but may not be available
              const sizeInMB = (result.videoData.size / (1024 * 1024)).toFixed(
                2
              );
              document.getElementById(
                "videoDuration"
              ).textContent = `${sizeInMB} MB video (not available)`;

              const downloadBtn = document.getElementById("downloadVideo");
              downloadBtn.disabled = true;
              downloadBtn.textContent = "⚠️ Lost";
              downloadBtn.style.opacity = "0.5";
              downloadBtn.style.cursor = "not-allowed";
            } else {
              // No video data available
              console.log("No video metadata found in storage");
              document.getElementById("videoDuration").textContent =
                "No video recorded";
              const downloadBtn = document.getElementById("downloadVideo");
              downloadBtn.disabled = true;
              downloadBtn.textContent = "⬇️ Download";
              downloadBtn.style.opacity = "0.5";
              downloadBtn.style.cursor = "not-allowed";
            }
          });
        }
      })();
    }

    // Handle network evidence
    if (networkData.length > 0) {
      const size = calculateDataSize(networkData);
      document.getElementById(
        "networkSummary"
      ).textContent = `${networkData.length} requests, ${size}`;

      // Enable download button
      const downloadBtn = document.getElementById("downloadHar");
      downloadBtn.disabled = false;
      downloadBtn.textContent = "⬇️ Download";
      downloadBtn.style.opacity = "1";
      downloadBtn.style.cursor = "pointer";
    } else {
      // No network data
      document.getElementById("networkSummary").textContent =
        "No network data captured";

      // Disable download button
      const downloadBtn = document.getElementById("downloadHar");
      downloadBtn.disabled = true;
      downloadBtn.textContent = "⬇️ Download";
      downloadBtn.style.opacity = "0.5";
      downloadBtn.style.cursor = "not-allowed";
    }

    // Handle console evidence
    console.log(
      "Checking console evidence - consoleData length:",
      consoleData.length
    );
    console.log("Console data:", consoleData);

    if (consoleData.length > 0) {
      // Calculate file size like video does
      const consoleJson = JSON.stringify(consoleData, null, 2);
      const sizeInBytes = new Blob([consoleJson]).size;
      const sizeInKB = (sizeInBytes / 1024).toFixed(2);

      console.log("Console file size:", sizeInKB, "KB");

      document.getElementById(
        "consoleSummary"
      ).textContent = `${consoleData.length} logs (${sizeInKB} KB)`;

      // Enable download button
      const downloadBtn = document.getElementById("downloadLogs");
      console.log("Enabling console download button");
      downloadBtn.disabled = false;
      downloadBtn.textContent = "⬇️ Download";
      downloadBtn.style.opacity = "1";
      downloadBtn.style.cursor = "pointer";
    } else {
      console.log("No console data found, disabling download button");
      // No console data
      document.getElementById("consoleSummary").textContent =
        "No console data captured";

      // Disable download button
      const downloadBtn = document.getElementById("downloadLogs");
      downloadBtn.disabled = true;
      downloadBtn.textContent = "⬇️ Download";
      downloadBtn.style.opacity = "0.5";
      downloadBtn.style.cursor = "not-allowed";
    }
  } // End of displayEvidencePanel function

  function updateCharCounter() {
    const count = bugDescription.value.length;
    descriptionCounter.textContent = `${count}/1000 characters`;
  }

  function validateForm() {
    const isValid =
      bugDescription.value.trim().length > 0 &&
      (bugComponentData || networkData.length > 0);

    reportBugBtn.disabled = !isValid;
    return isValid;
  }

  // Universal download helper function
  function triggerDownload(blob, filename, mimeType = null) {
    console.log(
      `Triggering download for ${filename}, blob size: ${blob.size} bytes`
    );

    try {
      // Method 1: Try direct blob download
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.style.display = "none";
      a.href = url;
      a.download = filename;

      // Ensure the element is added to DOM
      document.body.appendChild(a);

      // Force click
      a.click();

      // Clean up
      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 100);

      console.log(`Download initiated successfully for ${filename}`);
      return true;
    } catch (error) {
      console.error(`Download failed for ${filename}:`, error);

      // Method 2: Try using chrome downloads API (fallback)
      try {
        const reader = new FileReader();
        reader.onload = function () {
          const dataUrl = reader.result;
          const a = document.createElement("a");
          a.href = dataUrl;
          a.download = filename;
          a.click();
        };
        reader.readAsDataURL(blob);
        console.log(`Fallback download method attempted for ${filename}`);
        return true;
      } catch (fallbackError) {
        console.error(
          `Fallback download also failed for ${filename}:`,
          fallbackError
        );
        alert(
          `Download failed for ${filename}. Please check browser permissions.`
        );
        return false;
      }
    }
  }

  // Test function to verify downloads work
  function testDownload() {
    console.log("Testing download functionality");
    const testData =
      "This is a test file created by Sumo Bug Logger\\n" +
      "If you can see this file, downloads are working correctly!\\n" +
      "Timestamp: " +
      new Date().toISOString();
    const blob = new Blob([testData], { type: "text/plain" });
    const success = triggerDownload(blob, `test-download-${Date.now()}.txt`);

    if (success) {
      console.log("Test download completed successfully");
    } else {
      console.error("Test download failed");
    }
  }

  // Debug function to check data state

  async function downloadVideo() {
    console.log("Download video clicked - delegating to content script");

    try {
      console.log(
        "Attempting to download video from content script, tab ID:",
        currentTabId
      );
      const response = await chrome.tabs.sendMessage(currentTabId, {
        action: "downloadVideo",
      });

      if (response && response.success) {
        console.log("Video download initiated from content script");
      } else {
        throw new Error("Content script download failed");
      }
    } catch (error) {
      console.error("Error downloading video via content script:", error);
      alert("Error downloading video. Please try recording again.");
    }
  }

  function downloadHarFile() {
    console.log(
      "Download HAR clicked, networkData length:",
      networkData.length
    );
    console.log("Network data sample:", networkData.slice(0, 3));

    if (networkData.length === 0) {
      alert(
        "No network data available for download. Please record some network activity first."
      );
      return;
    }

    try {
      // Convert network data to proper HAR format
      const harEntries = convertToHarEntries(networkData);

      console.log(`Generated ${harEntries.length} HAR entries`);
      console.log("HAR entries sample:", harEntries.slice(0, 2));

      if (harEntries.length === 0) {
        console.warn("No valid HAR entries generated from network data");
        alert(
          "No valid network requests found to export. Please try recording network activity again."
        );
        return;
      }

      const harData = {
        log: {
          version: "1.2",
          creator: {
            name: "Sumo Bug Logger",
            version: "1.0",
          },
          browser: {
            name: "Chrome",
            version: navigator.userAgent,
          },
          pages: [
            {
              startedDateTime: new Date().toISOString(),
              id: "page_1",
              title: document.title || "Sumo Logic Page",
              pageTimings: {},
            },
          ],
          entries: harEntries,
        },
      };

      console.log("Final HAR data structure:", {
        entryCount: harData.log.entries.length,
        creator: harData.log.creator,
      });

      const blob = new Blob([JSON.stringify(harData, null, 2)], {
        type: "application/json",
      });

      console.log("Created blob with size:", blob.size, "bytes");

      const success = triggerDownload(
        blob,
        `network-data-${Date.now()}.har`,
        "application/json"
      );
      if (success) {
        console.log("HAR download initiated successfully");
      }
    } catch (error) {
      console.error("Error creating HAR file:", error);
      alert("Error creating HAR file. Please check the console for details.");
    }
  }

  // Convert network events to proper HAR entries
  function convertToHarEntries(networkEvents) {
    const requestMap = new Map();
    const entries = [];

    // Group requests and responses by requestId
    networkEvents.forEach((event, index) => {
      try {
        const requestId = event.requestId;

        if (!requestId) {
          console.warn(`Event ${index} missing requestId:`, event);
          return;
        }

        if (!requestMap.has(requestId)) {
          requestMap.set(requestId, {});
        }

        if (event.type === "request") {
          requestMap.get(requestId).request = event;
        } else if (event.type === "response") {
          requestMap.get(requestId).response = event;
        } else if (event.type === "failure") {
          requestMap.get(requestId).failure = event;
        }
      } catch (error) {
        console.warn(`Error processing event ${index}:`, error, event);
      }
    });

    console.log(`Grouped into ${requestMap.size} unique requests`);

    // Convert to HAR entries
    requestMap.forEach((data, requestId) => {
      try {
        const request = data.request;
        const response = data.response;
        const failure = data.failure;

        if (!request) {
          console.warn(`No request data for requestId ${requestId}`);
          return; // Skip if no request data
        }

        // Convert Chrome timestamp to ISO string
        const startTime = new Date(request.timestamp * 1000).toISOString();

        const entry = {
          pageref: "page_1",
          startedDateTime: startTime,
          time: response
            ? Math.round((response.timestamp - request.timestamp) * 1000)
            : 0,
          request: {
            method: request.method || "GET",
            url: request.url || "",
            httpVersion: "HTTP/1.1",
            headers: convertHeaders(request.headers || {}),
            queryString: [],
            cookies: [],
            headersSize: -1,
            bodySize: -1,
          },
          response: response
            ? {
                status: response.status || 0,
                statusText: response.statusText || "",
                httpVersion: "HTTP/1.1",
                headers: convertHeaders(response.headers || {}),
                cookies: [],
                content: {
                  size: -1,
                  mimeType: response.mimeType || "text/plain",
                },
                headersSize: -1,
                bodySize: -1,
              }
            : {
                status: failure ? 0 : 200,
                statusText: failure ? failure.errorText || "Failed" : "OK",
                httpVersion: "HTTP/1.1",
                headers: [],
                cookies: [],
                content: {
                  size: 0,
                  mimeType: "text/plain",
                },
                headersSize: -1,
                bodySize: -1,
              },
          cache: {},
          timings: {
            send: 0,
            wait: response
              ? Math.round((response.timestamp - request.timestamp) * 1000)
              : 0,
            receive: 0,
          },
        };

        entries.push(entry);
      } catch (error) {
        console.warn(
          `Error creating HAR entry for requestId ${requestId}:`,
          error
        );
      }
    });

    console.log(`Successfully created ${entries.length} HAR entries`);
    return entries;
  }

  // Convert headers object to HAR format
  function convertHeaders(headers) {
    if (!headers || typeof headers !== "object") return [];

    return Object.entries(headers).map(([name, value]) => ({
      name: name,
      value: String(value),
    }));
  }

  function downloadLogsFile() {
    console.log(
      "Download logs clicked, consoleData length:",
      consoleData.length
    );

    if (consoleData.length === 0) {
      alert(
        "No console logs available for download. Please record some console activity first."
      );
      return;
    }

    try {
      const logsText = consoleData
        .map(
          (log) =>
            `[${new Date(
              log.timestamp
            ).toISOString()}] ${log.level.toUpperCase()}: ${log.message}`
        )
        .join("\\n");

      const blob = new Blob([logsText], { type: "text/plain" });
      const success = triggerDownload(
        blob,
        `console-logs-${Date.now()}.txt`,
        "text/plain"
      );
      if (success) {
        console.log("Logs download initiated successfully");
      }
    } catch (error) {
      console.error("Error creating logs file:", error);
      alert("Error creating logs file. Please check the console for details.");
    }
  }

  // Utility Functions
  function calculateDataSize(data) {
    const size = new Blob([JSON.stringify(data)]).size;
    if (size < 1024) return `${size} B`;
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  }

  // Listen for storage changes
  chrome.storage.onChanged.addListener((changes, namespace) => {
    console.log("STORAGE CHANGE EVENT:", { changes, namespace });

    if (namespace === "local") {
      if (changes.bugComponentData) {
        bugComponentData = changes.bugComponentData.newValue;
        if (bugComponentData && bugComponentData.teamInfo) {
          displayTeamInfo(bugComponentData.teamInfo);
        }
        console.log(
          "STORAGE CHANGE - setting currentStep to:",
          Math.max(currentStep, 2)
        );
        currentStep = Math.max(currentStep, 2);
        updateUI();
      } else {
        console.log("Storage change but no bugRegionData in changes");
      }
    }
  });

  // Debug function to test button update
  window.testButtonUpdate = function () {
    console.log("Testing button update...");
    console.log("selectRegionBtn element:", selectRegionBtn);
    console.log("Current button text:", selectRegionBtn.textContent);
    console.log("Current button class:", selectRegionBtn.className);

    // Try to update button manually
    selectRegionBtn.textContent = "✅ Test Update";
    selectRegionBtn.className = "button success-btn";
    selectRegionBtn.disabled = true;

    console.log("After manual update:");
    console.log("Button text:", selectRegionBtn.textContent);
    console.log("Button class:", selectRegionBtn.className);
    console.log("Button disabled:", selectRegionBtn.disabled);
  };

  // Simple test function
  window.testConsole = function () {
    console.log("CONSOLE TEST - this should appear");
    alert("Console test - popup script is working");
  };
});
