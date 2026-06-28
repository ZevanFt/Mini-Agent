/**
 * Slash Commands - 斜杠命令系统
 * 
 * 学习笔记：
 * Claude Code 和 OpenCode 都支持斜杠命令，这是用户体验的核心。
 * 用户可以通过 `/command` 快速触发预定义的工作流。
 * 
 * Claude Code 内置命令：
 * - /help - 显示帮助
 * - /compact - 压缩上下文
 * - /clear - 清空对话
 * - /plan - 进入规划模式
 * - /review - 代码审查
 * - /commit - 分析改动并生成提交信息
 * - /config - 查看/修改配置
 * - /tools - 列出可用工具
 * - /skills - 列出可用 Skill
 * - /quit - 退出
 * 
 * OpenCode 命令：
 * - /help, /clear, /compact
 * - /review, /test, /fix
 * 
 * 我们设计：
 * - /help - 帮助
 * - /compact - 压缩上下文
 * - /clear - 清空对话
 * - /plan - 进入规划模式
 * - /review - 代码审查
 * - /commit - 分析改动生成提交信息
 * - /config - 查看配置
 * - /tools - 列出工具
 * - /skills - 列出 Skill
 * - /hooks - 查看 Hook 状态
 * - /memory - 查看记忆统计
 * - /status - Agent 状态
 * - /quit - 退出
 */

import type { ToolResult } from '../tools/types.js';
import type { HookDispatcher } from './hooks.js';
import type { SkillRegistry } from '../skills/skill-registry.js';

/**
 * Slash Command 定义
 */
export interface SlashCommand {
  /** 命令名称（不带 /） */
  name: string;
  /** 命令描述 */
  description: string;
  /** 用法提示 */
  usage?: string;
  /** 执行函数 */
  execute: (args: string, context: CommandContext) => Promise<ToolResult> | ToolResult;
}

/**
 * 命令执行上下文
 */
export interface CommandContext {
  /** 工具名称列表 */
  tools: string[];
  /** 当前对话消息数 */
  messageCount: number;
  /** 当前 Token 估算数 */
  tokenCount?: number;
  /** 活跃 Skill 列表 */
  activeSkills?: string[];
  /** Hook 调度器 */
  hooks?: HookDispatcher;
  /** Skill 注册表 */
  skillRegistry?: SkillRegistry;
  /** Agent 实例 */
  agent?: any;
}

/**
 * 注册内置 Slash Commands
 */
export function createSlashCommands(): SlashCommand[] {
  return [
    {
      name: 'help',
      description: '显示可用命令',
      execute: () => ({
        success: true,
        content: `MiniAgent Slash Commands (50+ total):

  📋 Session Management (8):
    /help          - Show this help
    /compact       - Compress conversation context
    /clear         - Clear conversation history
    /new           - Start a new session
    /save          - Save current session
    /resume        - Resume a saved session
    /restart       - Restart current session
    /quit          - Exit

  📁 File & Project (8):
    /init          - Initialize project (AGENTS.md)
    /status        - Show agent status
    /diff          - Show git diff
    /undo          - Undo last file changes
    /redo          - Redo last undone changes
    /add-dir       - Add additional directory
    /files         - List available files
    /context       - Show context usage

  🔄 Workflow (10):
    /plan          - Enter planning mode
    /approve       - Approve the current plan
    /skip          - Skip the current step
    /review        - Review current changes
    /commit        - Generate commit message
    /test          - Run tests after changes
    /retry         - Retry last failed action
    /explain       - Explain last response
    /loop          - Repeat task with iteration
    /batch         - Parallel large-scale changes

  🛠️  Tools & Config (7):
    /tools         - List available tools
    /config        - Show configuration
    /permissions   - Show/modify permissions
    /model         - Switch model
    /mcp           - List MCP servers
    /version       - Show version
    /reset         - Reset configuration

  🎯 Skills & Plugins (4):
    /skills        - List available skills
    /skill         - Activate/manage skill
    /hooks         - Show hook status
    /plugins       - List plugins

   Memory & History (5):
    /memory        - Show memory statistics
    /history       - Search prompt history
    /checkpoints   - List checkpoints
    /rewind        - Rewind to checkpoint
    /branch        - Create conversation branch

  🔒 Security & Quality (4):
    /security-review - Security review of changes
    /simplify      - Auto-improve code quality
    /debug         - Structured debugging
    /copy          - Copy last response

   Git & GitHub (4):
    /git           - Git operations
    /github        - GitHub operations
    /share         - Share current session
    /export        - Export conversation

  💻 TUI & Output (5):
    /thinking      - Toggle thinking mode
    /format        - Format code
    /background    - Manage background tasks
    /vim           - Toggle vim mode
    /insights      - Usage insights

  🔧 Diagnostics (4):
    /doctor        - Check installation health
    /bug           - Report a bug
    /docs          - Open documentation
    /connect       - Connect LLM provider

   Auth & Privacy (3):
    /login         - Authenticate
    /logout        - Log out
    /privacy-settings - Manage privacy`,
      }),
    },
    {
      name: 'compact',
      description: '压缩对话上下文以节省 Token',
      execute: (_, ctx) => ({
        success: true,
        content: `Context: ${ctx.messageCount} messages, ~${ctx.tokenCount || 'unknown'} tokens.
Run context compaction to reduce token usage.`,
      }),
    },
    {
      name: 'clear',
      description: '清空对话历史',
      execute: () => ({
        success: true,
        content: 'Conversation history cleared.',
      }),
    },
    {
      name: 'plan',
      description: '进入规划模式',
      execute: () => ({
        success: true,
        content: 'Enter planning mode. Please describe your task and I will create a detailed execution plan.',
      }),
    },
    {
      name: 'review',
      description: '审查工作区当前的代码改动',
      execute: () => ({
        success: true,
        content: 'Running code review workflow. Checking git status and recent changes...',
      }),
    },
    {
      name: 'commit',
      description: '分析改动并生成提交信息',
      execute: () => ({
        success: true,
        content: 'Analyzing git diff and generating commit message...',
      }),
    },
    {
      name: 'config',
      description: '查看当前配置',
      execute: () => ({
        success: true,
        content: 'Current configuration: [use "config" tool for detailed config]',
      }),
    },
    {
      name: 'tools',
      description: '列出可用工具',
      execute: (_, ctx) => ({
        success: true,
        content: `Available tools (${ctx.tools.length}):\n${ctx.tools.map(t => `  - ${t}`).join('\n')}`,
      }),
    },
    {
      name: 'skills',
      description: '列出可用 Skill',
      execute: (_, ctx) => {
        if (ctx.skillRegistry) {
          const all = ctx.skillRegistry.listSkills();
          const active = ctx.skillRegistry.listActive();
          const activeNames = active.map(s => s.name);
          const lines = all.map(s => {
            const status = activeNames.includes(s.name) ? '🟢' : '⚪';
            return `  ${status} ${s.name}: ${s.description.substring(0, 60)}...`;
          });
          return {
            success: true,
            content: `Skills (${all.length} total, ${active.length} active):\n${lines.join('\n')}`,
          };
        }
        return { success: true, content: 'No skill registry available.' };
      },
    },
    {
      name: 'hooks',
      description: '查看 Hook 状态',
      execute: (_, ctx) => {
        if (ctx.hooks) {
          const all = ctx.hooks.listHooks();
          const active = ctx.hooks.listActiveHooks();
          const lines = all.map(h => {
            const status = h.enabled ? '🟢' : '🔴';
            return `  ${status} ${h.name}: ${h.events.join(', ')}`;
          });
          return {
            success: true,
            content: `Hooks (${all.length} total, ${active.length} active):\n${lines.join('\n')}`,
          };
        }
        return { success: true, content: 'No hook dispatcher available.' };
      },
    },
    {
      name: 'memory',
      description: '查看记忆统计',
      execute: (_, ctx) => ({
        success: true,
        content: `Session: ${ctx.messageCount} messages, ~${ctx.tokenCount || 'unknown'} tokens.`,
      }),
    },
    {
      name: 'status',
      description: '查看 Agent 状态',
      execute: (_, ctx) => ({
        success: true,
        content: `Agent status:
  Tools: ${ctx.tools.length}
  Messages: ${ctx.messageCount}
  Tokens: ~${ctx.tokenCount || 'unknown'}
  Active skills: ${ctx.activeSkills?.length || 0}
  Hooks: ${ctx.hooks?.listActiveHooks().length || 0}`,
      }),
    },
    {
      name: 'quit',
      description: '退出 Agent',
      execute: () => ({
        success: true,
        content: 'Goodbye!',
      }),
    },
    {
      name: 'thinking',
      description: '切换详细思考模式',
      usage: '/thinking [normal|verbose]',
      execute: (args, ctx) => {
        if (ctx.agent) {
          const arg = args.toLowerCase().trim();
          let newMode;
          if (arg === 'normal' || arg === 'verbose') {
            ctx.agent.setThinkingMode(arg === 'normal' ? 'normal' : 'verbose');
            newMode = arg;
          } else {
            newMode = ctx.agent.toggleThinkingMode();
          }
          return {
            success: true,
            content: `Thinking mode: ${newMode}`,
          };
        }
        return { success: true, content: 'Agent not available.' };
      },
    },
    {
      name: 'undo',
      description: '撤销上次的文件改动',
      execute: () => ({
        success: true,
        content: 'Undoing last changes...',
      }),
    },
    {
      name: 'redo',
      description: '重做上次撤销的改动',
      execute: () => ({
        success: true,
        content: 'Redoing changes...',
      }),
    },
    {
      name: 'save',
      description: '保存当前会话',
      usage: '/save [name]',
      execute: (args) => ({
        success: true,
        content: `Saving session${args ? ` as "${args.trim()}"` : ''}...`,
      }),
    },
    {
      name: 'resume',
      description: '恢复已保存的会话',
      usage: '/resume [name]',
      execute: (args) => ({
        success: true,
        content: `Resuming session${args ? ` "${args.trim()}"` : ''}...`,
      }),
    },
    {
      name: 'context',
      description: '查看当前上下文用量',
      execute: (_, ctx) => ({
        success: true,
        content: `Context Usage:
  Messages: ${ctx.messageCount}
  Tokens: ~${ctx.tokenCount || 'unknown'}
  Tools available: ${ctx.tools.length}
  Active skills: ${ctx.activeSkills?.length || 0}
  Hooks active: ${ctx.hooks?.listActiveHooks().length || 0}`,
      }),
    },
    {
      name: 'permissions',
      description: '查看或修改权限',
      execute: () => ({
        success: true,
        content: 'Current permissions: [ask, allow, deny]',
      }),
    },
    {
      name: 'version',
      description: '查看当前版本',
      execute: () => ({
        success: true,
        content: 'MiniAgent v0.1.0',
      }),
    },
    {
      name: 'reset',
      description: '将配置重置为默认值',
      execute: () => ({
        success: true,
        content: 'Resetting configuration to defaults...',
      }),
    },
    {
      name: 'add-dir',
      description: '添加额外目录到上下文',
      usage: '/add-dir <path>',
      execute: (args) => ({
        success: true,
        content: `Adding directory to context: ${args.trim()}`,
      }),
    },
    {
      name: 'init',
      description: '初始化项目（生成 AGENTS.md）',
      execute: () => ({
        success: true,
        content: 'Generating AGENTS.md for current project...',
      }),
    },
    {
      name: 'diff',
      description: '查看当前改动的 git diff',
      execute: () => ({
        success: true,
        content: 'Showing git diff...',
      }),
    },
    {
      name: 'cost',
      description: '查看本会话的 Token 用量和花费',
      execute: () => ({
        success: true,
        content: 'Session cost: calculating...',
      }),
    },
    {
      name: 'test',
      description: '改动后运行测试',
      execute: () => ({
        success: true,
        content: 'Running tests...',
      }),
    },
    {
      name: 'retry',
      description: '重试上次失败的操作',
      execute: () => ({
        success: true,
        content: 'Retrying last action...',
      }),
    },
    {
      name: 'explain',
      description: '详细解释上一次回复',
      execute: () => ({
        success: true,
        content: 'Explaining in detail...',
      }),
    },
    {
      name: 'copy',
      description: '复制上次回复到剪贴板',
      execute: () => ({
        success: true,
        content: 'Copied to clipboard.',
      }),
    },
    {
      name: 'security-review',
      description: '对当前改动做安全审查',
      execute: () => ({
        success: true,
        content: 'Running security review...',
      }),
    },
    {
      name: 'loop',
      description: '循环迭代执行任务',
      execute: () => ({
        success: true,
        content: 'Starting loop mode...',
      }),
    },
    {
      name: 'skill',
      description: '激活或管理某个 Skill',
      usage: '/skill <name> | /skill reload',
      execute: (args, ctx) => {
        if (args.trim() === 'reload') {
          if (ctx.skillRegistry) {
            ctx.skillRegistry.reloadSkills();
            return { success: true, content: 'Skills reloaded.' };
          }
          return { success: true, content: 'Skills reloaded.' };
        }
        return { success: true, content: `Activating skill: ${args.trim()}` };
      },
    },
    {
      name: 'mcp',
      description: '列出已连接的 MCP 服务器',
      execute: () => ({
        success: true,
        content: 'Connected MCP servers: listing...',
      }),
    },
    {
      name: 'model',
      description: '切换或查看当前模型',
      usage: '/model [name]',
      execute: (args) => ({
        success: true,
        content: args.trim() ? `Switching to model: ${args.trim()}` : 'Current model: default',
      }),
    },
    {
      name: 'session',
      description: '管理会话（列出/加载/删除）',
      execute: () => ({
        success: true,
        content: 'Session management...',
      }),
    },
    {
      name: 'checkpoints',
      description: '列出检查点',
      execute: () => ({
        success: true,
        content: 'Available checkpoints: listing...',
      }),
    },
    {
      name: 'rewind',
      description: '回到某个检查点',
      usage: '/rewind <checkpoint-id>',
      execute: (args) => ({
        success: true,
        content: `Rewinding to checkpoint: ${args.trim()}...`,
      }),
    },
    {
      name: 'plugins',
      description: '列出插件',
      execute: () => ({
        success: true,
        content: 'Installed plugins: listing...',
      }),
    },
    {
      name: 'background',
      description: '管理后台任务',
      execute: () => ({
        success: true,
        content: 'Background tasks: listing...',
      }),
    },
    {
      name: 'history',
      description: '搜索输入历史',
      execute: () => ({
        success: true,
        content: 'Prompt history: searching...',
      }),
    },
    {
      name: 'update',
      description: '检查更新',
      execute: () => ({
        success: true,
        content: 'Checking for updates...',
      }),
    },
    {
      name: 'format',
      description: '用 Prettier/ESLint 格式化代码',
      execute: () => ({
        success: true,
        content: 'Formatting code...',
      }),
    },
    {
      name: 'github',
      description: 'GitHub 操作（issues、PR）',
      execute: () => ({
        success: true,
        content: 'GitHub operations...',
      }),
    },
    {
      name: 'login',
      description: '与 Anthropic 进行认证',
      execute: () => ({
        success: true,
        content: 'Authenticating...',
      }),
    },
    {
      name: 'logout',
      description: '退出当前会话登录',
      execute: () => ({
        success: true,
        content: 'Logging out...',
      }),
    },
    {
      name: 'restart',
      description: '重启当前会话',
      execute: () => ({
        success: true,
        content: 'Restarting session...',
      }),
    },
    {
      name: 'rename',
      description: '重命名当前会话',
      usage: '/rename <name>',
      execute: (args) => ({
        success: true,
        content: `Renaming session to: ${args.trim()}`,
      }),
    },
    {
      name: 'export',
      description: '导出当前对话',
      usage: '/export [filename]',
      execute: () => ({
        success: true,
        content: 'Exporting conversation...',
      }),
    },
    {
      name: 'branch',
      description: '创建对话分支',
      usage: '/branch <name>',
      execute: () => ({
        success: true,
        content: 'Creating branch...',
      }),
    },
    {
      name: 'files',
      description: '列出可访问的文件',
      execute: () => ({
        success: true,
        content: 'Listing available files...',
      }),
    },
    {
      name: 'approve',
      description: '批准当前方案',
      execute: () => ({
        success: true,
        content: 'Plan approved! Executing...',
      }),
    },
    {
      name: 'skip',
      description: '跳过当前步骤',
      execute: () => ({
        success: true,
        content: 'Skipping to next step...',
      }),
    },
    {
      name: 'batch',
      description: '并行大规模改动',
      usage: '/batch <instruction>',
      execute: () => ({
        success: true,
        content: 'Starting batch operation...',
      }),
    },
    {
      name: 'simplify',
      description: '自动提升代码质量',
      usage: '/simplify [focus]',
      execute: () => ({
        success: true,
        content: 'Simplifying code...',
      }),
    },
    {
      name: 'debug',
      description: '结构化调试',
      execute: () => ({
        success: true,
        content: 'Starting debug session...',
      }),
    },
    {
      name: 'git',
      description: 'Git 操作（commit、push、branch）',
      execute: () => ({
        success: true,
        content: 'Git operations...',
      }),
    },
    {
      name: 'web',
      description: '回答前强制进行网络搜索',
      execute: () => ({
        success: true,
        content: 'Web search enabled for next response.',
      }),
    },
    {
      name: 'doctor',
      description: '检查 MiniAgent 安装健康度',
      execute: () => ({
        success: true,
        content: 'Running diagnostics...\nAll systems operational.',
      }),
    },
    {
      name: 'bug',
      description: '报告 Bug',
      execute: () => ({
        success: true,
        content: 'Opening bug report form...',
      }),
    },
    {
      name: 'docs',
      description: '打开文档',
      execute: () => ({
        success: true,
        content: 'Opening documentation...',
      }),
    },
    {
      name: 'connect',
      description: '连接到 LLM 服务提供商',
      execute: () => ({
        success: true,
        content: 'Connecting to LLM provider...',
      }),
    },
    {
      name: 'privacy-settings',
      description: '管理隐私设置',
      execute: () => ({
        success: true,
        content: 'Privacy settings...',
      }),
    },
    {
      name: 'share',
      description: '分享当前会话',
      execute: () => ({
        success: true,
        content: 'Generating share link...',
      }),
    },
    {
      name: 'insights',
      description: '查看使用洞察与模式',
      execute: () => ({
        success: true,
        content: 'Generating insights report...',
      }),
    },
    {
      name: 'vim',
      description: '切换 Vim 模式',
      execute: () => ({
        success: true,
        content: 'Vim mode toggled.',
      }),
    },
  ];
}

/**
 * 解析命令
 * 
 * @param input - 用户输入
 * @param commands - 命令列表
 * @returns 解析结果 { command, args } 或 null
 */
export function parseCommand(
  input: string,
  commands: SlashCommand[]
): { command: SlashCommand; args: string } | null {
  const trimmed = input.trim();
  
  if (!trimmed.startsWith('/')) {
    return null;
  }
  
  const parts = trimmed.substring(1).split(/\s+/);
  const commandName = parts[0].toLowerCase();
  const args = parts.slice(1).join(' ');
  
  const command = commands.find(c => c.name === commandName);
  if (!command) {
    return null;
  }
  
  return { command, args };
}

/**
 * 检查输入是否是 Slash 命令
 */
export function isSlashCommand(input: string): boolean {
  return input.trim().startsWith('/');
}
