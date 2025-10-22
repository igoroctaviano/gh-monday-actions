# GitHub Action: Update Monday.com Tasks

This GitHub Action automatically updates Monday.com tasks based on pull request descriptions within a specified commit range.

## Features

- 🔍 Analyzes commit ranges to find associated pull requests
- 📝 Extracts task IDs from PR descriptions using "Ticket number:" format
- 🔄 Updates Monday.com column values with environment + version
- 💬 Adds formatted comments to Monday.com tasks
- ⚙️ Manual workflow dispatch with customizable inputs

## Setup

### 1. Required Secrets

Add these secrets to your GitHub repository:

- `MONDAY_API_TOKEN`: Your Monday.com API token

### 2. Monday.com API Token

To get your Monday.com API token:

1. Go to your Monday.com account
2. Navigate to Admin → API
3. Generate a new API token
4. Add it as a repository secret named `MONDAY_API_TOKEN`

### 3. Repository Structure

The action expects your repository to have the following structure:

```
.github/
├── workflows/
│   └── update-monday-tasks.yml
└── actions/
    └── update-monday-tasks/
        ├── action.yml
        ├── package.json
        └── index.js
```

## Usage

### Manual Trigger

1. Go to your repository's Actions tab
2. Select "Update Monday.com Tasks" workflow
3. Click "Run workflow"
4. Fill in the required inputs:
   - **Commit Range**: Git commit hash range (e.g., `abc123..def456`)
   - **Version**: Version number (e.g., `1.2.3`)
   - **Environment**: Environment name (`staging`, `production`, or `development`)
   - **Description**: Deployment description
   - **Monday Column Name**: Name of the Monday.com column to update

### Input Parameters

| Parameter | Description | Required | Example |
|-----------|-------------|----------|---------|
| `commit_range` | Git commit hash range | Yes | `abc123..def456` |
| `version` | Version number | Yes | `1.2.3` |
| `environment` | Environment name | Yes | `staging` |
| `description` | Deployment description | Yes | `Bug fixes and improvements` |
| `monday_column_name` | Monday.com column name | Yes | `Deployment Status` |

## How It Works

1. **Commit Analysis**: The action analyzes the specified commit range to find all commits
2. **PR Discovery**: It identifies pull requests associated with those commits
3. **Task ID Extraction**: It parses PD descriptions looking for "Ticket number:" followed by task IDs
4. **Monday.com Updates**: For each task ID found:
   - Updates the specified column with `{environment}{version}` (e.g., `staging1.2.3`)
   - Adds a formatted comment with version, environment, and description

## PR Description Format

Your pull request descriptions should include task IDs in this format:

```
Ticket number: TASK-123
```

The action will extract `TASK-123` and update the corresponding Monday.com task.

## Monday.com Column Update

The specified column will be updated with the concatenated environment and version:
- Example: `staging1.2.3` or `production2.0.1`

## Comments Added to Monday.com Tasks

Each updated task will receive a comment in this format:

```
Version: 1.2.3
Environment: staging
Description: Bug fixes and improvements
```

## Error Handling

- If no task IDs are found in PR descriptions, the action will warn but not fail
- If a task ID is not found in Monday.com, it will be skipped with a warning
- API errors are logged with detailed error information

## Requirements

- Node.js 20+
- GitHub repository with Actions enabled
- Monday.com account with API access
- Pull requests with properly formatted descriptions containing task IDs

## Troubleshooting

### Common Issues

1. **No task IDs found**: Ensure PR descriptions contain "Ticket number:" followed by the task ID
2. **Monday.com API errors**: Verify your API token has the necessary permissions
3. **Commit range errors**: Ensure the commit hash range is valid and accessible

### Debugging

Enable debug logging by adding this secret to your repository:
- `ACTIONS_STEP_DEBUG`: `true`

This will provide detailed logs of the action's execution.
# gh-monday-actions
