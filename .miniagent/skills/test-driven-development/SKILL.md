---
name: test-driven-development
description: Use when the user wants to write tests using Test-Driven Development methodology, create test suites for existing code, or follow TDD workflow for feature development. Provides TDD cycle (Red-Green-Refactor) with testing best practices. Triggers on test writing, TDD, unit testing, integration testing requests.
allowed-tools: file_read, file_write, glob, grep, bash
disallowedTools:
  - web_search
triggers:
  - 测试驱动开发
  - TDD
  - 写测试
  - unit test
  - integration test
  - test-driven
  - 编写测试
  - 测试这个函数
---

# Test-Driven Development Skill

TDD workflow following the Red-Green-Refactor cycle.

## TDD Cycle

```
RED → GREEN → REFACTOR → Repeat
```

### Step 1: RED - Write a Failing Test

Write the smallest test that expresses desired behavior:
- Test should fail because the code doesn't exist yet
- Test name should describe the behavior, not the implementation
- One assertion per test when possible

```typescript
describe('calculateTotal', () => {
  it('should return 0 for empty cart', () => {
    expect(calculateTotal([])).toBe(0);
  });
});
```

### Step 2: GREEN - Make It Pass

Write minimal code to make the test pass:
- Do the simplest thing that could possibly work
- Don't anticipate future requirements
- If it feels dirty, the test is telling you something

```typescript
function calculateTotal(items: any[]): number {
  return 0;
}
```

### Step 3: REFACTOR - Improve the Code

Clean up code while keeping all tests green:
- Remove duplication
- Improve naming
- Extract functions/classes
- Improve structure

## Test Categories

| Category | Purpose | Example |
|----------|---------|---------|
| Unit | Single function/class in isolation | `calculateTotal()` with mock data |
| Integration | Multiple components working together | API endpoint + database |
| E2E | Full user journey through the system | Login → Browse → Checkout |

## Testing Guidelines

### DO
- Name tests as specifications: `should return sorted array`
- Use Arrange-Act-Assert pattern
- Mock external dependencies (DB, network, filesystem)
- Test behavior, not implementation details
- Keep tests fast and independent

### DON'T
- Don't test trivial getters/setters
- Don't test third-party libraries
- Don't write tests that depend on execution order
- Don't have multiple assertions testing different things
- Don't leave failing tests in the codebase

## Test Structure (AAA Pattern)

```typescript
it('should filter inactive users', () => {
  // Arrange
  const users = [
    { name: 'Alice', active: true },
    { name: 'Bob', active: false },
  ];

  // Act
  const result = filterActiveUsers(users);

  // Assert
  expect(result).toEqual([{ name: 'Alice', active: true }]);
});
```
