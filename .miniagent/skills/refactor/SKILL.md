---
name: refactor
description: Use when the user wants to refactor, restructure, or improve existing code without changing behavior. Provides refactoring patterns including extract method, rename, simplify conditionals, reduce nesting, apply SOLID principles, and eliminate code smells. Triggers on code cleanup, refactoring requests, or improving code quality.
allowed-tools: file_read, file_write, glob, grep, bash
disallowedTools:
  - web_search
triggers:
  - 重构
  - refactor
  - 优化代码
  - improve code
  - 清理代码
  - clean up code
  - 代码优化
  - code cleanup
  - 提取函数
  - 简化这个代码
---

# Refactor Skill

Code refactoring following established patterns and principles.

## When to Refactor

- Code is hard to understand
- Code is duplicated (DRY violation)
- Function is too long (>30 lines)
- Too many parameters (>4)
- Deep nesting (>3 levels)
- Tight coupling between modules
- Tests are hard to write

## Refactoring Catalog

### Extract Method

**Before:**
```typescript
function processOrder(order: Order) {
  const total = order.items.reduce((sum, item) => sum + item.price * item.qty, 0);
  const tax = total * 0.1;
  const discount = total > 100 ? total * 0.05 : 0;
  const final = total + tax - discount;
  // ... more logic
}
```

**After:**
```typescript
function processOrder(order: Order) {
  const subtotal = calculateSubtotal(order.items);
  const tax = calculateTax(subtotal);
  const discount = calculateDiscount(subtotal);
  return subtotal + tax - discount;
}

function calculateSubtotal(items: Item[]): number {
  return items.reduce((sum, item) => sum + item.price * item.qty, 0);
}
```

### Replace Conditional with Polymorphism

**Before:**
```typescript
function getArea(shape: Shape): number {
  if (shape.type === 'circle') return Math.PI * shape.radius ** 2;
  if (shape.type === 'rectangle') return shape.width * shape.height;
  if (shape.type === 'triangle') return 0.5 * shape.base * shape.height;
}
```

**After:**
```typescript
interface Shape { getArea(): number; }
class Circle implements Shape { getArea() { return Math.PI * this.radius ** 2; } }
class Rectangle implements Shape { getArea() { return this.width * this.height; } }
```

### Reduce Nesting (Guard Clauses)

**Before:**
```typescript
function process(user: User) {
  if (user) {
    if (user.isActive) {
      if (user.hasPermission) {
        // do work
      }
    }
  }
}
```

**After:**
```typescript
function process(user: User) {
  if (!user) return;
  if (!user.isActive) return;
  if (!user.hasPermission) return;
  // do work
}
```

## Refactoring Checklist

- [ ] Behavior unchanged (tests pass)
- [ ] Code is easier to read
- [ ] Duplicated code eliminated
- [ ] Functions are focused and short
- [ ] Naming is clear and intention-revealing
- [ ] No deep nesting
- [ ] No unnecessary comments (code should be self-documenting)
- [ ] SOLID principles applied where appropriate

## SOLID Principles

| Principle | Meaning | Check |
|-----------|---------|-------|
| Single Responsibility | One reason to change | Each class/module does one thing |
| Open/Closed | Open for extension, closed for modification | Use interfaces, not if-else chains |
| Liskov Substitution | Subtypes must be substitutable | No instanceof checks in subclasses |
| Interface Segregation | Small, specific interfaces | No fat interfaces with unused methods |
| Dependency Inversion | Depend on abstractions | Use dependency injection |
