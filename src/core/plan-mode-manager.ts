/**
 * Plan Mode Manager - 规划模式管理器
 * 
 * 管理 Plan Mode 的整个生命周期：
 * 1. 接收用户请求
 * 2. 生成计划（调用 LLM）
 * 3. 等待用户批准/拒绝
 * 4. 执行计划
 * 5. 处理执行中的错误
 */

import type { LLMAdapter, Message } from '../llm/base.js';
import {
  PlanModeState,
  type Plan,
  type PlanStep,
  type GeneratePlanParams,
  formatPlan,
  planToSystemPrompt,
} from './plan-mode.js';

/**
 * 规划模式管理器
 * 
 * 负责：
 * - 计划的生成、批准、执行
 * - 步骤状态的管理
 * - 错误处理和重试
 */
export class PlanModeManager {
  private state: PlanModeState = PlanModeState.IDLE;
  private currentPlan: Plan | undefined;
  private currentStepIndex: number = 0;
  private llm: LLMAdapter | undefined;
  private baseSystemPrompt: string | undefined;

  /**
   * 设置 LLM 适配器（用于生成计划）
   */
  setLLM(llm: LLMAdapter, baseSystemPrompt?: string): void {
    this.llm = llm;
    this.baseSystemPrompt = baseSystemPrompt;
  }

  /**
   * 获取当前状态
   */
  getState(): PlanModeState {
    return this.state;
  }

  /**
   * 获取当前计划
   */
  getPlan(): Plan | undefined {
    return this.currentPlan;
  }

  /**
   * 是否处于规划模式
   */
  isActive(): boolean {
    return this.state !== PlanModeState.IDLE && this.state !== PlanModeState.COMPLETED && this.state !== PlanModeState.REJECTED;
  }

  /**
   * 生成计划
   * 
   * 调用 LLM 分析用户请求，生成详细的执行计划
   * 
   * @param params - 生成计划的参数
   * @returns 生成的计划
   */
  async generatePlan(params: GeneratePlanParams): Promise<Plan> {
    if (!this.llm) {
      throw new Error('LLM adapter not set. Call setLLM() first.');
    }

    this.state = PlanModeState.PLANNING;

    // 构建生成计划的 Prompt
    // 这个 Prompt 要求 LLM 返回结构化的 JSON 计划
    const planPrompt = `你是一个专业的规划助手。用户提出了以下请求：

<user_request>
${params.userRequest}
</user_request>

${params.projectContext ? `<project_context>\n${params.projectContext}\n</project_context>` : ''}

<available_tools>
${params.availableTools.join(', ')}
</available_tools>

请制定一个详细的执行计划。要求：

1. **步骤分解**：将请求分解为具体的、可执行的步骤
   - 每个步骤描述不超过 50 字
   - 步骤要具体、可操作
   - 步骤之间要有逻辑顺序

2. **工具选择**：为每个步骤选择合适的工具
   - 只使用 available_tools 中列出的工具
   - 如果不需要特定工具，留空数组

3. **风险评估**：识别潜在的风险和注意事项
   - 文件修改的风险
   - 依赖安装的兼容性
   - 可能出现的错误

4. **Token 预估**：预估每个步骤和总的 Token 消耗

请以 JSON 格式返回，格式如下：
\`\`\`json
{
  "title": "计划标题",
  "steps": [
    {
      "description": "步骤描述",
      "tools": ["工具1", "工具2"],
      "estimated_tokens": 500
    }
  ],
  "risks": ["风险1", "风险2"],
  "estimated_tokens": 总预估
}
\`\`\`

注意：只返回 JSON，不要有其他内容。`;

    const messages: Message[] = [
      { role: 'user', content: planPrompt }
    ];

    const response = await this.llm.chatOnce({
      messages,
      systemPrompt: this.baseSystemPrompt || '你是一个规划专家。',
    });

    // 提取 JSON（可能包含在代码块中）
    const jsonStr = this.extractJSON(response.content);
    let planData: any;
    
    try {
      planData = JSON.parse(jsonStr);
    } catch (error) {
      throw new Error(`Failed to parse plan JSON: ${error}\nRaw response: ${response.content.substring(0, 200)}`);
    }

    // 构建 Plan 对象
    const planId = `plan_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    
    this.currentPlan = {
      id: planId,
      title: planData.title || '未命名计划',
      userRequest: params.userRequest,
      steps: (planData.steps || []).map((step: any, index: number) => ({
        id: `step_${index}`,
        order: index + 1,
        description: step.description || '',
        tools: step.tools || [],
        estimatedTokens: step.estimated_tokens || 200,
        status: 'pending' as const,
      })),
      risks: planData.risks || [],
      estimatedTokens: planData.estimated_tokens || 1000,
      createdAt: new Date(),
    };

    this.state = PlanModeState.REVIEWING;
    this.currentStepIndex = 0;

    return this.currentPlan;
  }

  /**
   * 批准计划
   * 
   * 用户审查后批准计划，可以开始执行
   */
  approve(): void {
    if (this.state !== PlanModeState.REVIEWING) {
      throw new Error(`Can only approve a plan in reviewing state. Current state: ${this.state}`);
    }

    this.state = PlanModeState.APPROVED;
    if (this.currentPlan) {
      this.currentPlan.approvedAt = new Date();
    }
  }

  /**
   * 拒绝计划
   * 
   * 用户拒绝当前计划
   */
  reject(): void {
    if (!this.isActive()) {
      throw new Error('No active plan to reject.');
    }

    this.state = PlanModeState.REJECTED;
    this.currentPlan = undefined;
    this.currentStepIndex = 0;
  }

  /**
   * 开始执行计划
   * 
   * 将状态切换为 EXECUTING，并准备第一个步骤
   */
  startExecution(): void {
    if (this.state !== PlanModeState.APPROVED) {
      throw new Error(`Can only start execution of an approved plan. Current state: ${this.state}`);
    }

    this.state = PlanModeState.EXECUTING;
    this.executeNextStep();
  }

  /**
   * 执行下一个步骤
   * 
   * @returns 当前步骤的 System Prompt，或 undefined（如果所有步骤完成）
   */
  executeNextStep(): string | undefined {
    if (!this.currentPlan) {
      return undefined;
    }

    // 标记当前步骤为 in_progress
    const step = this.currentPlan.steps[this.currentStepIndex];
    if (!step) {
      // 所有步骤已完成
      this.state = PlanModeState.COMPLETED;
      if (this.currentPlan) {
        this.currentPlan.completedAt = new Date();
      }
      return undefined;
    }

    step.status = 'in_progress';

    return planToSystemPrompt(this.currentPlan);
  }

  /**
   * 标记当前步骤完成
   * 
   * @param result - 步骤执行结果
   * @returns 下一个步骤的 System Prompt，或 undefined（如果所有步骤完成）
   */
  completeStep(result: string): string | undefined {
    if (!this.currentPlan || this.state !== PlanModeState.EXECUTING) {
      return undefined;
    }

    const step = this.currentPlan.steps[this.currentStepIndex];
    if (step) {
      step.status = 'completed';
      step.result = result;
    }

    this.currentStepIndex++;

    return this.executeNextStep();
  }

  /**
   * 标记当前步骤失败
   * 
   * @param error - 错误信息
   * @returns 是否还有后续步骤
   */
  failStep(error: string): boolean {
    if (!this.currentPlan || this.state !== PlanModeState.EXECUTING) {
      return false;
    }

    const step = this.currentPlan.steps[this.currentStepIndex];
    if (step) {
      step.status = 'failed';
      step.error = error;
    }

    // 返回 false 表示需要用户决定是否继续
    return false;
  }

  /**
   * 跳过当前步骤
   */
  skipStep(): string | undefined {
    if (!this.currentPlan || this.state !== PlanModeState.EXECUTING) {
      return undefined;
    }

    const step = this.currentPlan.steps[this.currentStepIndex];
    if (step) {
      step.status = 'skipped';
    }

    this.currentStepIndex++;

    return this.executeNextStep();
  }

  /**
   * 获取当前步骤
   */
  getCurrentStep(): PlanStep | undefined {
    if (!this.currentPlan) {
      return undefined;
    }
    return this.currentPlan.steps[this.currentStepIndex];
  }

  /**
   * 获取计划的可读文本
   */
  formatPlanText(): string {
    if (!this.currentPlan) {
      return 'No active plan.';
    }
    return formatPlan(this.currentPlan);
  }

  /**
   * 重置规划模式
   * 
   * 清除当前计划，回到 IDLE 状态
   */
  reset(): void {
    this.state = PlanModeState.IDLE;
    this.currentPlan = undefined;
    this.currentStepIndex = 0;
  }

  /**
   * 从 JSON 字符串中提取 JSON 代码块
   * 
   * LLM 可能返回：
   * ```json
   * { ... }
   * ```
   * 或直接返回 { ... }
   * 
   * 这个函数处理这两种情况
   */
  private extractJSON(text: string): string {
    // 尝试提取 ```json 代码块
    const jsonBlockMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
    if (jsonBlockMatch) {
      return jsonBlockMatch[1].trim();
    }

    // 尝试找到第一个 { 和最后一个 }
    const firstBrace = text.indexOf('{');
    const lastBrace = text.lastIndexOf('}');
    
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      return text.substring(firstBrace, lastBrace + 1);
    }

    // 如果都找不到，返回原始文本（让 JSON.parse 报错）
    return text.trim();
  }
}
