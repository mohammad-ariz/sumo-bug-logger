
// Config will be loaded globally via manifest.json

/**
 * Creates a Jira issue using the provided issue data.
 * @param {Object} issueFields - The fields for the Jira issue (as per Jira API).
 * @returns {Promise<Object>} - The created issue response.
 */

async function createJiraIssue({ assigneeId , componentId , description, projectId , reporterId , summary , priority , parentKey  }) {
  const email = window.ENV.email;
  const apiToken = window.ENV.apiToken;
  const jiraDomain = window.ENV.jiraDomain;
  if (!email || !apiToken) {
    throw new Error('Email or API Token not configured in config.dev.js');
  }
  const url = `https://${jiraDomain}/rest/api/3/issue`;
  const headers = {
    'Authorization': `Basic ${btoa(`${email}:${apiToken}`)}`,
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
    "issuetype": {
      "id": "10105"
    },
    "labels": [
        "bug"
    ],
    "parent": {
      "key": parentKey 
    },
    "priority": {
      "id": priority
    },
    "project": {
      "id": projectId
    },
    "summary": summary,
  },
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


async function attachFilesToJira(issueKey, harBlob, consoleBlob , videoBlob) {
  const formData = new FormData();
  formData.append("file", harBlob, "network.har");
  formData.append("file", consoleBlob, "console.log.txt");
  formData.append("file", videoBlob, "video.webm");

const jiraDomain = window.ENV.jiraDomain;
const email = window.ENV.email;
const apiToken = window.ENV.apiToken;
const url = `https://${jiraDomain}/rest/api/3/issue/${issueKey}/attachments`;

  return fetch(url, {
     method: 'POST',
     body: formData,
     headers: {
        'Authorization': `Basic ${btoa(`${email}:${apiToken}`)}`,
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
     .then(text => {
        return `https://${jiraDomain}/browse/${issueKey}`
     })
}


/**
 * Gets the current Jira user info using the /myself endpoint.
 * @returns {Promise<Object>} - The current user info.
 */
async function getCurrentUser() {
  const email = window.ENV.email;
  const apiToken = window.ENV.apiToken;
  const jiraDomain = window.ENV.jiraDomain;
  if (!email || !apiToken) {
    throw new Error('Email or API Token not configured in config.dev.js');
  }
  const url = `https://${jiraDomain}/rest/api/3/myself`;
  const headers = {
    'Authorization': `Basic ${btoa(`${email}:${apiToken}`)}`,
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


const reportIssueInSlack = async (issueLink) => {
  // Placeholder function for Slack integration
  const slackWebHookUrl = 'https://hooks.slack.com/services/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'
  const body = JSON.stringify({
	attachments: [
		{
			pretext: ":warning: Attention <!subteam^SRFV89MGT>: New issue has been reported.",
			fields: [
				{
					title: "Issue link",
					value: issueLink
				},
            ],
			mrkdwn_in: ["text", "pretext"],
			color: "#F75A4F"
		}
	]
});

  return fetch(slackWebHookUrl, {
     method: 'POST',
     body
 })
};


// Browser-compatible exports
window.jiraService = { createJiraIssue, getCurrentUser, attachFilesToJira , reportIssueInSlack };
