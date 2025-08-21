# Sumo Bug Logger - Requirements Document

## Overview

Internal Chrome extension for streamlined bug reporting workflow that automatically identifies team ownership, captures evidence, and facilitates team communication through Jira and Slack integration.

## Target Environment

- **Domains**: `sumologic.net`, `localhost:8443`
- **Browser**: Chrome (Manifest V3)
- **User Base**: Internal development/ testing / customer support teams

## Core Workflow

### Phase 1: Bug Area Selection

1. User discovers a UI bug
2. User opens the extension popup
3. User clicks "Select Bug Area" button
4. Extension enables region selection mode on the webpage
5. User draws a rectangle around the buggy UI element
6. Extension captures:
   - Screenshot of selected area
   - `data-owner` attribute from DOM elements within selection
   - Page URL and timestamp
7. **Toast Notification Enhancement**: After selection, a toast notification appears showing:
   - ✅ Confirmation that bug area was captured
   - Team information (name, manager, Jira label, Slack channel)
   - "🎬 Start Recording" button for immediate evidence collection

### Phase 2: Evidence Collection

1. User clicks "Record Reproducible steps" button in popup OR "Start Recording" in toast
2. **Toast Recording Feature**: Clicking "Start Recording" in toast automatically:
   - Starts network and console monitoring
   - Opens popup directly to Step 2 (Recording phase)
   - Begins evidence collection without requiring popup navigation
3. Extension starts recording:
   - Network activity (HAR file format)
   - Console errors, warnings, and logs (text file format)
   - User interactions (video recording)
4. User reproduces the bug while recording is active
5. User clicks "Stop Recording" when done
6. Extension processes and stores:
   - HAR file with network requests/responses
   - Console log file (text file with timestamps)
   - Video recording of user interactions
   - Browser information, OS info, timezone and other stuffs useful for debugging

### Phase 3: Bug Report Preparation

1. Extension popup displays collected information:

   - **Team Information** (decoded from data-owner hash):
     - Team name
     - Manager name
     - Slack channel
   - **Evidence Summary** (with functional previews):

     - Screenshot thumbnail with click-to-preview functionality (opens full image in new tab)
     - Video recording preview (if available)
     - Network session har file and if user wants to check download that file
     - Console errors text file and if user wants to check download that file

   - **Editable Fields**:
     - Bug description (text area)
     - Severity level (dropdown)
     - Steps to reproduce (text area)

2. User reviews and edits information as needed

### Phase 4: Jira creation and sending message (Future)

1. User clicks "Report bug"
2. Extension creates Jira ticket with:
   - Auto-assigned to team manager
   - Attachments: screenshot, HAR file , console text file , video recording
   - Description with bug details
   - Labels: team name, severity
3. Extension returns Jira ticket URL and ID
4. Extension opens team's Slack channel
5. Pre-fills message: `@{team} New bug reported: {jira_url}`
6. User reviews and sends message ( by himself)

## Technical Requirements

### Data Structure

```javascript
// Data-owner hash mapping
{
  "hash_id": {
    "teamName": "Frontend Team",
    "teamJiraLabel": 'UI Issue',
    "managerName": "John Doe",
    "managerId": "john.doe@company.com",
    "slackChannel": "#frontend-bugs",
    "slackChannelId": "C1234567890"
  }
}
```

### Storage Requirements

- **Chrome Storage Local**:
  - Bug region data (screenshot, owner info)
  - Network session data (HAR format)
  - Console logs data (text format with timestamps)
  - Video recordings (WebM format)
  - User preferences
  - Draft bug reports

### Permissions Required

```json
{
  "permissions": [
    "activeTab",
    "storage",
    "scripting",
    "debugger",
    "tabs",
    "desktopCapture"
  ],
  "host_permissions": ["*://*.sumologic.net/*", "http://localhost:8443/*"]
}
```

## UI/UX Requirements

### Extension Popup (350x650px)

#### Header Section

- **Extension Title**: "🐛 Sumo Bug Logger"
- **Status Indicator**: Color-coded dot (🔴 Recording / 🟡 Processing / 🟢 Ready)
- **Current Step Indicator**: "Step 1 of 3" progress

#### Step 1 - Bug Area Selection

- **Section Title**: "📍 Select Bug Area"
- **Primary Button**: "Select Bug Area" (blue, prominent)
  - **States**:
    - Default: "Select Bug Area"
    - Active: "Selection Mode Active..." (disabled, orange)
    - Complete: "✅ Area Selected" (green)
- **Status Text**:
  - Ready: "Click to start selecting the buggy region"
  - Active: "Draw a rectangle around the bug on the page"
  - Complete: "Bug area captured successfully"

##### Toast Notification (After Area Selection)

- **Trigger**: Immediately after user completes bug area selection
- **Design**:
  - **Position**: Top-right corner of webpage (not popup)
  - **Style**: Green background, white text, rounded corners
  - **Duration**: 5 seconds (auto-dismiss) with manual close option
- **Content**:
  - **Title**: "✅ Bug Area Captured!"
  - **Team Info Display**:
    - "👥 Team: {teamName}"
    - "👤 Manager: {managerName}"
    - "📋 Jira Label: {teamJiraLabel}"
    - "💬 Slack: {slackChannel}"
  - **Next Step Prompt**: "Ready to record reproducible steps?"
  - **Action Button**: "🎬 Start Recording" (opens popup to Step 2)
- **Fallback**: If no team info found, show "⚠️ Team info not found - manual assignment required"

#### Step 2 - Evidence Collection

- **Section Title**: "🎬 Record Reproducible Steps"
- **Entry State**: When opened via toast button, auto-focus on recording button
- **Primary Button**: "Record Reproducible Steps" (toggle design)
  - **Start State**: "🔴 Start Recording" (red button)
  - **Recording State**: "⏹️ Stop Recording" (dark red, pulsing)
  - **Complete State**: "✅ Recording Complete" (green)
- **Recording Indicators** (when active):
  - **Timer**: "⏱️ 00:32" (live timer)
  - **Activity Counters**:
    - "📡 Network: 15 requests"
    - "❌ Console: 3 errors, 2 warnings"
    - "🎥 Video: Recording..."
- **Instructions Text**: "Reproduce the bug step by step while recording"

#### Step 3 - Information Review & Report

- **Section Title**: "📋 Review & Report Bug"

##### Team Information Panel

- **Header**: "👥 Team Information"
- **Content**:
  - **Team**: `{teamName}` (e.g., "Frontend Team")
  - **Manager**: `{managerName}` (e.g., "John Doe")
  - **Jira Label**: `{teamJiraLabel}` (e.g., "UI Issue")
  - **Slack Channel**: `{slackChannel}` (e.g., "#frontend-bugs")

##### Evidence Summary Panel

- **Header**: "📎 Collected Evidence"
- **Screenshot Section**:
  - Small thumbnail (100x60px) with "🔍 View" overlay
  - Click action: Open screenshot in new tab/modal
- **Video Recording Section**:
  - Video thumbnail with play button overlay
  - Duration display: "🎥 2:34"
  - Click action: Play video in modal/new tab
- **Network Data Section**:
  - Summary: "📡 HAR File (23 requests, 1.2MB)"
  - Download button: "⬇️ Download HAR"
- **Console Logs Section**:
  - Summary: "🔍 Console Logs (5 errors, 3 warnings)"
  - Download button: "⬇️ Download Logs"
- **System Information**:
  - Browser, OS, timezone automatically captured
  - Expandable section: "ℹ️ System Info"

##### Bug Details Form

- **Bug Description**:
  - Label: "🐛 Bug Description \*"
  - Large textarea (4 rows)
  - Placeholder: "Describe what you expected vs what actually happened..."
  - Character counter: "245/1000 characters"
- **Severity Level**:
  - Label: "⚡ Severity Level \*"
  - Dropdown options:
    - 🔴 Critical (System down, blocking)
    - 🟠 High (Major functionality broken)
    - 🟡 Medium (Minor functionality issue)
    - 🟢 Low (Cosmetic, enhancement)
- **Steps to Reproduce**:
  - Label: "📝 Steps to Reproduce"
  - Textarea (3 rows)
  - Placeholder: "1. Navigate to...\n2. Click on...\n3. Observe..."
  - Note: "Video recording will be attached automatically"

#### Action Buttons Section

- **Primary Action**: "🚀 Report Bug" (large, blue button)
  - **States**:
    - Disabled: When required fields empty
    - Loading: "Creating Jira ticket..." (with spinner)
    - Success: "✅ Bug Reported Successfully"
- **Secondary Actions**:
  - "📤 Export Data" (download JSON package)
  - "🗑️ Clear All Data" (red, secondary button with confirmation)

##### Clear All Data Functionality

- **Button Design**:
  - Red outline button with trash icon
  - Text: "🗑️ Clear All Data"
  - Position: Below export button, smaller size
- **Confirmation Dialog**:
  - **Title**: "⚠️ Clear All Data?"
  - **Message**: "This will permanently delete all collected evidence including screenshots, videos, network data, and console logs. This action cannot be undone."
  - **Buttons**:
    - "Cancel" (gray, default focus)
    - "🗑️ Delete Everything" (red, destructive)
- **Data Cleared**:
  - Screenshot and region selection data
  - Video recordings and network HAR files
  - Console logs and system information
  - Bug description and form inputs
  - All Chrome storage data for the extension
- **Post-Clear State**:
  - Extension resets to initial state (Step 1)
  - All buttons reset to default states
  - Success message: "✅ All data cleared successfully"
  - Storage usage shows "0 MB used"

#### Footer Section

- **Data Status**: "Last updated: 2 minutes ago"
- **Storage Usage**: "Using 2.3MB storage"

### Region Selection Overlay (on webpage)

- **Background**: Semi-transparent dark overlay (rgba(0,0,0,0.5))
- **Crosshair Cursor**: Custom crosshair for precise selection
- **Selection Rectangle**:
  - Dashed border (2px, blue)
  - Semi-transparent blue fill (rgba(0,123,255,0.1))
- **Coordinates Display**:
  - Live coordinates tooltip following cursor
  - Format: "X: 245, Y: 156"
- **Instructions Banner**:
  - Fixed position at top of screen
  - Text: "🎯 Draw a rectangle around the buggy area • Press ESC to cancel"
  - Style: Blue background, white text, slide-in animation
- **Completion Animation**:
  - Green checkmark animation over selected area
  - Success message: "✅ Bug area captured!"

### Modal/Preview Windows

- **Screenshot Preview**:
  - Full-size image display
  - Zoom in/out controls
  - Download button
  - Close button (X)
- **Video Playback**:
  - Standard HTML5 video controls
  - Full-screen option
  - Download button
  - Close button (X)

### Responsive Design

- **Minimum Width**: 320px
- **Maximum Width**: 400px
- **Scalable Text**: Relative units for different screen sizes
- **Touch-Friendly**: Minimum 44px tap targets

### Error States & Feedback

- **Error Messages**: Red background, white text
- **Success Messages**: Green background, white text
- **Loading States**: Blue background, spinner animation
- **Empty States**: Gray text, helpful instructions

### Accessibility

- **Keyboard Navigation**: Tab order, Enter/Space activation
- **Screen Reader**: Proper ARIA labels and descriptions
- **High Contrast**: Color combinations meet WCAG standards
- **Focus Indicators**: Visible focus rings for all interactive elements

## Enhanced Features (Implemented)

### Screenshot Preview Functionality

- **Thumbnail Display**: Screenshots show as background images in evidence thumbnails
- **Click-to-Preview**: Clicking screenshot thumbnail opens full image in new browser tab
- **Background Styling**: Proper CSS background-size, position, and repeat settings for optimal display

### Toast-to-Recording Integration

- **Seamless Workflow**: "Start Recording" button in toast notification triggers immediate recording
- **Auto-Navigation**: Toast button click automatically:
  - Starts network and console monitoring in background
  - Opens extension popup directly to Step 2 (Recording phase)
  - Sets recording state without requiring manual popup navigation
- **State Management**: Extension remembers toast-initiated recording state across popup sessions
- **Smart Step Progression**: When recording starts from toast, Step 1 requirement is bypassed for streamlined workflow

### Technical Implementation Details

- **Background Script Integration**: Enhanced message passing between content script, background worker, and popup
- **Storage Coordination**: Uses chrome.storage.local for state persistence between toast and popup
- **Recording State Sync**: Real-time synchronization of recording status across all extension components
- **Error Handling**: Robust error handling for toast-to-popup navigation edge cases
