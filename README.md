# igoroctaviano/gh-monday-actions

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

## Usage

### Quick Start

Copy this workflow to your repository's `.github/workflows/` directory:

```yaml
name: Update Monday.com Tasks

on:
  workflow_dispatch:
    inputs:
      commit_range:
        description: 'Commit hash range (e.g., abc123..def456)'
        required: true
        type: string
        default: 'HEAD~10..HEAD'
      version:
        description: 'Version number'
        required: true
        type: string
        default: '1.0.0'
      environment:
        description: 'Environment'
        required: true
        type: choice
        options:
          - staging
          - production
          - development
        default: 'staging'
      description:
        description: 'Deployment description'
        required: true
        type: string
        default: 'Deployment update'
      monday_column_name:
        description: 'Monday.com column name to update'
        required: true
        type: string
        default: 'Deployment Status'

jobs:
  update-monday-tasks:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout repository
        uses: actions/checkout@v4
        with:
          fetch-depth: 0
      
      - name: Update Monday.com tasks
        uses: igoroctaviano/gh-monday-actions@v1
        with:
          commit_range: ${{ github.event.inputs.commit_range }}
          version: ${{ github.event.inputs.version }}
          environment: ${{ github.event.inputs.environment }}
          description: ${{ github.event.inputs.description }}
          monday_column_name: ${{ github.event.inputs.monday_column_name }}
          github_token: ${{ secrets.GITHUB_TOKEN }}
          monday_api_token: ${{ secrets.MONDAY_API_TOKEN }}
```

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

### PR Description Format

Your pull request descriptions should include task IDs in this format:

```
Ticket number: TASK-123
```

### What the Action Does

1. **Analyzes commits** in the specified range
2. **Finds associated PRs** for those commits
3. **Extracts task IDs** from PR descriptions using "Ticket number:" format
4. **Updates Monday.com tasks** with:
   - Column value: `{environment}{version}` (e.g., `staging1.2.3`)
   - Comment with version, environment, and description

### Example Output

For a task with ID `TASK-123`, the action will:
- Update the specified column with `staging1.2.3`
- Add a comment:
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

## Publishing

This repository is the GitHub Action itself. To publish:

1. **Build the action**: `npm run build`
2. **Create a release**: Push a tag like `v1.0.0`
3. **Use the action**: `uses: igoroctaviano/gh-monday-actions@v1`
