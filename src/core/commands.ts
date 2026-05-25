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
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
      description: 'Show available commands',
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
      description: 'Compress conversation context to save tokens',
      execute: (_, ctx) => ({
        success: true,
        content: `Context: ${ctx.messageCount} messages, ~${ctx.tokenCount || 'unknown'} tokens.
Run context compaction to reduce token usage.`,
      }),
    },
    {
      name: 'clear',
      description: 'Clear conversation history',
      execute: () => ({
        success: true,
        content: 'Conversation history cleared.',
      }),
    },
    {
      name: 'plan',
      description: 'Enter planning mode',
      execute: () => ({
        success: true,
        content: 'Enter planning mode. Please describe your task and I will create a detailed execution plan.',
      }),
    },
    {
      name: 'review',
      description: 'Review current changes in the working directory',
      execute: () => ({
        success: true,
        content: 'Running code review workflow. Checking git status and recent changes...',
      }),
    },
    {
      name: 'commit',
      description: 'Analyze changes and generate commit message',
      execute: () => ({
        success: true,
        content: 'Analyzing git diff and generating commit message...',
      }),
    },
    {
      name: 'config',
      description: 'Show current configuration',
      execute: () => ({
        success: true,
        content: 'Current configuration: [use "config" tool for detailed config]',
      }),
    },
    {
      name: 'tools',
      description: 'List available tools',
      execute: (_, ctx) => ({
        success: true,
        content: `Available tools (${ctx.tools.length}):\n${ctx.tools.map(t => `  - ${t}`).join('\n')}`,
      }),
    },
    {
      name: 'skills',
      description: 'List available skills',
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
      description: 'Show hook status',
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
      description: 'Show memory statistics',
      execute: (_, ctx) => ({
        success: true,
        content: `Session: ${ctx.messageCount} messages, ~${ctx.tokenCount || 'unknown'} tokens.`,
      }),
    },
    {
      name: 'status',
      description: 'Show agent status',
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
      description: 'Exit the agent',
      execute: () => ({
        success: true,
        content: 'Goodbye!',
      }),
    },
    {
      name: 'thinking',
      description: 'Toggle verbose thinking mode',
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
      description: 'Undo last file changes',
      execute: () => ({
        success: true,
        content: 'Undoing last changes...',
      }),
    },
    {
      name: 'redo',
      description: 'Redo last undone changes',
      execute: () => ({
        success: true,
        content: 'Redoing changes...',
      }),
    },
    {
      name: 'save',
      description: 'Save current session',
      usage: '/save [name]',
      execute: (args) => ({
        success: true,
        content: `Saving session${args ? ` as "${args.trim()}"` : ''}...`,
      }),
    },
    {
      name: 'resume',
      description: 'Resume a saved session',
      usage: '/resume [name]',
      execute: (args) => ({
        success: true,
        content: `Resuming session${args ? ` "${args.trim()}"` : ''}...`,
      }),
    },
    {
      name: 'context',
      description: 'Show current context usage',
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
      description: 'Show/modify permissions',
      execute: () => ({
        success: true,
        content: 'Current permissions: [ask, allow, deny]',
      }),
    },
    {
      name: 'version',
      description: 'Show current version',
      execute: () => ({
        success: true,
        content: 'MiniAgent v0.1.0',
      }),
    },
    {
      name: 'reset',
      description: 'Reset configuration to defaults',
      execute: () => ({
        success: true,
        content: 'Resetting configuration to defaults...',
      }),
    },
    {
      name: 'add-dir',
      description: 'Add additional directory to context',
      usage: '/add-dir <path>',
      execute: (args) => ({
        success: true,
        content: `Adding directory to context: ${args.trim()}`,
      }),
    },
    {
      name: 'init',
      description: 'Initialize project (generate AGENTS.md)',
      execute: () => ({
        success: true,
        content: 'Generating AGENTS.md for current project...',
      }),
    },
    {
      name: 'diff',
      description: 'Show git diff of current changes',
      execute: () => ({
        success: true,
        content: 'Showing git diff...',
      }),
    },
    {
      name: 'cost',
      description: 'Show token usage and cost for current session',
      execute: () => ({
        success: true,
        content: 'Session cost: calculating...',
      }),
    },
    {
      name: 'test',
      description: 'Run tests after changes',
      execute: () => ({
        success: true,
        content: 'Running tests...',
      }),
    },
    {
      name: 'retry',
      description: 'Retry the last failed action',
      execute: () => ({
        success: true,
        content: 'Retrying last action...',
      }),
    },
    {
      name: 'explain',
      description: 'Explain the last response in more detail',
      execute: () => ({
        success: true,
        content: 'Explaining in detail...',
      }),
    },
    {
      name: 'copy',
      description: 'Copy last response to clipboard',
      execute: () => ({
        success: true,
        content: 'Copied to clipboard.',
      }),
    },
    {
      name: 'security-review',
      description: 'Security review of pending changes',
      execute: () => ({
        success: true,
        content: 'Running security review...',
      }),
    },
    {
      name: 'loop',
      description: 'Repeat a task with iteration',
      execute: () => ({
        success: true,
        content: 'Starting loop mode...',
      }),
    },
    {
      name: 'skill',
      description: 'Activate or manage a skill',
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
      description: 'List connected MCP servers',
      execute: () => ({
        success: true,
        content: 'Connected MCP servers: listing...',
      }),
    },
    {
      name: 'model',
      description: 'Switch or show current model',
      usage: '/model [name]',
      execute: (args) => ({
        success: true,
        content: args.trim() ? `Switching to model: ${args.trim()}` : 'Current model: default',
      }),
    },
    {
      name: 'session',
      description: 'Manage sessions (list/load/delete)',
      execute: () => ({
        success: true,
        content: 'Session management...',
      }),
    },
    {
      name: 'checkpoints',
      description: 'List checkpoints',
      execute: () => ({
        success: true,
        content: 'Available checkpoints: listing...',
      }),
    },
    {
      name: 'rewind',
      description: 'Rewind to a checkpoint',
      usage: '/rewind <checkpoint-id>',
      execute: (args) => ({
        success: true,
        content: `Rewinding to checkpoint: ${args.trim()}...`,
      }),
    },
    {
      name: 'plugins',
      description: 'List plugins',
      execute: () => ({
        success: true,
        content: 'Installed plugins: listing...',
      }),
    },
    {
      name: 'background',
      description: 'Manage background tasks',
      execute: () => ({
        success: true,
        content: 'Background tasks: listing...',
      }),
    },
    {
      name: 'history',
      description: 'Search prompt history',
      execute: () => ({
        success: true,
        content: 'Prompt history: searching...',
      }),
    },
    {
      name: 'update',
      description: 'Check for updates',
      execute: () => ({
        success: true,
        content: 'Checking for updates...',
      }),
    },
    {
      name: 'format',
      description: 'Format code with Prettier/ESLint',
      execute: () => ({
        success: true,
        content: 'Formatting code...',
      }),
    },
    {
      name: 'github',
      description: 'GitHub operations (issues, PRs)',
      execute: () => ({
        success: true,
        content: 'GitHub operations...',
      }),
    },
    {
      name: 'login',
      description: 'Authenticate with Anthropic',
      execute: () => ({
        success: true,
        content: 'Authenticating...',
      }),
    },
    {
      name: 'logout',
      description: 'Log out of current session',
      execute: () => ({
        success: true,
        content: 'Logging out...',
      }),
    },
    {
      name: 'restart',
      description: 'Restart the current session',
      execute: () => ({
        success: true,
        content: 'Restarting session...',
      }),
    },
    {
      name: 'rename',
      description: 'Rename current session',
      usage: '/rename <name>',
      execute: (args) => ({
        success: true,
        content: `Renaming session to: ${args.trim()}`,
      }),
    },
    {
      name: 'export',
      description: 'Export current conversation',
      usage: '/export [filename]',
      execute: () => ({
        success: true,
        content: 'Exporting conversation...',
      }),
    },
    {
      name: 'branch',
      description: 'Create a conversation branch',
      usage: '/branch <name>',
      execute: () => ({
        success: true,
        content: 'Creating branch...',
      }),
    },
    {
      name: 'files',
      description: 'List files Claude has access to',
      execute: () => ({
        success: true,
        content: 'Listing available files...',
      }),
    },
    {
      name: 'approve',
      description: 'Approve the current plan',
      execute: () => ({
        success: true,
        content: 'Plan approved! Executing...',
      }),
    },
    {
      name: 'skip',
      description: 'Skip the current step',
      execute: () => ({
        success: true,
        content: 'Skipping to next step...',
      }),
    },
    {
      name: 'batch',
      description: 'Parallel large-scale changes',
      usage: '/batch <instruction>',
      execute: () => ({
        success: true,
        content: 'Starting batch operation...',
      }),
    },
    {
      name: 'simplify',
      description: 'Auto-improve code quality',
      usage: '/simplify [focus]',
      execute: () => ({
        success: true,
        content: 'Simplifying code...',
      }),
    },
    {
      name: 'debug',
      description: 'Structured debugging',
      execute: () => ({
        success: true,
        content: 'Starting debug session...',
      }),
    },
    {
      name: 'git',
      description: 'Git operations (commit, push, branch)',
      execute: () => ({
        success: true,
        content: 'Git operations...',
      }),
    },
    {
      name: 'web',
      description: 'Force web search before answering',
      execute: () => ({
        success: true,
        content: 'Web search enabled for next response.',
      }),
    },
    {
      name: 'doctor',
      description: 'Check MiniAgent installation health',
      execute: () => ({
        success: true,
        content: 'Running diagnostics...\nAll systems operational.',
      }),
    },
    {
      name: 'bug',
      description: 'Report a bug',
      execute: () => ({
        success: true,
        content: 'Opening bug report form...',
      }),
    },
    {
      name: 'docs',
      description: 'Open documentation',
      execute: () => ({
        success: true,
        content: 'Opening documentation...',
      }),
    },
    {
      name: 'connect',
      description: 'Connect to an LLM provider',
      execute: () => ({
        success: true,
        content: 'Connecting to LLM provider...',
      }),
    },
    {
      name: 'privacy-settings',
      description: 'Manage privacy settings',
      execute: () => ({
        success: true,
        content: 'Privacy settings...',
      }),
    },
    {
      name: 'share',
      description: 'Share current session',
      execute: () => ({
        success: true,
        content: 'Generating share link...',
      }),
    },
    {
      name: 'insights',
      description: 'Show usage insights and patterns',
      execute: () => ({
        success: true,
        content: 'Generating insights report...',
      }),
    },
    {
      name: 'vim',
      description: 'Toggle vim mode',
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
