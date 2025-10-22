const core = require('@actions/core');
const github = require('@actions/github');
const axios = require('axios');
const { execSync } = require('child_process');

async function run() {
  try {
    // Get inputs
    const commitRange = core.getInput('commit_range', { required: true });
    const version = core.getInput('version', { required: true });
    const environment = core.getInput('environment', { required: true });
    const description = core.getInput('description', { required: true });
    const mondayColumnName = core.getInput('monday_column_name', { required: true });
    const githubToken = core.getInput('github_token', { required: true });
    const mondayApiToken = core.getInput('monday_api_token', { required: true });

    core.info(`Processing commit range: ${commitRange}`);
    core.info(`Version: ${version}, Environment: ${environment}`);

    // Initialize GitHub API client
    const octokit = github.getOctokit(githubToken);
    const context = github.context;

    // Get commits in the range
    const commits = getCommitsInRange(commitRange);
    core.info(`Found ${commits.length} commits in range`);

    // Find PRs for these commits
    const pullRequests = await findPullRequestsForCommits(octokit, commits, context.repo);
    core.info(`Found ${pullRequests.length} pull requests`);

    // Extract task IDs from PR descriptions
    const taskIds = extractTaskIdsFromPRs(pullRequests);
    core.info(`Extracted task IDs: ${taskIds.join(', ')}`);

    if (taskIds.length === 0) {
      core.warning('No task IDs found in PR descriptions');
      return;
    }

    // Update Monday.com tasks
    await updateMondayTasks(mondayApiToken, taskIds, mondayColumnName, version, environment, description);

    core.info('Successfully updated Monday.com tasks');
  } catch (error) {
    core.setFailed(`Action failed with error: ${error.message}`);
  }
}

function getCommitsInRange(commitRange) {
  try {
    const output = execSync(`git log --oneline ${commitRange}`, { encoding: 'utf8' });
    return output.trim().split('\n').map(line => {
      const [hash] = line.split(' ');
      return hash;
    }).filter(hash => hash);
  } catch (error) {
    throw new Error(`Failed to get commits in range: ${error.message}`);
  }
}

async function findPullRequestsForCommits(octokit, commits, repo) {
  const pullRequests = new Map();

  for (const commitHash of commits) {
    try {
      // Get commit details
      const { data: commit } = await octokit.rest.repos.getCommit({
        owner: repo.owner,
        repo: repo.repo,
        ref: commitHash
      });

      // Find PRs that contain this commit
      const { data: prs } = await octokit.rest.pulls.list({
        owner: repo.owner,
        repo: repo.repo,
        state: 'all',
        sort: 'updated',
        direction: 'desc'
      });

      for (const pr of prs) {
        if (commitHash === pr.merge_commit_sha || 
            commitHash === pr.head.sha ||
            (pr.commits && pr.commits.some(c => c.sha === commitHash))) {
          
          // Get full PR details including description
          const { data: fullPR } = await octokit.rest.pulls.get({
            owner: repo.owner,
            repo: repo.repo,
            pull_number: pr.number
          });

          pullRequests.set(pr.number, fullPR);
        }
      }
    } catch (error) {
      core.warning(`Failed to process commit ${commitHash}: ${error.message}`);
    }
  }

  return Array.from(pullRequests.values());
}

function extractTaskIdsFromPRs(pullRequests) {
  const taskIds = new Set();
  const ticketRegex = /Ticket number:\s*([A-Za-z0-9\-_]+)/gi;

  for (const pr of pullRequests) {
    const description = pr.body || '';
    const matches = description.matchAll(ticketRegex);
    
    for (const match of matches) {
      const taskId = match[1].trim();
      if (taskId) {
        taskIds.add(taskId);
      }
    }
  }

  return Array.from(taskIds);
}

async function updateMondayTasks(apiToken, taskIds, columnName, version, environment, description) {
  const mondayApiUrl = 'https://api.monday.com/v2';
  const headers = {
    'Authorization': apiToken,
    'Content-Type': 'application/json'
  };

  for (const taskId of taskIds) {
    try {
      // First, get the task details to find the item ID
      const taskQuery = `
        query {
          items_by_column_values(column_id: "name", column_values: ["${taskId}"]) {
            id
            name
          }
        }
      `;

      const { data: taskData } = await axios.post(mondayApiUrl, {
        query: taskQuery
      }, { headers });

      if (!taskData.data.items_by_column_values || taskData.data.items_by_column_values.length === 0) {
        core.warning(`Task ${taskId} not found in Monday.com`);
        continue;
      }

      const itemId = taskData.data.items_by_column_values[0].id;

      // Update the column value
      const columnValue = `${environment}${version}`;
      
      const updateMutation = `
        mutation {
          change_column_value(
            item_id: ${itemId},
            column_id: "${columnName}",
            value: "${columnValue}"
          ) {
            id
          }
        }
      `;

      await axios.post(mondayApiUrl, {
        query: updateMutation
      }, { headers });

      // Add comment to the task
      const commentText = `Version: ${version}\nEnvironment: ${environment}\nDescription: ${description}`;
      
      const commentMutation = `
        mutation {
          create_update(
            item_id: ${itemId},
            body: "${commentText}"
          ) {
            id
          }
        }
      `;

      await axios.post(mondayApiUrl, {
        query: commentMutation
      }, { headers });

      core.info(`Successfully updated task ${taskId} (item ID: ${itemId})`);
    } catch (error) {
      core.error(`Failed to update task ${taskId}: ${error.message}`);
      if (error.response) {
        core.error(`Response data: ${JSON.stringify(error.response.data)}`);
      }
    }
  }
}

// Export the run function for testing
module.exports = { run };

// Run the action if this file is executed directly
if (require.main === module) {
  run();
}
