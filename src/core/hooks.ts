/**
 * Hooks 系统 - 生命周期事件钩子
 * 
 * 学习笔记：
 * Claude Code 的 Hooks 系统是其最强大的扩展机制之一。
 * 在 Agent 运行的关键生命周期点触发回调，允许：
 * - 自动执行检查/审计
 * - 记录工具调用
 * - 播放通知声音
 * - 自动 git commit
 * - 安全审计
 * 
 * 事件类型（13 种）：
 * 1. SessionStart - 会话开始
 * 2. SessionEnd - 会话结束
 * 3. UserPromptSubmit - 用户提交 prompt 前
 * 4. PreToolUse - 工具执行前（可阻止）
 * 5. PostToolUse - 工具执行后
 * 6. PermissionRequest - 权限请求
 * 7. SubagentStart - 子 Agent 启动
 * 8. SubagentStop - 子 Agent 停止
 * 9. PreCompact - 上下文压缩前
 * 10. TaskCompleted - 任务完成
 * 11. ConfigChange - 配置变更
 * 12. Stop - Agent 停止
 * 13. Notification - 通知事件
 * 
 * 架构：
 * Agent 生命周期 ─▶ HookDispatcher ─▶ 注册的 Hook 处理器
 */

/**
 * Hook 事件类型
 */
export type HookEvent =
  | 'session_start'
  | 'session_end'
  | 'user_prompt_submit'
  | 'pre_tool_use'
  | 'post_tool_use'
  | 'permission_request'
  | 'subagent_start'
  | 'subagent_stop'
  | 'pre_compact'
  | 'task_completed'
  | 'config_change'
  | 'stop'
  | 'notification';

/**
 * Hook 回调函数
 */
export type HookHandler = (payload: HookPayload) => HookResult | Promise<HookResult>;

/**
 * Hook 结果
 */
export interface HookResult {
  /** 是否阻止后续操作（仅 pre_tool_use 有效） */
  blocked?: boolean;
  /** 阻止原因 */
  reason?: string;
  /** 额外信息 */
  message?: string;
}

/**
 * Hook 负载（事件数据）
 */
export interface HookPayload {
  /** 事件类型 */
  event: HookEvent;
  /** 时间戳 */
  timestamp: Date;
  /** 工具名称（工具相关事件） */
  toolName?: string;
  /** 工具参数（工具相关事件） */
  toolParams?: Record<string, unknown>;
  /** 工具执行结果（post_tool_use 事件） */
  toolResult?: {
    success: boolean;
    content?: string;
    error?: string;
  };
  /** 用户 prompt（user_prompt_submit 事件） */
  userPrompt?: string;
  /** 子 Agent 名称（子 Agent 相关事件） */
  subagentName?: string;
  /** 会话 ID */
  sessionId?: string;
  /** 自定义数据 */
  [key: string]: unknown;
}

/**
 * Hook 定义
 */
export interface HookDefinition {
  /** 唯一名称 */
  name: string;
  /** 描述 */
  description?: string;
  /** 触发的事件类型 */
  events: HookEvent[];
  /** 回调函数 */
  handler: HookHandler;
  /** 是否启用 */
  enabled: boolean;
  /** 优先级（数字越小越先执行） */
  priority: number;
}

/**
 * Hook 调度器
 * 
 * 管理所有注册的 Hook，在生命周期点触发
 */
export class HookDispatcher {
  private hooks: HookDefinition[] = [];
  private sessionId: string;

  constructor(sessionId: string = `session_${Date.now()}`) {
    this.sessionId = sessionId;
  }

  /**
   * 注册 Hook
   */
  register(hook: HookDefinition): void {
    this.hooks.push(hook);
    // 按优先级排序
    this.hooks.sort((a, b) => a.priority - b.priority);
  }

  /**
   * 注销 Hook
   */
  unregister(name: string): boolean {
    const index = this.hooks.findIndex(h => h.name === name);
    if (index !== -1) {
      this.hooks.splice(index, 1);
      return true;
    }
    return false;
  }

  /**
   * 启用/禁用 Hook
   */
  setEnabled(name: string, enabled: boolean): void {
    const hook = this.hooks.find(h => h.name === name);
    if (hook) {
      hook.enabled = enabled;
    }
  }

  /**
   * 列出所有 Hook
   */
  listHooks(): HookDefinition[] {
    return [...this.hooks];
  }

  /**
   * 列出已启用的 Hook
   */
  listActiveHooks(): HookDefinition[] {
    return this.hooks.filter(h => h.enabled);
  }

  /**
   * 触发事件
   * 
   * @param event - 事件类型
   * @param payload - 事件数据
   * @returns 是否有 Hook 阻止了操作
   */
  async fire(event: HookEvent, payload: Partial<HookPayload> = {}): Promise<{ blocked: boolean; results: HookResult[] }> {
    const fullPayload: HookPayload = {
      event,
      timestamp: new Date(),
      sessionId: this.sessionId,
      ...payload,
    };

    const results: HookResult[] = [];
    let blocked = false;

    for (const hook of this.hooks) {
      if (!hook.enabled) continue;
      if (!hook.events.includes(event)) continue;

      try {
        const result = await hook.handler(fullPayload);
        results.push(result);
        if (result.blocked) {
          blocked = true;
        }
      } catch (error) {
        results.push({
          blocked: false,
          message: `Hook '${hook.name}' error: ${error instanceof Error ? error.message : String(error)}`,
        });
      }
    }

    return { blocked, results };
  }

  /**
   * 清除所有 Hook
   */
  clear(): void {
    this.hooks = [];
  }
}

/**
 * 内置 Hook 工厂函数
 * 快速创建常用的 Hook
 */

/**
 * 创建工具调用日志 Hook
 * 记录每次工具调用的名称和参数
 */
export function createToolLogHook(): HookDefinition {
  return {
    name: 'tool_log',
    description: 'Log all tool calls to console',
    events: ['pre_tool_use', 'post_tool_use'],
    handler: (payload) => {
      const tool = payload.toolName || 'unknown';
      if (payload.event === 'pre_tool_use') {
        console.log(`[Hook] 🔧 Calling: ${tool}`);
      } else if (payload.event === 'post_tool_use') {
        const success = payload.toolResult?.success ? '✅' : '❌';
        console.log(`[Hook] ${success} ${tool} completed`);
      }
      return {};
    },
    enabled: true,
    priority: 100,
  };
}

/**
 * 创建安全审计 Hook
 * 在执行危险命令前阻止
 */
export function createSecurityAuditHook(): HookDefinition {
  const dangerousPatterns = ['rm -rf /', ':(){ :|:& };:', 'dd if=/dev/zero'];
  
  return {
    name: 'security_audit',
    description: 'Block dangerous commands',
    events: ['pre_tool_use'],
    handler: (payload) => {
      if (payload.toolName === 'bash' && typeof payload.toolParams?.command === 'string') {
        const cmd = payload.toolParams.command.toLowerCase();
        for (const pattern of dangerousPatterns) {
          if (cmd.includes(pattern.toLowerCase())) {
            return { blocked: true, reason: `Blocked dangerous command: ${payload.toolParams.command}` };
          }
        }
      }
      return {};
    },
    enabled: true,
    priority: 1, // 最高优先级
  };
}

/**
 * 创建会话计时 Hook
 * 记录会话持续时间
 */
export function createSessionTimerHook(): HookDefinition {
  let startTime: Date | null = null;

  return {
    name: 'session_timer',
    description: 'Track session duration',
    events: ['session_start', 'session_end'],
    handler: (payload) => {
      if (payload.event === 'session_start') {
        startTime = new Date();
        return { message: `Session started at ${startTime.toLocaleTimeString()}` };
      } else if (payload.event === 'session_end' && startTime) {
        const duration = (Date.now() - startTime.getTime()) / 1000;
        return { message: `Session lasted ${duration.toFixed(1)}s` };
      }
      return {};
    },
    enabled: true,
    priority: 50,
  };
}
