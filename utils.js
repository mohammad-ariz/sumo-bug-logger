

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

const createHarBlob = (data) => {
    if (!data) {
        data = []
    }
      console.log(
        `Converting ${data.length} network events to HAR format`
      );
      console.log("Raw network data:", data);

      // Convert network data to proper HAR format
      const harEntries = convertToHarEntries(data);

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

      return blob;
    
}



const createConsoleBlob = (consoleData)=>{
          const logsText = consoleData
        .map(
          (log) =>
            `[${new Date(
              log.timestamp
            ).toISOString()}] ${log.level.toUpperCase()}: ${log.message}`
        )
        .join("\\n");

      const blob = new Blob([logsText], { type: "text/plain" });
      return blob;
}


// Browser-compatible exports
window.utils = {
    createHarBlob,
    createConsoleBlob
};