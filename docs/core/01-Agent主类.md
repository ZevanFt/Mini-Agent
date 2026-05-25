# 01 - Agent 主类

> 📅 创建日期: 2026-05-23
> 🎯 难度: ⭐⭐ 进阶级
> ⏱️ 阅读时间: 20 分钟

---

## 1. 概述

`Agent` 是整个框架的**主入口类**，它把所有组件粘合在一起。

```typescript
// 使用示例
const agent = new Agent({
  llm: new OllamaAdapter({ model: "qwen2:0.5b" }),
  cwd: process.cwd()
});

agent.addTool(new FileReadTool());
agent.addSkill(GitCommitSkill);

// 开始聊天
for await (const chunk of agent.chat("帮我看看当前目录")) {
  if (chunk.type === "content") {
    process.stdout.write(chunk.content);
  }
}
```

---

## 2. 代码结构

### 2.1 完整类定义

```typescript
// src/core/agent.ts
import { QueryLoop } from "./query-loop";
import { ToolRegistry } from "../tools/registry";
import { SkillRegistry } from "../skills/registry";
import { MemoryManager } from "../memory";

interface AgentConfig {
  llm: LLMAdapter;
  cwd: string;
  configPath?: string;
  verbose?: boolean;
}

class Agent {
  private queryLoop: QueryLoop;
  private toolRegistry: ToolRegistry;
  private skillRegistry: SkillRegistry;
  private memory: MemoryManager;
  private config: AgentConfig;

  constructor(config: AgentConfig) {
    this.config = config;

    // 初始化各个组件
    this.toolRegistry = new ToolRegistry();
    this.skillRegistry = new SkillRegistry();
    this.memory = new MemoryManager(config.cwd);
    this.queryLoop = new QueryLoop({
      llm: config.llm,
      tools: this.toolRegistry,
      skills: this.skillRegistry,
      memory: this.memory,
      cwd: config.cwd
    });

    // 加载默认配置
    this.loadDefaultTools();
    this.loadDefaultSkills();
  }

  // ===== Tool 管理 =====
  addTool(tool: Tool): void {
    this.toolRegistry.register(tool);
  }

  removeTool(toolName: string): void {
    this.toolRegistry.unregister(toolName);
  }

  listTools(): Tool[] {
    return this.toolRegistry.list();
  }

  // ===== Skill 管理 =====
  addSkill(skill: Skill): void {
    this.skillRegistry.register(skill);
  }

  removeSkill(skillName: string): void {
    this.skillRegistry.unregister(skillName);
  }

  listSkills(): Skill[] {
    return this.skillRegistry.list();
  }

  // ===== 主方法 =====
  async *chat(message: string): AsyncGenerator<Chunk> {
    // 检查 Skill 激活
    await this.skillRegistry.checkAndActivate(message, {
      agent: this,
      cwd: this.config.cwd
    });

    // 运行 QueryLoop
    yield* this.queryLoop.run(message);
  }

  async run(prompt: string): Promise<string> {
    // 单次执行（非流式）
    let result = "";
    for await (const chunk of this.chat(prompt)) {
      if (chunk.type === "content") {
        result += chunk.content;
      }
    }
    return result;
  }

  // ===== 内部方法 =====
  private loadDefaultTools(): void {
    // 内置工具
    this.addTool(new FileReadTool());
    this.addTool(new FileWriteTool());
    this.addTool(new GlobTool());
    this.addTool(new GrepTool());
    this.addTool(new BashTool());
    this.addTool(new WebFetchTool());
    this.addTool(new TodoWriteTool());
    this.addTool(new AskUserQuestionTool());
  }

  private loadDefaultSkills(): void {
    // 内置技能
    this.addSkill(GitCommitSkill);
    this.addSkill(ReadCodeSkill);
    this.addSkill(SearchFilesSkill);
  }

  // ===== 状态管理 =====
  reset(): void {
    this.memory.clear();
    this.queryLoop.reset();
  }

  getState(): AgentState {
    return {
      tools: this.toolRegistry.list(),
      skills: this.skillRegistry.list(),
      memory: this.memory.getState()
    };
  }
}
```

---

## 3. 学习要点

### 3.1 职责明确

`Agent` 类本身不做复杂逻辑，它只负责：
- 组合各个组件
- 提供用户友好的接口
- 管理生命周期

### 3.2 依赖注入

所有依赖都通过构造函数传入，方便测试和扩展：
```typescript
// 测试时可以用 Mock 的 LLM
const mockLLM = new MockLLM();
const agent = new Agent({ llm: mockLLM, cwd: "/test" });
```

---

## 4. 相关阅读

- [QueryLoop](./02-QueryLoop.md)
- [Tool 注册表](../tools/02-ToolRegistry.md)
- [Skill 注册表](../skills/02-SkillRegistry.md)
- [Memory 系统](../memory/01-三层记忆架构.md)
