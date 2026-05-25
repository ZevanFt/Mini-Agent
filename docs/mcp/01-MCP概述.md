# 01 - MCP 概述

> 📅 创建日期: 2026-05-23
> 🎯 难度: ⭐⭐ 进阶级
> ⏱️ 阅读时间: 20 分钟

---

## 1. 什么是 MCP

MCP = **Model Context Protocol**，是一个开放协议，用于:
- 让 LLM 访问外部数据源
- 提供自定义工具
- 标准化工具接口

### 1.1 为什么要用 MCP

```typescript
// 问题: 每个工具都要自己写代码
agent.addTool(new MyCustomTool());
agent.addTool(new AnotherTool());

// 解决方案: 用 MCP 协议动态加载
mcpClient.connect({
  command: "my-mcp-server",
  args: [...]
});
// 自动发现和注册工具
```

---

## 2. MCP 架构

```
┌──────────────────┐         ┌─────────────────┐
│  MiniAgent       │◄───────►│  MCP Client     │
│  (Host)          │         └────────┬────────┘
└──────────────────┘                  │
                                      │ JSON-RPC
                                      │
                          ┌───────────┴───────────┐
                          │                       │
                  ┌───────▼────────┐    ┌───────▼────────┐
                  │ MCP Server 1   │    │ MCP Server 2   │
                  │ (e.g. Files)   │    │ (e.g. GitHub)  │
                  └────────────────┘    └────────────────┘
```

---

## 3. 核心概念

### 3.1 MCP Tool

```typescript
interface MCPTool {
  name: string;
  description: string;
  inputSchema: JSONSchema;
}
```

### 3.2 MCP Resource

```typescript
interface MCPResource {
  uri: string;
  name: string;
  description: string;
  mimeType: string;
}
```

---

## 4. 完整实现

```typescript
// src/mcp/client.ts
import { spawn, ChildProcess } from "child_process";

interface MCPServerConfig {
  name: string;
  command: string;
  args?: string[];
  env?: Record<string, string>;
}

class MCPClient {
  private servers: Map<string, MCPServer> = new Map();

  async connect(config: MCPServerConfig): Promise<void> {
    const server = new MCPServer(config);
    await server.initialize();
    this.servers.set(config.name, server);
  }

  async callTool(
    serverName: string,
    toolName: string,
    args: any
  ): Promise<any> {
    const server = this.servers.get(serverName);
    if (!server) {
      throw new Error(`MCP server ${serverName} not connected`);
    }

    return await server.callTool(toolName, args);
  }

  async listTools(): Promise<MCPTool[]> {
    const tools: MCPTool[] = [];
    for (const [name, server] of this.servers) {
      const serverTools = await server.listTools();
      tools.push(...serverTools.map(t => ({ ...t, server: name })));
    }
    return tools;
  }
}

class MCPServer {
  private process: ChildProcess;
  private requestId: number = 0;
  private pendingRequests: Map<number, Deferred<any>> = new Map();
  private isInitialized: boolean = false;

  constructor(private config: MCPServerConfig) {}

  async initialize(): Promise<void> {
    // 启动进程
    this.process = spawn(this.config.command, this.config.args || [], {
      stdio: ["pipe", "pipe", "pipe"],
      env: { ...process.env, ...this.config.env }
    });

    // 监听输出
    this.setupMessageHandler();

    // 发送初始化请求
    const initResult = await this.sendRequest("initialize", {
      protocolVersion: "2024-11-05",
      capabilities: { tools: {}, resources: {} },
      clientInfo: { name: "miniagent", version: "1.0.0" }
    });

    this.isInitialized = true;
  }

  async listTools(): Promise<MCPTool[]> {
    const result = await this.sendRequest("tools/list");
    return result.tools;
  }

  async callTool(name: string, args: any): Promise<any> {
    return await this.sendRequest("tools/call", {
      name,
      arguments: args
    });
  }

  async listResources(): Promise<MCPResource[]> {
    const result = await this.sendRequest("resources/list");
    return result.resources;
  }

  async readResource(uri: string): Promise<string> {
    const result = await this.sendRequest("resources/read", { uri });
    return result.contents;
  }

  private async sendRequest(method: string, params?: any): Promise<any> {
    return new Promise((resolve, reject) => {
      const id = ++this.requestId;
      this.pendingRequests.set(id, { resolve, reject });

      this.process.stdin?.write(
        JSON.stringify({ jsonrpc: "2.0", id, method, params }) + "\n"
      );
    });
  }

  private setupMessageHandler(): void {
    let buffer = "";

    this.process.stdout?.on("data", (data) => {
      buffer += data.toString();
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const message = JSON.parse(line);
          this.handleMessage(message);
        } catch (e) {
          console.error("解析 MCP 消息失败:", e);
        }
      }
    });
  }

  private handleMessage(message: any): void {
    if (message.id) {
      const deferred = this.pendingRequests.get(message.id);
      if (deferred) {
        if (message.error) {
          deferred.reject(new Error(message.error.message));
        } else {
          deferred.resolve(message.result);
        }
        this.pendingRequests.delete(message.id);
      }
    }
  }
}
```

---

## 5. 配置示例

```json
// .openagent.json
{
  "mcp": {
    "servers": [
      {
        "name": "filesystem",
        "command": "npx",
        "args": [
          "-y",
          "@modelcontextprotocol/server-filesystem",
          "/path/to/directory"
        ]
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

## 6. 学习要点

### 6.1 MCP 优势

1. **标准协议**: 生态系统丰富
2. **动态加载**: 不需要改代码
3. **安全隔离**: Server 在独立进程运行
4. **多语言**: Server 可以用任意语言写

### 6.2 何时用 MCP

- 需要连接外部 API
- 需要访问数据库
- 需要复杂的工具逻辑
- 需要与其他系统集成

---

## 7. 相关阅读

- [MCP 规范](https://modelcontextprotocol.io)
- [MCPTool 包装器](./02-MCPToolWrapper.md)
- [MCP 配置](./03-MCP配置.md)
