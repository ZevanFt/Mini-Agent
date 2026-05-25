---
name: read-code
description: Use when the user wants to analyze, understand, or review code in a project. Provides structured code reading workflow with dependency analysis, pattern identification, and comprehension summaries.
allowed-tools: file_read, glob, grep, bash
disallowedTools:
  - file_write
  - web_search
triggers:
  - 分析代码
  - 阅读代码
  - 代码结构
  - 代码审查
  - 依赖分析
  - 调用关系
  - 理解代码
---

# Read Code Skill

专业的代码阅读助手，帮助理解和分析代码。

## 核心能力

1. **结构化阅读** - 按照入口→依赖→核心逻辑的顺序阅读
2. **依赖分析** - 绘制模块间的调用关系
3. **模式识别** - 识别设计模式和代码异味
4. **摘要生成** - 为复杂模块生成理解摘要

## 工作流程

### 第一步：了解项目结构

```bash
ls -la
find . -name "*.ts" -o -name "*.js" | head -20
cat package.json 2>/dev/null || cat Cargo.toml 2>/dev/null
```

### 第二步：定位入口文件

常见入口：
- TypeScript/JavaScript: `index.ts`, `main.ts`, `app.ts`, `src/index.ts`
- Python: `main.py`, `__init__.py`, `app.py`
- Go: `main.go`, `cmd/`
- Rust: `main.rs`, `lib.rs`

### 第三步：阅读核心代码

按照以下顺序阅读：
1. **入口文件** - 了解程序启动流程
2. **配置文件** - 了解项目设置和依赖
3. **核心模块** - 按照调用链逐层阅读
4. **工具函数** - 了解辅助逻辑

### 第四步：分析总结

输出以下信息：
- **架构概览** - 模块分层（MVC/Clean/等）
- **核心流程** - 主要功能的调用链
- **关键类型** - 核心数据结构和接口
- **外部依赖** - 使用的第三方库
- **设计模式** - 使用的模式（单例/工厂/观察者等）

## 代码分析维度

### 复杂度分析
- 函数长度超过 50 行标记为"需要重构"
- 嵌套超过 3 层标记为"复杂逻辑"
- 参数超过 4 个标记为"建议简化"

### 代码质量
- 缺少类型注解
- 未处理的错误
- 硬编码值
- 重复代码

### 安全检查
- SQL 注入风险
- XSS 风险
- 路径遍历
- 敏感信息泄露

## 输出模板

```
## 📋 模块: <模块名>

### 架构
- 分层: <MVC / Clean / 等>
- 模块数: <数量>
- 总行数: <数量>

### 核心流程
1. <步骤1>
2. <步骤2>
3. <步骤3>

### 关键类型
- `TypeName`: <简要说明>

### 依赖
- 内部: <模块列表>
- 外部: <库列表>

### 建议
- ⚠️ <改进建议>
```

## 阅读技巧

- **自顶向下**: 先理解整体架构，再深入细节
- **追踪调用链**: 从一个入口点追踪完整的执行流程
- **关注接口**: 接口定义了模块的契约，是理解的关键
- **忽略实现细节**: 第一遍阅读时不要陷入具体实现的细节
