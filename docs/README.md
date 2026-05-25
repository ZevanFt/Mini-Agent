# 📚 MiniAgent 学习笔记

欢迎来到 MiniAgent 的学习笔记库！

这个目录包含 MiniAgent 每个模块的学习笔记，帮你理解 Agent 开发的每个细节。

---

## 📋 导航

| 模块 | 笔记位置 |
|------|----------|
| **项目概述** | [architecture/01-项目概述.md](./architecture/01-项目概述.md) |
| **整体架构** | [architecture/02-整体架构图.md](./architecture/02-整体架构图.md) |
| **核心执行流程** | [architecture/03-核心执行流程.md](./architecture/03-核心执行流程.md) |
| **Core 模块** | [core/](./core/) |
| **Tool 系统** | [tools/](./tools/) |
| **Skill 系统** | [skills/](./skills/) |
| **Memory 系统** | [memory/](./memory/) |
| **MCP 协议** | [mcp/](./mcp/) |
| **LLM 适配** | [llm/](./llm/) |
| **CLI 模块** | [cli/](./cli/) |
| **Task 系统** | [tasks/](./tasks/) |
| **Plan Mode** | [planmode/](./planmode/) |

---

## 🎯 学习路径

### 入门级 (第 1-2 周)
1. 先看 [项目概述](./architecture/01-项目概述.md) 理解定位
2. 看 [整体架构图](./architecture/02-整体架构图.md) 理解全局
3. 学习 [Tool 基类](./tools/01-Tool基类.md) 理解核心概念
4. 实现一个简单的 CLI Demo

### 进阶级 (第 3-4 周)
1. 学习 [QueryLoop](./core/02-QueryLoop.md) 核心
2. 看 [SystemPromptBuilder](./core/03-SystemPromptBuilder.md)
3. 学 [Skill 基类](./skills/01-Skill基类.md)
4. 尝试写自定义 Tool/Skill

### 高级 (第 5 周+)
1. 学 [三层记忆系统](./memory/01-三层记忆架构.md)
2. 学 [MCP 协议](./mcp/01-MCP概述.md)
3. 深入理解 [权限系统](./tools/04-权限系统.md)
4. 开始贡献代码！

---

## 💡 笔记格式

每篇笔记都按照这个结构写：
```
# 标题
## 概述
## 设计理念
## 代码结构
## 关键实现
## 学习要点
## 相关阅读
```

---

## 📝 如何贡献笔记

1. 在对应目录下新建 `.md` 文件
2. 按照笔记格式写
3. 更新这个 README 的导航
4. 提交 PR！

---

## 🎉 开始学习

点击上面的导航链接，从你感兴趣的模块开始吧！
