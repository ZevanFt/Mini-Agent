# MiniAgent 快速开始

## 1. 环境要求

- **Node.js**: 18+
- **运行时**: Bun（推荐）或 Node
- **模型服务**: Ollama（本地）或任意 OpenAI 兼容 API

## 2. 快速安装

### 安装 Bun（如未安装）
```bash
curl -fsSL https://bun.sh/install | bash
```

### 克隆项目
```bash
git clone <repo-url>
cd miniagent
```

### 安装依赖
```bash
bun install
```

## 3. 部署本地模型

### 安装 Ollama
```bash
# Linux/macOS
curl -fsSL https://ollama.com/install.sh | sh
```

### 启动 Ollama 服务
```bash
ollama serve
```

### 下载最小模型
```bash
# 最小模型（0.5B 参数，~500MB，低配电脑可用）
ollama pull qwen2:0.5b

# 或者代码专用模型
ollama pull deepseek-coder:1.3b

# 或通用对话模型
ollama pull llama3.2:1b
```

### 测试模型
```bash
ollama run qwen2:0.5b "你好，请用一句话介绍你自己"
```

## 4. 运行 MiniAgent

### 交互式聊天
```bash
# 使用默认模型
bun run src/cli.ts chat

# 指定模型
bun run src/cli.ts chat --model qwen2:0.5b

# 显示详细信息
bun run src/cli.ts chat --verbose
```

### 单次执行
```bash
# 直接发送一条消息
bun run src/cli.ts run "帮我看看当前目录有什么文件"

# 指定模型
bun run src/cli.ts run -m deepseek-coder:1.3b "帮我写一个快速排序"
```

### 查看可用工具
```bash
bun run src/cli.ts tools
```

## 5. 运行测试

```bash
# 运行测试套件
bun run src/test.ts
```

## 6. 常见问题

### Q: Ollama 连接失败
```
Connection refused (11434)
```
**解决**: 确保 Ollama 服务正在运行
```bash
ollama serve
```

### Q: 模型下载慢
**解决**: 使用国内镜像或换网络好的环境

### Q: 模型响应慢
**解决**: 换更小的模型（0.5B）或增加内存

### Q: 内存不足
**解决**: 
- 使用 0.5B 模型
- 关闭其他程序
- 增加 swap

## 7. 模型推荐

| 模型 | 大小 | 最低内存 | 适用场景 |
|------|------|----------|----------|
| `qwen2:0.5b` | ~400MB | 1GB | 轻量对话 |
| `qwen2:1.5b` | ~1GB | 2GB | 日常使用 |
| `deepseek-coder:1.3b` | ~1GB | 2GB | 代码助手 |
| `phi3:mini` | ~2GB | 4GB | 综合能力 |
| `llama3.2:1b` | ~1GB | 2GB | 通用对话 |

## 8. 开发

```bash
# 开发模式
bun run dev

# 构建
bun run build
```

## 9. 下一步

1. ✅ 完成 Phase 1 核心框架
2. ⏳ Phase 2: Skill + Memory 系统
3. ⏳ Phase 3: Agent 编排 + Task 系统
4. ⏳ Phase 4: MCP 支持 + 插件系统
