/**
 * Plan Mode - 规划模式
 * 
 * 学习笔记：
 * Plan Mode 是 Claude Code 的核心功能之一。当用户提出复杂的开发请求时，
 * Agent 不会直接执行，而是先制定详细的计划，让用户审查和批准后再执行。
 * 
 * 这样做的好处：
 * 1. 让用户了解 Agent 的意图，避免"黑盒"操作
 * 2. 用户可以修改计划、添加约束
 * 3. 防止 Agent 做危险操作（如大量文件修改）
 * 4. 提高复杂任务的成功率
 * 
 * 工作流程：
 * 1. 用户请求 → Agent 进入 Plan Mode
 * 2. Agent 分析请求，生成执行计划
 * 3. 展示计划给用户，等待批准
 * 4. 用户批准后，按计划逐步执行
 * 5. 执行过程中可以随时修改计划
 */

/**
 * 计划状态枚举
 */
export enum PlanModeState {
  /** 未激活规划模式 */
  IDLE = 'idle',
  /** 正在生成计划 */
  PLANNING = 'planning',
  /** 计划已生成，等待用户审查 */
  REVIEWING = 'reviewing',
  /** 计划已批准，可以执行 */
  APPROVED = 'approved',
  /** 正在执行计划 */
  EXECUTING = 'executing',
  /** 计划执行完成 */
  COMPLETED = 'completed',
  /** 计划已拒绝 */
  REJECTED = 'rejected',
}

/**
 * 计划步骤状态
 */
export type PlanStepStatus = 'pending' | 'in_progress' | 'completed' | 'skipped' | 'failed';

/**
 * 计划步骤
 * 
 * 每个步骤包含：
 * - 描述：这一步要做什么
 * - 工具列表：需要用到哪些工具
 * - 预估 Token：这一步大概消耗多少 Token
 * - 状态：当前执行情况
 * - 结果：执行后的输出
 */
export interface PlanStep {
  /** 步骤 ID */
  id: string;
  /** 步骤顺序号 */
  order: number;
  /** 步骤描述（不超过 50 字） */
  description: string;
  /** 需要的工具列表 */
  tools: string[];
  /** 预估 Token 消耗 */
  estimatedTokens: number;
  /** 当前状态 */
  status: PlanStepStatus;
  /** 执行结果（执行后填充） */
  result?: string;
  /** 错误信息（失败时填充） */
  error?: string;
}

/**
 * 完整计划
 * 
 * 包含多个步骤，以及整体的风险和 Token 预估
 */
export interface Plan {
  /** 计划 ID */
  id: string;
  /** 计划标题 */
  title: string;
  /** 用户原始请求 */
  userRequest: string;
  /** 执行步骤 */
  steps: PlanStep[];
  /** 潜在风险和注意事项 */
  risks: string[];
  /** 总预估 Token 消耗 */
  estimatedTokens: number;
  /** 创建时间 */
  createdAt: Date;
  /** 批准时间（未批准时为 undefined） */
  approvedAt?: Date;
  /** 完成时间（未完成时为 undefined） */
  completedAt?: Date;
}

/**
 * 步骤执行结果
 */
export interface StepResult {
  stepId: string;
  success: boolean;
  result?: string;
  error?: string;
  canRetry: boolean;
}

/**
 * 计划执行结果
 */
export interface PlanResult {
  plan: Plan;
  results: StepResult[];
  totalTokensUsed: number;
  duration: number;
}

/**
 * 生成计划所需的参数
 */
export interface GeneratePlanParams {
  /** 用户请求 */
  userRequest: string;
  /** 当前可用工具列表 */
  availableTools: string[];
  /** 项目上下文（可选，帮助生成更准确的计划） */
  projectContext?: string;
}

/**
 * 格式化计划为人类可读的文本
 * 
 * 用于向用户展示计划内容，让用户了解 Agent 的意图
 */
export function formatPlan(plan: Plan): string {
  const lines: string[] = [];
  
  lines.push(`📋 计划: ${plan.title}`);
  lines.push(`请求: ${plan.userRequest}`);
  lines.push('');
  lines.push('执行步骤:');
  lines.push('');
  
  for (const step of plan.steps) {
    const statusIcon = {
      'pending': '⬜',
      'in_progress': '🔄',
      'completed': '✅',
      'skipped': '⏭️',
      'failed': '❌',
    }[step.status];
    
    lines.push(`${statusIcon} [${step.order}] ${step.description}`);
    if (step.tools.length > 0) {
      lines.push(`   工具: ${step.tools.join(', ')}`);
    }
    lines.push(`   预估: ~${step.estimatedTokens} tokens`);
    if (step.result) {
      lines.push(`   结果: ${step.result.substring(0, 100)}${step.result.length > 100 ? '...' : ''}`);
    }
    if (step.error) {
      lines.push(`   错误: ${step.error}`);
    }
    lines.push('');
  }
  
  if (plan.risks.length > 0) {
    lines.push('⚠️  风险提示:');
    for (const risk of plan.risks) {
      lines.push(`   • ${risk}`);
    }
    lines.push('');
  }
  
  lines.push(`📊 总预估 Token: ~${plan.estimatedTokens}`);
  
  return lines.join('\n');
}

/**
 * 格式化计划为 System Prompt
 * 
 * 将计划转换为 System Prompt 注入，让 Agent 按照计划执行
 */
export function planToSystemPrompt(plan: Plan): string {
  const currentStep = plan.steps.find(s => s.status === 'in_progress') 
    || plan.steps.find(s => s.status === 'pending');
  
  if (!currentStep) {
    return '所有步骤已完成。';
  }
  
  return `你正在执行一个预定的计划。

计划标题: ${plan.title}
用户请求: ${plan.userRequest}

当前步骤: [${currentStep.order}] ${currentStep.description}
需要工具: ${currentStep.tools.join(', ') || '无特定工具要求'}

完整步骤:
${plan.steps.map(s => `${s.status === 'completed' ? '✅' : s.status === 'in_progress' ? '🔄' : '⬜'} [${s.order}] ${s.description}`).join('\n')}

重要规则:
1. 只执行当前步骤，不要跳步
2. 完成当前步骤后，报告结果
3. 如果遇到错误，报告错误信息
4. 不要执行计划以外的操作`;
}
