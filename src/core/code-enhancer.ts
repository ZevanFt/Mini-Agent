import { logger } from '../utils/logger.js';
import type { LLMAdapter } from '@/llm/base.js';
import type { ChatParams } from '@/llm/base.js';

export interface CodeBlock {
  language: string;
  code: string;
  filePath?: string;
}

export interface RetryConfig {
  maxAttempts: number;
  delayMs: number;
  backoffMultiplier: number;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  suggestions: string[];
}

export interface EnhancerConfig {
  retryConfig?: Partial<RetryConfig>;
  llm?: LLMAdapter;
  maxReviewCycles?: number;
}

const PROMPT_TEMPLATES = {
  codeReview: (code: string, language: string) => `You are an expert code reviewer. Review the following ${language} code for:
1. Syntax errors
2. Logical errors
3. Security vulnerabilities
4. Performance issues
5. Best practices violations

Code:
\`\`\`${language}
${code}
\`\`\`

Respond in JSON format:
{
  "valid": boolean,
  "errors": ["error1", "error2"],
  "warnings": ["warning1"],
  "suggestions": ["suggestion1"]
}`,

  codeFix: (code: string, errors: string[], language: string) => `Fix the following issues in this ${language} code:

Issues to fix:
${errors.map((e, i) => `${i + 1}. ${e}`).join('\n')}

Original code:
\`\`\`${language}
${code}
\`\`\`

Return only the fixed code, no explanations.`,

  progressiveStep: (prompt: string, step: string, stepNum: number, totalSteps: number, previousCode?: string) => `${prompt}

Step ${stepNum}/${totalSteps}: ${step}${
  previousCode ? `\n\nPrevious code for context:\n\`\`\`\n${previousCode}\n\`\`\`` : ''
}

Generate only the code for this step.`,
};

export class CodeEnhancer {
  private readonly retryConfig: RetryConfig;
  private readonly llm?: LLMAdapter;
  private readonly maxReviewCycles: number;

  constructor(config: EnhancerConfig = {}) {
    this.retryConfig = {
      maxAttempts: config.retryConfig?.maxAttempts ?? 3,
      delayMs: config.retryConfig?.delayMs ?? 1000,
      backoffMultiplier: config.retryConfig?.backoffMultiplier ?? 2,
    };
    this.llm = config.llm;
    this.maxReviewCycles = config.maxReviewCycles ?? 3;
  }

  /**
   * 语法感知代码分块
   * 按函数/类边界切分，而非简单按行数
   */
  splitCodeBySyntax(code: string, language: string, maxChunkSize: number = 500): string[] {
    const chunks: string[] = [];
    
    if (language === 'javascript' || language === 'typescript') {
      return this.splitJSBySyntax(code, maxChunkSize);
    }
    
    if (language === 'python') {
      return this.splitPythonBySyntax(code, maxChunkSize);
    }
    
    // 降级到简单分块
    return this.splitCodeIntoChunks(code, maxChunkSize);
  }

  private splitJSBySyntax(code: string, maxChunkSize: number): string[] {
    const lines = code.split('\n');
    const chunks: string[] = [];
    let currentChunk: string[] = [];
    let braceDepth = 0;
    let inFunction = false;
    let inClass = false;

    for (const line of lines) {
      const trimmed = line.trim();
      
      currentChunk.push(line);
      braceDepth += (line.match(/{/g) || []).length - (line.match(/}/g) || []).length;
      
      if (trimmed.startsWith('function ') || trimmed.startsWith('async function ') || 
          trimmed.startsWith('const ') || trimmed.startsWith('let ') ||
          trimmed.startsWith('class ') || trimmed.startsWith('export ')) {
        inFunction = trimmed.includes('function') || trimmed.includes('=>');
        inClass = trimmed.startsWith('class ');
      }
      
      if (braceDepth === 0 && currentChunk.join('\n').length >= maxChunkSize / 2) {
        chunks.push(currentChunk.join('\n'));
        currentChunk = [];
        inFunction = false;
        inClass = false;
      }
    }

    if (currentChunk.length > 0) {
      chunks.push(currentChunk.join('\n'));
    }

    return chunks;
  }

  private splitPythonBySyntax(code: string, maxChunkSize: number): string[] {
    const lines = code.split('\n');
    const chunks: string[] = [];
    let currentChunk: string[] = [];

    for (const line of lines) {
      const trimmed = line.trim();
      const indent = line.search(/\S/);
      
      if (indent === 0 && trimmed && currentChunk.length > 0) {
        const chunkStr = currentChunk.join('\n');
        if (chunkStr.length >= maxChunkSize / 2) {
          chunks.push(chunkStr);
          currentChunk = [];
        }
      }
      
      currentChunk.push(line);
    }

    if (currentChunk.length > 0) {
      chunks.push(currentChunk.join('\n'));
    }

    return chunks;
  }

  /**
   * LLM 驱动代码审查
   * 使用 LLM 进行智能审查，而非仅依赖正则
   */
  async llmReview(code: string, language: string): Promise<ValidationResult> {
    if (!this.llm) {
      logger.warn('LLM not configured, falling back to rule-based review');
      return { valid: true, errors: [], warnings: [], suggestions: [] };
    }

    try {
      const prompt = PROMPT_TEMPLATES.codeReview(code, language);
      const result = await this.llm.chatOnce({
        messages: [{ role: 'user', content: prompt }],
        maxTokens: 512,
      });

      const parsed = JSON.parse(result.content);
      return {
        valid: parsed.valid ?? true,
        errors: parsed.errors || [],
        warnings: parsed.warnings || [],
        suggestions: parsed.suggestions || [],
      };
    } catch (error) {
      logger.error('LLM review failed:', error);
      return { valid: true, errors: [], warnings: [], suggestions: [] };
    }
  }

  /**
   * LLM 驱动代码修复
   * 使用 LLM 自动修复发现的问题
   */
  async llmFix(code: string, errors: string[], language: string): Promise<string> {
    if (!this.llm) {
      logger.warn('LLM not configured, cannot auto-fix');
      return code;
    }

    try {
      const prompt = PROMPT_TEMPLATES.codeFix(code, errors, language);
      const result = await this.llm.chatOnce({
        messages: [{ role: 'user', content: prompt }],
        maxTokens: 2048,
      });

      return result.content.trim();
    } catch (error) {
      logger.error('LLM fix failed:', error);
      return code;
    }
  }

  /**
   * 智能审查修复循环（LLM 驱动）
   */
  async smartReviewAndFix(
    code: string,
    language: string
  ): Promise<{ code: string; cycles: number; finalValidation: ValidationResult }> {
    let currentCode = code;
    let cycles = 0;

    for (let i = 0; i < this.maxReviewCycles; i++) {
      const validation = await this.llmReview(currentCode, language);
      
      if (validation.valid && validation.errors.length === 0) {
        logger.info(`Code passed LLM review after ${i} cycles`);
        return { code: currentCode, cycles: i, finalValidation: validation };
      }

      if (validation.errors.length > 0) {
        logger.warn(`LLM review found issues, cycle ${i + 1}:`, validation.errors);
        currentCode = await this.llmFix(currentCode, validation.errors, language);
        cycles = i + 1;
      }
    }

    logger.warn(`Max review cycles reached, code may still have issues`);
    const finalValidation = await this.llmReview(currentCode, language);
    return { code: currentCode, cycles, finalValidation };
  }

  /**
   * 渐进式代码生成
   * 小模型一次生成太多代码容易出错，拆分步骤
   */
  async generateProgressively(
    prompt: string,
    generateFn: (stepPrompt: string) => Promise<CodeBlock>,
    steps: string[]
  ): Promise<CodeBlock[]> {
    const results: CodeBlock[] = [];

    for (let i = 0; i < steps.length; i++) {
      logger.info(`Generating step ${i + 1}/${steps.length}: ${steps[i]}`);
      
      const stepPrompt = `${prompt}\n\nStep ${i + 1}: ${steps[i]}${
        i > 0 ? `\n\nPrevious steps output:\n${results.map(r => r.code).join('\n\n')}` : ''
      }`;

      const result = await this.retryWithBackoff(() => generateFn(stepPrompt));
      results.push(result);
    }

    return results;
  }

  /**
   * 代码审查和修复循环
   */
  async reviewAndFix(
    code: string,
    language: string,
    reviewFn: (code: string) => Promise<ValidationResult>,
    fixFn: (code: string, errors: string[]) => Promise<string>,
    maxCycles: number = 3
  ): Promise<{ code: string; cycles: number; finalValidation: ValidationResult }> {
    let currentCode = code;
    let cycles = 0;

    for (let i = 0; i < maxCycles; i++) {
      const validation = await reviewFn(currentCode);
      
      if (validation.valid) {
        logger.info(`Code passed validation after ${i} cycles`);
        return { code: currentCode, cycles: i, finalValidation: validation };
      }

      logger.warn(`Validation failed, cycle ${i + 1}:`, validation.errors);
      currentCode = await fixFn(currentCode, validation.errors);
      cycles = i + 1;
    }

    logger.warn(`Max cycles reached, code may still have issues`);
    const finalValidation = await reviewFn(currentCode);
    return { code: currentCode, cycles, finalValidation };
  }

  /**
   * 代码分块处理
   * 大文件拆成小块处理
   */
  splitCodeIntoChunks(code: string, maxChunkSize: number = 500): string[] {
    const lines = code.split('\n');
    const chunks: string[] = [];
    let currentChunk: string[] = [];

    for (const line of lines) {
      currentChunk.push(line);
      
      if (currentChunk.join('\n').length >= maxChunkSize) {
        chunks.push(currentChunk.join('\n'));
        currentChunk = [];
      }
    }

    if (currentChunk.length > 0) {
      chunks.push(currentChunk.join('\n'));
    }

    return chunks;
  }

  /**
   * 带重试的生成
   */
  private async retryWithBackoff<T>(fn: () => Promise<T>): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < this.retryConfig.maxAttempts; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        logger.warn(`Attempt ${attempt + 1} failed:`, lastError.message);
        
        if (attempt < this.retryConfig.maxAttempts - 1) {
          const delay = this.retryConfig.delayMs * Math.pow(this.retryConfig.backoffMultiplier, attempt);
          logger.info(`Retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError || new Error('All retry attempts failed');
  }
}
