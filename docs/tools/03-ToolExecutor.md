# 03 - ToolExecutor

> 📅 创建日期: 2026-05-23
> 🎯 难度: ⭐⭐ 进阶级
> ⏱️ 阅读时间: 20 分钟

---

## 1. 概述

ToolExecutor 是**工具的安全执行器**，负责:
- 参数验证
- 权限检查
- 并发执行
- 错误处理
- 结果格式化

---

## 2. 代码结构

```typescript
// src/tools/executor.ts
import { PermissionSystem } from "./permissions";

class ToolExecutor {
  private permissionSystem: PermissionSystem;
  private concurrentExecutions: number = 0;
  private maxConcurrent: number = 5;

  constructor(permissionSystem: PermissionSystem) {
    this.permissionSystem = permissionSystem;
  }

  async execute(
    tool: Tool,
    params: any,
    options: ExecuteOptions
  ): Promise<ToolResult> {
    // 1. 验证参数
    const paramErrors = this.validateParams(tool.parameters, params);
    if (paramErrors.length > 0) {
      return {
        success: false,
        error: "INVALID_PARAMS",
        message: paramErrors.join(", ")
      };
    }

    // 2. 权限检查
    const allowed = await this.permissionSystem.check(tool.name, params);
    if (!allowed) {
      if (options.askUser) {
        const confirmed = await this.askUserConfirm(tool, params);
        if (!confirmed) {
          return {
            success: false,
            error: "PERMISSION_DENIED",
            message: "用户拒绝了此操作"
          };
        }
      } else {
        return {
          success: false,
          error: "PERMISSION_DENIED",
          message: "权限不足"
        };
      }
    }

    // 3. 并发控制
    while (this.concurrentExecutions >= this.maxConcurrent) {
      await this.sleep(100);
    }
    this.concurrentExecutions++;

    try {
      // 4. 执行 Tool
      const result = await tool.execute(params);

      // 5. 返回结果
      return {
        success: true,
        result
      };
    } catch (error) {
      return {
        success: false,
        error: "EXECUTION_FAILED",
        message: error.message
      };
    } finally {
      this.concurrentExecutions--;
    }
  }

  async executeBatch(
    calls: ToolCall[]
  ): Promise<PromiseSettledResult<ToolResult>[]> {
    return await Promise.allSettled(
      calls.map(call =>
        this.execute(call.tool, call.parameters, { askUser: true })
      )
    );
  }

  private validateParams(schema: JSONSchema, params: any): string[] {
    const errors: string[] = [];

    // 必填字段检查
    for (const required of schema.required || []) {
      if (!(required in params)) {
        errors.push(`缺少必填字段: ${required}`);
      }
    }

    // 类型检查
    for (const [key, prop] of Object.entries(schema.properties || {})) {
      if (key in params) {
        const expectedType = prop.type;
        const actualType = typeof params[key];

        if (expectedType !== actualType && expectedType !== "array") {
          errors.push(`${key} 类型错误，期望 ${expectedType}`);
        }

        if (expectedType === "array" && !Array.isArray(params[key])) {
          errors.push(`${key} 应该是数组`);
        }
      }
    }

    return errors;
  }

  private async askUserConfirm(tool: Tool, params: any): Promise<boolean> {
    // 询问用户确认
    console.log(`\n⚠️  即将执行 ${tool.name}:`);
    console.log(`参数:`, JSON.stringify(params, null, 2));

    const readline = require("readline").createInterface({
      input: process.stdin,
      output: process.stdout
    });

    const answer = await new Promise(resolve => {
      readline.question("\n确认执行? (y/n) ", resolve);
    });

    readline.close();
    return answer.toLowerCase().startsWith("y");
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
```

---

## 3. 学习要点

### 3.1 安全优先

执行顺序很重要:
1. 参数验证
2. 权限检查
3. 用户确认
4. 执行

### 3.2 并发控制

防止同时执行太多 Tool 导致系统过载。

---

## 4. 相关阅读

- [权限系统](./04-权限系统.md)
- [Tool 基类](./01-Tool基类.md)
