# MiniAgent - 极简本地 Agent 框架

> 一个面向个人开发者的轻量级本地 Agent 框架，零门槛、低配置、可学习

## 1. 项目概述

### 1.1 项目定位

```
MiniAgent = 极简 + 本地 + 可学习 + 有用
```

**解决的问题**：
- 想体验 Agent 但没有 API 预算
- 低配电脑无法运行复杂的 Agent 系统
- 想学习 Agent 开发但代码太复杂
- 现有开源 Agent 框架门槛太高

**目标用户**：
- 个人开发者 / 独立开发者
- 想学习 Agent 开发的学习者
- 低配置设备的用户
- 预算有限的开发者

### 1.2 核心特性

- **零成本运行**：完全本地，Ollama 驱动，无需 API Key
- **极简设计**：代码 < 5000 行，结构清晰易读
- **开箱即用**：内置常用工具集和技能模块
- **低配友好**：支持 0.5B~1.5B 参数量级模型
- **可扩展**：Tool 和 Skill 都支持插件化扩展
- **可学习**：注释完善，适合作为 Agent 开发入门项目

### 1.3 技术选型

| 组件 | 技术选型 | 理由 |
|------|----------|------|
| **语言** | TypeScript | 前端友好，类型安全 |
| **运行时** | Bun | 极速启动，兼容 npm |
| **核心依赖** | ollama (SDK) | 本地模型支持 |
| **CLI 框架** | Commander.js | 轻量、简单 |
| **TUI** | Ink / React | 可选，有趣 |
| **配置管理** | 纯 JSON/YAML | 无需额外依赖 |

---

## 2. 架构设计

### 2.1 整体架构图

```
┌─────────────────────────────────────────────────────────────────────┐
│                              MiniAgent                               │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌──────────────┐                                                    │
│  │    CLI      │  用户交互层                                          │
│  │  (Commander)│  - 命令行参数解析                                     │
│  └──────┬───────┘  - 交互式会话管理                                    │
│         │                                                            │
│  ┌──────▼───────────────────────────────────────────────────────────┐│
│  │                      Agent Core (核心引擎)                         ││
│  │  ┌─────────────────────────────────────────────────────────────┐ ││
│  │  │                    Query Loop (查询循环)                    │ ││
│  │  │                                                              │ ││
│  │  │  ┌──────────┐   ┌──────────────┐   ┌──────────────────────┐ │ ││
│  │  │  │  Input   │──▶│ System Prompt │──▶│   LLM Stream Call   │ │ ││
│  │  │  │ Handler  │   │   Builder    │   │   (Ollama SDK)     │ │ ││
│  │  │  └──────────┘   └──────────────┘   └──────────┬───────────┘ │ ││
│  │  │                                              │              │ ││
│  │  │                                              ▼              │ ││
│  │  │                              ┌─────────────────────────────┐ │ ││
│  │  │                              │     Response Parser        │ │ ││
│  │  │                              │  (解析 tool_use / text)    │ │ ││
│  │  │                              └─────────────┬───────────────┘ │ ││
│  │  │                                            │               │ ││
│  │  │                    ┌───────────────────────┴───────────┐    │ ││
│  │  │                    │                                   │    │ ││
│  │  │                    ▼                                   ▼    │ ││
│  │  │            ┌───────────────┐                   ┌──────────┐ │ ││
│  │  │            │ tool_use 调用 │                   │ 纯文本回复 │ │ ││
│  │  │            └───────┬───────┘                   └──────────┘ │ ││
│  │  │                    │                                        │ ││
│  │  │                    ▼                                        │ ││
│  │  │            ┌───────────────┐                                │ ││
│  │  │            │ Tool Executor │                                │ ││
│  │  │            └───────┬───────┘                                │ ││
│  │  │                    │                                        │ ││
│  │  │                    ▼                                        │ ││
│  │  │            ┌───────────────┐                                │ ││
│  │  │            │  Result Loop │──────────────────────────────────┘ ││
│  │  │            └───────────────┘                                    ││
│  │  └────────────────────────────────────────────────────────────────┘│
│  └────────────────────────────────────────────────────────────────────┘
│                                                                      │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │                      Skill System (技能系统)                      │  │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │  │
│  │  │git-commit    │  │ read-code    │  │ search-files │  ...      │  │
│  │  │   Skill      │  │   Skill      │  │   Skill      │          │  │
│  │  └──────────────┘  └──────────────┘  └──────────────┘          │  │
│  │                                                                   │  │
│  │  Skill = Prompt Template + Tool 组合                              │  │
│  └────────────────────────────────────────────────────────────────┘  │
│                                                                      │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │                       Tool System (工具系统)                      │  │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌──────────┐ │  │
│  │  │  BashTool  │  │  FileTool  │  │ GlobTool   │  │GrepTool  │ │  │
│  │  └────────────┘  └────────────┘  └────────────┘  └──────────┘ │  │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────┐                │  │
│  │  │WebFetchTool│  │ TodoTool   │  │  LSPTool   │  ...          │  │
│  │  └────────────┘  └────────────┘  └────────────┘                │  │
│  │                                                                    │  │
│  │  每个 Tool = name + description + parameters + handler            │  │
│  └────────────────────────────────────────────────────────────────┘  │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
                                        │
                                        ▼
                              ┌─────────────────┐
                              │  Ollama Server  │
                              │  (本地模型运行)  │
                              │  qwen2:0.5b     │
                              │  deepseek-coder │
                              │  phi3:mini      │
                              └─────────────────┘
```

### 2.2 核心执行流程

```
用户输入: "帮我分析这个项目的结构"

┌──────────────────────────────────────────────────────────────────────┐
│ Step 1: Input Handler                                                │
│   • 接收用户消息                                                     │
│   • 追加到对话历史                                                   │
│   • 添加会话元数据                                                   │
└──────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌──────────────────────────────────────────────────────────────────────┐
│ Step 2: System Prompt Builder                                         │
│   • 加载项目配置 (openagent.json)                                     │
│   • 注入当前目录、文件列表、Git 状态                                  │
│   • 注入可用 Tools 列表                                              │
│   • 注入活跃 Skill 信息                                              │
│   • 拼接完整的 System Prompt                                         │
└──────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌──────────────────────────────────────────────────────────────────────┐
│ Step 3: LLM Stream Call (Ollama)                                     │
│   • 建立 SSE 连接                                                    │
│   • 流式接收 tokens                                                  │
│   • 实时渲染到终端                                                   │
└──────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌──────────────────────────────────────────────────────────────────────┐
│ Step 4: Response Parser                                              │
│   • 检测是否包含 tool_use 块                                          │
│   • 如果有 → 提取 tool_calls 数组                                     │
│   • 如果无 → 直接输出文本                                             │
└──────────────────────────────────────────────────────────────────────┘
                                    │
                         ┌──────────┴──────────┐
                         │                     │
                         ▼                     ▼
              ┌──────────────────┐   ┌──────────────────┐
              │  包含 tool_use   │   │    纯文本回复    │
              └────────┬─────────┘   └──────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────────────────────────────┐
│ Step 5: Tool Executor                                                │
│   • 遍历 tool_calls                                                   │
│   • 权限检查                                                          │
│   • 并发执行多个工具                                                  │
│   • 收集结果                                                          │
└──────────────────────────────────────────────────────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────────────────────────────┐
│ Step 6: Result Loop                                                  │
│   • 将工具结果格式化为消息                                            │
│   • 追加到对话历史                                                    │
│   • 回到 Step 3 (继续 LLM 调用)                                       │
│   • 直到 LLM 不再调用工具                                             │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 3. 模块设计

### 3.1 项目目录结构

```
miniagent/
├── src/
│   ├── cli/
│   │   ├── index.ts              # CLI 入口
│   │   ├── commands/
│   │   │   ├── chat.ts           # 交互式聊天命令
│   │   │   ├── run.ts            # 单次执行命令
│   │   │   ├── init.ts           # 初始化项目
│   │   │   └── skill.ts          # Skill 管理命令
│   │   └── interactive/
│   │       ├── repl.ts           # REPL 主循环
│   │       └── input.ts          # 输入处理
│   │
│   ├── core/
│   │   ├── agent.ts              # Agent 主类
│   │   ├── query-loop.ts         # 查询循环
│   │   ├── system-prompt.ts      # 系统提示构建
│   │   └── response-parser.ts    # 响应解析
│   │
│   ├── tools/
│   │   ├── base.ts               # Tool 基类
│   │   ├── registry.ts           # Tool 注册表
│   │   ├── executor.ts           # 工具执行器
│   │   └── types.ts              # Tool 类型定义
│   │
│   │   ├── bash.ts               # Bash 工具
│   │   ├── file-read.ts          # 文件读取
│   │   ├── file-write.ts         # 文件写入
│   │   ├── file-edit.ts          # 文件编辑
│   │   ├── glob.ts               # 文件搜索
│   │   ├── grep.ts               # 内容搜索
│   │   ├── web-fetch.ts          # 网页获取
│   │   ├── todo.ts               # 待办事项
│   │   └── lsp.ts                # LSP 支持
│   │
│   ├── skills/
│   │   ├── base.ts               # Skill 基类
│   │   ├── registry.ts           # Skill 注册表
│   │   └── loader.ts             # Skill 加载器
│   │
│   │   ├── git-commit.ts         # Git 提交技能
│   │   ├── read-code.ts          # 代码阅读技能
│   │   ├── search-files.ts       # 文件搜索技能
│   │   ├── explain-code.ts       # 代码解释技能
│   │   └── generate-readme.ts    # README 生成技能
│   │
│   ├── llm/
│   │   ├── base.ts               # LLM 接口定义
│   │   ├── ollama.ts             # Ollama 适配器
│   │   └── types.ts              # LLM 类型定义
│   │
│   ├── memory/
│   │   ├── session.ts            # 会话管理
│   │   ├── history.ts            # 对话历史
│   │   └── context.ts            # 上下文管理
│   │
│   ├── config/
│   │   ├── loader.ts             # 配置加载
│   │   ├── validator.ts          # 配置验证
│   │   └── defaults.ts           # 默认配置
│   │
│   ├── utils/
│   │   ├── logger.ts             # 日志工具
│   │   ├── stream.ts             # 流处理工具
│   │   └── security.ts           # 安全检查
│   │
│   └── index.ts                  # 统一导出
│
├── packages/
│   ├── cli/                      # CLI 独立包
│   ├── core/                     # 核心包（可独立使用）
│   └── tools/                    # 工具包
│
├── examples/                     # 示例代码
│   ├── basic-chat.ts             # 基础聊天
│   ├── custom-tool.ts            # 自定义工具
│   └── custom-skill.ts           # 自定义技能
│
├── docs/                         # 文档
│   ├── architecture.md           # 架构文档
│   ├── tools.md                  # 工具开发指南
│   ├── skills.md                 # 技能开发指南
│   └── api.md                    # API 文档
│
├── tests/                        # 测试
│   ├── unit/                     # 单元测试
│   ├── integration/              # 集成测试
│   └── fixtures/                 # 测试数据
│
├── package.json
├── tsconfig.json
├── bunfig.toml
└── README.md
```

### 3.2 核心模块职责

#### 3.2.1 CLI 层

```typescript
// src/cli/index.ts
// 职责：命令行入口，参数解析，命令分发

interface CLICommands {
  // 交互式聊天
  chat [options]: {
    cwd?: string;           // 工作目录
    model?: string;         // 指定模型
    skill?: string[];       // 启用的技能
  };

  // 单次执行
  run <prompt> [options]: {
    cwd?: string;
    model?: string;
    noStream?: boolean;      // 禁用流式输出
  };

  // 初始化
  init [path]: {
    force?: boolean;         // 强制初始化
  };

  // 技能管理
  skill: {
    list: void;              // 列出可用技能
    enable <name>: void;     // 启用技能
    disable <name>: void;    // 禁用技能
    create <name>: void;     // 创建新技能
  };
}
```

#### 3.2.2 Core 层

```typescript
// src/core/agent.ts
// 职责：Agent 主类，协调各个组件

class Agent {
  private llm: LLMAdapter;
  private toolRegistry: ToolRegistry;
  private skillRegistry: SkillRegistry;
  private memory: SessionMemory;
  private config: AgentConfig;

  async chat(message: string): AsyncGenerator<string>;
  async run(prompt: string): Promise<string>;
  addTool(tool: Tool): void;
  addSkill(skill: Skill): void;
  reset(): void;
}
```

```typescript
// src/core/query-loop.ts
// 职责：核心查询循环，处理 LLM 调用和工具执行

class QueryLoop {
  private llm: LLMAdapter;
  private executor: ToolExecutor;
  private parser: ResponseParser;
  private maxIterations: number;  // 防止无限循环

  async execute(
    messages: Message[],
    tools: Tool[],
    systemPrompt: string
  ): AsyncGenerator<LoopEvent>;
}
```

#### 3.2.3 Tool 系统

```typescript
// src/tools/base.ts
// 职责：定义 Tool 的标准接口

interface Tool {
  name: string;                    // 工具名称（小写+下划线）
  description: string;             // 描述（用于 LLM 理解）
  parameters: {                    // JSON Schema 参数定义
    type: 'object';
    properties: Record<string, ParameterSchema>;
    required: string[];
  };
  permissions?: Permission[];      // 权限要求
}

interface ParameterSchema {
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  description?: string;
  default?: any;
  enum?: any[];
}

// 示例：FileReadTool
const FileReadTool: Tool = {
  name: 'file_read',
  description: 'Read the contents of a file from the filesystem. ' +
                'Use this when you need to examine existing code or text files.',
  parameters: {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: 'Absolute path to the file to read'
      },
      lines: {
        type: 'number',
        description: 'Maximum number of lines to read (default: all)'
      }
    },
    required: ['path']
  },
  async execute(params: { path: string; lines?: number }) {
    // 实现...
  }
};
```

#### 3.2.4 Skill 系统

```typescript
// src/skills/base.ts
// 职责：Skill 基类定义

interface Skill {
  name: string;                    // 技能名称
  description: string;             // 技能描述
  triggers: string[];              // 触发词/模式
  tools: Tool[];                   // 依赖的工具
  systemPrompt?: string;           // 追加的系统提示
  onActivate?: () => void;         // 激活钩子
  onDeactivate?: () => void;       // 停用钩子
}

// 示例：GitCommitSkill
const GitCommitSkill: Skill = {
  name: 'git_commit',
  description: '智能 Git 提交助手，帮助生成规范的提交信息',
  triggers: [
    '帮我提交代码',
    '生成 commit message',
    'git commit',
    '提交改动'
  ],
  tools: [BashTool, FileReadTool, GlobTool],
  systemPrompt: `你是一个 Git 提交助手。当用户提供代码改动时：
1. 分析改动的目的和影响
2. 根据 Conventional Commits 规范生成提交信息
3. 格式：<type>(<scope>): <subject>

type 类型：
- feat: 新功能
- fix: 修复 bug
- docs: 文档更新
- style: 代码格式
- refactor: 重构
- perf: 性能优化
- test: 测试相关
- chore: 构建/工具`
};
```

---

## 4. 内置工具设计

### 4.1 工具清单

| 工具名 | 描述 | 权限级别 |
|--------|------|----------|
| `bash` | 执行 Shell 命令 | 🔴 高危 |
| `file_read` | 读取文件内容 | 🟡 中危 |
| `file_write` | 写入文件 | 🔴 高危 |
| `file_edit` | 编辑文件（精确替换） | 🔴 高危 |
| `glob` | 搜索文件 | 🟢 低危 |
| `grep` | 搜索文件内容 | 🟢 低危 |
| `web_fetch` | 获取网页内容 | 🟢 低危 |
| `todo_write` | 管理待办事项 | 🟢 低危 |
| `lsp_complete` | LSP 代码补全 | 🟢 低危 |

### 4.2 权限系统

```typescript
// src/tools/permissions.ts

interface PermissionRule {
  tool: string;              // 工具名
  pattern?: string;           // 参数匹配模式
  action: 'allow' | 'deny' | 'ask';
}

class PermissionSystem {
  private rules: PermissionRule[];
  private interactive: boolean;

  // 检查是否允许执行
  async check(tool: string, params: any): Promise<PermissionResult>;

  // 请求用户确认
  async requestConfirmation(tool: string, params: any): Promise<boolean>;
}

// 配置示例 (.openagent.json)
{
  "permissions": {
    "askOnFirstUse": true,
    "rules": [
      { "tool": "bash", "pattern": "git *", "action": "allow" },
      { "tool": "bash", "pattern": "rm *", "action": "ask" },
      { "tool": "bash", "pattern": "rm -rf /*", "action": "deny" },
      { "tool": "file_write", "action": "ask" },
      { "tool": "file_read", "action": "allow" }
    ]
  }
}
```

### 4.3 BashTool 安全检查

```typescript
// 内置危险命令检测
const DANGEROUS_PATTERNS = [
  /^rm\s+-rf\s+\//,                    // rm -rf /
  /^rm\s+-rf\s+\*\s*$/,               // rm -rf *
  /;\s*rm\s+/,                         // ; rm
  /\|\s*bash/,                         // | bash
  /\|\s*sh/,                           // | sh
  /^sudo\s+rm/,                        // sudo rm
  /^curl\s+.*\|\s*bash/,               // curl | bash
  /^wget\s+.*\|\s*bash/,               // wget | bash
  /fork\s*\(\s*\)\s*{/,               // fork bomb
  /^:(){ :|:& };:/,                   // fork bomb
];

class BashTool extends BaseTool {
  async execute(params: { command: string; cwd?: string }) {
    // 1. 危险命令检查
    for (const pattern of DANGEROUS_PATTERNS) {
      if (pattern.test(params.command)) {
        throw new SecurityError('DANGEROUS_COMMAND_DETECTED');
      }
    }

    // 2. TTY 注入检查
    if (containsTtyInjection(params.command)) {
      throw new SecurityError('TTY_INJECTION_DETECTED');
    }

    // 3. 执行命令
    return await execCommand(params.command, { cwd: params.cwd });
  }
}
```

---

## 5. 内置技能设计

### 5.1 技能清单

| 技能名 | 描述 | 触发词示例 |
|--------|------|------------|
| `git_commit` | Git 提交助手 | "帮我提交", "生成 commit" |
| `read_code` | 代码阅读助手 | "这段代码干嘛的", "解释代码" |
| `search_files` | 文件搜索助手 | "找到 XX 文件", "搜索 XX" |
| `explain_error` | 错误解释助手 | "这个报错啥意思", "解释错误" |
| `generate_readme` | README 生成器 | "生成 README" |

### 5.2 GitCommitSkill 详解

```typescript
// src/skills/git-commit.ts

const GitCommitSkill: Skill = {
  name: 'git_commit',
  description: '智能 Git 提交助手',

  triggers: [
    '帮我提交代码',
    '提交到 git',
    '生成 commit message',
    'git commit',
    '提交改动'
  ],

  tools: [BashTool, FileReadTool, GlobTool, GrepTool],

  systemPrompt: `你是一个专业的 Git 提交助手。

工作流程：
1. 先运行 \`git status\` 查看当前改动
2. 运行 \`git diff\` 查看具体改动内容
3. 分析改动目的和影响范围
4. 生成符合规范的 commit message

Commit Message 规范（Angular 规范）：
<type>(<scope>): <subject>

# 空行

<body>

# 空行

<footer>

Type 类型：
- feat: 新功能
- fix: 修复 bug
- docs: 文档更新
- style: 代码格式（不影响功能）
- refactor: 重构（不是新功能或修复）
- perf: 性能优化
- test: 添加测试
- chore: 构建/工具

Rules：
- subject 不超过 50 字符
- subject 使用动词开头
- subject 不要用句号结尾
- body 每行不超过 72 字符
- 说明 why 而不是 what`,

  async onActivate(context) {
    // 激活时执行
    context.setContext('git_branch', await getCurrentBranch());
    context.setContext('git_status', await getGitStatus());
  }
};
```

### 5.3 ReadCodeSkill 详解

```typescript
// src/skills/read-code.ts

const ReadCodeSkill: Skill = {
  name: 'read_code',
  description: '代码阅读和解释助手',

  triggers: [
    '这段代码干嘛的',
    '解释这个函数',
    '这段代码是什么意思',
    '帮我理解这段代码'
  ],

  tools: [FileReadTool, GlobTool, GrepTool, LspTool],

  systemPrompt: `你是一个代码阅读助手，专注于帮助用户理解代码。

你的职责：
1. 解释代码的功能和逻辑
2. 识别代码的输入输出
3. 说明代码的依赖关系
4. 指出潜在的 bug 或改进点
5. 用简洁易懂的语言解释

当你被问到某段代码时：
1. 先读取完整的文件内容
2. 理解函数/类的上下文
3. 解释其目的和实现方式
4. 如有必要，追踪调用链
5. 提供总结和可能的改进建议`
};
```

---

## 6. LLM 适配器设计

### 6.1 接口定义

```typescript
// src/llm/base.ts

interface LLMAdapter {
  // 流式聊天
  chat(params: ChatParams): AsyncGenerator<ChatChunk>;

  // 非流式聊天
  chatOnce(params: ChatParams): Promise<ChatResponse>;

  // 获取模型信息
  getModel(): ModelInfo;
}

interface ChatParams {
  messages: Message[];
  tools?: Tool[];
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
}

interface Message {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  toolCalls?: ToolCall[];
  toolResults?: ToolResult[];
}

interface ChatChunk {
  type: 'content' | 'tool_call' | 'done' | 'error';
  content?: string;
  toolCall?: ToolCall;
  error?: string;
}
```

### 6.2 Ollama 适配器

```typescript
// src/llm/ollama.ts

class OllamaAdapter implements LLMAdapter {
  private baseUrl: string;
  private model: string;

  constructor(options: { baseUrl?: string; model: string }) {
    this.baseUrl = options.baseUrl || 'http://localhost:11434';
    this.model = options.model;
  }

  async *chat(params: ChatParams): AsyncGenerator<ChatChunk> {
    // 1. 转换为 Ollama 格式
    const ollamaMessages = this.convertMessages(params.messages);

    // 2. 构建请求
    const request = {
      model: this.model,
      messages: ollamaMessages,
      stream: true,
      options: {
        temperature: params.temperature ?? 0.7,
        num_predict: params.maxTokens ?? 4096,
      },
      tools: params.tools ? this.convertTools(params.tools) : undefined,
    };

    // 3. 流式请求
    const response = await fetch(`${this.baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    });

    const reader = response.body?.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader!.read();
      if (done) break;

      const lines = decoder.decode(value).split('\n');
      for (const line of lines) {
        if (!line.trim()) continue;

        const data = JSON.parse(line);
        yield this.parseChunk(data);
      }
    }
  }

  private parseChunk(data: any): ChatChunk {
    if (data.message?.tool_calls) {
      return {
        type: 'tool_call',
        toolCall: data.message.tool_calls[0],
      };
    }

    if (data.message?.content) {
      return {
        type: 'content',
        content: data.message.content,
      };
    }

    if (data.done) {
      return { type: 'done' };
    }

    return { type: 'content', content: '' };
  }
}
```

### 6.3 支持的本地模型

| 模型 | 参数量 | 最低内存 | 推荐用途 |
|------|--------|----------|----------|
| `qwen2:0.5b` | 0.5B | 1GB | 轻量对话 |
| `qwen2:1.5b` | 1.5B | 2GB | 日常使用 |
| `deepseek-coder:0.5b` | 0.5B | 1GB | 代码助手 |
| `deepseek-coder:1.3b` | 1.3B | 2GB | 代码助手 |
| `phi3:mini` | 3.8B | 4GB | 综合能力 |
| `llama3.2:1b` | 1B | 2GB | 通用对话 |

---

## 7. 配置系统设计

### 7.1 配置文件结构

```json
// .openagent.json (项目级)

{
  "version": "1.0.0",

  "model": {
    "provider": "ollama",
    "name": "qwen2:1.5b",
    "baseUrl": "http://localhost:11434",
    "temperature": 0.7,
    "maxTokens": 4096
  },

  "skills": {
    "enabled": ["git_commit", "read_code", "search_files"],
    "disabled": []
  },

  "tools": {
    "enabled": ["bash", "file_read", "file_write", "glob", "grep"],
    "disabled": []
  },

  "permissions": {
    "askOnFirstUse": true,
    "rules": [
      { "tool": "bash", "pattern": "git *", "action": "allow" },
      { "tool": "bash", "pattern": "rm *", "action": "ask" },
      { "tool": "file_write", "action": "ask" }
    ]
  },

  "context": {
    "includePatterns": ["**/*.ts", "**/*.js", "**/*.json"],
    "excludePatterns": ["node_modules/**", "dist/**", ".git/**"],
    "maxFiles": 50,
    "maxContextTokens": 8192
  }
}
```

### 7.2 配置加载优先级

```
1. 命令行参数 (最高优先)
2. 项目级配置 (.openagent.json)
3. 用户级配置 (~/.openagent/config.json)
4. 默认配置 (最低优先)
```

---

## 8. 扩展性设计

### 8.1 自定义工具

```typescript
// examples/custom-tool.ts

import { BaseTool, Tool } from 'miniagent/tools';

class MyCustomTool extends BaseTool {
  name = 'my_custom_tool';
  description = '执行自定义操作';
  parameters = {
    type: 'object',
    properties: {
      input: { type: 'string', description: '输入内容' }
    },
    required: ['input']
  };

  async execute(params: { input: string }) {
    // 实现逻辑
    const result = doSomething(params.input);
    return {
      success: true,
      data: result
    };
  }
}

// 注册到 Agent
agent.addTool(new MyCustomTool());
```

### 8.2 自定义技能

```typescript
// examples/custom-skill.ts

import { Skill, BaseSkill } from 'miniagent/skills';

const MyCustomSkill: Skill = {
  name: 'my_skill',
  description: '我的自定义技能',

  triggers: [
    '执行我的技能',
    '使用自定义功能'
  ],

  tools: [/* 依赖的工具 */],

  systemPrompt: `你是一个自定义技能助手...`,

  async onActivate(context) {
    // 初始化
  },

  async onDeactivate(context) {
    // 清理
  }
};

// 注册到 Agent
agent.addSkill(MyCustomSkill);
```

### 8.3 插件系统

```typescript
// src/plugins/loader.ts

interface Plugin {
  name: string;
  version: string;
  tools?: Tool[];
  skills?: Skill[];
  onLoad?: (agent: Agent) => void;
  onUnload?: () => void;
}

class PluginLoader {
  async loadPlugin(path: string): Promise<Plugin>;
  async loadPlugins(dir: string): Promise<Plugin[]>;
  async loadFromNpm(packageName: string): Promise<Plugin>;
}
```

---

## 9. 使用示例

### 9.1 基础使用

```bash
# 安装
npm install -g miniagent

# 启动交互式聊天
miniagent chat

# 单次执行
miniagent run "帮我分析当前目录的项目结构"

# 指定模型
miniagent run --model deepseek-coder:1.3b "写一个快速排序"
```

### 9.2 代码示例

```typescript
// examples/basic-chat.ts
import { Agent } from 'miniagent';
import { OllamaAdapter } from 'miniagent/llm';

const agent = new Agent({
  llm: new OllamaAdapter({ model: 'qwen2:1.5b' }),
  cwd: process.cwd()
});

// 启用技能
agent.addSkill(GitCommitSkill);
agent.addSkill(ReadCodeSkill);

// 开始对话
for await (const chunk of agent.chat('帮我提交当前的代码改动')) {
  if (chunk.type === 'content') {
    process.stdout.write(chunk.content);
  }
}
```

---

## 10. 完整工具系统 (对齐 Claude Code)

### 10.1 工具清单 (共 25 个核心工具)

#### 文件操作 (6 个)
| 工具名 | 描述 | 权限级别 |
|--------|------|----------|
| `file_read` | 读取文件内容 | 🟢 低危 |
| `file_write` | 写入/创建文件 | 🔴 高危 |
| `file_edit` | 编辑文件（精确字符串替换） | 🔴 高危 |
| `glob` | 按模式搜索文件 | 🟢 低危 |
| `grep` | 搜索文件内容 | 🟢 低危 |
| `notebook_edit` | 编辑 Jupyter Notebook | 🟡 中危 |

#### 执行命令 (2 个)
| 工具名 | 描述 | 权限级别 |
|--------|------|----------|
| `bash` | 执行 Shell 命令 | 🔴 高危 |
| `powershell` | 执行 PowerShell 命令 | 🔴 高危 |

#### 搜索 & 获取 (3 个)
| 工具名 | 描述 | 权限级别 |
|--------|------|----------|
| `web_fetch` | 获取网页内容 | 🟢 低危 |
| `web_search` | 搜索网络 | 🟢 低危 |
| `search` | 搜索代码/文档 | 🟢 低危 |

#### Agent 编排 (8 个)
| 工具名 | 描述 | 权限级别 |
|--------|------|----------|
| `agent` | 派生子 Agent | 🟡 中危 |
| `send_message` | 向 Agent 发送消息 | 🟢 低危 |
| `task_create` | 创建任务 | 🟢 低危 |
| `task_get` | 获取任务详情 | 🟢 低危 |
| `task_list` | 列出所有任务 | 🟢 低危 |
| `task_update` | 更新任务状态 | 🟢 低危 |
| `task_stop` | 停止任务 | 🟡 中危 |
| `task_output` | 获取任务输出 | 🟢 低危 |

#### 规划 & 工作流 (4 个)
| 工具名 | 描述 | 权限级别 |
|--------|------|----------|
| `enter_plan_mode` | 进入规划模式 | 🟢 低危 |
| `exit_plan_mode` | 退出规划模式 | 🟢 低危 |
| `enter_worktree` | 进入 Git Worktree | 🟡 中危 |
| `exit_worktree` | 退出 Git Worktree | 🟡 中危 |

#### MCP 扩展 (3 个)
| 工具名 | 描述 | 权限级别 |
|--------|------|----------|
| `mcp_tool` | 调用 MCP 工具 | 🟢 低危 |
| `list_mcp_resources` | 列出 MCP 资源 | 🟢 低危 |
| `read_mcp_resource` | 读取 MCP 资源 | 🟢 低危 |

#### 系统工具 (8 个)
| 工具名 | 描述 | 权限级别 |
|--------|------|----------|
| `ask_user` | 向用户提问 | 🟢 低危 |
| `todo_write` | 管理待办事项 | 🟢 低危 |
| `config` | 配置管理 | 🟡 中危 |
| `memory` | 记忆管理 | 🟢 低危 |
| `search_memory` | 搜索记忆 | 🟢 低危 |
| `sleep` | 休眠/延迟 | 🟢 低危 |
| `brief` | 简短回复模式 | 🟢 低危 |
| `lsp_complete` | LSP 代码补全 | 🟢 低危 |

---

## 11. 子 Agent 系统 (AgentTool)

### 11.1 设计理念

```
Claude Code 架构：
                    Main Agent
                        │
        ┌───────────────┼───────────────┐
        │               │               │
        ▼               ▼               ▼
   Worker A        Worker B        Worker C
   (research)      (coding)       (review)
        │               │               │
        └───────────────┼───────────────┘
                        │
                        ▼
                  SendMessage
```

### 11.2 接口设计

```typescript
// src/tools/agent.ts

interface AgentToolOptions {
  name?: string;              // Agent 名称
  prompt?: string;            // Agent 系统提示
  tools?: Tool[];             // 可用工具
  model?: string;             // 指定模型
  maxIterations?: number;     // 最大迭代次数
}

class AgentTool extends BaseTool {
  name = 'agent';
  description = `Spawn a sub-agent to handle a specific task.
Use this when:
- The task is complex and can be parallelized
- You need specialized knowledge in a specific domain
- You want to delegate work to avoid context overflow

The sub-agent will have its own context and tools.
You can communicate with it via send_message.`;

  parameters = {
    type: 'object',
    properties: {
      task: {
        type: 'string',
        description: 'The task description for the sub-agent'
      },
      agent_name: {
        type: 'string',
        description: 'Identifier for this agent (for communication)'
      },
      system_prompt: {
        type: 'string',
        description: 'Additional system prompt for this agent'
      },
      tools: {
        type: 'array',
        items: { type: 'string' },
        description: 'List of tool names this agent can use'
      },
      max_iterations: {
        type: 'number',
        description: 'Maximum number of iterations (default: 50)'
      }
    },
    required: ['task', 'agent_name']
  };

  async execute(params: AgentToolOptions): Promise<AgentResult> {
    // 1. 创建子 Agent 实例
    const subAgent = new SubAgent({
      name: params.agent_name,
      systemPrompt: params.system_prompt,
      tools: this.getToolsByNames(params.tools),
      maxIterations: params.max_iterations ?? 50,
    });

    // 2. 注册到 Agent 协调器
    this.coordinator.register(subAgent);

    // 3. 派发任务
    const result = await subAgent.run(params.task);

    // 4. 返回结果
    return {
      success: true,
      agent_name: params.agent_name,
      result: result.summary,
      tokens_used: result.tokens,
    };
  }
}
```

### 11.3 Agent 协调器

```typescript
// src/core/coordinator.ts

class AgentCoordinator {
  private agents: Map<string, SubAgent>;
  private mainAgent: Agent;
  private messageQueue: Map<string, Message[]>;

  register(agent: SubAgent): void {
    this.agents.set(agent.name, agent);
    this.messageQueue.set(agent.name, []);
  }

  unregister(name: string): void {
    this.agents.delete(name);
    this.messageQueue.delete(name);
  }

  async sendMessage(
    from: string,
    to: string,
    message: string
  ): Promise<string> {
    const targetAgent = this.agents.get(to);
    if (!targetAgent) {
      throw new Error(`Agent ${to} not found`);
    }

    // 添加消息到队列
    this.messageQueue.get(to)?.push({
      role: 'user',
      content: message,
      metadata: { from }
    });

    // 执行目标 Agent
    const result = await targetAgent.continue();
    return result;
  }

  getAgent(name: string): SubAgent | undefined {
    return this.agents.get(name);
  }

  listAgents(): AgentInfo[] {
    return Array.from(this.agents.values()).map(agent => ({
      name: agent.name,
      status: agent.status,
      createdAt: agent.createdAt
    }));
  }
}
```

---

## 12. 任务管理系统 (Task System)

### 12.1 任务数据结构

```typescript
// src/tasks/types.ts

interface Task {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  createdAt: Date;
  updatedAt: Date;
  createdBy: 'user' | 'agent';
  parentId?: string;          // 父任务 ID
  children?: string[];       // 子任务 IDs
  assignedAgent?: string;     // 分配的 Agent
  result?: TaskResult;
  tags?: string[];
  dueDate?: Date;
}

type TaskStatus =
  | 'pending'      // 等待中
  | 'in_progress'  // 进行中
  | 'waiting'      // 等待用户确认
  | 'completed'    // 已完成
  | 'failed'       // 失败
  | 'cancelled';   // 已取消

interface TaskResult {
  summary: string;
  output?: string;
  filesModified?: string[];
  tokensUsed?: number;
  duration?: number;
}
```

### 12.2 任务工具实现

```typescript
// src/tools/tasks.ts

// TaskCreateTool
class TaskCreateTool extends BaseTool {
  name = 'task_create';
  description = 'Create a new task for tracking work';

  parameters = {
    type: 'object',
    properties: {
      title: { type: 'string', description: 'Task title' },
      description: { type: 'string', description: 'Task description' },
      priority: {
        type: 'string',
        enum: ['low', 'medium', 'high', 'urgent'],
        default: 'medium'
      },
      parent_id: { type: 'string', description: 'Parent task ID' },
      tags: {
        type: 'array',
        items: { type: 'string' },
        description: 'Task tags'
      }
    },
    required: ['title']
  };

  async execute(params: CreateTaskParams): Promise<Task> {
    const task = await this.taskManager.create({
      ...params,
      status: 'pending',
      createdAt: new Date(),
      createdBy: 'agent'
    });

    // 如果有父任务，更新父子关系
    if (params.parent_id) {
      await this.taskManager.addChild(params.parent_id, task.id);
    }

    return task;
  }
}

// TaskListTool
class TaskListTool extends BaseTool {
  name = 'task_list';
  description = 'List all tasks with optional filtering';

  parameters = {
    type: 'object',
    properties: {
      status: {
        type: 'string',
        enum: ['pending', 'in_progress', 'completed', 'failed', 'all'],
        default: 'all'
      },
      assigned_to_me: { type: 'boolean', default: false },
      limit: { type: 'number', default: 20 },
      include_children: { type: 'boolean', default: false }
    }
  };

  async execute(params: ListTasksParams): Promise<TaskListResult> {
    const tasks = await this.taskManager.list({
      status: params.status,
      assignedAgent: params.assigned_to_me ? 'current' : undefined,
      limit: params.limit,
      includeChildren: params.include_children
    });

    return {
      tasks,
      total: tasks.length,
      hasMore: tasks.length === params.limit
    };
  }
}

// TaskUpdateTool
class TaskUpdateTool extends BaseTool {
  name = 'task_update';
  description = 'Update a task status or details';

  parameters = {
    type: 'object',
    properties: {
      task_id: { type: 'string', description: 'Task ID to update' },
      status: { type: 'string', enum: ['in_progress', 'completed', 'failed', 'cancelled'] },
      result: {
        type: 'object',
        properties: {
          summary: { type: 'string' },
          output: { type: 'string' },
          filesModified: { type: 'array', items: { type: 'string' } }
        }
      }
    },
    required: ['task_id']
  };

  async execute(params: UpdateTaskParams): Promise<Task> {
    return await this.taskManager.update(params.task_id, {
      status: params.status,
      result: params.result,
      updatedAt: new Date()
    });
  }
}

// TaskStopTool
class TaskStopTool extends BaseTool {
  name = 'task_stop';
  description = 'Stop a running task';

  async execute(params: { task_id: string }): Promise<void> {
    const task = await this.taskManager.get(params.task_id);
    const agent = this.coordinator.getAgent(task.assignedAgent);

    if (agent) {
      await agent.stop();
    }

    await this.taskManager.update(params.task_id, {
      status: 'cancelled'
    });
  }
}
```

### 12.3 任务持久化

```typescript
// src/tasks/store.ts

class TaskStore {
  private db: SQLiteDatabase;
  private cache: Map<string, Task>;

  constructor(dataDir: string) {
    this.db = new SQLiteDatabase(`${dataDir}/tasks.db`);
    this.initSchema();
  }

  private initSchema() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS tasks (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT,
        status TEXT NOT NULL,
        priority TEXT DEFAULT 'medium',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        created_by TEXT NOT NULL,
        parent_id TEXT,
        assigned_agent TEXT,
        result TEXT,
        tags TEXT,
        due_date TEXT,
        FOREIGN KEY (parent_id) REFERENCES tasks(id)
      );

      CREATE INDEX idx_tasks_status ON tasks(status);
      CREATE INDEX idx_tasks_parent ON tasks(parent_id);
      CREATE INDEX idx_tasks_created_at ON tasks(created_at);
    `);
  }

  async create(task: Task): Promise<Task> {
    const id = task.id || generateId();
    const now = new Date().toISOString();

    this.db.run(`
      INSERT INTO tasks (id, title, description, status, priority,
        created_at, updated_at, created_by, parent_id, assigned_agent,
        result, tags, due_date)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      id, task.title, task.description, task.status, task.priority,
      task.createdAt.toISOString(), now, task.createdBy,
      task.parentId, task.assignedAgent, JSON.stringify(task.result),
      JSON.stringify(task.tags), task.dueDate?.toISOString()
    ]);

    const fullTask = { ...task, id, createdAt: new Date(now), updatedAt: new Date(now) };
    this.cache.set(id, fullTask);
    return fullTask;
  }
}
```

---

## 13. 规划模式 & Worktree

### 13.1 Plan Mode 设计

```typescript
// src/core/plan-mode.ts

enum PlanModeState {
  IDLE = 'idle',
  PLANNING = 'planning',
  REVIEWING = 'reviewing',
  APPROVED = 'approved',
  EXECUTING = 'executing',
  COMPLETED = 'completed'
}

interface Plan {
  id: string;
  title: string;
  steps: PlanStep[];
  risks: string[];
  estimatedTokens: number;
  createdAt: Date;
  approvedAt?: Date;
}

interface PlanStep {
  id: string;
  order: number;
  description: string;
  tools: string[];
  estimatedTokens: number;
  status: 'pending' | 'in_progress' | 'completed' | 'skipped';
  result?: string;
}

class PlanMode {
  private state: PlanModeState = PlanModeState.IDLE;
  private currentPlan?: Plan;
  private currentStepIndex: number = 0;

  async enter(userMessage: string): Promise<void> {
    this.state = PlanModeState.PLANNING;

    // 调用 LLM 生成计划
    const planPrompt = `
你是一个规划助手。用户提出了以下请求：

${userMessage}

请制定一个详细的执行计划，包括：
1. 具体的步骤（每个步骤不超过 50 字）
2. 每个步骤需要的工具
3. 潜在风险和注意事项
4. 预估 token 消耗

请以 JSON 格式返回：
{
  "title": "计划标题",
  "steps": [
    {
      "description": "步骤描述",
      "tools": ["需要的工具列表"],
      "estimated_tokens": 预估 token 数
    }
  ],
  "risks": ["风险1", "风险2"],
  "estimated_tokens": 总预估 token 数
}
`;

    const response = await this.llm.chatOnce({
      messages: [{ role: 'user', content: planPrompt }],
      systemPrompt: this.systemPrompt + '\n\n你是一个规划专家。'
    });

    this.currentPlan = JSON.parse(extractJson(response));
    this.state = PlanModeState.REVIEWING;
  }

  async approve(): Promise<void> {
    if (this.state !== PlanModeState.REVIEWING) {
      throw new Error('Can only approve in reviewing state');
    }

    this.state = PlanModeState.APPROVED;
    this.currentPlan!.approvedAt = new Date();
  }

  async execute(): Promise<PlanResult> {
    this.state = PlanModeState.EXECUTING;
    const results: StepResult[] = [];

    for (const step of this.currentPlan!.steps) {
      if (step.status === 'skipped') continue;

      step.status = 'in_progress';

      try {
        const result = await this.executeStep(step);
        step.status = 'completed';
        step.result = result;
        results.push({ stepId: step.id, success: true, result });
      } catch (error) {
        step.status = 'pending';
        results.push({
          stepId: step.id,
          success: false,
          error: error.message,
          canRetry: error.retryable
        });

        // 询问用户是继续还是停止
        const userChoice = await this.askUser(
          `步骤 "${step.description}" 失败: ${error.message}\n是否继续？`
        );

        if (userChoice === 'stop') {
          break;
        }
      }
    }

    this.state = PlanModeState.COMPLETED;
    return { plan: this.currentPlan, results };
  }
}
```

### 13.2 Worktree 支持

```typescript
// src/tools/worktree.ts

class EnterWorktreeTool extends BaseTool {
  name = 'enter_worktree';
  description = 'Create and enter a Git worktree for parallel development';

  parameters = {
    type: 'object',
    properties: {
      branch_name: {
        type: 'string',
        description: 'Name for the new branch/worktree'
      },
      path: {
        type: 'string',
        description: 'Directory path for the worktree'
      },
      create_branch: {
        type: 'boolean',
        description: 'Create new branch if true, use existing if false',
        default: true
      }
    },
    required: ['branch_name', 'path']
  };

  async execute(params: EnterWorktreeParams): Promise<WorktreeInfo> {
    // 1. 检查 Git 仓库
    const isGitRepo = await checkGitRepo(this.cwd);
    if (!isGitRepo) {
      throw new Error('Not a Git repository');
    }

    // 2. 检查 branch 是否存在
    if (!params.create_branch) {
      const exists = await exec(`git branch --list ${params.branch_name}`);
      if (!exists) {
        throw new Error(`Branch ${params.branch_name} does not exist`);
      }
    }

    // 3. 创建 worktree
    const worktreePath = `${this.cwd}/${params.path}`;
    await exec(
      `git worktree add ${params.create_branch ? '-b' : ''} ${params.branch_name} ${worktreePath}`
    );

    // 4. 返回 worktree 信息
    return {
      branch: params.branch_name,
      path: worktreePath,
      is_main: false,
      locked: false
    };
  }
}

class ExitWorktreeTool extends BaseTool {
  name = 'exit_worktree';
  description = 'Exit and optionally remove a Git worktree';

  async execute(params: { remove?: boolean }): Promise<void> {
    const currentWorktree = await this.getCurrentWorktree();

    if (currentWorktree.is_main) {
      throw new Error('Cannot exit the main worktree');
    }

    if (params.remove) {
      await exec(`git worktree remove ${currentWorktree.path}`);
      await exec(`git worktree prune`);
    } else {
      await exec(`git worktree lock ${currentWorktree.path}`);
    }

    // 切换回主目录
    process.chdir(this.mainWorktreePath);
  }
}
```

---

## 14. 三层记忆系统 (Memory System)

### 14.1 架构设计

```
┌─────────────────────────────────────────────────────────────────┐
│                        Memory Architecture                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │              Layer 1: Working Memory (工作记忆)           │   │
│  │  ┌────────────────────────────────────────────────────┐ │   │
│  │  │ 当前对话上下文                                       │ │   │
│  │  │ • 最近的 N 条消息                                    │ │   │
│  │  │ • 当前任务状态                                       │ │   │
│  │  │ • 临时变量                                           │ │   │
│  │  │ • 活跃的 Tool 调用结果                               │ │   │
│  │  └────────────────────────────────────────────────────┘ │   │
│  │  容量：~8K tokens                                        │   │
│  │  生命周期：当前对话                                      │   │
│  └──────────────────────────────────────────────────────────┘   │
│                            │                                    │
│                            ▼                                    │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │             Layer 2: Session Memory (会话记忆)           │   │
│  │  ┌────────────────────────────────────────────────────┐ │   │
│  │  │ MEMORY.md (指针索引)                                │ │   │
│  │  │ • 项目结构                                          │ │   │
│  │  │ • 最近的改动摘要                                     │ │   │
│  │  │ • 任务历史                                          │ │   │
│  │  │ • 重要上下文                                        │ │   │
│  │  └────────────────────────────────────────────────────┘ │   │
│  │  容量：~150 字符/行 × 100 行 ≈ 15K chars               │   │
│  │  生命周期：项目生命周期                                  │   │
│  └──────────────────────────────────────────────────────────┘   │
│                            │                                    │
│                            ▼                                    │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │           Layer 3: Long-term Memory (长期记忆)            │   │
│  │  ┌────────────────────────────────────────────────────┐ │   │
│  │  │ ~/.miniagent/memory/                               │ │   │
│  │  │ • 项目知识库                                        │ │   │
│  │  │ • 用户偏好                                          │ │   │
│  │  │ • 使用模式                                          │ │   │
│  │  │ • 跨项目上下文                                      │ │   │
│  │  └────────────────────────────────────────────────────┘ │   │
│  │  容量：无限制                                           │   │
│  │  生命周期：持久化                                       │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 14.2 实现代码

```typescript
// src/memory/index.ts

class MemoryManager {
  private workingMemory: WorkingMemory;
  private sessionMemory: SessionMemory;
  private longTermMemory: LongTermMemory;

  constructor(options: MemoryOptions) {
    this.workingMemory = new WorkingMemory(options.maxWorkingTokens);
    this.sessionMemory = new SessionMemory(options.projectPath);
    this.longTermMemory = new LongTermMemory(options.dataDir);
  }

  // 提取需要持久化的信息
  async extract(session: Session): Promise<void> {
    // 从当前对话中提取关键信息
    const extractionPrompt = `
从以下对话历史中提取需要记忆的关键信息：

${session.messages.map(m => `${m.role}: ${m.content}`).join('\n')}

提取以下类型的信息：
1. 项目结构变化
2. 代码设计决策
3. 用户偏好和习惯
4. 重要上下文

以结构化格式返回，简洁明了。
`;

    const extraction = await this.llm.extract(extractionPrompt);

    // 更新会话记忆
    await this.sessionMemory.update(extraction);

    // 如果有跨项目有价值的信息，更新长期记忆
    if (extraction.crossProject) {
      await this.longTermMemory.store(extraction.crossProject);
    }
  }

  // 获取上下文
  async getContext(request: MemoryRequest): Promise<string> {
    const contexts: string[] = [];

    // 1. 工作记忆（总是包含）
    const working = await this.workingMemory.get(request.maxTokens * 0.3);
    if (working) contexts.push(working);

    // 2. 会话记忆
    const session = await this.sessionMemory.get(request.projectId);
    if (session) contexts.push(session);

    // 3. 长期记忆（相关性检索）
    if (request.query) {
      const relevant = await this.longTermMemory.search(
        request.query,
        request.maxTokens * 0.2
      );
      if (relevant) contexts.push(relevant);
    }

    return contexts.join('\n\n---\n\n');
  }

  // 上下文压缩
  async compact(currentContext: string, maxTokens: number): Promise<string> {
    if (this.countTokens(currentContext) <= maxTokens) {
      return currentContext;
    }

    const compactPrompt = `
压缩以下上下文，保留最重要的信息：

${currentContext}

要求：
1. 保留关键的设计决策和结论
2. 移除冗余和重复内容
3. 保持可读性
4. 目标：压缩到 ${maxTokens} tokens 以内
`;

    return await this.llm.compact(compactPrompt);
  }
}
```

### 14.3 Memory 工具

```typescript
// src/tools/memory.ts

class MemoryTool extends BaseTool {
  name = 'memory';
  description = 'Store or retrieve information from memory';

  parameters = {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        enum: ['store', 'get', 'search', 'forget'],
        description: 'Action to perform'
      },
      key: {
        type: 'string',
        description: 'Memory key (for store/get)'
      },
      value: {
        type: 'string',
        description: 'Value to store (for store action)'
      },
      query: {
        type: 'string',
        description: 'Search query (for search action)'
      },
      scope: {
        type: 'string',
        enum: ['working', 'session', 'longterm'],
        description: 'Memory scope',
        default: 'session'
      }
    },
    required: ['action']
  };

  async execute(params: MemoryParams): Promise<MemoryResult> {
    switch (params.action) {
      case 'store':
        await this.memory.store(params.key!, params.value!, params.scope);
        return { success: true, message: `Stored in ${params.scope}` };

      case 'get':
        const value = await this.memory.get(params.key!, params.scope);
        return { success: true, value };

      case 'search':
        const results = await this.memory.search(params.query!, params.scope);
        return { success: true, results };

      case 'forget':
        await this.memory.forget(params.key!, params.scope);
        return { success: true, message: 'Memory cleared' };
    }
  }
}
```

---

## 15. MCP 协议支持 (Model Context Protocol)

### 15.1 MCP 概述

```
MCP = Model Context Protocol

┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Host      │────▶│   Client    │────▶│   Server    │
│  (MiniAgent)│◀────│  (MCP SDK)  │◀────│  (工具提供者)│
└─────────────┘     └─────────────┘     └─────────────┘
      │                   │                   │
      │   JSON-RPC 2.0   │                   │
      │◀─────────────────▶│                   │
      │                   │                   │
      │  • initialize     │                   │
      │  • tools/list     │                   │
      │  • tools/call     │                   │
      │  • resources/*   │                   │
      │  • prompts/*      │                   │
```

### 15.2 MCP 客户端实现

```typescript
// src/mcp/client.ts

interface MCPServer {
  name: string;
  command: string;
  args?: string[];
  env?: Record<string, string>;
}

class MCPClient {
  private servers: Map<string, MCPClientInstance> = new Map();
  private toolRegistry: ToolRegistry;

  async connectServer(config: MCPServer): Promise<void> {
    // 1. 启动 MCP 服务器进程
    const process = spawn(config.command, config.args || [], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, ...config.env }
    });

    // 2. 创建客户端实例
    const client = new MCPClientInstance(process);
    await client.initialize();

    // 3. 发现可用工具
    const tools = await client.listTools();

    // 4. 注册工具
    for (const tool of tools) {
      this.toolRegistry.register(new MCPToolWrapper(client, tool));
    }

    this.servers.set(config.name, client);
  }

  async callTool(serverName: string, toolName: string, args: any): Promise<any> {
    const client = this.servers.get(serverName);
    if (!client) {
      throw new Error(`MCP server ${serverName} not connected`);
    }

    return await client.callTool(toolName, args);
  }
}

class MCPClientInstance {
  private process: ChildProcess;
  private requestId: number = 0;
  private pendingRequests: Map<number, Deferred> = new Map();

  constructor(process: ChildProcess) {
    this.process = process;
    this.setupMessageHandler();
  }

  private setupMessageHandler() {
    this.process.stdout?.on('data', (data) => {
      const messages = data.toString().split('\n').filter(Boolean);
      for (const msg of messages) {
        const parsed = JSON.parse(msg);
        this.handleMessage(parsed);
      }
    });
  }

  async initialize(): Promise<void> {
    const result = await this.sendRequest('initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {
        tools: {},
        resources: {}
      },
      clientInfo: {
        name: 'miniagent',
        version: '1.0.0'
      }
    });

    this.protocolVersion = result.protocolVersion;
  }

  async listTools(): Promise<ToolSchema[]> {
    const result = await this.sendRequest('tools/list');
    return result.tools;
  }

  async callTool(name: string, args: any): Promise<any> {
    const result = await this.sendRequest('tools/call', {
      name,
      arguments: args
    });
    return result;
  }

  private sendRequest(method: string, params: any): Promise<any> {
    return new Promise((resolve, reject) => {
      const id = ++this.requestId;
      this.pendingRequests.set(id, { resolve, reject });

      this.process.stdin?.write(JSON.stringify({
        jsonrpc: '2.0',
        id,
        method,
        params
      }) + '\n');
    });
  }

  private handleMessage(message: any) {
    if (message.id) {
      const pending = this.pendingRequests.get(message.id);
      if (pending) {
        if (message.error) {
          pending.reject(new Error(message.error.message));
        } else {
          pending.resolve(message.result);
        }
        this.pendingRequests.delete(message.id);
      }
    }
  }
}
```

### 15.3 MCP 工具包装器

```typescript
// src/tools/mcp.ts

class MCPToolWrapper extends BaseTool {
  constructor(
    private client: MCPClientInstance,
    private schema: ToolSchema
  ) {
    super();
  }

  get name(): string {
    return `mcp_${this.schema.name}`;
  }

  get description(): string {
    return `[MCP] ${this.schema.description}`;
  }

  get parameters(): ParameterSchema {
    return this.schema.inputSchema;
  }

  async execute(params: any): Promise<any> {
    return await this.client.callTool(this.schema.name, params);
  }
}

// MCP 工具
class MCPTool extends BaseTool {
  name = 'mcp_tool';
  description = 'Call a tool from a connected MCP server';

  parameters = {
    type: 'object',
    properties: {
      server: { type: 'string', description: 'MCP server name' },
      tool: { type: 'string', description: 'Tool name' },
      arguments: { type: 'object', description: 'Tool arguments' }
    },
    required: ['server', 'tool', 'arguments']
  };

  async execute(params: { server: string; tool: string; arguments: any }): Promise<any> {
    return await this.mcpClient.callTool(params.server, params.tool, params.arguments);
  }
}

class ListMcpResourcesTool extends BaseTool {
  name = 'list_mcp_resources';
  description = 'List available resources from MCP servers';

  async execute(): Promise<MCPResource[]> {
    const resources: MCPResource[] = [];

    for (const [name, client] of this.mcpClient.getServers()) {
      const result = await client.listResources();
      resources.push(...result.resources.map(r => ({
        ...r,
        server: name
      })));
    }

    return resources;
  }
}
```

### 15.4 MCP 配置

```json
// .openagent.json

{
  "mcp": {
    "servers": [
      {
        "name": "filesystem",
        "command": "npx",
        "args": ["-y", "@modelcontextprotocol/server-filesystem", "/path/to/dir"]
      },
      {
        "name": "git",
        "command": "npx",
        "args": ["-y", "@modelcontextprotocol/server-git"]
      },
      {
        "name": "github",
        "command": "uvx",
        "args": ["mcp-servers/github"],
        "env": {
          "GITHUB_TOKEN": "${GITHUB_TOKEN}"
        }
      }
    ]
  }
}
```

---

## 16. 上下文压缩 (Context Compaction)

### 16.1 压缩触发条件

```typescript
// src/core/compact.ts

interface CompactionConfig {
  enabled: boolean;
  thresholdTokens: number;      // 触发阈值（默认 150K）
  targetTokens: number;        // 目标大小（默认 100K）
  preserveSystemPrompt: boolean;
  preserveRecentMessages: number;  // 保留最近 N 条
}

class ContextCompactor {
  constructor(
    private config: CompactionConfig,
    private memory: MemoryManager
  ) {}

  async shouldCompact(messages: Message[], tools: Tool[]): Promise<boolean> {
    const totalTokens = this.countTokens(messages) +
                        this.countTokens(tools) +
                        this.countTokens(this.systemPrompt);

    return totalTokens > this.config.thresholdTokens;
  }

  async compact(context: AgentContext): Promise<CompactedContext> {
    const {
      messages,
      systemPrompt,
      tools,
      workingMemory
    } = context;

    // 1. 保留系统提示（如果配置允许）
    const preservedSystem = this.config.preserveSystemPrompt
      ? systemPrompt
      : '';

    // 2. 保留最近消息
    const recentMessages = messages.slice(-this.config.preserveRecentMessages);

    // 3. 压缩历史消息
    const olderMessages = messages.slice(
      0,
      -this.config.preserveRecentMessages
    );

    const compressedHistory = await this.compressHistory(olderMessages);

    // 4. 提取关键信息到记忆
    await this.extractToMemory(olderMessages);

    // 5. 精简工具列表（只保留相关的）
    const relevantTools = this.pruneTools(tools, recentMessages);

    // 6. 精简工作记忆
    const精简WorkingMemory = await this.compactWorkingMemory(workingMemory);

    return {
      systemPrompt: preservedSystem,
      messages: [...compressedHistory, ...recentMessages],
      tools: relevantTools,
      workingMemory: 精简WorkingMemory,
      compactionMetadata: {
        originalTokens: context.totalTokens,
        newTokens: await this.countContext(),
        timestamp: new Date()
      }
    };
  }

  private async compressHistory(messages: Message[]): Promise<Message[]> {
    if (messages.length <= 10) {
      return messages; // 消息太少不压缩
    }

    // 按主题分组
    const groups = this.groupByTopic(messages);

    // 对每个组生成摘要
    const summaries: Message[] = [];

    for (const group of groups) {
      const summary = await this.llm.summarize(group);
      summaries.push({
        role: 'system',
        content: `[Summary of ${group.length} messages]: ${summary}`,
        metadata: { isSummary: true, originalCount: group.length }
      });
    }

    return summaries;
  }

  private async extractToMemory(messages: Message[]): Promise<void> {
    const extractionPrompt = `
从以下对话中提取值得长期记忆的信息：

${messages.map(m => `${m.role}: ${m.content}`).join('\n')}

提取：
1. 项目关键信息（架构、设计决策）
2. 代码模式和规范
3. 用户偏好
4. 未完成的重要任务

简洁明了，每条不超过 50 字。
`;

    const extraction = await this.llm.extract(extractionPrompt);
    await this.memory.store('context_extraction', extraction, 'session');
  }
}
```

---

## 17. 其他补充工具

### 17.1 AskUserQuestionTool

```typescript
// src/tools/ask-user.ts

class AskUserQuestionTool extends BaseTool {
  name = 'ask_user';
  description = `Ask the user a question and wait for their response.
Use this when:
- You need clarification on ambiguous instructions
- You need user confirmation before proceeding
- You want user input on choices or preferences
- You need additional context that only the user has`;

  parameters = {
    type: 'object',
    properties: {
      question: {
        type: 'string',
        description: 'The question to ask the user'
      },
      options: {
        type: 'array',
        items: { type: 'string' },
        description: 'Optional predefined options (user can also type free text)'
      },
      timeout_seconds: {
        type: 'number',
        description: 'Wait timeout in seconds (default: 300)',
        default: 300
      }
    },
    required: ['question']
  };

  async execute(params: AskUserParams): Promise<UserResponse> {
    // 1. 显示问题给用户
    this.ui.showQuestion(params.question, params.options);

    // 2. 等待用户响应
    const response = await this.ui.waitForResponse(params.timeout_seconds);

    if (response.timeout) {
      return {
        type: 'timeout',
        message: 'User did not respond within the timeout period'
      };
    }

    return {
      type: 'response',
      value: response.value,
      timestamp: response.timestamp
    };
  }
}
```

### 17.2 ConfigTool

```typescript
// src/tools/config.ts

class ConfigTool extends BaseTool {
  name = 'config';
  description = 'Get or set MiniAgent configuration';

  parameters = {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        enum: ['get', 'set', 'list', 'reset'],
        description: 'Configuration action'
      },
      key: {
        type: 'string',
        description: 'Configuration key (for get/set)'
      },
      value: {
        type: 'string',
        description: 'Configuration value (for set)'
      },
      scope: {
        type: 'string',
        enum: ['local', 'global'],
        description: 'Config scope (default: global)',
        default: 'global'
      }
    },
    required: ['action']
  };

  async execute(params: ConfigParams): Promise<any> {
    switch (params.action) {
      case 'get':
        return this.config.get(params.key!, params.scope);

      case 'set':
        await this.config.set(params.key!, params.value, params.scope);
        return { success: true };

      case 'list':
        return this.config.list(params.scope);

      case 'reset':
        await this.config.reset(params.scope);
        return { success: true };
    }
  }
}
```

### 17.3 WebSearchTool

```typescript
// src/tools/web-search.ts

class WebSearchTool extends BaseTool {
  name = 'web_search';
  description = `Search the web for information.
Use this when:
- You need up-to-date information not in your training data
- You need to look up documentation or APIs
- You need to find solutions to errors
- You need current news or data`;

  parameters = {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'The search query'
      },
      limit: {
        type: 'number',
        description: 'Maximum number of results (default: 5)',
        default: 5
      },
      source: {
        type: 'string',
        enum: ['duckduckgo', 'google', 'bing'],
        description: 'Search engine to use',
        default: 'duckduckgo'
      }
    },
    required: ['query']
  };

  async execute(params: WebSearchParams): Promise<SearchResult> {
    // 使用本地搜索（如果配置了）
    if (this.config.localSearch) {
      return await this.localSearch(params.query, params.limit);
    }

    // 使用 DuckDuckGo（免费，无需 API key）
    const results = await this.duckduckgoSearch(params.query, params.limit);

    return {
      query: params.query,
      results: results.map(r => ({
        title: r.title,
        url: r.url,
        snippet: r.snippet
      })),
      total: results.length
    };
  }
}
```

---

## 18. 完整开发计划 (对齐 Claude Code)

### Phase 1: 核心框架 ⭐⭐⭐
- [x] 项目脚手架
- [x] LLM 适配器 (Ollama)
- [x] Tool 系统基类
- [x] Skill 系统基类
- [x] Query Loop 核心
- [x] CLI 入口
- [ ] 配置加载器
- [ ] 错误处理

### Phase 2: 基础工具 ⭐⭐⭐
- [x] BashTool
- [x] FileReadTool / FileWriteTool
- [x] FileEditTool
- [x] GlobTool / GrepTool
- [ ] WebFetchTool
- [ ] TodoWriteTool
- [ ] 权限系统

### Phase 3: Agent 编排 ⭐⭐⭐
- [ ] AgentTool (子 Agent)
- [ ] AgentCoordinator
- [ ] SendMessageTool

### Phase 4: 任务系统 ⭐⭐
- [ ] TaskCreateTool
- [ ] TaskListTool
- [ ] TaskGetTool
- [ ] TaskUpdateTool
- [ ] TaskStopTool
- [ ] 任务持久化 (SQLite)

### Phase 5: 规划模式 ⭐⭐
- [ ] Plan Mode 核心
- [ ] EnterPlanModeTool
- [ ] ExitPlanModeTool
- [ ] 计划执行器

### Phase 6: 记忆系统 ⭐⭐
- [ ] WorkingMemory
- [ ] SessionMemory
- [ ] LongTermMemory
- [ ] MemoryTool
- [ ] 上下文压缩

### Phase 7: MCP 支持 ⭐⭐
- [ ] MCP Client
- [ ] MCPTool
- [ ] ListMcpResourcesTool
- [ ] ReadMcpResourceTool

### Phase 8: 完善工具 ⭐
- [ ] WorktreeTool
- [ ] AskUserQuestionTool
- [ ] ConfigTool
- [ ] WebSearchTool
- [ ] LSPTool

### Phase 9: 用户体验 ⭐⭐
- [ ] 交互式 REPL
- [ ] 流式输出美化
- [ ] 进度显示
- [ ] 错误提示优化

### Phase 10: 生态建设 ⭐
- [ ] 插件系统
- [ ] 更多模型支持
- [ ] VS Code 插件
- [ ] 文档完善

---

## 19. 附录

### 19.1 参考项目

- [Claude Code](https://github.com/anthropics/claude-code) - 架构参考
- [OpenCode](https://github.com/sst/opencode) - 设计参考
- [Ollama](https://github.com/ollama/ollama) - 本地模型支持
- [MCP SDK](https://github.com/modelcontextprotocol/sdk) - MCP 协议

### 19.2 学习路径

```
1. 先跑通基础 Demo
   └── Query Loop → Tool 调用 → 流式输出

2. 学习 Tool 开发
   └── BashTool → FileTool → 自定义 Tool

3. 学习 Skill 开发
   └── GitCommitSkill → ReadCodeSkill → 自定义 Skill

4. 理解 Agent 编排
   └── 单 Agent → 子 Agent → Agent 间通信

5. 探索高级功能
   └── Memory → MCP → 插件系统
```

### 19.3 贡献指南

欢迎提交：
- 新工具 (Tool) - 遵循 Tool 接口
- 新技能 (Skill) - 遵循 Skill 接口
- 插件 (Plugin) - 遵循 Plugin 接口
- 文档改进
- Bug 修复
- 测试用例

---

## 20. Phase 8: 小模型增强方案

### 20.1 核心理念

> 小模型不适合从零生成复杂代码，但配合工程优化后，可以成为可靠的代码助手。

**策略**：提供预制模板 + 文档缓存 + 完整性检查 + 自动化测试

### 20.2 代码预制库 (Code Snippets Library)

```
.miniagent/snippets/
├── typescript/
│   ├── react-component.tsx    # React 功能组件模板
│   ├── express-api.ts         # Express CRUD API 模板
│   └── utils.ts               # TypeScript 工具类模板
└── python/
    ├── fastapi-app.py         # FastAPI 应用模板
    └── fastapi-router.py      # FastAPI 路由模板
```

**设计原则**：
1. 每个模板包含完整结构、日志、错误处理
2. 使用 `TODO:` 标记需要实现的部分
3. 遵循最佳实践和命名规范

### 20.3 文档缓存系统 (Docs Cache)

```
.miniagent/docs/
├── index.yaml              # 编程语言文档索引
├── cache-config.yaml       # 缓存配置
└── cache/                  # 缓存存储目录
    └── index.json          # 缓存索引
```

**工作流程**：
```
用户请求文档
     ↓
检查本地缓存
     ↓
缓存存在？──否──→ 在线获取 → 缓存到本地 → 返回内容
     ↓是
检查是否过期
     ↓
过期？──是──→ 更新缓存 → 返回内容
     ↓否
返回本地缓存（毫秒级响应）
```

**核心模块**：[`src/core/docs-cache.ts`](file:///workspace/src/core/docs-cache.ts)

**特性**：
- SHA-256 内容校验，防止篡改
- TTL 过期机制（官方文档7天，镜像14天）
- 按域名分类缓存
- 自动清理过期缓存

### 20.4 文档索引系统 (Language Docs Index)

**官方源示例**：
- JavaScript: MDN Web Docs
- TypeScript: TypeScript 官方文档
- React: react.dev
- Python: docs.python.org
- FastAPI: fastapi.tiangolo.com

**镜像源示例**：
- MDN 中文网
- TypeScript 中文手册
- FastAPI 中文文档
- 廖雪峰教程 (Python, Java, Git)

### 20.5 完整性检查机制（待实现）

- [ ] 语法检查（括号匹配、缩进、导入）
- [ ] 静态分析（ESLint/Prettier/Pylint/MyPy）
- [ ] 安全检查（硬编码密码、SQL注入、XSS）
- [ ] TODO/FIXME 检测
- [ ] 未完成代码检测

### 20.6 自动运行机制（待实现）

```yaml
run_strategy:
  immediate:    # 简单脚本立即运行
    - JavaScript/Node.js
    - Python 单文件
  delayed:      # 需要构建延迟运行
    - TypeScript (需要编译)
    - Rust (需要 cargo build)
  manual:       # 风险操作手动确认
    - 数据库迁移
    - 删除操作
```

