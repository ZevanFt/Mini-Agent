---
name: git-commit
description: Use when the user wants to commit code changes, generate conventional commit messages, analyze git diffs, or needs help with git workflow. Provides intelligent commit message generation following Conventional Commits (Angular) specification.
allowed-tools: bash, file_read, glob, grep
disallowedTools:
  - file_write
  - web_search
triggers:
  - 提交
  - git commit
  - 提交代码
  - 生成提交信息
  - 分析改动
  - git diff
---

# Git Commit Skill

专业的 Git 提交助手，基于 Claude Code 的 git-commit skill 设计。

## 核心能力

1. **智能分析** - 自动分析 git diff 理解改动意图
2. **规范生成** - 按照 Conventional Commits 规范生成提交信息
3. **质量检查** - 检测大文件、密钥泄露等常见问题

## 工作流程

### 第一步：查看改动

```bash
git status --short
git diff --stat
```

### 第二步：分析具体改动

```bash
git diff
```

### 第三步：生成提交信息

根据改动内容，按照以下规范生成：

#### Conventional Commits 格式

```
<type>(<scope>): <subject>

<body>

<footer>
```

#### Type 类型

| Type | 说明 | 示例 |
|------|------|------|
| `feat` | 新功能 | `feat(auth): add login endpoint` |
| `fix` | 修复 bug | `fix(parser): handle null values` |
| `docs` | 文档更新 | `docs(api): update endpoint descriptions` |
| `style` | 代码格式 | `style: fix indentation in utils.ts` |
| `refactor` | 重构 | `refactor(auth): simplify token logic` |
| `perf` | 性能优化 | `perf: reduce memory usage in parser` |
| `test` | 测试 | `test(auth): add login flow tests` |
| `chore` | 构建/工具 | `chore: update dependencies` |

#### 提交信息规则

- **subject**: 不超过 50 字符，使用祈使句（"add" 而非 "added"）
- **body**: 解释"为什么"而非"是什么"，可选
- **footer**: BREAKING CHANGE 或关联 Issue，可选

### 第四步：执行提交

```bash
git add -A
git commit -m "<生成的提交信息>"
```

## 质量检查清单

在提交前检查：
- [ ] 是否包含敏感信息（密钥、密码、token）
- [ ] 是否有不应该提交的大文件（>100KB）
- [ ] 是否有未使用的调试代码（console.log, debugger）
- [ ] 是否应该拆分提交（多个不相关的改动）

## 常见场景处理

**只修改了一个文件**：
```
feat(utils): add formatNumber function
```

**修改了多个相关文件**：
```
feat(auth): implement JWT token refresh

- Add refresh token endpoint
- Update token validation logic
- Add tests for refresh flow
```

**修复 bug**：
```
fix(parser): handle empty input gracefully

The parser crashed when given an empty string.
Now returns a default empty result instead.

Fixes #123
```

**重构代码**：
```
refactor(db): extract query builder from repository

Extract the query building logic into a separate
module to reduce repository complexity.
```
