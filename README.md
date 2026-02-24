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

- Node.js >= 22.0.0
- [Claude Code CLI](https://claude.ai/code) (`claude` command available)
  - Uses your existing CLI credentials. Run `claude` beforehand to authenticate.

### Install

```bash
npm install -g cc-spacemolt
```

## Usage

### Initial Setup

1. Run `cc-spacemolt` to launch the app.

2. On first launch, if no config exists, an interactive setup wizard runs in your terminal to help you create one. When the wizard completes, the configuration is saved to `~/.cc-spacemolt/config.json`.

### Starting the App

```bash
# Run the app
cc-spacemolt

# With options
cc-spacemolt --port 3001 --workspace /path/to/workspace
```

Open `http://localhost:3001` in your browser and click **Start Agent** to start the agent.

### Web UI Overview

The screen consists of three panels:

- **Ship panel (left)**: Detailed ship and player status, galaxy map
- **Claude panel (center)**: Agent action log, conversation interface
- **Events panel (right)**: Real-time game event display

When you first open the browser, the Claude panel shows a button to start the agent. Optionally edit the initial prompt, then click the button to launch. You can send instructions to the agent at any time via the text input in the Claude panel, and stop or reset the session as needed. Click the clock icon in the chat view to resume a past session. The dashboard refreshes approximately every 10 seconds to reflect the latest game state.

## Command Line

```
cc-spacemolt [options]
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
| `--claude-env <KEY=VALUE>`       | —                                                     | Env var for Claude CLI (repeatable)                    |
| `--claude-args <args>`           | —                                                     | Additional args for Claude CLI (repeatable)            |

Command-line arguments override values in the config file.

## Configuration

Configure behavior via `~/.cc-spacemolt/config.json` (or `data/config.json` during development).

```jsonc
{
  "initialPrompt": "...", // Default initial prompt sent to the agent at session start
  "systemPromptAppend": "...", // Additional system prompt appended when running Claude Code
  "mcpServers": {
    // MCP server configuration
    "spacemolt": {
      "type": "http",
      "url": "https://game.spacemolt.com/mcp",
    },
  },
  "permissions": {
    "autoAllowTools": [], // Tool names to auto-approve
    "allowedMcpPrefixes": ["mcp__spacemolt__"], // MCP tool prefixes to auto-approve
    "allowedWebDomains": ["game.spacemolt.com", "spacemolt.com"], // Domains to auto-approve for WebFetch / WebSearch
  },
  "maxLogEntries": 1000, // Maximum number of conversation log entries to keep
  "model": "sonnet", // Claude model to use
  "workspacePath": "/path/to/workspace", // Working directory for Claude Code
  "language": "English", // Language for agent responses (e.g. "English", "Japanese")
  "uiLanguage": "en", // Language for the Web UI setup wizard ("en" or "ja")
  "dangerouslySkipPermissions": false, // Bypass all permission checks (use with caution)
  "claudeArgs": ["--verbose"], // Additional CLI arguments appended to the Claude CLI command
  "claudeEnv": { "MY_VAR": "value" }, // Environment variables applied when launching Claude CLI
}
```

## Development

### Running from Source

```bash
git clone https://github.com/palon7/cc-spacemolt.git
cd cc-spacemolt
npm install
npm run dev # start dev server
```

```bash
npm run dev:backend -- --workspace path/to/workspace # backend only with custom workspace
npm run dev:frontend # frontend only
```

## Security Considerations

- To mitigate prompt injection risks, grant Claude Code only the minimum necessary permissions. Use `dangerouslySkipPermissions` only in a sandboxed environment with restricted internet access.
- The Web UI provides an interface to control Claude Code. Take security seriously if exposing it externally. Do not expose it directly to the public internet.
