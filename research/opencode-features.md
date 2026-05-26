# OpenCode 完整功能调研 — 对标 MiniAgent Web UI

> 基于 OpenCode (sst/opencode) 真实源码分析
> 来源：packages/app (SolidJS 主应用，TUI 界面)

---

## 一、技术栈

| 层级 | 技术 |
|------|------|
| 框架 | SolidJS (非 React，非 Vue) |
| UI 组件 | Kobalte (Solid 版 Headless UI) + TailwindCSS |
| 状态 | `createStore` (Solid 原生) |
| 数据查询 | TanStack Query (solid-query) |
| 路由 | Solid Router |
| 代码高亮 | Shiki |
| Markdown | Marked + Marked-Shiki |
| 国际化 | @solid-primitives/i18n，20+ 语言 |
| 构建 | Vite |
| 运行时 | Bun |

---

## 二、OpenCode 完整功能清单

### 1️⃣ 对话/消息层
| 组件 | 功能 |
|------|------|
| Message Timeline | 消息时间线（按时间排序的消息流） |
| Session Tabs | 多会话并行切换（Tab 式） |
| Session Composer | 输入框组件（支持 @文件引用、拖拽图片、Slash 命令） |
| Follow-up Dock | 追问面板 |
| Permission Dock | 权限确认面板 |
| Request Tree | 请求树可视化（展示每次请求-响应的层级关系） |
| Revert Dock | 回滚面板 |
| Todo Dock | TODO 面板（进度条、复选框、删除线） |
| Review Tab | 审查面板（代码审查） |
| Terminal Panel | 内嵌终端面板 |
| File Tabs | 文件编辑 Tab 页 |

### 2️⃣ 模型/Provider 层
| 组件 | 功能 |
|------|------|
| Dialog Select Model | 模型选择弹窗（搜索、按 Provider 分组、按热度排序） |
| Dialog Select Provider | Provider 选择 |
| Dialog Custom Provider | 自定义 Provider 配置（API Key, Base URL） |
| Model Tooltip | 模型信息浮窗（Context 限制、价格、是否最新） |
| Dialog Manage Models | 模型管理 |
| Popular Providers | 热门 Provider 优先排序 |
| Model Cost Display | 模型费用显示（免费/付费标签） |

### 3️⃣ 用量/监控层
| 组件 | 功能 |
|------|------|
| Session Context Usage | **会话用量展示**（核心！） |
| Session Context Metrics | 用量指标计算 |
| Context Progress Circle | 环形进度条（已用/总量） |
| Context Tab | Context 详情 Tab |
| Usage Exceeded Dialog | 用量超限弹窗 |

**Context Metrics 数据结构（真实代码）：**
```typescript
type Context = {
  input: number         // 输入 Token
  output: number        // 输出 Token
  reasoning: number     // 推理 Token
  cacheRead: number     // 缓存读取 Token
  cacheWrite: number    // 缓存写入 Token
  total: number         // 总 Token
  usage: number         // 使用率（已用/限制 * 100%）
  limit: number         // Context 窗口上限
}
```

### 4️⃣ 文件/项目层
| 组件 | 功能 |
|------|------|
| File Tree | 文件树（展开/折叠、文件图标、Git 状态标记） |
| File Tabs | 打开的文件 Tab 页 |
| File Content Cache | 文件内容缓存 |
| File Watcher | 文件系统监听（自动同步） |
| Diff View | Diff 预览 |
| Inline Editor | 行内编辑器 |
| @ File Reference | 消息中 @ 引用文件 |
| Image Attachments | 拖拽上传图片 |

### 5️ 侧边栏/导航
| 组件 | 功能 |
|------|------|
| Sidebar Workspace | 工作区切换 |
| Sidebar Project | 项目信息 |
| Sidebar Items | 导航项 |
| Sidebar Shell | 侧边栏外壳 |
| Layout System | 面板布局系统（可拖拽调整） |
| Titlebar | 标题栏（会话历史、当前模型） |

### 6️⃣ 设置层
| 组件 | 功能 |
|------|------|
| Settings General | 通用设置（主题、语言） |
| Settings Models | 模型设置 |
| Settings Providers | Provider 设置（API Key、URL） |
| Settings Keybinds | 快捷键 |

### 7️⃣ 权限/安全
| 组件 | 功能 |
|------|------|
| Permission Auto Respond | 自动响应（记住选择） |
| Permission Panel | 权限确认面板（逐条确认） |

### 8️⃣ 其他功能
| 功能 | 说明 |
|------|------|
| Session Fork | 会话分支（分叉出新的会话副本） |
| Release Notes Dialog | 更新日志 |
| Sound Notifications | 声音通知 |
| Debug Bar | 调试栏 |
| MCP Selection Dialog | MCP 服务器选择 |
| Server Selection Dialog | 后端服务器选择 |
| Status Popover | 状态弹窗 |

---

## 三、MiniAgent 当前 Web UI 对标情况

### ✅ 已实现（但简陋）
- 基础聊天面板
- 会话列表/创建/切换
- 基础设置弹窗
- 模型选择（硬编码下拉框，温度滑块）
- 主题切换（暗色/亮色）
- i18n（中英双语）

### ❌ 完全缺失
| 功能 | 重要性 |
|------|--------|
| **🔴 模型用量面板**（Token 统计、Context 使用率、环形进度条） | ⭐⭐⭐⭐⭐ |
| **🔴 文件树侧边栏**（文件浏览、Diff 预览、@ 引用） | ⭐⭐⭐⭐ |
| **🔴 Todo/任务面板**（任务进度、完成状态） | ⭐⭐⭐ |
| **🟡 模型参数可视化**（top_p, frequency_penalty, 预设方案） | ⭐⭐⭐ |
| **🟡 从 Ollama 动态拉取模型列表**（不是硬编码） | ⭐⭐⭐⭐ |
| ** 工具调用可视化**（工具执行链、进度、结果） | ⭐⭐⭐⭐ |
| **🟡 终端面板**（内嵌终端输出） | ⭐⭐⭐ |
| **🟠 多标签页布局**（文件 Tab、终端 Tab） | ⭐⭐⭐ |
| **🟠 会话分叉** | ⭐⭐ |
| **🟠 快捷键配置** | ⭐⭐ |

---

## 四、建议实施优先级

**第一梯队（先生最关心的）：**
1. 模型用量面板（Token 统计 + Context 使用率 + 环形进度条）
2. 文件树侧边栏
3. Todo/任务面板

**第二梯队：**
4. 工具调用可视化（执行链展示）
5. 模型参数可视化（更多参数 + 预设方案）
6. 从 Ollama 动态拉取模型列表

**第三梯队：**
7. 终端面板
8. 多标签页布局
9. 会话分叉

---

## 五、关键数据点

- OpenCode app 包 **79 个组件文件**（仅 packages/app/src/components）
- 页面布局 **30+ 文件**
- Context/状态管理 **40+ 文件**
- 总计 SolidJS 前端约 **300+ TSX 文件**

MiniAgent 当前 Web UI 只有 3 个文件（index.html, style.css, app.js）— 差距在 **100 倍**。
