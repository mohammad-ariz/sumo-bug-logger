const COMPONENT_INFO = {
  queryEditor: "@Sanyaku/ui-observability",
  messageTable: "@Sanyaku/ui-observability",
  logInspector: "@Sanyaku/ui-observability",
  histogram: "@Sanyaku/ui-observability",
  fieldBrowser: "@Sanyaku/ui-observability",
  searchBar: "@Sanyaku/ui-observability",
  filterPanel: "@Sanyaku/ui-observability",
  navBar: "@Sanyaku/ui-core-platform",
  dashboardWidget: "@Frontend/core",
  navigationBar: "@Frontend/core",
  sidePanel: "@Frontend/core",
  userProfile: "@Security/auth",
  loginForm: "@Security/auth",
  apiConnector: "@Backend/api",
  dataProcessor: "@Backend/api",
  systemStatus: "@Platform/infrastructure",
  serverMetrics: "@Platform/infrastructure",
};

// Export for use in content script
if (typeof module !== "undefined" && module.exports) {
  module.exports = COMPONENT_INFO;
}
