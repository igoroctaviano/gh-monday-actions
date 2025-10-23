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
    // Get GitHub token - try input first, then environment variable
    const githubToken = core.getInput('github_token') || process.env.GITHUB_TOKEN;
    // Get Monday API token from input (required)
    const mondayApiToken = core.getInput('monday_api_token', { required: true });
    
    if (!githubToken) {
      core.setFailed('GitHub token not found. Please provide github_token input or ensure GITHUB_TOKEN environment variable is available.');
      return;
    }

    core.info(`Processing commit range: ${commitRange}`);
    core.info(`Version: ${version}, Environment: ${environment}`);

    // Initialize GitHub API client
    const octokit = github.getOctokit(githubToken);
    const context = github.context;

    // Get commits in the range
    const commits = getCommitsInRange(commitRange);
    core.info(`Found ${commits.length} commits in range`);
    core.info(`Commits: ${commits.join(', ')}`);

    // Find PRs for these commits
    const pullRequests = await findPullRequestsForCommits(octokit, commits, context.repo);
    core.info(`Found ${pullRequests.length} pull requests`);
    
    // Log PR details for debugging
    for (const pr of pullRequests) {
      core.info(`PR #${pr.number}: "${pr.title}" - Body: ${pr.body ? pr.body.substring(0, 100) + '...' : 'No body'}`);
    }

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
      core.info(`Looking for PRs associated with commit: ${commitHash}`);
      
      // Use GitHub's API to find PRs associated with this commit
      // This is more efficient than listing all PRs
      const { data: associatedPRs } = await octokit.rest.repos.listPullRequestsAssociatedWithCommit({
        owner: repo.owner,
        repo: repo.repo,
        commit_sha: commitHash
      });

      core.info(`Found ${associatedPRs.length} PRs for commit ${commitHash}`);

      for (const pr of associatedPRs) {
        // Get full PR details including description
        const { data: fullPR } = await octokit.rest.pulls.get({
          owner: repo.owner,
          repo: repo.repo,
          pull_number: pr.number
        });

        pullRequests.set(pr.number, fullPR);
        core.info(`Added PR #${pr.number}: "${fullPR.title}"`);
      }
    } catch (error) {
      core.warning(`Failed to process commit ${commitHash}: ${error.message}`);
      // Fallback: try the old method if the new API fails
      try {
        core.info(`Trying fallback method for commit ${commitHash}`);
        await findPRsFallbackMethod(octokit, commitHash, repo, pullRequests);
      } catch (fallbackError) {
        core.warning(`Fallback method also failed for commit ${commitHash}: ${fallbackError.message}`);
      }
    }
  }

  return Array.from(pullRequests.values());
}

// Fallback method using the original approach
async function findPRsFallbackMethod(octokit, commitHash, repo, pullRequests) {
  const { data: prs } = await octokit.rest.pulls.list({
    owner: repo.owner,
    repo: repo.repo,
    state: 'all',
    sort: 'updated',
    direction: 'desc',
    per_page: 100 // Limit to avoid too many API calls
  });

  for (const pr of prs) {
    if (commitHash === pr.merge_commit_sha || 
        commitHash === pr.head.sha) {
      
      const { data: fullPR } = await octokit.rest.pulls.get({
        owner: repo.owner,
        repo: repo.repo,
        pull_number: pr.number
      });

      pullRequests.set(pr.number, fullPR);
      core.info(`Added PR #${pr.number} via fallback: "${fullPR.title}"`);
    }
  }
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

  // First, try to find the board ID from the first task ID
  let boardId = null;
  
  if (taskIds.length > 0) {
    core.info(`Attempting to find board ID from task ID: ${taskIds[0]}`);
    
    try {
      // Try to get item information to find the board
      const itemQuery = `
        query {
          items(ids: [${taskIds[0]}]) {
            id
            name
            board {
              id
              name
            }
          }
        }
      `;

      const { data: itemData } = await axios.post(mondayApiUrl, {
        query: itemQuery
      }, { headers });

      if (itemData.errors) {
        core.error('Failed to get item info:', itemData.errors);
      } else if (itemData.data && itemData.data.items && itemData.data.items.length > 0) {
        boardId = itemData.data.items[0].board.id;
        core.info(`Found board ID: ${boardId} (Board: ${itemData.data.items[0].board.name})`);
      }
    } catch (error) {
      core.warning(`Failed to get board ID from item: ${error.message}`);
    }
  }

  if (!boardId) {
    core.error('Could not determine board ID. Please provide monday_board_id input.');
    return;
  }

  for (const taskId of taskIds) {
    try {
      core.info(`Looking for task ${taskId} in Monday.com`);
      
      // First, get the task details to find the item ID
      // Use the updated Monday.com API syntax with board_id and columns
      let taskQuery = `
        query {
          items_page_by_column_values(limit: 1, board_id: ${boardId}, columns: [{column_id: "name", column_values: ["${taskId}"]}]) {
            items {
              id
              name
              column_values {
                id
                text
              }
            }
          }
        }
      `;

      // Alternative query if the first one fails
      const alternativeQuery = `
        query {
          items_page_by_column_values(limit: 1, board_id: ${boardId}, columns: [{column_id: "title", column_values: ["${taskId}"]}]) {
            items {
              id
              name
              column_values {
                id
                text
              }
            }
          }
        }
      `;

      let taskData;
      
      // Try the first query
      try {
        const response = await axios.post(mondayApiUrl, {
          query: taskQuery
        }, { headers });
        taskData = response.data;
      } catch (error) {
        core.warning(`First query failed for task ${taskId}, trying alternative: ${error.message}`);
        // Try alternative query
        const response = await axios.post(mondayApiUrl, {
          query: alternativeQuery
        }, { headers });
        taskData = response.data;
      }

      core.info(`Monday.com API response for task ${taskId}:`, JSON.stringify(taskData, null, 2));

      // Check for API errors first
      if (taskData.errors) {
        core.error(`Monday.com API errors for task ${taskId}:`);
        for (const error of taskData.errors) {
          core.error(`  - ${error.message}`);
          if (error.extensions) {
            core.error(`    Extensions: ${JSON.stringify(error.extensions)}`);
          }
        }
        continue;
      }

      if (!taskData.data || !taskData.data.items_page_by_column_values || !taskData.data.items_page_by_column_values.items || taskData.data.items_page_by_column_values.items.length === 0) {
        core.warning(`Task ${taskId} not found in Monday.com`);
        continue;
      }

      const itemId = taskData.data.items_page_by_column_values.items[0].id;
      core.info(`Found task ${taskId} with item ID: ${itemId}`);

      // Update the column value
      const columnValue = `${environment}${version}`;
      core.info(`Updating column "${columnName}" with value: "${columnValue}"`);
      
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

      const { data: updateData } = await axios.post(mondayApiUrl, {
        query: updateMutation
      }, { headers });

      // Check for update errors
      if (updateData.errors) {
        core.error(`Failed to update column for task ${taskId}:`);
        for (const error of updateData.errors) {
          core.error(`  - ${error.message}`);
        }
        continue;
      }

      core.info(`Successfully updated column for task ${taskId}`);

      // Add comment to the task
      const commentText = `Version: ${version}\nEnvironment: ${environment}\nDescription: ${description}`;
      core.info(`Adding comment to task ${taskId}: ${commentText}`);
      
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

      const { data: commentData } = await axios.post(mondayApiUrl, {
        query: commentMutation
      }, { headers });

      // Check for comment errors
      if (commentData.errors) {
        core.error(`Failed to add comment for task ${taskId}:`);
        for (const error of commentData.errors) {
          core.error(`  - ${error.message}`);
        }
      } else {
        core.info(`Successfully added comment to task ${taskId}`);
      }

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
