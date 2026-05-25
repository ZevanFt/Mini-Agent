---
name: code-review
description: Use when the user wants to review code for quality, bugs, best practices, or style issues. Provides structured code review workflow with checklist covering correctness, readability, security, and performance. Triggers on code review requests, pull request reviews, or when asked to check code quality.
allowed-tools: file_read, glob, grep, bash
disallowedTools:
  - file_write
  - web_search
triggers:
  - 代码审查
  - 代码评审
  - review code
  - code review
  - pull request review
  - 检查代码质量
  - 审查这个代码
  - review my code
---

# Code Review Skill

Structured code review following industry best practices.

## Review Checklist

### Correctness
- [ ] Logic handles all edge cases (null, empty, boundary values)
- [ ] No off-by-one errors or race conditions
- [ ] Error handling is comprehensive and appropriate
- [ ] No unreachable code or dead branches

### Readability
- [ ] Naming is clear and intention-revealing
- [ ] Functions are focused and under 30 lines
- [ ] Comments explain "why", not "what"
- [ ] Code follows project style conventions

### Architecture
- [ ] Proper separation of concerns
- [ ] No circular dependencies
- [ ] Follows established patterns (SOLID, DRY, KISS)
- [ ] No inappropriate coupling

### Performance
- [ ] No unnecessary allocations or copies
- [ ] Loop complexity is reasonable
- [ ] Database queries use indexes
- [ ] No memory leaks or resource leaks

### Security
- [ ] No hardcoded secrets or credentials
- [ ] Input validation on all external data
- [ ] No SQL injection or XSS vectors
- [ ] Proper authentication and authorization

## Review Process

1. Read the changed files to understand the purpose
2. Run `git diff` to see exact changes
3. Review against the checklist above
4. Categorize findings:
   - **Critical** - Must fix before merge
   - **Warning** - Should fix, but not blocking
   - **Suggestion** - Nice to have
5. Output structured review report

## Report Template

```
## Code Review Report

### Overview
- Files reviewed: N
- Critical issues: N
- Warnings: N
- Suggestions: N

### Critical Issues
1. [file:line] Issue description

### Warnings
1. [file:line] Issue description

### Suggestions
1. [file:line] Issue description

### Overall Assessment
[Brief summary of code quality and readiness]
```

## Review Guidelines

- Be specific: reference exact file:line
- Be constructive: explain impact, not just problem
- Be balanced: note good patterns too
- Be focused: review only changed files
- Be actionable: provide concrete fix suggestions
