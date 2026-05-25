# 01 - Skill 基类

> 📅 创建日期: 2026-05-23
> 🎯 难度: ⭐⭐ 进阶级
> ⏱️ 阅读时间: 20 分钟

---

## 1. 概述

Skill 是**预定义的专业能力包**，它把:
- Prompt 模板
- 依赖的 Tools
- 上下文设置
- 激活条件

打包在一起，让 Agent 快速具备某种专业能力。

### 1.1 为什么需要 Skill

```typescript
// 没有 Skill 时：每次都要配置
const agent = new Agent();
agent.addTool(new GitTool());
agent.addTool(new FileReadTool());
agent.setSystemPrompt(`你是一个 Git 专家...`);
agent.chat("帮我提交代码");

// 有 Skill 时：一键激活
agent.addSkill(GitCommitSkill);
agent.chat("帮我提交代码"); // 自动使用 Git 相关能力
```

### 1.2 Skill vs Tool

| 特性 | Tool | Skill |
|------|------|-------|
| **职责** | 单一功能执行 | 专业能力包 |
| **例子** | 文件读取 | Git 提交助手 |
| **粒度** | 细粒度 | 粗粒度 |
| **谁调用** | LLM/Agent | 用户/Agent |

---

## 2. 设计理念

### 2.1 Skill 三要素

```typescript
interface Skill {
  // 1. 基本信息
  name: string;
  description: string;

  // 2. 激活条件
  triggers: string[];  // 触发关键词/正则

  // 3. 能力配置
  tools: Tool[];       // 依赖的工具
  systemPrompt?: string; // 追加的系统提示

  // 4. 生命周期钩子
  onActivate?: (ctx) => void;
  onDeactivate?: (ctx) => void;
}
```

### 2.2 激活机制

```
用户消息: "帮我提交这个代码"
      │
      ▼
检查所有 Skill 的 triggers
      │
      ├─→ GitCommitSkill: "提交" 匹配 ✓
      ├─→ ReadCodeSkill: 不匹配
      └─→ ...
      │
      ▼
激活 GitCommitSkill
      │
      ├─→ 注册依赖的 Tools (Bash, FileRead, Glob)
      ├─→ 追加 System Prompt
      └─→ 调用 onActivate()
      │
      ▼
开始对话
```

---

## 3. 代码结构

### 3.1 BaseSkill 基类

```typescript
// src/skills/base.ts
interface SkillContext {
  agent: Agent;
  cwd: string;
  state: Record<string, any>;
}

abstract class BaseSkill {
  abstract name: string;
  abstract description: string;
  abstract triggers: string[];
  abstract tools: Tool[];
  systemPrompt?: string;

  async onActivate(ctx: SkillContext): Promise<void> {}
  async onDeactivate(ctx: SkillContext): Promise<void> {}
}
```

### 3.2 完整示例: GitCommitSkill

```typescript
// src/skills/git-commit.ts
const GitCommitSkill = new BaseSkill();
GitCommitSkill.name = "git_commit";
GitCommitSkill.description = "智能 Git 提交助手";

GitCommitSkill.triggers = [
  "帮我提交",
  "git commit",
  "提交代码",
  "生成提交信息"
];

GitCommitSkill.tools = [
  new BashTool(),
  new FileReadTool(),
  new GlobTool(),
  new GrepTool()
];

GitCommitSkill.systemPrompt = `
你是一个专业的 Git 提交助手。

## 工作流程

1. 首先运行 git status 查看当前改动
2. 运行 git diff 查看具体改动
3. 分析改动目的和影响
4. 按照 Conventional Commits 规范生成信息

## 提交信息格式

<type>(<scope>): <subject>

<body>

## Type 类型

- feat: 新功能
- fix: 修复 bug
- docs: 文档更新
- style: 代码格式
- refactor: 重构
- perf: 性能优化
- test: 测试
- chore: 构建/工具
`;

GitCommitSkill.onActivate = async (ctx) => {
  // 激活时检查 git 仓库
  const isGit = await exec("git rev-parse --git-dir");
  if (!isGit) {
    throw new Error("不是 Git 仓库！");
  }

  // 保存当前分支到 context
  ctx.state.branch = await exec("git branch --show-current");
};

export { GitCommitSkill };
```

---

## 4. 关键实现细节

### 4.1 Skill 注册表

```typescript
// src/skills/registry.ts
class SkillRegistry {
  private skills: Map<string, BaseSkill> = new Map();
  private activeSkills: Set<string> = new Set();

  register(skill: BaseSkill): void {
    this.skills.set(skill.name, skill);
  }

  async checkAndActivate(
    message: string,
    ctx: SkillContext
  ): Promise<BaseSkill[]> {
    const activated: BaseSkill[] = [];

    for (const [name, skill] of this.skills) {
      // 检查 triggers
      for (const trigger of skill.triggers) {
        if (message.includes(trigger)) {
          await this.activate(skill, ctx);
          activated.push(skill);
          break;
        }
      }
    }

    return activated;
  }

  async activate(skill: BaseSkill, ctx: SkillContext): Promise<void> {
    if (this.activeSkills.has(skill.name)) {
      return;
    }

    // 1. 注册 tools
    for (const tool of skill.tools) {
      ctx.agent.addTool(tool);
    }

    // 2. 调用钩子
    await skill.onActivate(ctx);

    // 3. 标记为激活
    this.activeSkills.add(skill.name);
  }

  async deactivate(skillName: string, ctx: SkillContext): Promise<void> {
    const skill = this.skills.get(skillName);
    if (!skill) return;

    await skill.onDeactivate(ctx);
    this.activeSkills.delete(skillName);
  }
}
```

### 4.2 System Prompt 合并

```typescript
// 当多个 Skill 激活时，系统提示合并策略：
const mergedPrompt = [
  baseSystemPrompt,          // 基础提示
  ...activeSkills.map(s => s.systemPrompt), // Skill 追加的
].join("\n\n---\n\n");
```

---

## 5. 学习要点

### 5.1 如何设计一个好的 Skill

1. **单一职责**: 每个 Skill 只专注一件事
2. **清晰激活**: triggers 要容易触发但不会误触发
3. **工具最小化**: 只依赖真正需要的 Tool
4. **提示明确**: systemPrompt 要具体，不能太泛

### 5.2 Trigger 设计技巧

| 类型 | 例子 | 优点 |
|------|------|------|
| **关键词** | "git commit" | 简单直接 |
| **短语** | "帮我提交" | 自然 |
| **正则** | /git.*commit/ | 灵活 |

### 5.3 常见错误

| 错误 | 原因 | 修复 |
|------|------|------|
| Skill 从不激活 | triggers 太严格 | 放松触发条件 |
| 总是误激活 | triggers 太泛 | 增加关键词 |
| 工具冲突 | 和其他 Skill 依赖同一 Tool | 明确工具归属 |

---

## 6. 相关阅读

- [Skill 注册表](./02-SkillRegistry.md)
- [Tool 基类](../tools/01-Tool基类.md)
- [内置 Skill: ReadCodeSkill](./skills/ReadCodeSkill.md)
- [内置 Skill: GitCommitSkill](./skills/GitCommitSkill.md)
