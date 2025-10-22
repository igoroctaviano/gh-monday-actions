# Usage Examples

## Quick Start

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

## Required Secrets

Add this secret to your repository:

- `MONDAY_API_TOKEN`: Your Monday.com API token

## PR Description Format

Your pull request descriptions should include task IDs in this format:

```
Ticket number: TASK-123
```

## What the Action Does

1. **Analyzes commits** in the specified range
2. **Finds associated PRs** for those commits
3. **Extracts task IDs** from PR descriptions using "Ticket number:" format
4. **Updates Monday.com tasks** with:
   - Column value: `{environment}{version}` (e.g., `staging1.2.3`)
   - Comment with version, environment, and description

## Example Output

For a task with ID `TASK-123`, the action will:
- Update the specified column with `staging1.2.3`
- Add a comment:
  ```
  Version: 1.2.3
  Environment: staging
  Description: Bug fixes and improvements
  ```
