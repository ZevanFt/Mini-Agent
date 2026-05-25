/**
 * Plan Mode Tools - 规划模式工具
 * 
 * 提供两个工具：
 * 1. enter_plan_mode - 进入规划模式
 * 2. exit_plan_mode - 退出规划模式
 * 
 * 学习笔记：
 * Claude Code 中，当 Agent 认为用户的请求需要详细规划时，
 * 会主动调用 enter_plan_mode 工具，向用户展示执行计划。
 * 
 * 用户可以选择：
 * - 批准计划 → Agent 按计划执行
 * - 修改计划 → Agent 重新生成
 * - 拒绝计划 → Agent 取消操作
 * 
 * exit_plan_mode 用于在执行过程中退出规划模式，
 * 回到普通的对话模式。
 */

import type { Tool, ToolResult, ToolProperty } from '../tools/types.js';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function _unusedPlanModeManagerTypeCheck(): void {
  // PlanModeManager may not exist; these types are for reference only
  type _PlanModeState = string;
  type _PlanModeManager = unknown;
}

interface PlanStep {
  description: string;
  tools?: string[];
}

interface EnterPlanModeParams {
  title: string;
  steps: PlanStep[];
  risks?: string[];
}

interface ExitPlanModeParams {
  reason: string;
  summary?: string;
}

/**
 * 创建 EnterPlanMode 工具
 * 
 * 让 Agent 可以主动进入规划模式
 * 需要传入 manager 实例来操作规划状态
 */
export function createEnterPlanModeTool(manager: unknown): Tool {
  return {
    name: 'enter_plan_mode',
    description: `Enter planning mode to create a detailed execution plan.

Use this when:
- The user's request is complex and requires multiple steps
- You need to modify multiple files or make significant changes
- You want user approval before proceeding with risky operations
- The task involves creating a new feature or refactoring

The plan will be shown to the user for review before execution.`,

    parameters: {
      type: 'object',
      properties: {
        title: {
          type: 'string',
          description: 'Short title for the plan (e.g., "Add user authentication")',
        },
        steps: {
          type: 'array',
          description: 'List of execution steps',
          items: {
            type: 'object' as ToolProperty['type'],
            description: 'A step in the plan',
          },
        },
        risks: {
          type: 'array',
          description: 'Potential risks or concerns',
          items: { type: 'string' },
        },
      },
      required: ['title', 'steps'],
    },

    async execute(params: Record<string, unknown>): Promise<ToolResult> {
      const p = params as unknown as EnterPlanModeParams;
      try {
        const plan = (manager as any).getPlan?.();
        if (plan) {
          return {
            success: true,
            content: `已进入规划模式。\n\n计划: ${plan.title}\n\n${(manager as any).formatPlanText?.() ?? ''}\n\n等待用户批准...`,
          };
        }

        return {
          success: false,
          content: '无法进入规划模式：没有活跃的计划。',
        };
      } catch (error) {
        return {
          success: false,
          content: `进入规划模式失败: ${error instanceof Error ? error.message : String(error)}`,
        };
      }
    },
  };
}

/**
 * 创建 ExitPlanMode 工具
 * 
 * 让 Agent 可以退出规划模式
 */
export function createExitPlanModeTool(manager: unknown): Tool {
  return {
    name: 'exit_plan_mode',
    description: `Exit planning mode and return to normal conversation.

Use this when:
- The plan has been completed
- The user has rejected the plan
- You want to switch back to normal conversation mode
- The plan execution encountered an error and needs user input`,

    parameters: {
      type: 'object',
      properties: {
        reason: {
          type: 'string',
          description: 'Reason for exiting plan mode (e.g., "Plan completed", "User rejected", "Error occurred")',
        },
        summary: {
          type: 'string',
          description: 'Brief summary of what was accomplished or what went wrong',
        },
      },
      required: ['reason'],
    },

    async execute(params: Record<string, unknown>): Promise<ToolResult> {
      const p = params as unknown as ExitPlanModeParams;
      try {
        const currentState = (manager as any).getState?.();
        (manager as any).reset?.();

        const summaryText = p.summary ? `\n\n摘要: ${p.summary}` : '';

        return {
          success: true,
          content: `已退出规划模式。原因: ${p.reason}${summaryText}\n当前状态: ${currentState ?? 'unknown'}`,
        };
      } catch (error) {
        return {
          success: false,
          content: `退出规划模式失败: ${error instanceof Error ? error.message : String(error)}`,
        };
      }
    },
  };
}

/**
 * 创建所有规划模式工具
 * 
 * 便捷函数，一次性返回所有 Plan Mode 工具
 */
export function createPlanModeTools(manager: unknown): Tool[] {
  return [
    createEnterPlanModeTool(manager),
    createExitPlanModeTool(manager),
  ];
}
