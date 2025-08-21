
const { ENV } = require('./config.dev.js');

/**
 * Creates a Jira issue using the provided issue data.
 * @param {Object} issueFields - The fields for the Jira issue (as per Jira API).
 * @returns {Promise<Object>} - The created issue response.
 */

async function createJiraIssue({ assigneeId , componentId , description, projectId , reporterId , summary , priority  }) {
  const email = ENV.email;
  const apiToken = ENV.apiToken;
  const jiraDomain = ENV.jiraDomain;
  if (!email || !apiToken) {
    throw new Error('Email or API Token not configured in config.dev.js');
  }
  const url = `https://${jiraDomain}/rest/api/3/issue`;
  const headers = {
    'Authorization': `Basic ${Buffer.from(`${email}:${apiToken}`).toString('base64')}`,
    'Accept': 'application/json',
    'Content-Type': 'application/json'
  };

  const body = JSON.stringify({
  "fields": {
    "assignee": {
      "id": assigneeId
    },
    "components": [
      {
        "id": componentId
      }
    ],

    "description": {
      "content": [
        {
          "content": [
            {
              "text": description,
              "type": "text"
            }
          ],
          "type": "paragraph"
        }
      ],
      "type": "doc",
      "version": 1
    },
    "fixVersions": [
      {
        "id": "10001"
      }
    ],
    "issuetype": {
      "id": "10000"
    },
    "labels": [
        "bug", "urgent"
    ],
    "parent": {
      "key": "PROJ-123"
    },
    "priority": {
      "id": priority
    },
    "project": {
      "id": projectId
    },
    "reporter": {
      "id": reporterId
    },
    "security": {
      "id": "10000"
    },
    "summary": summary,
    "versions": [
      {
        "id": "10000"
      }
    ]
  },
  "update": {}
});

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body
    });
    const result = await response.json();
    if (!response.ok) {
      throw new Error(result.errorMessages || JSON.stringify(result));
    }
    return result;
  } catch (err) {
    throw err;
  }
}


async function attachFilesToJira(issueIdOrKey, harBlob, consoleBlob) {
  const formData = new FormData();
  formData.append("file", harBlob, "network.har");
  formData.append("file", consoleBlob, "console.log.txt");

  const url = `https://${jiraDomain}/rest/api/3/issue/${issueIdOrKey}/attachments`;

  fetch(url, {
     method: 'POST',
     body: form,
     headers: {
         'Authorization': `Basic ${Buffer.from(
             'email@example.com:'
         ).toString('base64')}`,
         'Accept': 'application/json',
         'X-Atlassian-Token': 'no-check'
     }
 })
     .then(response => {
         console.log(
             `Response: ${response.status} ${response.statusText}`
         );
         return response.text();
     })
     .then(text => console.log(text))
}


/**
 * Gets the current Jira user info using the /myself endpoint.
 * @returns {Promise<Object>} - The current user info.
 */
async function getCurrentUser() {
  const email = ENV.email;
  const apiToken = ENV.apiToken;
  const jiraDomain = ENV.jiraDomain;
  if (!email || !apiToken) {
    throw new Error('Email or API Token not configured in config.dev.js');
  }
  const url = `https://${jiraDomain}/rest/api/3/myself`;
  const headers = {
    'Authorization': `Basic ${Buffer.from(`${email}:${apiToken}`).toString('base64')}`,
    'Accept': 'application/json'
  };
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers
    });
    const result = await response.json();
    if (!response.ok) {
      throw new Error(result.errorMessages || JSON.stringify(result));
    }
    return result;
  } catch (err) {
    throw err;
  }
}

module.exports = { createJiraIssue, getCurrentUser, attachFilesToJira };
