# 架构对比: MiniAgent vs OpenCode vs Claude Code

## 1. 项目结构对比

### Claude Code
```
claude-code/
├── .claude/
│   ├── skills/
│   │   └── *skill-name/SKILL.md
│   └── ...
├── src/
│   ├── cli/
│   ├── core/
│   ├── skills/
│   ├── tools/
│   └── ...
└── ...
```

### OpenCode
```
opencode/
├── .opencode/
│   ├── skills/
│   ├── docs/
│   └── ...
├── src/
│   ├── core/
│   ├── tools/
│   ├── skills/
│   └── ...
└── ...
```

### MiniAgent (当前)
```
miniagent/
├── .miniagent/
│   ├── skills/        # 项目级技能
│   ├── snippets/      # 代码模板库 (Phase 8 新增)
│   ├── docs/          # 文档索引 (Phase 8 新增)
│   └── ...
├── src/
│   ├── core/          # 核心引擎 (agent, hooks, commands, etc.)
│   ├── tools/         # 工具系统
│   ├── skills/        # 内置技能模块
│   ├── llm/           # LLM 适配器
│   ├── mcp/           # MCP 协议
│   ├── tasks/         # 任务管理
│   └── memory/        # 记忆系统
├── test/
│   ├── core/
│   ├── tools/
│   ├── skills/
│   └── fixtures/
└── ...
```

## 2. 差异分析

### 2.1 相似点
✅ **技能目录结构** - 都使用 `.config/skills/skill-name/SKILL.md` 格式
✅ **核心模块划分** - core/tools/skills 结构相似
✅ **本地优先设计** - 都重视本地运行，支持低成本硬件
✅ **CLI 交互** - 都提供命令行界面

### 2.2 MiniAgent 新增的特性 (Phase 8)
| 特性 | 说明 |
|------|------|
| 代码模板库 (.miniagent/snippets/) | 预制代码片段，小模型友好 |
| 文档索引和缓存 | 文档本地化，减少网络访问 |
| 完整性检查 | 生成后自动验证代码 |
| 自动运行机制 | 生成后自动测试验证 |
| 日志注入 | 自动添加完善的日志 |

## 3. 建议优化方向

### 立即优化
✅ 已完成:
- 新增 skill-creator, find-skill, list-skills, skill-info 技能
- 代码模板库已创建
- 文档索引和缓存已实现

### 下一步
- 集成 Phase 8 功能到 Agent 主循环
- 完善测试覆盖
