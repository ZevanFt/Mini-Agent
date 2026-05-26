# 开发日记索引

> 按时间顺序记录 MiniAgent 项目开发日志

| 日期 | 文件名 | 内容概要 |
|------|--------|----------|
| 2026-05-24 | [2026-05-24.md](2026-05-24.md) | 环境搭建 + 评测框架 + 首轮 ds-coder:1.3b 跑分 |
| 2026-05-25 | [2026-05-25.md](2026-05-25.md) | 后处理器 + Baseline D/E + qwen2.5-coder:3b 升级 + 全量对比 |
| 2026-05-25 | (同上) | CLI 实测 + tool_call 回退解析 + 自适应模型策略 + 项目收尾 |
| 2026-05-26 | [2026-05-26.md](2026-05-26.md) | TUI 大重构：blessed → terminal-kit，全局错误捕获，Ctrl+C 不退出终端 |

## 相关文档

- [总评测报告](../evaluation/SUMMARY.md) — 社交媒体风格，包含全部实验数据和截图
- [开发计划](../DEVELOPMENT_PLAN.md) — 进度总览

## 切换回 Trae 开发时的注意点

MiniAgent 项目主要分两部分：

### 1. 评测框架（Python）
- 位置：`evaluation/`
- 全 Python 实现，和主项目解耦
- 需要 Ollama 运行模型
- 环境变量：`OLLAMA_MODELS=G:\ollama\models`

### 2. MiniAgent 核心（TypeScript + Bun）
- 位置：`src/`
- TypeScript 代码，需要 `bun` 编译
- `npm run build` / `npm run dev` 构建
- 主入口：`src/cli.ts`

### 模型文件位置
- Ollama 安装：`G:\ollama\app\`
- 模型存储：`G:\ollama\models\`
- 可用模型：`qwen2.5-coder:3b`（推荐）、`deepseek-coder:1.3b`（保留备用）
