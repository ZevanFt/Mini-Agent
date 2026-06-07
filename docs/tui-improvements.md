# TUI 改进计划

> 状态：待开发（优先级：低，排在其他核心问题之后）
> 
> 创建时间：2026-05-31
> 
> 最后更新：2026-05-31

---

## 目标

让 TUI（Terminal UI）的交互体验接近 Web 界面，实现真正的终端版 MiniAgent 体验。

---

## 问题清单

### 第一阶段：核心功能（让 TUI 能用）

#### 1. 发送消息后显示 AI 回复
- **现状**：用户发完消息后看不到 AI 回复，消息发送后无输出渲染
- **目标**：实现完整的消息收发流程，用户消息 → AI 流式响应 → 消息显示
- **涉及文件**：`src/tui/MiniAgentTUI.tsx`
- **参考 Web 实现**：`web/src/components/ChatArea.tsx`（消息气泡渲染）

#### 2. 会话历史列表
- **现状**：没有会话管理，每次打开都是全新开始
- **目标**：左侧或底部显示最近会话列表，支持切换/新建/删除
- **参考 Web 实现**：`web/src/components/Sidebar.tsx` + `web/src/hooks/useSessions.ts`

#### 3. 命令历史（上下键翻历史）
- **现状**：不支持命令历史
- **目标**：按 ↑ 翻阅之前发送的消息，按 ↓ 返回当前输入
- **技术要点**：维护 `commandHistory: string[]` 数组和 `historyIndex: number` 指针

#### 4. 消息渲染区分
- **现状**：定义了 `Message` 类型（`role: 'user' | 'assistant'`，`type: 'thought' | 'tool' | 'code' | 'text'`）但没实现渲染
- **目标**：
  - 用户消息：用特定标记（如 `>` 前缀或颜色）区分
  - AI 消息：正常显示
  - 思考过程：折叠/展开，灰色文字
  - 工具调用：显示工具名和参数
  - 代码块：语法高亮（或终端能支持的方式）

---

### 第二阶段：体验提升

#### 5. 斜杠命令完整菜单
- **现状**：`ctrl+p` 只显示有限的斜杠命令
- **目标**：显示所有 20+ 个斜杠命令，支持过滤搜索
- **命令列表**：
  - `/help`, `/quit`, `/clear`, `/compact`, `/model`, `/new`
  - `/plan`, `/build`, `/diff`, `/search`, `/review`, `/commit`
  - `/mcp`, `/health`, `/tools`, 以及更多自定义命令
- **参考实现**：`web/src/components/CommandPalette.tsx`（如果存在）或 `cli.ts` 中的命令定义

#### 6. 模式切换可视化
- **现状**：Build/Plan 模式切换只显示在底部小字
- **目标**：更明显的模式指示（颜色、边框、图标等）
- **建议**：Build 模式用绿色/蓝色，Plan 模式用橙色/黄色

#### 7. 工具调用过程显示
- **现状**：用户看不到 Agent 在做什么
- **目标**：实时显示工具调用过程（类似 Web 的 tool call bubble）
- **显示内容**：
  - 工具名称（如 `FileRead`）
  - 工具参数（如 `path: "src/main.ts"`）
  - 执行结果摘要（成功/失败，耗时）

#### 8. 思考过程折叠/展开
- **现状**：无
- **目标**：Agent 的思考过程（`<thinking>` 标签内容）默认折叠，可按需展开
- **终端实现**：用 `...` 或 `[展开]` 提示符，按回车展开

---

### 第三阶段：高级功能

#### 9. 多会话管理
- **目标**：
  - 新建会话：`/new` 或快捷键
  - 切换会话：列表选择
  - 删除会话：确认对话框
  - 会话持久化：保存/加载
- **参考 Web 实现**：`web/src/hooks/useSessions.ts`

#### 10. 设置界面
- **目标**：TUI 版的 SettingsModal
- **设置项**：
  - 主题（暗色/亮色/跟随系统）→ TUI 颜色主题
  - 模型（切换 LLM 模型）
  - 语言（中文/英文）
  - 字体大小（终端字体大小，可能受限）
- **打开方式**：快捷键或斜杠命令 `/settings`

#### 11. 项目选择器
- **目标**：TUI 版 Project Picker
- **功能**：选择/切换工作目录
- **打开方式**：快捷键或斜杠命令

#### 12. Token 用量显示
- **目标**：底部状态栏显示 Token 用量（输入/输出/总计）
- **数据来源**：Agent 的 `usage` 统计
- **参考 Web 实现**：`web/src/App.tsx` 底部 `status-bar`

---

### 已知限制（非代码问题）

#### A. 终端原生限制
1. **IME 候选框位置**：中文输入法的候选框通常在下方，这是 Windows 终端的已知限制，无法通过代码解决
2. **光标闪烁**：终端原生光标闪烁由终端模拟器控制，代码只能模拟（当前用 530ms 定时器切换 `█`/空格）
3. **中文显示宽度**：中文字符占 2 格但 `string.length` 返回 1，需用 `getStringWidth()` 手动计算

#### B. Ink 框架限制
1. **无原生输入框**：Ink 的 `useInput` 只能捕获键盘事件，没有原生 `<input>` 组件
2. **布局限制**：不支持百分比宽度、flex 嵌套复杂场景
3. **样式有限**：只有颜色、粗体、斜体、下划线、删除线，无 CSS 样式
4. **无法复用 Web 组件**：Web 的 React 组件依赖 DOM 和 CSS，无法直接复用于 Ink

---

## 技术要点

### 当前 TUI 架构
```
src/tui/
├── index.ts          # 入口，alternate screen buffer 设置
└── MiniAgentTUI.tsx  # 主界面组件
```

### 输入框当前状态
- 宽度计算：`inputBoxWidth = termWidth * 0.35`
- 文本截断：`truncateByWidth()` 处理 CJK 字符宽度
- 光标：模拟闪烁（530ms 定时器）
- 边框：`borderStyle="single"` 有溢出问题（待修复）
- 退格：使用 `key.backspace` 检测
- 自动换行：基于显示宽度的递归处理

### 需要添加的核心状态
```typescript
// 消息历史
const [messages, setMessages] = useState<Message[]>([]);

// 命令历史
const [commandHistory, setCommandHistory] = useState<string[]>([]);
const [historyIndex, setHistoryIndex] = useState(-1);

// 流式响应
const [currentResponse, setCurrentResponse] = useState('');
const [isStreaming, setIsStreaming] = useState(false);

// 会话管理
const [sessions, setSessions] = useState<Session[]>([]);
const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
```

---

## 开发建议

1. **先跑通核心流程**：发送消息 → 显示 AI 回复，这是最重要的
2. **消息渲染优先**：用户消息和 AI 消息区分显示
3. **逐步迭代**：不要一次性实现所有功能
4. **测试驱动**：每完成一个功能就测试

## 参考文档

- [Ink 官方文档](https://github.com/vadimdemedes/ink)
- [Web 界面实现](../web/src/)
- [CLI 斜杠命令定义](../src/core/commands.ts)

---

*本文档由用户要求创建，记录 TUI 所有待改进内容，避免遗忘。*
*优先级：低，排在其他核心问题之后。*
