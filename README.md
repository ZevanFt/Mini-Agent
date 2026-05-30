# MiniAgent

A local AI Agent framework — runs on your machine with Ollama, no cloud needed.

## Features

- **Local-first** — runs entirely on your machine with Ollama
- **22+ built-in tools** — bash, file read/write, glob, grep, web search, web fetch, git, and more
- **Dual-pipeline code enhancement** — automatically rescues bad code and elevates good code to production quality
- **TUI & Web UI** — terminal interface or browser-based chat
- **MCP support** — Model Context Protocol server for external clients
- **Skill system** — discoverable and pluggable skill modules
- **Hooks system** — event-driven lifecycle hooks
- **Session management** — save, load, rewind conversations

## Quick Start

### Prerequisites

- Node.js >= 18
- Ollama running locally (`ollama serve`)

### Installation

```bash
npm install -g miniagent
```

### Usage

```bash
# Start interactive chat
miniagent chat

# Start web server
miniagent serve --port 3000

# Start MCP SSE server
miniagent mcp-serve --port 8080

# Run a single command
miniagent run "Explain this codebase"

# List available tools
miniagent tools

# Initialize project config
miniagent init
```

## Commands

| Command | Description |
|---------|-------------|
| `miniagent chat` | Interactive terminal chat |
| `miniagent run <msg>` | Run a single task |
| `miniagent serve` | Start web UI server |
| `miniagent mcp-serve` | Start MCP SSE server |
| `miniagent tools` | List available tools |
| `miniagent init` | Initialize project config |

## Slash Commands (in chat mode)

- `/help` — Show help
- `/quit` — Exit
- `/clear` — Clear conversation
- `/compact` — Compress context
- `/model` — Switch model
- `/new` — New session
- `/plan` — Toggle plan mode
- `/build` — Toggle build mode
- `/diff` — Show git diff
- `/search` — Search codebase
- `/review` — Review changes
- `/commit` — Generate commit message
- `/mcp` — Manage MCP servers
- `/health` — Health check
- `/tools` — List available tools

## License

MIT
