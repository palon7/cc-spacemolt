# cc-spacemolt

<p align="center">
    <img alt="Application Main Image" width="800" src="./docs/image/main.png" />
</p>

[日本語版README](README-ja.md)

**cc-spacemolt** is a Web UI for letting **Claude Code** play [SpaceMolt](https://spacemolt.com/), an online game for AI agents.
It displays various information in real time and is designed to make SpaceMolt more enjoyable and comfortable to play.

## Features

- Real-time dashboard showing detailed player and ship status, agent actions, and events
- Live conversation with the agent
- Freely customizable system prompt and initial prompt
- Agent actions displayed in a clear, readable format
- Galaxy map showing current position, travel history, and next warp destination

## Installation

### Requirements

- Node.js >= 22.13.0
- [Claude Code CLI](https://claude.ai/code) (`claude` command available)
  - Uses your existing CLI credentials. Run `claude` beforehand to authenticate.

### Install from Source

```bash
git clone https://github.com/palon7/cc-spacemolt.git
cd cc-spacemolt
npm install
npm run build
```

## Usage

### Initial Setup

1. Run `npm start` to launch the app.

2. On first launch, if no config exists, an interactive setup wizard runs in your terminal to help you create one. When the wizard completes, the configuration is saved to `~/.cc-spacemolt/config.json`.

3. Open `http://localhost:3001` in your browser and click **Start Agent** to start the agent.

### Starting the App

```bash
# Start with dev server
npm run dev
```

```bash
# Start from built binary
npm start

# With options
npm start -- --port 3001 --workspace /path/to/workspace
```

Open `http://localhost:3001` in your browser to access the Web UI.

### Web UI Overview

The screen consists of three panels:

- **Ship panel (left)**: Detailed ship and player status, galaxy map
- **Claude panel (center)**: Agent action log, conversation interface
- **Events panel (right)**: Real-time game event display

When you first open the browser, the Claude panel shows a button to start the agent. Optionally edit the initial prompt, then click the button to launch. You can send instructions to the agent at any time via the text input in the Claude panel, and stop or reset the session as needed. Click the clock icon in the chat view to resume a past session. The dashboard refreshes approximately every 10 seconds to reflect the latest game state.

## Command Line

```
npm start -- [options]
```

| Option                           | Default                                               | Description                                            |
| -------------------------------- | ----------------------------------------------------- | ------------------------------------------------------ |
| `--config-file <path>`           | `~/.cc-spacemolt/config.json`                         | Path to config file                                    |
| `--log-dir <path>`               | `~/.cc-spacemolt/logs`                                | Log output directory                                   |
| `--workspace <path>`             | config `workspacePath` or `~/.cc-spacemolt/workspace` | Working directory for Claude Code                      |
| `--port <number>`                | `3001`                                                | Web UI port                                            |
| `--host <hostname>`              | `localhost`                                           | Bind hostname (use `0.0.0.0` to allow external access) |
| `--debug`                        | —                                                     | Enable debug logging                                   |
| `--dangerously-skip-permissions` | —                                                     | Bypass all permission checks                           |

Command-line arguments override values in the config file.

## Configuration

Configure behavior via `~/.cc-spacemolt/config.json` (or `data/config.json` during development).

| Field                            | Description                                                |
| -------------------------------- | ---------------------------------------------------------- |
| `initialPrompt`                  | Default initial prompt sent to the agent at session start  |
| `systemPromptAppend`             | Additional system prompt appended when running Claude Code |
| `mcpServers`                     | MCP server configuration (`stdio` / `http` / `sse`)        |
| `permissions.autoAllowTools`     | List of built-in tool names to auto-approve                |
| `permissions.allowedMcpPrefixes` | MCP tool prefixes to auto-approve                          |
| `permissions.allowedWebDomains`  | Domains to auto-approve for WebFetch / WebSearch           |
| `maxLogEntries`                  | Maximum number of log entries to keep in memory            |
| `model`                          | Claude model to use                                        |
| `workspacePath`                  | Working directory for Claude CLI (uses default if not set) |
| `language`                       | Language for agent responses (e.g., `"Japanese"`)          |
| `uiLanguage`                     | Language for the Web UI setup wizard (`"en"` or `"ja"`)    |
| `dangerouslySkipPermissions`     | Bypass all permission checks (use with caution)            |

## Security Considerations

- To mitigate prompt injection risks, grant Claude Code only the minimum necessary permissions. Use `dangerouslySkipPermissions` only in a sandboxed environment with restricted internet access.
- The Web UI provides an interface to control Claude Code. Take security seriously if exposing it externally. Do not expose it directly to the public internet.
