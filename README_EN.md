# MiniAgent 🐱

> A minimalist local Agent framework for individual developers, aligned with Claude Code & OpenCode

```
███╗   ███╗██╗███╗   ██╗██╗ █████╗  ██████╗ ███████╗███╗   ██╗████████╗
████╗ ████║██║████╗  ██║██║██╔══██╗██╔════╝ ██╔════╝████╗  ██║╚══██╔══╝
██╔████╔██║██║██╔██╗ ██║██║███████║██║  ███╗█████╗  ██╔██╗ ██║   ██║   
██║╚██╔╝██║██║██║╚██╗██║██║██╔══██║██║   ██║██╔══╝  ██║╚██╗██║   ██║   
██║ ╚═╝ ██║██║██║ ╚████║██║██║  ██║╚██████╔╝███████╗██║ ╚████║   ██║   
╚═╝     ╚═╝╚═╝╚═╝  ╚═══╝╚═╝╚═╝  ╚═╝ ╚═════╝ ╚══════╝╚═╝  ╚═══╝   ╚═╝   
```

---

## 🚀 Quick Start

### Usage

| Scenario | Command |
|----------|---------|
| **Use without installing** | `npx miniagent chat` |
| **After global install** | `npm install -g miniagent` → `miniagent chat` |
| **Local development** | `npm run dev` or `npx tsx src/cli.ts chat` |

### Demo

```bash
# Interactive chat
miniagent chat -m qwen2:0.5b

# List all sessions
miniagent chat --list-sessions

# Single execution
miniagent run "Help me create a todo list"

# View all tools
miniagent tools
```

---

## ✨ Core Features

| Feature | Status | Description |
|---------|--------|-------------|
| **30+ Tools** | ✅ | bash, file, git, github, mcp, memory, config, lsp, image, etc. |
| 🎯 **16 Skills** | ✅ | SKILL.md format, aligned with Claude Code |
| 🪝 **13 Hook Types** | ✅ | session_start/pre_tool_use/post_tool_use, etc. |
| 💻 **TUI Interface** | ✅ | MINIAGENT ASCII header + status bar |
| 📝 **52+ Slash Commands** | ✅ | Fully aligned with Claude Code (50+) |
|  **Session Persistence** | ✅ | Save/load/delete sessions |
| 🎮 **Checkpoints / Rewind** | ✅ | Auto-save before/after changes, rollback |
|  **AGENTS.md Support** | ✅ | Project-level custom config, YAML frontmatter |
| 🧠 **3-Layer Memory** | ✅ | SessionMemory + LongTermMemory + Context Compactor |
| 🔒 **11-Layer Security** | ✅ | Permission system, dangerous command detection |
| 🔌 **MCP Protocol** | ✅ | Connect MCP services to extend tools |
| 📊 **Stats & Usage** | ✅ | Usage statistics tracking |
| 🎵 **Background Tasks** | ✅ | Start background processes without blocking |
| 📜 **Prompt History** | ✅ | History search and navigation |
| 🎭 **Thinking Mode** | ✅ | Normal/verbose mode toggle |
| 📦 **Plugin System** | ✅ | npm package extensions |
|  **Formatters** | ✅ | Prettier/ESLint/Stylelint |
| 🐙 **GitHub Integration** | ✅ | Issue/PR management |
| 📦 **Code Snippets** | ✅ | TypeScript/Python pre-built code |
| 📚 **Docs Cache** | ✅ | Auto-cache programming docs |
| ✅ **Completeness Check** | ✅ | Auto-validate generated code |
| ▶️ **Auto-Run** | ✅ | Auto-test after generation |
| 🖨️ **Log Injection** | ✅ | Auto-add complete logs |
| 🔍 **LSP Integration** | ✅ | Code diagnostics/definition/references |
| ❓ **Question Tool** | ✅ | LLM can ask user questions |
| 📝 **Apply Patch Tool** | ✅ | Precise diff/patch file editing |
| 🖼️ **Image Support** | ✅ | Read images for LLM vision analysis |
| 🔗 **Share Feature** | ✅ | Generate session links to share |
| 🖥️ **Client/Server Arch** | ✅ | Session persistence, reconnect safe |
| 🌐 **Web UI** | ✅ | Browser access, mobile-friendly |

---

## 🏗️ Architecture

### System Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              MiniAgent System                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   ┌───────────────────────────────────────────────────────────────────┐    │
│   │                    CLI / TUI Interface                             │    │
│   │   ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────────┐ │    │
│   │   │  Chat    │  │  Run     │  │  Slash   │  │  Skill Commands  │ │    │
│   │   │  Mode    │  │  Mode    │  │  Cmds    │  │  (/skill-name)   │ │    │
│   │   └──────────┘  └──────────┘  └──────────┘  └──────────────────┘ │    │
│   └─────────────────────────────┬─────────────────────────────────────┘    │
│                                 │                                          │
│                                 ▼                                          │
│   ┌───────────────────────────────────────────────────────────────────┐    │
│   │                        Agent Core Loop                             │    │
│   │                                                                   │    │
│   │   ┌────────────┐   ┌────────────┐   ┌──────────────────────────┐  │    │
│   │   │  System    │   │  Message   │   │  Tool Call               │  │    │
│   │   │  Prompt    │──▶│  History   │──▶│  Decision & Execution    │  │    │
│   │   │  Builder   │   │  Manager   │   │  Loop                    │  │    │
│   │   └────────────┘   └────────────┘   └──────────────────────────┘  │    │
│   │          │                                             │          │    │
│   │          ▼                                             ▼          │    │
│   │   ┌────────────┐                             ┌──────────────────┐  │    │
│   │   │  Project   │                             │  Permission      │  │    │
│   │   │  Config    │                             │  System          │  │    │
│   │   │(AGENTS.md) │                             │  (11 Layers)     │  │    │
│   │   └────────────┘                             └──────────────────┘  │    │
│   └───────────────────────────────────────────────────────────────────┘    │
│                                 │                                          │
│          ┌──────────────────────┼──────────────────────┐                   │
│          ▼                      ▼                      ▼                   │
│   ┌──────────────┐    ┌──────────────┐    ┌────────────────────────┐      │
│   │ LLM Adapter  │    │ Tool Registry│    │    Code Enhancer       │      │
│   │              │    │              │    │                        │      │
│   │ ┌──────────┐ │    │ ┌──────────┐ │    │                        │      │
│   │ │  Ollama  │ │    │ │ 30+ Tools│ │    │  ┌──────────────────┐  │      │
│   │ │ Adapter  │ │    │ │          │ │    │  │  Snippet Library │  │      │
│   │ └──────────┘ │    │ │ • Bash   │ │    │  └──────────────────┘  │      │
│   │ ┌──────────┐ │    │ │ • File   │ │    │  ┌──────────────────┐  │      │
│   │ │  Mock    │ │    │ │ • Glob   │ │    │  │ Example-Driven   │  │      │
│   │ │ Adapter  │ │    │ │ • Grep   │ │    │  │ Generator        │  │      │
│   │ └──────────┘ │    │ │ • Web    │ │    │  └──────────────────┘  │      │
│   └──────────────┘    │ │ • Todo   │ │    │  ┌──────────────────┐  │      │
│                       │ • Config  │ │    │  │  Progressive     │  │      │
│                       │ • Format  │ │    │  │  Generation      │  │      │
│                       │ • GitHub  │ │    │  └──────────────────┘  │      │
│                       │ • MCP     │ │    │  ┌──────────────────┐  │      │
│                       │ • Memory  │ │    │  │  Multi-Role      │  │      │
│                       │ • ...26+  │ │    │  │  Review          │  │      │
│                       └──────────┘ │    │  └──────────────────┘  │      │
│                                    │    │  ┌──────────────────┐  │      │
│                                    │    │  │ Constraint-      │  │      │
│                                    │    │  │ Driven Gen       │  │      │
│                                    │    │  └──────────────────┘  │      │
│                                    │    │  ┌──────────────────┐  │      │
│                                    │    │  │ Failure Pattern  │  │      │
│                                    │    │  │ Learner          │  │      │
│                                    │    │  └──────────────────┘  │      │
│                                    └────────────────────────────────┘      │
│                                                                         │
│   ┌─────────────────────────────────────────────────────────────────┐    │
│   │                    Supporting Systems                            │    │
│   │                                                                 │    │
│   │   ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────────┐  │    │
│   │   │ Session  │ │ Check-   │ │  Hooks   │ │  Plugins         │  │    │
│   │   │ Memory   │ │ points   │ │  System  │ │  System          │  │    │
│   │   └──────────┘ └──────────┘ └──────────┘ └──────────────────┘  │    │
│   │   ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────────┐  │    │
│   │   │ Docs     │ │ Thinking │ │  Task    │ │  Stats &         │  │    │
│   │   │ Cache    │ │ Mode     │ │  System  │ │  Tracking        │  │    │
│   │   └──────────┘ └──────────┘ └──────────┘ └──────────────────┘  │    │
│   └─────────────────────────────────────────────────────────────────┘    │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

---

##  MiniAgent Innovation: Small Model Enhancement

> **Core Philosophy**: "Small models + engineering optimization = viable coding assistant"

MiniAgent introduces unique features not found in Claude Code or OpenCode, specifically designed to help small models (7B and below) generate better code:

### 1. 📦 Code Snippets Library

Small models struggle with generating complex code from scratch. We provide pre-built templates:

```
.miniagent/snippets/
├── typescript/
│   ├── react-component.tsx    # React component template
│   ├── express-api.ts         # Express CRUD API
│   └── utils.ts               # TypeScript utilities
└── python/
    ├── fastapi-app.py         # FastAPI application
    └── fastapi-router.py      # FastAPI routes
```

### 2.  Documentation Cache System

Instead of storing all docs in the project, we cache them on first access:

```
.miniagent/docs/
├── index.yaml                 # Language doc index (15+ languages)
├── cache-config.yaml          # Cache configuration
└── cache/                     # Cached documentation
```

**Workflow**:
```
User requests doc
     ↓
Check local cache
     ↓
Cache exists?──No──→ Fetch online → Cache locally → Return
     ↓Yes
Check if expired
     ↓
Expired?──Yes──→ Update cache → Return
     ↓No
Return cached content (ms-level response!)
```

### Agent Main Loop

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          Agent Main Loop                                 │
└─────────────────────────────────────────────────────────────────────────┘

  User Input
     │
     ▼
┌─────────────────────────┐
│  Build System Prompt    │
│  ┌───────────────────┐  │
│  │ • Role Definition │  │
│  │ • Tool Descriptions│ │
│  │ • Project Config  │  │
│  │ • Memory Context  │  │
│  │ • Active Skills   │  │
│  └───────────────────┘  │
└────────────┬────────────┘
             │
             ▼
┌─────────────────────────┐     ┌─────────────────────────┐
│  Generate Response      │────▶│  LLM Adapter            │
│  (Local Ollama)         │     │  ┌───────────────────┐  │
│                         │     │  │ qwen2.5:7b        │  │
│                         │     │  │ llama3.2:3b       │  │
│                         │◀────│  │ deepseek-coder:6b │  │
└────────────┬────────────┘     │  └───────────────────┘  │
             │                  └─────────────────────────┘
             │
             ▼
┌─────────────────────────┐
│  Parse Response         │
│  ┌───────────────────┐  │
│  │ Text Response     │──┼──▶ Return to User
│  │ Tool Calls        │  │
│  └────────┬──────────┘  │
└───────────┼─────────────┘
            │
            ▼
┌─────────────────────────────────────────────────────────────────┐
│  Tool Execution Pipeline                                         │
│                                                                  │
│  ┌────────────┐   ┌────────────┐   ┌──────────────────────────┐ │
│  │ Permission │──▶│ Pre-Hooks  │──▶│ Tool Execution           │ │
│  │ Check      │   │            │   │ (bash, file, glob, ...)  │ │
│  └────────────┘   └────────────┘   └────────────┬─────────────┘ │
│                                                  │              │
│                                                  ▼              │
│                                         ┌────────────┐         │
│                                         │Post-Hooks  │         │
│                                         └────────────┘         │
└─────────────────────────────────────────────────────────────────┘
            │
            ▼
┌─────────────────────────┐
│  Enhance Generated Code │
│                         │
│  ┌───────────────────┐  │
│  │ Completeness Check│  │
│  │ Log Injection     │  │
│  │ Auto-Run          │  │
│  └───────────────────┘  │
└────────────┬────────────┘
             │
             ▼
┌─────────────────────────┐
│  Update Message History │
│  ┌───────────────────┐  │
│  │ Add Assistant Msg │  │
│  │ Add Tool Results  │  │
│  │ Save Checkpoint   │  │
│  └───────────────────┘  │
└────────────┬────────────┘
             │
             ▼
     Continue Loop? ──Yes──▶ Back to Generate Response
             │
             No
             │
             ▼
     Return Final Response
```

- **Syntax**: Bracket matching, indentation consistency
- **Imports**: All imports present, properly ordered
- **Structure**: Export statements, main functions
- **Security**: Hardcoded secrets, eval() usage
- **Completeness**: TODO/FIXME detection

### Code Enhancer Architecture

```
┌──────────────────────────────────────────────────────────────────────────┐
│                     Code Enhancer - Unified Pipeline                      │
│                                                                          │
│   "Small Model + Engineering = High Quality Code"                        │
└──────────────────────────────────────────────────────────────────────────┘

  User Request
     │
     ▼
┌──────────────────────────────────────────────────────────────────────┐
│  Step 1: Find Relevant Snippets (SnippetLibrary)                     │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │  .miniagent/snippets/                                        │   │
│  │  ├── typescript/    # React, Express, Utils templates        │   │
│  │  └── python/        # FastAPI, CLI, Data templates           │   │
│  │                                                              │   │
│  │  Smart Match: name + description + tags + code content       │   │
│  └──────────────────────────────────────────────────────────────┘   │
└────────────────────────────┬─────────────────────────────────────────┘
                             │
                             ▼
┌──────────────────────────────────────────────────────────────────────┐
│  Step 2: Find Similar Examples (ExampleDrivenGenerator)              │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │  Scan Project Code → Extract patterns → Build example pool   │   │
│  │                                                              │   │
│  │  Similarity: Jaccard + tag matching + keyword scoring        │   │
│  │                                                              │   │
│  │  Small model mimics > creates from scratch                   │   │
│  └──────────────────────────────────────────────────────────────┘   │
└────────────────────────────┬─────────────────────────────────────────┘
                             │
                             ▼
┌──────────────────────────────────────────────────────────────────────┐
│  Step 3: Extract Constraints (ConstraintDrivenGenerator)             │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │  mustUse:      Libraries/patterns to use                     │   │
│  │  mustNotUse:   Libraries/patterns to avoid                   │   │
│  │  mustFollow:   Coding standards to follow                    │   │
│  │  mustHandle:   Edge cases to handle                          │   │
│  │  maxComplexity: Max cyclomatic complexity                    │   │
│  │  maxLines:     Max lines of code                             │   │
│  └──────────────────────────────────────────────────────────────┘   │
└────────────────────────────┬─────────────────────────────────────────┘
                             │
                             ▼
┌──────────────────────────────────────────────────────────────────────┐
│  Step 4: Query Failure History (FailurePatternLearner)               │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │  .miniagent/failures.json                                    │   │
│  │                                                              │   │
│  │  Record: request → generated code → failure reason → fix     │   │
│  │  Search: Similar failures → Prevention tips                  │   │
│  │                                                              │   │
│  │  Project gets smarter over time!                             │   │
│  └──────────────────────────────────────────────────────────────┘   │
└────────────────────────────┬─────────────────────────────────────────┘
                             │
                             ▼
┌──────────────────────────────────────────────────────────────────────┐
│  Step 5: Generate Code (Choose Strategy)                             │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │                                                              │   │
│  │  Progressive Generation (Recommended)                        │   │
│  │  ┌─────────────────────────────────────────────────────┐    │   │
│  │  │ Round 1: Skeleton / Type definitions                │    │   │
│  │  │   ▼ validate                                         │    │   │
│  │  │ Round 2: Function implementation                    │    │   │
│  │  │   ▼ validate                                         │    │   │
│  │  │ Round 3: Error handling                             │    │   │
│  │  │   ▼ validate                                         │    │   │
│  │  │ Round 4: Edge cases                                 │    │   │
│  │  └─────────────────────────────────────────────────────┘    │   │
│  │                                                              │   │
│  │  Fallback: Example-driven → Constraint-driven → Direct       │   │
│  └──────────────────────────────────────────────────────────────┘   │
└────────────────────────────┬─────────────────────────────────────────┘
                             │
                             ▼
┌──────────────────────────────────────────────────────────────────────┐
│  Step 6: Multi-Role Review (MultiRoleReviewer)                       │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │                                                              │   │
│  │  🔒 Security Expert     → OWASP Top 10, injections, secrets  │   │
│  │  ⚡ Performance Engineer → Complexity, I/O, memory, caching  │   │
│  │  🏗️ Architecture Reviewer → SOLID, patterns, modularity     │   │
│  │  🧪 Testing Expert       → Testability, coverage, patterns   │   │
│  │  📖 Readability Expert   → Naming, structure, documentation  │   │
│  │                                                              │   │
│  │  Merge all reviews → Auto-fix critical issues                │   │
│  └──────────────────────────────────────────────────────────────┘   │
└────────────────────────────┬─────────────────────────────────────────┘
                             │
                             ▼
┌──────────────────────────────────────────────────────────────────────┐
│  Step 7: Final Validation & Return                                   │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │  Syntax check → Security check → Quality score → Return      │   │
│  └──────────────────────────────────────────────────────────────┘   │
└────────────────────────────┬─────────────────────────────────────────┘
                             │
                             ▼
┌──────────────────────────────────────────────────────────────────────┐
│  Step 8: Record Experience (Success or Failure)                      │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │  Success → Record best practice                              │   │
│  │  Failure → Record failure pattern → Increment occurrence     │   │
│  └──────────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────────┘
```

```yaml
run_strategy:
  immediate:    # Run simple scripts immediately
    - JavaScript/Node.js
    - Python single files
  delayed:      # Delay for build-required code
    - TypeScript (needs compilation)
    - Rust (needs cargo build)
  manual:       # Manual confirmation for risky ops
    - Database migrations
    - Delete operations
```

### Multi-Role Review System

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    Multi-Role Code Review System                         │
│                                                                          │
│  "One model, multiple personas - comprehensive quality assurance"       │
└─────────────────────────────────────────────────────────────────────────┘

  Generated Code
       │
       ├───▶ ┌──────────────────────────────────────────────────────────┐
       │     │  🔒 Security Expert (10+ years experience)               │
       │     │  ┌────────────────────────────────────────────────────┐  │
       │     │  │ • SQL/XSS/Command injection detection              │  │
       │     │  │ • Hardcoded secrets & credentials                  │  │
       │     │  │ • Authentication & authorization gaps              │  │
       │     │  │ • PII exposure & data protection                   │  │
       │     │  │ • Input validation & sanitization                  │  │
       │     │  │ • Error handling & info leakage                    │  │
       │     │  │ • Dependency & supply chain security               │  │
       │     │  └────────────────────────────────────────────────────┘  │
       │     │  Output: Severity + Location + Vulnerability + Fix       │
       │     └──────────────────────────────────────────────────────────┘
       │
       ├───▶ ┌──────────────────────────────────────────────────────────┐
       │     │  ⚡ Performance Engineer (10+ years experience)           │
       │     │  ┌────────────────────────────────────────────────────┐  │
       │     │  │ • Algorithm complexity (O(n), O(n²), O(n log n))   │  │
       │     │  │ • Database I/O (N+1 queries, indexing)             │  │
       │     │  │ • Memory management (leaks, allocations)           │  │
       │     │  │ • Network & API optimization                       │  │
       │     │  │ • Concurrency & parallelism                        │  │
       │     │  │ • Caching strategy                                 │  │
       │     │  └────────────────────────────────────────────────────┘  │
       │     │  Output: Impact + Location + Optimization + Expected     │
       │     └──────────────────────────────────────────────────────────┘
       │
       ├───▶ ┌──────────────────────────────────────────────────────────┐
       │     │  🏗️ Architecture Reviewer (15+ years experience)         │
       │     │  ┌────────────────────────────────────────────────────┐  │
       │     │  │ • SOLID principles compliance                      │  │
       │     │  │ • Separation of concerns                           │  │
       │     │  │ • Design patterns (appropriate usage)              │  │
       │     │  │ • API design & contracts                           │  │
       │     │  │ • Error handling strategy                          │  │
       │     │  │ • Code organization & modularity                   │  │
       │     │  │ • Scalability & extensibility                      │  │
       │     │  └────────────────────────────────────────────────────┘  │
       │     │  Output: Severity + Principle + Current + Recommended    │
       │     └──────────────────────────────────────────────────────────┘
       │
       ├───▶ ┌──────────────────────────────────────────────────────────┐
       │     │  🧪 Testing Expert (QA Architect)                        │
       │     │  ┌────────────────────────────────────────────────────┐  │
       │     │  │ • Testability (DI, side effects)                   │  │
       │     │  │ • Coverage gaps (edge cases, error paths)          │  │
       │     │  │ • Test quality (descriptive, independent, fast)    │  │
       │     │  │ • Testing patterns (fixtures, mocks, parameterized)│  │
       │     │  │ • Integration testing concerns                     │  │
       │     │  │ • Testing anti-patterns                            │  │
       │     │  └────────────────────────────────────────────────────┘  │
       │     │  Output: Type + Location + Issue + Recommendation        │
       │     └──────────────────────────────────────────────────────────┘
       │
       └───▶ ┌──────────────────────────────────────────────────────────┐
             │  📖 Readability Expert (DX Expert)                       │
             │  ┌────────────────────────────────────────────────────┐  │
             │  │ • Naming conventions (descriptive, domain-aligned) │  │
             │  │ • Code structure (function length, early returns)  │  │
             │  │ • Comments & documentation (WHY not WHAT)          │  │
             │  │ • Cognitive complexity (nesting, boolean logic)    │  │
             │  │ • Code duplication (DRY principle)                 │  │
             │  │ • Developer experience (errors, predictability)    │  │
             │  └────────────────────────────────────────────────────┘  │
             │  Output: Type + Location + Before/After + Impact         │
             └──────────────────────────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  Merge All Reviews                                                       │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │  • Deduplicate similar issues                                    │   │
│  │  • Prioritize by severity (CRITICAL > HIGH > MEDIUM > LOW)       │   │
│  │  • Calculate overall quality score (0-100)                       │   │
│  │  • Generate summary report                                       │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│  │                                                                      │
│  ▼                                                                      │
┌─────────────────────────────────────────────────────────────────────────┐
│  Auto-Fix Critical Issues                                                │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │  For each CRITICAL/HIGH issue → Generate fix prompt → Apply      │   │
│  └──────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
```

Automatically inject comprehensive logging into generated code:

```python
def process_data(data):
    logger.info(f"Processing {len(data)} items")
    logger.debug(f"Input: {data[:5]}...")
    # ... processing ...
    logger.info(f"Processed {len(result)} items")
    return result
```

---

## 📁 Project Structure

```
miniagent/
├── src/
│   ├── cli.ts                         # CLI entry (MINIAGENT TUI)
│   ├── core/                          # Core engine (22 files)
│   │   ├── agent.ts                   # Agent main class
│   │   ├── system-prompt.ts           # System prompt builder
│   │   ├── permissions.ts             # Permission system
│   │   ├── hooks.ts                   # Hook system (13 events)
│   │   ├── commands.ts                # Slash commands (52+)
│   │   ├── checkpoints.ts             # Checkpoints/Rewind
│   │   ├── agents-md.ts               # AGENTS.md parser
│   │   ├── background-tasks.ts        # Background tasks
│   │   ├── prompt-history.ts          # Prompt history
│   │   ├── stats.ts                   # Usage statistics
│   │   ├── autoupdate.ts              # Auto-update checker
│   │   ├── watcher.ts                 # File watcher
│   │   ├── thinking-mode.ts           # Thinking mode
│   │   ├── compact.ts                 # Context compaction
│   │   ├── docs-cache.ts              # Docs cache
│   │   ├── completeness-checker.ts    # Completeness check
│   │   ├── auto-runner.ts             # Auto-run
│   │   └── log-injector.ts            # Log injection
│   ├── tools/                         # Tool system (22 files)
│   ├── skills/                        # Skill system (4 files)
│   ├── memory/                        # Memory system (2 files)
│   └── mcp/                           # MCP protocol (4 files)
├── test/                              # Tests (modularized)
│   ├── core/                          # Core module tests
│   ├── tools/                         # Tool tests
│   ├── skills/                        # Skill tests
│   └── fixtures/                      # Test fixtures
├── docs/                              # Learning notes (12 docs)
├── .miniagent/                        # Project config
│   ├── skills/                        # Project-level skills (16 SKILL.md)
│   ├── snippets/                      # Code snippets
│   └── docs/                          # Doc index
└── local_llm/                         # Local LLM models & scripts
```

---

## 📖 Documentation

| Document | Link |
|----------|------|
| 📋 Development Plan | [DEVELOPMENT_PLAN.md](./DEVELOPMENT_PLAN.md) |
| 🏗️ Architecture | [ARCHITECTURE.md](./ARCHITECTURE.md) |
| 📊 Architecture Comparison | [ARCHITECTURE_COMPARISON.md](./ARCHITECTURE_COMPARISON.md) |
| 📚 Learning Notes | [docs/](./docs/) |
| 🚀 Quick Start | [QUICKSTART.md](./QUICKSTART.md) |

---

##  Slash Commands (52+)

| Category | Commands |
|----------|----------|
| **Session (8)** | /help, /compact, /clear, /new, /save, /resume, /restart, /quit |
| **File (8)** | /init, /status, /diff, /undo, /redo, /add-dir, /files, /context |
| **Workflow (10)** | /plan, /approve, /skip, /review, /commit, /test, /retry, /explain, /loop, /batch |
| **Tools (7)** | /tools, /config, /permissions, /model, /mcp, /version, /reset |
| **Skills (4)** | /skills, /skill, /hooks, /plugins |
| **Memory (5)** | /memory, /history, /checkpoints, /rewind, /branch |
| **Security (4)** | /security-review, /simplify, /debug, /copy |
| **Git (4)** | /git, /github, /share, /export |
| **TUI (5)** | /thinking, /format, /background, /vim, /insights |
| **Diagnostics (4)** | /doctor, /bug, /docs, /connect |
| **Auth (3)** | /login, /logout, /privacy-settings |

---

## 🏆 Gap Analysis vs Claude Code / OpenCode

### ✅ Features Aligned with Claude Code

| Feature | Claude Code | MiniAgent |
|---------|-------------|-----------|
| Core Agent Loop | ✅ | ✅ |
| 26+ Tools | ~30 | 26 |
| 50+ Slash Commands | ~50 | 52 |
| Skills System | ✅ | ✅ |
| Session Persistence | ✅ | ✅ |
| Checkpoints/Rewind | ✅ | ✅ |
| AGENTS.md/CLAUDE.md | ✅ | ✅ |
| MCP Protocol | ✅ | ✅ |
| Plan Mode | ✅ | ✅ |
| Sub-Agent | ✅ | ✅ |
| Task System | ✅ | ✅ |
| Permission System | ✅ | ✅ |
| LongTermMemory | ✅ | ✅ |
| Context Compactor | ✅ | ✅ |
| Background Tasks | ✅ | ✅ |
| Hooks System | ✅ | ✅ |

###  MiniAgent Exclusive Innovations

| Feature | Claude Code | OpenCode | MiniAgent |
|---------|-------------|----------|-----------|
| Code Snippets | ❌ |  | ✅ |
| Docs Cache | ❌ | ❌ | ✅ |
| Completeness Check |  | ❌ | ✅ |
| Auto-Run | ❌ | ❌ | ✅ |
| Log Injection | ❌ | ❌ | ✅ |
| Local-First | ❌ |  | ✅ |

### 📋 Remaining Gaps (Nice-to-Have)

| Feature | Priority | Description |
|---------|----------|-------------|
| Client/Server Architecture | Low | Separate client and server |
| Full LSP Integration | Low | Language Server Protocol |
| VS Code Extension | Medium | Editor integration |
| JetBrains Extension | Medium | Editor integration |
| Notebook Editor | Low | Jupyter Notebook support |
| Worktree Tools | Low | Git Worktree management |
| SQLite Persistence | Low | Database task storage |
| MCP SSE Transport | Low | Server-Sent Events |

---

## 📦 Publish npm Package

```bash
# 1. Build
npm run build

# 2. Pre-publish check
npm pack --dry-run

# 3. Publish
npm publish --access public
```

After publishing:
```bash
# Use without installing
npx miniagent chat

# Global install
npm install -g miniagent
miniagent chat
```

---

## 📄 License

MIT

---

## 🙏 Acknowledgments

- Referenced Claude Code official architecture
- Referenced OpenCode official architecture
- Thanks to all open-source contributors

---

✨ Let AI help you write code, run locally, no API Key needed! ✨
