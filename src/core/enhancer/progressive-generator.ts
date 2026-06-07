/**
 * 渐进式复杂度生成器
 * 
 * 分层生成代码，确保每步验证通过后再进入下一步。
 * 生成流程：骨架 → 实现 → 错误处理 → 边界情况
 */

import type { LLMAdapter } from '../../llm/base.js';
import { logger } from '../../utils/logger.js';
import type { CodeBlock, ValidationResult, ProgressiveStep } from './types.js';

/**
 * 生成层配置
 */
interface LayerConfig {
  name: string;
  description: string;
  promptTemplate: string;
  validationCriteria: string[];
  expectedOutputHint: string;
}

/**
 * 生成结果
 */
interface GenerationResult {
  code: string;
  blocks: CodeBlock[];
  steps: ProgressiveStep[];
  validations: ValidationResult[];
  success: boolean;
  failedAt?: number;
}

/**
 * 内置的生成层配置
 */
const DEFAULT_LAYERS: LayerConfig[] = [
  {
    name: 'skeleton',
    description: '生成代码骨架，包含函数签名、类定义、接口声明等结构',
    promptTemplate: `Generate only the skeleton/structure for the following code request:
{request}

Requirements:
- Include function signatures, class definitions, interface declarations
- Use placeholder comments like "// TODO: implement" for body content
- Do NOT implement logic
- Focus on correct structure, naming, and type signatures
- Language: {language}

Output only the code block.`,
    validationCriteria: [
      'Has correct structure (functions/classes/interfaces)',
      'Has appropriate naming',
      'Has type signatures or parameter definitions',
      'Contains TODO placeholders for unimplemented parts',
    ],
    expectedOutputHint: '代码骨架，仅包含结构定义',
  },
  {
    name: 'implementation',
    description: '基于骨架填充核心实现逻辑',
    promptTemplate: `Implement the core logic for the following code skeleton:

{existingCode}

Requirements from original request:
{request}

Requirements:
- Fill in all TODO placeholders with actual implementation
- Keep the existing structure intact
- Implement core logic only (no error handling yet)
- Ensure the code compiles logically
- Language: {language}

Output the complete code with implementations.`,
    validationCriteria: [
      'All TODO placeholders are replaced',
      'Core logic is implemented',
      'Structure matches the skeleton',
      'No empty function bodies (except intentional)',
    ],
    expectedOutputHint: '包含完整核心逻辑的实现代码',
  },
  {
    name: 'error-handling',
    description: '添加错误处理、异常捕获和防御性编程',
    promptTemplate: `Add error handling and defensive programming to the following code:

{existingCode}

Requirements:
- Add try-catch blocks where appropriate
- Add input validation
- Add null/undefined checks
- Add meaningful error messages
- Handle edge cases in data flow
- Do NOT change existing core logic
- Language: {language}

Output the complete code with error handling.`,
    validationCriteria: [
      'Has try-catch or error handling patterns',
      'Has input validation',
      'Has null/undefined checks',
      'Error messages are meaningful',
    ],
    expectedOutputHint: '包含错误处理的健壮代码',
  },
  {
    name: 'edge-cases',
    description: '处理边界情况和特殊场景',
    promptTemplate: `Handle edge cases and special scenarios for the following code:

{existingCode}

Requirements from original request:
{request}

Requirements:
- Handle empty inputs, large inputs, special characters
- Add boundary condition checks
- Handle performance edge cases (large arrays, deep nesting)
- Add comments explaining edge case handling
- Do NOT break existing functionality
- Language: {language}

Output the final complete code.`,
    validationCriteria: [
      'Handles empty/null/undefined inputs',
      'Handles boundary values',
      'Has edge case comments',
      'Existing functionality is preserved',
    ],
    expectedOutputHint: '处理边界情况的最终完整代码',
  },
];

/**
 * 渐进式复杂度生成器
 * 
 * 将代码生成拆分为多个层级，每层专注于一个方面，
 * 验证通过后才进入下一层，确保生成质量。
 */
export class ProgressiveGenerator {
  /**
   * LLM 适配器实例
   */
  private readonly llm: LLMAdapter;

  /**
   * 最大重试次数
   */
  private readonly maxRetries: number;

  /**
   * 是否使用简化模式
   */
  private simplified: boolean;

  /**
   * 创建渐进式生成器
   * @param llm - LLM 适配器实例
   * @param maxRetries - 每步最大重试次数，默认 3
   */
  constructor(llm: LLMAdapter, maxRetries = 3) {
    this.llm = llm;
    this.maxRetries = maxRetries;
    this.simplified = false;
  }

  /**
   * 启用简化模式（仅生成骨架和实现）
   */
  public enableSimplified(): void {
    this.simplified = true;
  }

  /**
   * 禁用简化模式（完整四层生成）
   */
  public disableSimplified(): void {
    this.simplified = false;
  }

  /**
   * 根据请求创建生成步骤
   * @param request - 代码生成请求
   * @param language - 目标编程语言
   * @returns 生成的步骤列表
   */
  public createSteps(request: string, language: string): ProgressiveStep[] {
    const layers = this.simplified ? DEFAULT_LAYERS.slice(0, 2) : DEFAULT_LAYERS;
    const steps: ProgressiveStep[] = [];

    for (let i = 0; i < layers.length; i++) {
      const layer = layers[i];
      steps.push({
        stepNumber: i + 1,
        name: layer.name,
        description: layer.description,
        prompt: layer.promptTemplate
          .replace('{request}', request)
          .replace('{language}', language),
        expectedOutput: layer.expectedOutputHint,
      });
    }

    logger.info(`[ProgressiveGenerator] 创建了 ${steps.length} 个生成步骤: ${steps.map(s => s.name).join(' → ')}`);
    return steps;
  }

  /**
   * 执行生成步骤，每步验证后进入下一步
   * @param steps - 要执行的步骤列表
   * @param language - 目标编程语言
   * @returns 生成结果
   */
  public async executeSteps(
    steps: ProgressiveStep[],
    language: string,
  ): Promise<GenerationResult> {
    const blocks: CodeBlock[] = [];
    const validations: ValidationResult[] = [];
    let currentCode = '';
    let failedAt: number | undefined;

    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      logger.info(`[ProgressiveGenerator] 执行步骤 ${step.stepNumber}/${steps.length}: ${step.name}`);

      const stepCode = await this.executeStepWithRetry(step, currentCode, language);

      if (!stepCode) {
        logger.error(`[ProgressiveGenerator] 步骤 ${step.stepNumber} (${step.name}) 失败，无法继续`);
        failedAt = step.stepNumber;
        break;
      }

      currentCode = stepCode;
      blocks.push({
        language,
        code: stepCode,
      });

      const validation = this.validateStep(step, stepCode);
      validations.push(validation);

      if (!validation.valid && validation.errors.length > 2) {
        logger.warn(`[ProgressiveGenerator] 步骤 ${step.stepNumber} 验证未通过，尝试回退`);
        const fallbackCode = await this.attemptFallback(step, currentCode, language);

        if (fallbackCode) {
          currentCode = fallbackCode;
          blocks[blocks.length - 1] = { language, code: fallbackCode };
          validations[i] = this.validateStep(step, fallbackCode);
          logger.info(`[ProgressiveGenerator] 回退成功，继续下一步`);
        } else {
          logger.error(`[ProgressiveGenerator] 回退也失败了，终止生成`);
          failedAt = step.stepNumber;
          break;
        }
      }

      logger.info(`[ProgressiveGenerator] 步骤 ${step.stepNumber} 完成，验证结果: ${validation.valid ? '通过' : '有警告'}`);
    }

    const success = failedAt === undefined;

    return {
      code: currentCode,
      blocks,
      steps,
      validations,
      success,
      failedAt,
    };
  }

  /**
   * 执行单个步骤（带重试机制）
   * @param step - 要执行的步骤
   * @param existingCode - 已有的代码（上一步的输出）
   * @param language - 目标语言
   * @returns 生成的代码，失败返回 null
   */
  private async executeStepWithRetry(
    step: ProgressiveStep,
    existingCode: string,
    language: string,
  ): Promise<string | null> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        let prompt = step.prompt;

        if (existingCode) {
          prompt = prompt.replace('{existingCode}', existingCode);
        }

        if (attempt > 1) {
          const retryHint = `\n\nPrevious attempt failed. Please try a different approach.`;
          prompt += retryHint;
        }

        const response = await this.llm.chatOnce({
          messages: [
            { role: 'system', content: `You are a code generator. Output only valid ${language} code.` },
            { role: 'user', content: prompt },
          ],
        });

        const code = this.extractCode(response.content);

        if (!code) {
          logger.warn(`[ProgressiveGenerator] 步骤 ${step.stepNumber} 第 ${attempt} 次尝试：未提取到代码`);
          lastError = new Error('No code extracted');
          continue;
        }

        logger.info(`[ProgressiveGenerator] 步骤 ${step.stepNumber} 第 ${attempt} 次尝试成功，代码长度: ${code.length} 字符`);
        return code;
      } catch (error) {
        lastError = error as Error;
        logger.warn(`[ProgressiveGenerator] 步骤 ${step.stepNumber} 第 ${attempt} 次尝试失败: ${lastError.message}`);
      }
    }

    logger.error(`[ProgressiveGenerator] 步骤 ${step.stepNumber} 所有 ${this.maxRetries} 次尝试均失败`);
    return null;
  }

  /**
   * 验证步骤输出
   * @param step - 执行的步骤定义
   * @param code - 生成的代码
   * @returns 验证结果
   */
  public validateStep(step: ProgressiveStep, code: string): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const suggestions: string[] = [];
    const layer = DEFAULT_LAYERS.find(l => l.name === step.name);

    if (!layer) {
      return { valid: false, errors: [`Unknown step type: ${step.name}`], warnings: [], suggestions: [] };
    }

    if (!code || code.trim().length === 0) {
      errors.push('Generated code is empty');
      return { valid: false, errors, warnings, suggestions };
    }

    for (const criteria of layer.validationCriteria) {
      const checkResult = this.checkCriteria(criteria, code, step.name);
      if (!checkResult.passed) {
        if (checkResult.isError) {
          errors.push(checkResult.message);
        } else {
          warnings.push(checkResult.message);
        }
      } else if (checkResult.suggestion) {
        suggestions.push(checkResult.suggestion);
      }
    }

    const valid = errors.length === 0;
    const score = this.calculateScore(code, errors.length, warnings.length, step.name);

    return {
      valid,
      errors,
      warnings,
      suggestions,
      score,
    };
  }

  /**
   * 尝试回退策略
   * @param step - 失败的步骤
   * @param currentCode - 当前代码
   * @param language - 目标语言
   * @returns 回退后的代码，失败返回 null
   */
  private async attemptFallback(
    step: ProgressiveStep,
    currentCode: string,
    language: string,
  ): Promise<string | null> {
    logger.info(`[ProgressiveGenerator] 尝试回退策略: ${step.name}`);

    const fallbackPrompt = `The following code needs improvement. Please make minimal, focused improvements:

${currentCode}

Requirements:
- Make the smallest change needed to address the validation issues
- Do not rewrite everything from scratch
- Keep the existing structure and logic
- Language: ${language}

Output the improved code.`;

    try {
      const response = await this.llm.chatOnce({
        messages: [
          { role: 'system', content: `You are a code improvement assistant. Make minimal focused improvements.` },
          { role: 'user', content: fallbackPrompt },
        ],
      });

      const code = this.extractCode(response.content);
      return code;
    } catch (error) {
      logger.error(`[ProgressiveGenerator] 回退策略执行失败: ${(error as Error).message}`);
      return null;
    }
  }

  /**
   * 检查验证条件
   * @param criteria - 条件描述
   * @param code - 待检查代码
   * @param stepName - 步骤名称
   * @returns 检查结果
   */
  private checkCriteria(
    criteria: string,
    code: string,
    stepName: string,
  ): { passed: boolean; message: string; isError: boolean; suggestion?: string } {
    const lower = code.toLowerCase();

    switch (stepName) {
      case 'skeleton': {
        if (criteria.includes('structure')) {
          const hasFunction = /function\s+\w+|class\s+\w+|interface\s+\w+|def\s+\w+|const\s+\w+\s*=\s*\(|=>/.test(code);
          if (!hasFunction) {
            return { passed: false, message: 'Missing function/class/interface definitions', isError: true };
          }
          return { passed: true, message: '', isError: false };
        }
        if (criteria.includes('naming')) {
          const hasPascalOrCamel = /[A-Z][a-zA-Z]+|[a-z][a-zA-Z]+/.test(code);
          if (!hasPascalOrCamel) {
            return { passed: false, message: 'No meaningful names detected', isError: false };
          }
          return { passed: true, message: '', isError: false };
        }
        if (criteria.includes('TODO')) {
          const hasTodo = /TODO|FIXME|implement later|placeholder/i.test(code);
          if (!hasTodo) {
            return { passed: false, message: 'Missing TODO placeholders', isError: false };
          }
          return { passed: true, message: '', isError: false };
        }
        break;
      }

      case 'implementation': {
        if (criteria.includes('TODO')) {
          const remainingTodos = (code.match(/TODO/gi) || []).length;
          const totalFunctions = (code.match(/function|class|def|=>/g) || []).length;
          if (remainingTodos > totalFunctions * 0.5) {
            return { passed: false, message: `Too many TODOs remaining: ${remainingTodos}`, isError: true };
          }
          return { passed: true, message: '', isError: false };
        }
        if (criteria.includes('Core logic')) {
          const hasLogic = /if|for|while|switch|return|map|filter|reduce/.test(code);
          if (!hasLogic) {
            return { passed: false, message: 'No core logic detected', isError: true };
          }
          return { passed: true, message: '', isError: false };
        }
        break;
      }

      case 'error-handling': {
        if (criteria.includes('try-catch') || criteria.includes('error handling')) {
          const hasTryCatch = /try\s*\{|catch|except|Result<|Either/.test(code);
          if (!hasTryCatch) {
            return { passed: false, message: 'No error handling patterns detected', isError: false };
          }
          return { passed: true, message: '', isError: false };
        }
        if (criteria.includes('input validation') || criteria.includes('null')) {
          const hasValidation = /null|undefined|if\s*\(!|throw|guard|isValid|check/.test(lower);
          if (!hasValidation) {
            return { passed: false, message: 'No input validation detected', isError: false };
          }
          return { passed: true, message: '', isError: false };
        }
        break;
      }

      case 'edge-cases': {
        if (criteria.includes('empty') || criteria.includes('boundary')) {
          const hasEdgeHandling = /empty|null|undefined|length\s*[<=>]\s*0|\.length\s*===?\s*0|size\s*[<=>]/.test(lower);
          if (!hasEdgeHandling) {
            return { passed: false, message: 'No empty/null input handling detected', isError: false };
          }
          return { passed: true, message: '', isError: false };
        }
        break;
      }
    }

    return { passed: true, message: '', isError: false };
  }

  /**
   * 计算步骤得分
   * @param code - 生成的代码
   * @param errorCount - 错误数量
   * @param warningCount - 警告数量
   * @param stepName - 步骤名称
   * @returns 得分 0-100
   */
  private calculateScore(code: string, errorCount: number, warningCount: number, _stepName: string): number {
    let score = 100;
    score -= errorCount * 25;
    score -= warningCount * 10;

    const lineCount = code.split('\n').length;
    if (lineCount < 3) {
      score -= 20;
    }

    const hasComments = /[\/\*]{1,2}\s*[a-zA-Z]|#\s*[a-zA-Z]/.test(code);
    if (hasComments) {
      score += 5;
    }

    return Math.max(0, Math.min(100, score));
  }

  /**
   * 从 LLM 响应中提取代码块
   * @param content - LLM 响应内容
   * @returns 提取的代码
   */
  private extractCode(content: string): string {
    const codeBlockRegex = /```[\w]*\n([\s\S]*?)```/;
    const match = content.match(codeBlockRegex);

    if (match && match[1]) {
      return match[1].trim();
    }

    if (content.trim().length > 10) {
      return content.trim();
    }

    return '';
  }

  /**
   * 分层生成：骨架 → 实现 → 错误处理 → 边界情况
   * @param request - 代码生成请求
   * @param language - 目标编程语言
   * @returns 生成结果
   */
  public async generateProgressively(
    request: string,
    language: string = 'typescript',
  ): Promise<GenerationResult> {
    logger.info(`[ProgressiveGenerator] 开始渐进式生成: ${request.substring(0, 80)}...`);

    const steps = this.createSteps(request, language);
    const result = await this.executeSteps(steps, language);

    logger.info(`[ProgressiveGenerator] 生成完成: 成功=${result.success}, 代码行数=${result.code.split('\n').length}`);

    return result;
  }
}
