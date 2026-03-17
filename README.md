# gh-monday-actions

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

A GitHub Action that syncs Monday.com tasks with your release workflow by analyzing pull requests in a commit range and updating board items with deployment metadata (version, environment, description).

---

## Table of Contents

- [Features](#features)
- [Requirements](#requirements)
- [Setup](#setup)
- [Usage](#usage)
- [Inputs](#inputs)
- [PR description format](#pr-description-format)
- [Behavior](#behavior)
- [Error handling](#error-handling)
- [Troubleshooting](#troubleshooting)
- [Publishing](#publishing)
- [License](#license)

---

## Features

- **Commit-range analysis** — Finds pull requests associated with a given commit range
- **Task ID extraction** — Parses task IDs from PR descriptions (configurable regex)
- **Monday.com updates** — Writes column values and adds comments to matching tasks
- **Board auto-detection** — Resolves board ID from task IDs (no manual board config)
- **Manual dispatch** — Workflow dispatch with inputs for version, environment, and column name

---

## Requirements

- **Node.js** 20 or later (action runtime)
- **GitHub** — Repository with Actions enabled, sufficient fetch depth for commit history
- **Monday.com** — Account with API access and an API token
- **PR descriptions** — Pull requests in the range must include task IDs in the [expected format](#pr-description-format)

---

## Setup

### 1. Repository secrets

Configure the following secret in your repository (**Settings → Secrets and variables → Actions**):

| Secret               | Description                    |
|----------------------|--------------------------------|
| `MONDAY_API_TOKEN`   | Your Monday.com API token      |

### 2. Monday.com API token

1. In Monday.com, go to **Admin** → **API**.
2. Create a new API token with access to the boards and columns you want to update.
3. Add it as the `MONDAY_API_TOKEN` repository secret.

---

## Usage

### Quick start

Add a workflow under `.github/workflows/` (e.g. `monday-sync.yml`):

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

### Running the workflow

1. Open the **Actions** tab and select **Update Monday.com Tasks**.
2. Click **Run workflow**.
3. Set the inputs (commit range, version, environment, description, Monday column name) and run.

A full example including optional `ticket_regex_pattern` is in [examples/example-workflow.yml](examples/example-workflow.yml).

---

## Inputs

| Input                 | Required | Description |
|-----------------------|----------|-------------|
| `commit_range`        | Yes      | Git commit range (e.g. `abc123..def456` or `HEAD~10..HEAD`). |
| `version`             | Yes      | Version string (e.g. `1.2.3`). |
| `environment`         | Yes      | Environment name (e.g. `staging`, `production`, `development`). |
| `description`         | Yes      | Deployment description (e.g. used in Monday comments). |
| `monday_column_name`  | Yes      | Exact title of the Monday.com column to update. |
| `github_token`        | Yes      | Usually `${{ secrets.GITHUB_TOKEN }}` for PR/commit API access. |
| `monday_api_token`    | Yes      | Monday.com API token (e.g. `${{ secrets.MONDAY_API_TOKEN }}`). |
| `ticket_regex_pattern`| No       | Regex to extract task IDs from PR body (default matches `Ticket number: TASK-123` style). |

---

## PR description format

The action extracts task IDs from pull request bodies. Default pattern:

```text
Ticket number: TASK-123
```

You can override the pattern with `ticket_regex_pattern` (regex with one capture group for the task ID).

---

## Behavior

1. **Resolves commits** in the given `commit_range`.
2. **Finds merge commits / PRs** for those commits via the GitHub API.
3. **Extracts task IDs** from each PR body using the ticket regex.
4. **Resolves Monday.com board** from the first task ID.
5. **Updates each task**:
   - Sets the chosen column to `{environment}{version}` (e.g. `staging1.2.3`).
   - Adds a comment with version, environment, and description.

---

## Error handling

- **No task IDs found** — Logs a warning; does not fail the workflow.
- **Task not found in Monday.com** — Skips that task with a warning.
- **Column not found** — Fails and logs available column names.
- **API errors** — Logged with details; step fails on critical errors.
- Success is reported only when at least one task is updated.

---

## Troubleshooting

| Issue | What to check |
|-------|----------------|
| No task IDs found | PR descriptions in the range include the ticket line (e.g. `Ticket number: TASK-123`). |
| Monday.com API errors | Token has correct scope and the board/item are accessible. |
| Invalid commit range | Range is valid and the job has enough history (`fetch-depth: 0`). |
| Column not found | Column name matches the board column title exactly (case-sensitive). |
| Board detection fails | Task ID exists and the token can read that board. |

**Debug logging:** Add repository secret `ACTIONS_STEP_DEBUG` = `true` to enable verbose step logs.

---

## Publishing

This repo is the action source. To release a new version:

1. Build: `npm run build`
2. Commit the `dist/` output (if you ship from this repo).
3. Create a tag (e.g. `v1.0.0`) and push, or publish via GitHub Releases.

Consumers can pin with `igoroctaviano/gh-monday-actions@v1` (or a specific tag).

---

## License

This project is licensed under the **MIT License**. See [LICENSE](LICENSE) for the full text.
