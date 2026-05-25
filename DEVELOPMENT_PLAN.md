# MiniAgent 开发进度

> 最后更新: 2026-05-25

## 总览

```
Phase 1-8: ✅ 全部完成
总文件: 95+
总工具: 26 个
核心模块: 28 个
测试状态: 全部通过
Slash 命令: 52+ 个
```

## Phase 1: 核心框架 ✅

- [x] 项目脚手架 (package.json, tsconfig.json)
- [x] LLM 适配器
  - [x] LLMAdapter 接口定义
  - [x] Ollama 适配器
  - [x] MockLLMAdapter (测试用)
- [x] Tool 系统
  - [x] Tool 基类/类型定义
  - [x] ToolRegistry (注册表)
  - [x] ToolExecutor (执行器, 支持重试/并发)
  - [x] BashTool (安全检查 + 危险命令检测)
  - [x] FileReadTool
  - [x] GlobTool
  - [x] GrepTool
- [x] Query Loop 核心 (集成到 Agent 类)
- [x] CLI 入口 (chat/run/tools 命令)
- [x] System Prompt 构建器 (参照 Claude Code 风格)

## Phase 2: 基础工具 + Skill + Memory ✅

- [x] FileWriteTool
- [x] WebFetchTool
- [x] TodoWriteTool
- [x] Skill 系统
  - [x] SkillRegistry
  - [x] GitCommitSkill
  - [x] ReadCodeSkill
- [x] Memory 系统
  - [x] SessionMemory (会话级消息管理)

## Phase 3: Agent 编排 ✅

- [x] Task 系统
  - [x] TaskManager (CRUD + 父子关系 + 状态管理)
  - [x] task_create / task_list / task_update / task_get (4个工具)
- [x] Sub-Agent
  - [x] SubAgent 类 (独立 LLM 调用循环)
  - [x] agent 工具 (创建子 Agent)
- [x] AskUser 工具
- [x] Plan Mode (规划模式)
  - [x] PlanModeState 状态机
  - [x] PlanModeManager (生成→批准→执行)
  - [x] enter_plan_mode / exit_plan_mode (2个工具)
  - [x] 计划格式化输出
- [x] 权限系统
  - [x] PermissionSystem (allow/deny/ask)
  - [x] 危险命令检测 (rm -rf /, fork bomb 等)
  - [x] 授权缓存 (用户确认后记住)
  - [x] 默认安全规则

## Phase 4: MCP 支持 ✅

- [x] MCP 类型定义 (JSON-RPC 2.0)
- [x] MCPClient (stdio 连接)
- [x] MCPManager (多服务器管理)
- [x] MCP 工具
  - [x] mcp_call (通用 MCP 调用)
  - [x] mcp_list_servers
  - [x] mcp_list_resources
  - [x] mcp_read_resource

## Phase 5: Memory + Compaction + 扩展工具 ✅

- [x] WebSearchTool (DuckDuckGo 搜索)
- [x] ConfigTool (get/set/list/reset)
- [x] LongTermMemory (跨会话持久化)
  - [x] store/get/search/list/forget
  - [x] 按类别管理 (project/preference/context/decision/error/fact)
  - [x] JSON 文件持久化存储
- [x] Context Compactor
  - [x] 快速压缩 (保留最近消息)
  - [x] LLM 摘要压缩
  - [x] Token 估算
- [x] MemoryTool (Agent 主动管理记忆)

## Phase 6: Hooks + Slash Commands + File Edit ✅

- [x] FileEditTool (精确搜索替换)
- [x] Hooks 系统 (13 种生命周期事件)
  - [x] createToolLogHook
  - [x] createSecurityAuditHook
  - [x] createSessionTimerHook
  - [x] HookDispatcher 管理
- [x] Slash Commands (13 个内置命令)
  - [x] /help, /compact, /clear, /plan, /review
  - [x] /commit, /config, /tools, /skills, /hooks
  - [x] /memory, /status, /quit
- [x] 集成 Hooks 到 Agent 主循环
- [x] 集成 Commands 到 CLI

## Phase 7: 所有差距修复 ✅

### 严重差距

- [x] **TUI 界面** — MINIAGENT ASCII 大标题 + 状态栏 + 24 个 slash 命令
- [x] **Session 持久化** — save/load/listSessions/deleteSession
- [x] **Checkpoints / Rewind** — create/rewind/list 检查点
- [x] **AGENTS.md 项目配置** — 解析 YAML frontmatter + 向上搜索
- [x] **Hooks 集成到 Agent** — session_start/pre_tool_use/post_tool_use 等
- [x] **Slash Commands 集成到 CLI** — 所有命令可用

### 中等差距

- [x] **Background Tasks** — start/stop/list/logs 后台任务管理
- [x] **多模型运行时切换** — /model 命令
- [x] **Prompt History** — 搜索/导航/持久化
- [x] **Thinking Mode Toggle** — /thinking normal/verbose 命令
- [x] **Plugin System** — discover/load/install/uninstall 插件

### 次要差距

- [x] **Stats & Usage Tracking** — 记录/导出报告
- [x] **Auto-update Checker** — npm registry 检查更新
- [x] **File Watcher** — 递归文件变更监控
- [x] **Multi-File Edit** — 批量 search/replace
- [x] **Formatters** — Prettier/ESLint/Stylelint 集成
- [x] **GitHub Integration** — Issue/PR 管理
- [x] **/loop, /goal, /stats, /plugins, /background, /history, /update** — 扩展命令

## Phase 8: 小模型增强方案 ✅ (全部完成)

### 核心理念

> "小模型 + 工程优化 = 可落地的代码助手"

### 核心特性

#### 1. 📦 代码预制库（Code Snippets Library）✅

> 小模型不擅长从 0 到 1 生成复杂代码，提供预制模板

- [x] 设计架构
- [x] 实现 JS/TS 预制库
  - [x] React 组件模板 (`.miniagent/snippets/typescript/react-component.tsx`)
  - [x] Express 端点模板 (`.miniagent/snippets/typescript/express-api.ts`)
  - [x] TypeScript 工具类模板 (`.miniagent/snippets/typescript/utils.ts`)
  - [x] 测试模板
- [x] 实现 Python 预制库
  - [x] FastAPI 应用模板 (`.miniagent/snippets/python/fastapi-app.py`)
  - [x] FastAPI 路由模板 (`.miniagent/snippets/python/fastapi-router.py`)
  - [x] SQLAlchemy 模型
  - [x] pytest 模板
- [ ] 实现 Java 预制库（后续扩展）
- [ ] 实现 Go 预制库（后续扩展）
- [ ] 实现 Rust 预制库（后续扩展）

#### 2. 📚 编程语言文档索引 + 缓存系统（Language Docs Index + Cache）✅

> 不在项目中存储所有文档，只存储官方源和镜像源索引，首次访问时自动缓存到本地

- [x] 设计架构
- [x] 创建文档索引文件 (`.miniagent/docs/index.yaml`)
  - [x] 官方源列表 (MDN, TypeScript, React, Node.js, FastAPI 等)
  - [x] 镜像源列表 (中文文档、廖雪峰教程等)
  - [x] 地区偏好配置
  - [x] 离线缓存策略
- [x] 文档缓存系统 (`src/core/docs-cache.ts`)
  - [x] DocsCacheManager 核心类
  - [x] 缓存索引管理
  - [x] SHA-256 内容校验
  - [x] 过期自动刷新
  - [x] 缓存配置模板 (`.miniagent/docs/cache-config.yaml`)
- [x] 文档检索工具
  - [x] 在线检索与本地缓存切换
  - [x] 自动内容提取与清洗
  - [x] 智能摘要提取

#### 3. ✅ 生成后完整性检查（Post-Generation Completeness Check）✅

- [x] 设计架构
- [x] 实现语法检查
  - [x] 括号匹配（JS/TS）
  - [x] 缩进一致性（Python）
  - [x] 导入检查（ES6 导入语句格式）
- [x] 实现静态分析
  - [x] ESLint/Prettier 集成点
  - [x] Pylint/MyPy 集成点
  - [x] 安全漏洞检查（硬编码密码、eval 检测）
- [x] 完整性检查清单
  - [x] TODO/FIXME/HACK 检测
  - [x] 未完成代码检测
  - [x] 硬编码密钥检测

#### 4. ▶️ 生成后自动运行（Post-Generation Auto-Run）✅

- [x] 设计架构
- [x] 实现运行策略
  - [x] 立即运行（简单脚本：JS, Python）
  - [x] 延迟运行（需要构建：TypeScript via tsx）
  - [x] 手动确认（风险操作）
- [x] 语言特定运行器
  - [x] JavaScript/TypeScript（node / npx tsx）
  - [x] Python（python）
  - [ ] Rust（后续扩展）
  - [ ] Go（后续扩展）

#### 5. 📋 运行检查日志（Run Log Checking）✅

- [x] 设计架构
- [x] 实现日志分析
  - [x] 错误模式识别
  - [x] 警告模式识别
  - [x] 成功指标检测
- [x] 智能建议
  - [x] 错误修复建议
  - [x] 性能优化建议
  - [x] 安全改进建议

#### 6. 🖨️ 生成代码完整打印（Complete Logging in Generated Code）✅

- [x] 设计架构
- [x] 日志模板
  - [x] 函数入口日志
  - [x] 参数日志
  - [x] 返回值日志
  - [x] 异常捕获日志
  - [x] 循环进度日志
- [x] 日志最佳实践
  - [x] 日志级别规范
  - [x] 结构化日志
  - [x] 性能优化

#### 7. 🎯 完善 Slash 命令（Complete Slash Commands）✅

- [x] 差距分析
- [x] 实现 52+ 命令，按 11 类组织
  - [x] 会话管理（8 个）
  - [x] 文件项目（8 个）
  - [x] 工作流（10 个）
  - [x] 工具配置（7 个）
  - [x] 技能插件（4 个）
  - [x] 记忆历史（5 个）
  - [x] 安全质量（4 个）
  - [x] Git/GitHub（4 个）
  - [x] TUI 输出（5 个）
  - [x] 诊断（4 个）
  - [x] 认证隐私（3 个）

#### 8. 🔧 代码增强器（CodeEnhancer）✅

- [x] 渐进式代码生成（分步生成 + 上下文累积）
- [x] 审查修复循环（验证 → 修复 → 再验证，最多 N 轮）
- [x] 代码分块处理（大文件拆分处理）
- [x] 带指数退避的重试机制
- [x] 集成到 Agent 主循环（file_write / multi_edit / file_edit 后自动触发）

### Phase 8 集成状态

- [x] `DocsCacheManager` 集成到 Agent
- [x] `CompletenessChecker` 集成到工具执行后处理
- [x] `AutoRunner` 集成到代码生成流程
- [x] `LogInjector` 集成到代码生成流程
- [x] `CodeEnhancer` 集成到 Agent 主循环
- [x] 所有 Phase 8 模块导出到 `src/core/index.ts`
- [x] Agent 提供公共 API 访问各模块
- [x] Phase 8 可通过 `enablePhase8` 配置开关

## 工具清单 (26 个)

| 类别 | 工具 | 状态 |
|------|------|------|
| 基础 | bash | ✅ |
| 基础 | file_read | ✅ |
| 基础 | file_write | ✅ |
| 基础 | file_edit | ✅ |
| 基础 | multi_edit | ✅ |
| 基础 | glob | ✅ |
| 基础 | grep | ✅ |
| 基础 | web_fetch | ✅ |
| 基础 | todo_write | ✅ |
| 基础 | config | ✅ |
| 基础 | format | ✅ |
| 扩展 | web_search | ✅ |
| 任务 | task_create | ✅ |
| 任务 | task_list | ✅ |
| 任务 | task_update | ✅ |
| 任务 | task_get | ✅ |
| 交互 | ask_user | ✅ |
| 编排 | agent (Sub-Agent) | ✅ |
| 规划 | enter_plan_mode | ✅ |
| 规划 | exit_plan_mode | ✅ |
| MCP | mcp_call | ✅ |
| MCP | mcp_list_servers | ✅ |
| MCP | mcp_list_resources | ✅ |
| MCP | mcp_read_resource | ✅ |
| 记忆 | memory | ✅ |
| GitHub | github | ✅ |

## Slash 命令清单 (52+ 个)

✅ **全部完成**，按 11 大类组织：

| 类别 | 命令数量 | 示例 |
|------|----------|------|
| 会话管理 | 8 | /help, /compact, /clear, /new, /save, /resume, /restart, /quit |
| 文件项目 | 8 | /init, /status, /diff, /undo, /redo, /add-dir, /files, /context |
| 工作流 | 10 | /plan, /approve, /skip, /review, /commit, /test, /retry, /explain, /loop, /batch |
| 工具配置 | 7 | /tools, /config, /permissions, /model, /mcp, /version, /reset |
| 技能插件 | 4 | /skills, /skill, /hooks, /plugins |
| 记忆历史 | 5 | /memory, /history, /checkpoints, /rewind, /branch |
| 安全质量 | 4 | /security-review, /simplify, /debug, /copy |
| Git/GitHub | 4 | /git, /github, /share, /export |
| TUI 输出 | 5 | /thinking, /format, /background, /vim, /insights |
| 诊断 | 4 | /doctor, /bug, /docs, /connect |
| 认证隐私 | 3 | /login, /logout, /privacy-settings |

## 项目结构

```
miniagent/
├── src/
│   ├── cli.ts                         # CLI 入口 (MINIAGENT TUI)
│   ├── core/                          # 核心引擎 (21个文件)
│   │   ├── agent.ts                   # Agent 主类 (集成 Hooks)
│   │   ├── system-prompt.ts           # System Prompt 构建
│   │   ├── plan-mode.ts               # Plan Mode 类型
│   │   ├── plan-mode-manager.ts       # Plan Mode 管理器
│   │   ├── permissions.ts             # 权限系统 (增强版)
│   │   ├── compact.ts                 # 上下文压缩
│   │   ├── hooks.ts                   # Hooks 系统 (13种事件)
│   │   ├── commands.ts                # Slash 命令系统 (33个命令)
│   │   ├── checkpoints.ts             # Checkpoints/Rewind
│   │   ├── agents-md.ts               # AGENTS.md 解析
│   │   ├── background-tasks.ts        # 后台任务
│   │   ├── prompt-history.ts          # Prompt 历史
│   │   ├── stats.ts                   # 使用统计
│   │   ├── autoupdate.ts              # 自动更新检查
│   │   ├── watcher.ts                 # 文件监控
│   │   ├── thinking-mode.ts           # 思考模式
│   │   ├── docs-cache.ts              # 文档缓存系统 ✨ 新增 (Phase 8)
│   │   └── index.ts                   # 统一导出
│   ├── llm/                           # LLM 适配器 (4个文件)
│   ├── tools/                         # 工具系统 (22个文件)
│   │   ├── format.ts                  # 代码格式化
│   │   ├── multi-edit.ts              # 多文件编辑
│   │   └── github.ts                  # GitHub 集成
│   ├── tasks/                         # Task 系统 (3个文件)
│   ├── mcp/                           # MCP 协议 (4个文件)
│   ├── memory/                        # 记忆系统 (2个文件, 支持持久化)
│   └── skills/                        # 技能系统 (4个文件, SKILL.md 格式)
├── test/                              # 模块化测试 (15+ 文件)
│   ├── core/                          # 核心模块测试
│   │   ├── test-code-enhancer.ts      # CodeEnhancer 测试
│   │   ├── test-completeness-checker.ts # CompletenessChecker 测试
│   │   ├── test-auto-runner.ts        # AutoRunner 测试
│   │   ├── test-log-injector.ts       # LogInjector 测试
│   │   ├── test-docs-cache.ts         # DocsCacheManager 测试
│   │   ├── test-sqlite-store.ts       # SQLiteStore 测试
│   │   ├── test-phase2.ts             # Phase 2 测试
│   │   ├── test-phase3.ts             # Phase 3 测试
│   │   ├── test-phase3-complete.ts    # Phase 3 完整测试
│   │   ├── test-phase5.ts             # Phase 5 测试
│   │   ├── test-phase6.ts             # Phase 6 测试
│   │   └── test-security.ts           # 安全性测试
│   ├── tools/                         # 工具测试
│   │   └── test-phase4.ts             # Phase 4 工具测试
│   ├── skills/                        # 技能测试
│   │   └── test-skills.ts             # 技能系统测试
│   ├── fixtures/                      # 测试夹具
│   │   └── test-edit.ts               # 编辑测试夹具
│   ├── test-final.ts                  # 最终集成测试
│   ├── test-integration.ts            # 集成测试
│   └── README.md                      # 测试文档
├── docs/                              # 学习笔记 (12篇)
├── .miniagent/                        # 项目配置
│   ├── skills/                        # Skill 配置 (12个 SKILL.md)
│   ├── snippets/                      # 代码预制库 ✨ 新增 (Phase 8)
│   │   ├── typescript/
│   │   │   ├── react-component.tsx    # React 组件模板
│   │   │   ├── express-api.ts         # Express API 端点
│   │   │   └── utils.ts               # TypeScript 工具类
│   │   └── python/
│   │       ├── fastapi-app.py         # FastAPI 应用模板
│   │       └── fastapi-router.py      # FastAPI 路由模板
│   ├── docs/                          # 文档索引 + 缓存 ✨ 新增 (Phase 8)
│   │   ├── index.yaml                 # 编程语言文档索引
│   │   ├── cache-config.yaml          # 缓存配置
│   │   └── cache/                     # 缓存存储目录
│   │       └── index.json             # 缓存索引
│   └── templates/                     # 提示词模板 ✨ 新增 (Phase 8)
├── local_llm/                         # 本地 LLM 模型和部署脚本
│   ├── models/                        # 模型文件目录
│   ├── scripts/                       # 部署脚本
│   └── configs/                       # 配置文件
├── ARCHITECTURE.md                    # 架构文档
├── DEVELOPMENT_PLAN.md                # 开发计划 (你现在看的这个)
├── QUICKSTART.md                      # 快速开始
└── README.md                          # 项目入口
```

## 使用方式

| 场景 | 命令 |
|------|------|
| **不安装直接用** | `npx miniagent chat` |
| **全局安装后** | `npm install -g miniagent` → `miniagent chat` |
| **本地开发** | `npm run dev` 或 `npx tsx src/cli.ts chat` |

## 实测验证（2026-05-24 ~ 2026-05-25）

完成了对小模型的真实编码能力评测，搭建了完整评测框架。

### 目录结构

```
evaluation/
├── tasks/tasks.json    # 5 个编码任务（FizzBuzz ~ Calculator）
├── runners/
│   ├── run_eval.py     # 5 个 baseline 对比跑分
│   ├── scorer.py       # 4 维度自动评分
│   └── code_postprocessor.py  # 确定性代码后处理器
├── results/            # 各轮结果归档（含报告）
└── SUMMARY.md          # 社交媒体风格总报告
```

### 关键数据

| Baseline | 模型 | 综合通过率 | 时间 |
|---|---|---|---|
| A: 裸模型 | ds-coder:1.3b | **6.7%** | 24s |
| D: 全增强 | ds-coder:1.3b | **42.5%** | 73s |
| **A: 裸模型** | **qwen2.5-coder:3b** | **100%** | **15s** |

### 核心结论

1. **ds-coder:1.3b 太弱**——裸模型 0/5 全挂，需要后处理器兜底
2. **qwen2.5-coder:3b 是甜蜜点**——裸模型 5/5 全过，不需要任何 hack
3. **后处理器只对 ≤1.3B 有效**——对 3B 模型反而负优化
4. 日记见 -> journal/
   - `journal/2026-05-24.md`
   - `journal/2026-05-25.md`
   - `journal/INDEX.md`
   - `evaluation/SUMMARY.md` 可作发社媒的素材

### 模型部署脚本整理（2026-05-25）

- `local_llm/scripts/manage.ps1` — 模型管理（start/stop/list/pull/rm/status）
- `local_llm/scripts/smoke-test.ps1` — 烟雾测试生成器，对新模型跑 5 任务存入 test/fixtures/models/
- `local_llm/configs/models.json` — 模型策略配置（按模型自动开关增强）
- `local_llm/configs/ollama.env` — Ollama 环境变量（G盘路径）
- `test/fixtures/models/` — 模型测试产物永久归档
  - `qwen2.5-coder-3b/` — 5 任务 × raw.txt + output.py
  - `ds-coder-1.3b/` — 5 任务 × raw.txt + output.py + cleaned.py（后处理器版）

## 与 OpenCode / Claude Code 的差距

剩余差距（可选，锦上添花）:

- [ ] Client/Server 架构
- [ ] LSP 完整集成
- [ ] VS Code / JetBrains 插件
- [ ] Notebook 编辑工具
- [ ] Worktree 工具
- [ ] SQLite 任务持久化
- [ ] MCP SSE 传输支持

## 小模型最佳实践

### 核心理念

> "小模型不适合从零生成复杂代码，但适合：
> 1. 在预制模板基础上修改
> 2. 执行结构化任务
> 3. 代码审查和重构
> 4. 简单调试"

### 模型推荐

| 硬件 | 推荐模型 | 参数 | 内存占用 |
|------|----------|------|----------|
| 8-16GB RAM | qwen2.5-coder:7b | 7B | 4-8GB |
| 8-12GB RAM | qwen2.5-coder:1.5b | 1.5B | 1-2GB |
| 4-8GB RAM | qwen2.5-coder:0.5b | 0.5B | 0.3-1GB |

### 工作流程

```
1. 分析任务 → 2. 推荐模板 → 3. 生成代码 → 4. 完整性检查
                                             ↓
                                           5. 自动运行 → 6. 日志检查 → 7. 修复重试
```

## 学习笔记

- [项目概述](./docs/architecture/01-项目概述.md)
- [整体架构图](./docs/architecture/02-整体架构图.md)
- [核心执行流程](./docs/architecture/03-核心执行流程.md)
- [Agent 主类](./docs/core/01-Agent主类.md)
- [权限系统](./docs/tools/04-权限系统.md)
