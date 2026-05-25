# 02 - ToolRegistry

> 📅 创建日期: 2026-05-23
> 🎯 难度: ⭐ 入门级
> ⏱️ 阅读时间: 15 分钟

---

## 1. 概述

ToolRegistry 是**工具的注册中心**，负责:
- 注册 Tool
- 查找 Tool
- 列出可用 Tool
- 管理 Tool 的权限信息

---

## 2. 代码结构

```typescript
// src/tools/registry.ts
class ToolRegistry {
  private tools: Map<string, Tool> = new Map();
  private toolDescriptions: Map<string, string> = new Map();

  // ===== 注册 =====
  register(tool: Tool): void {
    this.tools.set(tool.name, tool);
    this.toolDescriptions.set(tool.name, tool.description);
  }

  registerAll(tools: Tool[]): void {
    for (const tool of tools) {
      this.register(tool);
    }
  }

  unregister(name: string): void {
    this.tools.delete(name);
    this.toolDescriptions.delete(name);
  }

  // ===== 查询 =====
  get(name: string): Tool | undefined {
    return this.tools.get(name);
  }

  list(): Tool[] {
    return Array.from(this.tools.values());
  }

  // ===== 给 LLM 用的描述 =====
  getToolDescriptions(): string {
    const descriptions: string[] = [];
    for (const [name, description] of this.toolDescriptions) {
      descriptions.push(`## ${name}\n${description}`);
    }
    return descriptions.join("\n\n");
  }

  getToolSchemas(): any[] {
    return Array.from(this.tools.values()).map(tool => ({
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters
    }));
  }

  // ===== 检查 =====
  has(name: string): boolean {
    return this.tools.has(name);
  }

  size(): number {
    return this.tools.size;
  }

  // ===== 清空 =====
  clear(): void {
    this.tools.clear();
    this.toolDescriptions.clear();
  }
}
```

---

## 3. 使用示例

```typescript
// 注册工具
const registry = new ToolRegistry();
registry.register(new FileReadTool());
registry.register(new FileWriteTool());
registry.register(new BashTool());

// 查找工具
const fileTool = registry.get("file_read");
if (fileTool) {
  await fileTool.execute({ path: "./test.txt" });
}

// 列出所有工具
const allTools = registry.list();
console.log("Available tools:", allTools.map(t => t.name));
```

---

## 4. 学习要点

### 4.1 设计目标

- **简单**: 只做注册和查询
- **类型安全**: 完整的 TypeScript 类型
- **可扩展**: 新增工具不需要改代码

### 4.2 扩展点

可以扩展支持:
- 按类别分组工具
- 工具优先级排序
- 工具启用/禁用
- 工具元数据管理

---

## 5. 相关阅读

- [Tool 基类](./01-Tool基类.md)
- [ToolExecutor](./03-ToolExecutor.md)
