# 01 - Tool 基类

> 📅 创建日期: 2026-05-23
> 🎯 难度: ⭐ 入门级
> ⏱️ 阅读时间: 20 分钟

---

## 1. 概述

Tool 是 MiniAgent 的**核心执行单元**，Agent 通过调用 Tool 来完成各种实际任务。

### 1.1 什么是 Tool

```typescript
// 最简单的 Tool 定义
interface Tool {
  name: string;           // 工具名 (小写+下划线)
  description: string;    // 给 LLM 看的描述
  parameters: JSONSchema;  // 参数结构
  execute: (params) => Promise<any>;  // 执行逻辑
}
```

### 1.2 Tool 的分类

| 类型 | 示例 |
|------|------|
| **文件操作** | FileReadTool, FileWriteTool |
| **命令执行** | BashTool, PowerShellTool |
| **搜索查询** | WebSearchTool, GrepTool |
| **Agent 编排** | AgentTool, SendMessageTool |
| **MCP 代理** | MCPTool |

---

## 2. 设计理念

### 2.1 安全第一

```typescript
// 每个 Tool 执行前都会进行：
// 1. 权限检查
// 2. 参数验证
// 3. 风险分析
```

### 2.2 声明式定义

```typescript
// 用 JSON Schema 声明参数
// LLM 会根据 Schema 生成正确的调用
parameters: {
  type: "object",
  properties: { ... },
  required: [...]
}
```

### 2.3 结果格式化

```typescript
// Tool 返回结构化结果
execute(params) {
  return {
    success: true,
    result: "...",
    metadata: { ... }
  };
}
```

---

## 3. 代码结构

### 3.1 BaseTool 基类

```typescript
// src/tools/base.ts
abstract class BaseTool {
  abstract name: string;
  abstract description: string;
  abstract parameters: JSONSchema;

  async execute(params: any): Promise<any> {
    throw new Error("Not implemented");
  }

  // 权限检查钩子
  async checkPermission(params: any): Promise<boolean> {
    return true;
  }

  // 参数验证钩子
  validateParams(params: any): boolean {
    return true;
  }
}
```

### 3.2 完整示例: FileReadTool

```typescript
// src/tools/file-read.ts
class FileReadTool extends BaseTool {
  name = "file_read";

  description = `
    Read the contents of a file from the filesystem.
    Use this when you need to examine existing code or text files.
  `;

  parameters = {
    type: "object",
    properties: {
      path: {
        type: "string",
        description: "Absolute path to the file to read"
      },
      lines: {
        type: "number",
        description: "Maximum number of lines to read (optional)"
      }
    },
    required: ["path"]
  };

  async execute(params: { path: string; lines?: number }): Promise<any> {
    // 1. 验证参数
    if (!existsSync(params.path)) {
      throw new Error("File not found");
    }

    // 2. 读取文件
    let content = readFileSync(params.path, "utf-8");

    // 3. 可选行数限制
    if (params.lines) {
      content = content.split("\n").slice(0, params.lines).join("\n");
    }

    // 4. 返回结果
    return {
      success: true,
      path: params.path,
      content,
      lines: content.split("\n").length
    };
  }

  // 自定义权限检查
  async checkPermission(params: { path: string }): Promise<boolean> {
    // 禁止读取敏感文件
    const sensitivePatterns = [
      /\.env$/,
      /\.key$/,
      /id_rsa/,
      /passwd/
    ];

    for (const pattern of sensitivePatterns) {
      if (pattern.test(params.path)) {
        return false;
      }
    }

    return true;
  }
}
```

---

## 4. 关键实现细节

### 4.1 权限检查流程

```
User Request
    │
    ▼
Tool Executor
    │
    ├─→ checkPermission()
    │     │
    │     ├─→ 权限规则匹配
    │     ├─→ 危险命令检测
    │     └─→ 用户确认 (可选)
    │
    ├─→ validateParams()
    │     │
    │     └─→ JSON Schema 验证
    │
    └─→ execute()
          │
          └─→ 返回结果
```

### 4.2 错误处理

```typescript
// 所有错误都是结构化的
class ToolError extends Error {
  constructor(
    message: string,
    public code: "PERMISSION_DENIED"
             | "INVALID_PARAMS"
             | "EXECUTION_FAILED",
    public details?: any
  ) {
    super(message);
  }
}
```

---

## 5. 学习要点

### 5.1 如何写一个好 Tool

1. **描述要具体**: 告诉 LLM 什么时候用这个 Tool
2. **参数要明确**: 用 JSON Schema 详细说明
3. **权限要谨慎**: 所有高危操作都需要检查
4. **错误要清晰**: 用户能看懂的错误信息

### 5.2 常见错误

| 错误 | 原因 | 修复 |
|------|------|------|
| LLM 不会调用这个 Tool | description 不够清晰 | 优化 description |
| 参数验证失败 | Schema 定义不对 | 检查 JSONSchema |
| 权限总是被拒 | 规则太严 | 调整 checkPermission |

---

## 6. 相关阅读

- [Tool 注册表](./02-ToolRegistry.md)
- [Tool 执行器](./03-ToolExecutor.md)
- [权限系统](./04-权限系统.md)
- [内置工具: BashTool](./tools/BashTool.md)
