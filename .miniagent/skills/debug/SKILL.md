---
name: debug
description: Use when the user needs to debug errors, investigate unexpected behavior, or troubleshoot issues in code. Provides systematic debugging workflow with log analysis, stack trace interpretation, hypothesis testing, and root cause identification. Triggers on error fixing, bug investigation, troubleshooting requests.
allowed-tools: file_read, glob, grep, bash
disallowedTools:
  - file_write
triggers:
  - 调试
  - debug
  - 修复错误
  - fix error
  - 排查问题
  - troubleshoot
  - 为什么报错
  - investigate bug
  - 这个报错了
  - something is broken
---

# Debug Skill

Systematic debugging workflow for finding and fixing issues.

## Debug Workflow

```
1. Reproduce → 2. Observe → 3. Hypothesize → 4. Test → 5. Fix → 6. Verify
```

### Step 1: Reproduce the Issue

Understand exactly what's happening:
- What is the expected behavior?
- What is the actual behavior?
- What steps reproduce the issue?
- Is it consistent or intermittent?

### Step 2: Observe and Collect Evidence

```bash
# Read error logs
cat error.log | tail -50

# Check recent changes
git log --oneline -10
git diff HEAD~5

# Run with verbose output
DEBUG=* npm start
```

### Step 3: Form a Hypothesis

Based on evidence, identify likely causes:
- **Stack traces**: Where did the error originate?
- **Recent changes**: What changed that could cause this?
- **Edge cases**: Is this a boundary condition?
- **Dependencies**: Did a library update cause this?

### Step 4: Test the Hypothesis

```bash
# Isolate the issue
grep -rn "error message" src/

# Add logging
console.log('DEBUG: variable =', variable);

# Test minimal reproduction
node -e "const fn = require('./src'); fn.testCase();"
```

### Step 5: Fix the Root Cause

- Fix the underlying issue, not the symptom
- Consider the fix's impact on other code paths
- Add tests to prevent regression

### Step 6: Verify the Fix

- Original reproduction case now works
- Existing tests still pass
- No new issues introduced

## Common Error Patterns

### TypeError: Cannot read property of undefined
```
Cause: Missing null check
Fix: Add optional chaining or null check
Example: obj?.prop instead of obj.prop
```

### Module not found / Import error
```
Cause: Wrong path, missing dependency, or typo
Fix: Verify import path, run npm install, check spelling
```

### Timeout / Connection refused
```
Cause: Service down, wrong port, network issue
Fix: Check service status, verify port, test connectivity
```

### Memory leak / High memory usage
```
Cause: Unclosed connections, growing arrays, event listeners
Fix: Close resources, use WeakMap, remove listeners
```

## Debugging Tools

| Tool | Purpose | Command |
|------|---------|---------|
| Stack trace | Find error origin | Look at first user-code line |
| git bisect | Find introducing commit | `git bisect start` |
| Console.log | Trace execution | Strategic placement |
| Debugger | Step-through | `node --inspect` |
| Logs | Historical context | `tail -f logs/*.log` |
