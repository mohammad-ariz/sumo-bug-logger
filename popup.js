document.addEventListener("DOMContentLoaded", () => {
  // Initialize all UI elements
  const statusDot = document.getElementById("statusDot");
  const statusText = document.getElementById("statusText");
  const progressIndicator = document.getElementById("progressIndicator");

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
  const infoContent = document.getElementById("infoContent");

  // Team info elements
  const teamName = document.getElementById("teamName");
  const managerName = document.getElementById("managerName");
  const jiraLabel = document.getElementById("jiraLabel");
  const slackChannel = document.getElementById("slackChannel");

  // Evidence elements
  const screenshotEvidence = document.getElementById("screenshotEvidence");
  const videoEvidence = document.getElementById("videoEvidence");
  const networkEvidence = document.getElementById("networkEvidence");
  const consoleEvidence = document.getElementById("consoleEvidence");
  const screenshotThumbnail = document.getElementById("screenshotThumbnail");
  const videoThumbnail = document.getElementById("videoThumbnail");
  const downloadHar = document.getElementById("downloadHar");
  const downloadLogs = document.getElementById("downloadLogs");

  // Form elements
  const bugDescription = document.getElementById("bugDescription");
  const severityLevel = document.getElementById("severityLevel");
  const stepsToReproduce = document.getElementById("stepsToReproduce");
  const descriptionCounter = document.getElementById("descriptionCounter");

  // Footer elements
  const dataStatus = document.getElementById("dataStatus");
  const storageUsage = document.getElementById("storageUsage");

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

  // Initialize popup
  initializePopup();

  async function initializePopup() {
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
        updateStatusIndicator("error", "Invalid Page");
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

      // Load existing data
      await loadExistingData();

      // Check if recording is in progress
      const recordingState = await chrome.runtime.sendMessage({
        action: "getRecordingState",
        tabId: currentTabId,
      });

      if (recordingState && recordingState.isRecording) {
        startRecordingUI();
      }

      updateUI();
      updateStorageUsage();
    } catch (error) {
      console.error("Error initializing popup:", error);
      updateStatusIndicator("error", "Initialization Error");
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
  severityLevel.addEventListener("change", validateForm);

  // Modal event listeners
  modalCancel.addEventListener("click", hideClearDataModal);
  modalConfirm.addEventListener("click", handleClearData);

  // Evidence thumbnail listeners
  screenshotThumbnail.addEventListener("click", previewScreenshot);
  videoThumbnail.addEventListener("click", previewVideo);
  document
    .getElementById("downloadVideo")
    .addEventListener("click", downloadVideo);
  downloadHar.addEventListener("click", downloadHarFile);
  downloadLogs.addEventListener("click", downloadLogsFile);

  // Component Selection Handler
  async function handleComponentSelection() {
    try {
      updateStatusIndicator("processing", "Selecting Component");
      step1Status.textContent = "Hover over components with data-component attributes and click to select";
      selectRegionBtn.textContent = "Component Selection Active...";
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
      updateStatusIndicator("error", "Selection Failed");
      step1Status.textContent =
        "Error: Could not start selection. Please refresh and try again.";
      selectRegionBtn.textContent = "Select Buggy Component";
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
      updateStatusIndicator("error", "Recording Error");
      stopRecordingUI();
    }
  }

  async function startRecording() {
    updateStatusIndicator("recording", "Recording");

    // Start network recording
    const networkResponse = await chrome.runtime.sendMessage({
      action: "startNetworkRecording",
      tabId: currentTabId,
    });

    if (!networkResponse || !networkResponse.success) {
      throw new Error("Failed to start network recording");
    }

    // Start video recording
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { mediaSource: "screen" },
        audio: true,
      });

      mediaRecorder = new MediaRecorder(stream, { mimeType: "video/webm" });
      const recordedChunks = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          recordedChunks.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        videoBlob = new Blob(recordedChunks, { type: "video/webm" });
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start();
    } catch (videoError) {
      console.warn("Video recording failed:", videoError);
      // Continue without video recording
    }

    // Start console monitoring
    await chrome.runtime.sendMessage({
      action: "startConsoleRecording",
      tabId: currentTabId,
    });

    startRecordingUI();
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
    const consoleResponse = await chrome.runtime.sendMessage({
      action: "stopConsoleRecording",
      tabId: currentTabId,
    });

    if (consoleResponse && consoleResponse.success) {
      consoleData = consoleResponse.consoleLogs || [];
    }

    // Stop video recording
    if (mediaRecorder && mediaRecorder.state === "recording") {
      mediaRecorder.stop();
    }

    // Save recording data
    await chrome.storage.local.set({
      networkData: networkData,
      consoleData: consoleData,
      recordingTimestamp: Date.now(),
    });

    stopRecordingUI();
    currentStep = 3;
    updateUI();
    updateStatusIndicator("ready", "Recording Complete");
  }

  function startRecordingUI() {
    isRecording = true;
    recordingStartTime = Date.now();

    recordNetworkBtn.textContent = "⏹️ Stop Recording";
    recordNetworkBtn.className = "button danger-btn";
    step2Status.textContent = "Recording in progress - reproduce the bug now";
    recordingIndicators.classList.remove("hidden");

    // Start timer
    timerInterval = setInterval(updateRecordingTimer, 1000);

    // Start counters update
    setInterval(updateRecordingCounters, 2000);
  }

  function stopRecordingUI() {
    isRecording = false;
    recordingStartTime = null;

    recordNetworkBtn.textContent = "✅ Recording Complete";
    recordNetworkBtn.className = "button success-btn";
    recordNetworkBtn.disabled = true;
    step2Status.textContent = "Evidence collection completed successfully";
    recordingIndicators.classList.add("hidden");

    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }
  }

  function updateRecordingTimer() {
    if (!recordingStartTime) return;

    const elapsed = Math.floor((Date.now() - recordingStartTime) / 1000);
    const minutes = Math.floor(elapsed / 60)
      .toString()
      .padStart(2, "0");
    const seconds = (elapsed % 60).toString().padStart(2, "0");
    recordingTimer.textContent = `${minutes}:${seconds}`;
  }

  async function updateRecordingCounters() {
    if (!isRecording) return;

    try {
      const response = await chrome.runtime.sendMessage({
        action: "getRecordingStats",
        tabId: currentTabId,
      });

      if (response) {
        networkCounter.textContent = `${response.networkCount || 0} requests`;
        consoleCounter.textContent = `${response.errorCount || 0} errors, ${
          response.warningCount || 0
        } warnings`;
      }
    } catch (error) {
      console.warn("Failed to update recording counters:", error);
    }
  }

  // Report Bug Handler
  async function handleReportBug() {
    if (!validateForm()) {
      updateStatusIndicator("error", "Form Incomplete");
      return;
    }

    try {
      updateStatusIndicator("processing", "Creating Report");
      reportBugBtn.textContent = "Creating Jira ticket...";
      reportBugBtn.disabled = true;

      // Collect all data
      const bugReport = {
        bugComponentData: bugComponentData,
        networkData: networkData,
        consoleData: consoleData,
        videoBlob: videoBlob,
        description: bugDescription.value,
        severity: severityLevel.value,
        stepsToReproduce: stepsToReproduce.value,
        timestamp: Date.now(),
        url: (await chrome.tabs.get(currentTabId)).url,
        userAgent: navigator.userAgent,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      };

      // For now, just show success (Jira integration will be added later)
      updateStatusIndicator("ready", "Report Ready");
      reportBugBtn.textContent = "✅ Bug Reported Successfully";
      reportBugBtn.className = "button success-btn";

      // Save the complete report
      await chrome.storage.local.set({ bugReport: bugReport });

      // Future: Send to Jira and Slack
      // await createJiraTicket(bugReport);
      // await notifySlackChannel(bugReport);
    } catch (error) {
      console.error("Error reporting bug:", error);
      updateStatusIndicator("error", "Report Failed");
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
      severityLevel.value = "";
      stepsToReproduce.value = "";

      // Reset button states
      selectRegionBtn.textContent = "🎯 Select Buggy Component";
      selectRegionBtn.className = "button primary-btn";
      selectRegionBtn.disabled = false;

      recordNetworkBtn.textContent = "🎬 Record Evidence";
      recordNetworkBtn.className = "button primary-btn";
      recordNetworkBtn.disabled = true;

      // Hide panels
      teamInfoPanel.classList.add("hidden");
      evidencePanel.classList.add("hidden");
      infoContent.classList.remove("hidden");

      // Reset status messages
      step1Status.textContent =
        "Click to start selecting the buggy component";
      step2Status.textContent = "Record your steps to reproduce the bug";

      // Update UI
      updateUI();
      updateStatusIndicator("ready", "Data Cleared");
      hideClearDataModal();
    } catch (error) {
      console.error("Error clearing data:", error);
      updateStatusIndicator("error", "Clear Failed");
    }
  }

  // Load Existing Data
  async function loadExistingData() {
    try {
      const result = await chrome.storage.local.get([
        "bugComponentData",
        "networkData",
        "consoleData",
        "bugReport",
      ]);

      if (result.bugComponentData) {
        bugComponentData = result.bugComponentData;
        currentStep = Math.max(currentStep, 2);

        // Show team info
        if (bugComponentData.teamInfo) {
          displayTeamInfo(bugComponentData.teamInfo);
        }
      }

      if (result.networkData && result.networkData.length > 0) {
        networkData = result.networkData;
        currentStep = Math.max(currentStep, 3);
      }

      if (result.consoleData) {
        consoleData = result.consoleData;
      }

      updateUI();
    } catch (error) {
      console.error("Error loading existing data:", error);
    }
  }

  // UI Update Functions
  function updateUI() {
    // Update progress indicator
    progressIndicator.textContent = `Step ${currentStep} of 3`;

    // Update step 1
    if (bugComponentData) {
      selectRegionBtn.textContent = "✅ Component Selected";
      selectRegionBtn.className = "button success-btn";
      selectRegionBtn.disabled = true;
      step1Status.textContent = "Bug component captured successfully";

      // Enable step 2
      recordNetworkBtn.disabled = false;
      step2Status.textContent = "Click to start recording reproducible steps";
    }

    // Update step 2 based on currentStep
    if (currentStep >= 2) {
      // If we're on step 2 or higher, enable recording button
      recordNetworkBtn.disabled = false;
      if (!bugComponentData) {
        step2Status.textContent =
          "Recording started from toast - capture evidence";
      }
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

    // Show/hide info content
    if (currentStep === 1 && !bugComponentData) {
      infoContent.classList.remove("hidden");
    } else {
      infoContent.classList.add("hidden");
    }
  }

  function displayTeamInfo(teamInfo) {
    teamName.textContent = teamInfo.teamName || "Unknown";
    managerName.textContent = teamInfo.managerName || "Unknown";
    jiraLabel.textContent = teamInfo.teamJiraLabel || "Unknown";
    slackChannel.textContent = teamInfo.slackChannel || "Unknown";
    teamInfoPanel.classList.remove("hidden");
  }

  function displayEvidencePanel() {
    evidencePanel.classList.remove("hidden");

    // Show screenshot evidence
    if (bugComponentData && bugComponentData.screenshot) {
      screenshotEvidence.classList.remove("hidden");
      // Set the thumbnail image
      screenshotThumbnail.style.backgroundImage = `url(${bugComponentData.screenshot})`;
      screenshotThumbnail.style.backgroundSize = "cover";
      screenshotThumbnail.style.backgroundPosition = "center";
      screenshotThumbnail.style.backgroundRepeat = "no-repeat";
    }

    // Show video evidence
    if (videoBlob) {
      videoEvidence.classList.remove("hidden");
      // Calculate and show duration and size
      const sizeInMB = (videoBlob.size / (1024 * 1024)).toFixed(2);
      document.getElementById(
        "videoDuration"
      ).textContent = `${sizeInMB} MB - Click to preview or download`;
    }

    // Show network evidence
    if (networkData.length > 0) {
      networkEvidence.classList.remove("hidden");
      const size = calculateDataSize(networkData);
      document.getElementById(
        "networkSummary"
      ).textContent = `${networkData.length} requests, ${size}`;
    }

    // Show console evidence
    if (consoleData.length > 0) {
      consoleEvidence.classList.remove("hidden");
      const errorCount = consoleData.filter(
        (log) => log.level === "error"
      ).length;
      const warningCount = consoleData.filter(
        (log) => log.level === "warning"
      ).length;
      document.getElementById(
        "consoleSummary"
      ).textContent = `${errorCount} errors, ${warningCount} warnings`;
    }
  }

  function updateStatusIndicator(type, text) {
    statusText.textContent = text;
    statusDot.className = `status-dot ${type}`;
  }

  function updateCharCounter() {
    const count = bugDescription.value.length;
    descriptionCounter.textContent = `${count}/1000 characters`;
  }

  function validateForm() {
    const isValid =
      bugDescription.value.trim().length > 0 &&
      severityLevel.value !== "" &&
      (bugComponentData || networkData.length > 0);

    reportBugBtn.disabled = !isValid;
    return isValid;
  }

  async function updateStorageUsage() {
    try {
      const data = await chrome.storage.local.get(null);
      const size = new Blob([JSON.stringify(data)]).size;
      const sizeInMB = (size / (1024 * 1024)).toFixed(2);
      storageUsage.textContent = `Using ${sizeInMB} MB storage`;
    } catch (error) {
      storageUsage.textContent = "Storage usage unknown";
    }
  }

  // Evidence Preview Functions
  function previewScreenshot() {
    if (bugComponentData && bugComponentData.screenshot) {
      const newTab = window.open();
      newTab.document.write(
        `<img src="${bugComponentData.screenshot}" style="max-width: 100%; height: auto;">`
      );
    }
  }

  function previewVideo() {
    if (videoBlob) {
      const url = URL.createObjectURL(videoBlob);
      const newTab = window.open();
      newTab.document.write(
        `<video controls style="max-width: 100%; height: auto;"><source src="${url}" type="video/webm"></video>`
      );
    }
  }

  function downloadVideo() {
    if (videoBlob) {
      const url = URL.createObjectURL(videoBlob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `screen-recording-${Date.now()}.webm`;
      a.click();
      URL.revokeObjectURL(url);
    }
  }

  function downloadHarFile() {
    if (networkData.length > 0) {
      console.log(
        `Converting ${networkData.length} network events to HAR format`
      );
      console.log("Raw network data:", networkData);

      // Convert network data to proper HAR format
      const harEntries = convertToHarEntries(networkData);

      console.log(`Generated ${harEntries.length} HAR entries`);
      console.log("HAR entries sample:", harEntries.slice(0, 2));

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

      const blob = new Blob([JSON.stringify(harData, null, 2)], {
        type: "application/json",
      });

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `network-data-${Date.now()}.har`;
      a.click();
      URL.revokeObjectURL(url);
    }
  }

  // Convert network events to proper HAR entries
  function convertToHarEntries(networkEvents) {
    const requestMap = new Map();
    const entries = [];

    // Group requests and responses by requestId
    networkEvents.forEach((event) => {
      const requestId = event.requestId;

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
    });

    // Convert to HAR entries
    requestMap.forEach((data, requestId) => {
      const request = data.request;
      const response = data.response;
      const failure = data.failure;

      if (!request) return; // Skip if no request data

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
    });

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
    if (consoleData.length > 0) {
      const logsText = consoleData
        .map(
          (log) =>
            `[${new Date(
              log.timestamp
            ).toISOString()}] ${log.level.toUpperCase()}: ${log.message}`
        )
        .join("\\n");

      const blob = new Blob([logsText], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `console-logs-${Date.now()}.txt`;
      a.click();
      URL.revokeObjectURL(url);
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
    if (namespace === "local") {
      if (changes.bugComponentData) {
        bugComponentData = changes.bugComponentData.newValue;
        if (bugComponentData && bugComponentData.teamInfo) {
          displayTeamInfo(bugComponentData.teamInfo);
        }
        currentStep = Math.max(currentStep, 2);
        updateUI();
      }
      updateStorageUsage();
    }
  });

  // Update storage usage periodically
  setInterval(updateStorageUsage, 5000);
});
