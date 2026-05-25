import type { LLMAdapter, ChatParams } from '@/llm/base.js';
import type {
  CodeBlock,
  ValidationResult,
  GenerationConstraints,
} from './types.js';
import { logger } from '@/utils/logger.js';

/**
 * 约束驱动生成器
 *
 * 从用户需求中提取约束，构建带约束的 prompt，
 * 验证生成结果是否满足约束，确保代码质量可控。
 */
export class ConstraintDrivenGenerator {
  private llm: LLMAdapter;

  constructor(llm: LLMAdapter) {
    this.llm = llm;
  }

  /**
   * 从用户需求中提取约束条件
   *
   * @param userRequest 用户的原始需求描述
   * @returns 提取到的约束对象
   */
  public async extractConstraints(userRequest: string): Promise<GenerationConstraints> {
    logger.debug('Extracting constraints from user request');

    const prompt = `You are a constraint extraction assistant. Analyze the following user request and extract constraints for code generation.

Return a JSON object with the following fields (omit fields that are not applicable):
{
  "mustUse": ["list of required libraries/patterns"],
  "mustNotUse": ["list of forbidden libraries/patterns"],
  "mustFollow": ["list of rules/standards to follow"],
  "mustHandle": ["list of edge cases/situations to handle"],
  "maxComplexity": 10,
  "maxLines": 200
}

User request:
${userRequest}

Return ONLY the JSON object, no explanation.`;

    const params: ChatParams = {
      messages: [
        { role: 'system', content: 'You are an expert at extracting technical constraints from requirements.' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.1,
    };

    const response = await this.llm.chatOnce(params);
    const content = this.extractJsonFromResponse(response.content);

    try {
      const constraints: GenerationConstraints = JSON.parse(content);
      logger.info('Extracted constraints:', JSON.stringify(constraints));
      return constraints;
    } catch (err) {
      logger.warn('Failed to parse constraints from LLM response, returning empty constraints');
      return {};
    }
  }

  /**
   * 构建带约束的 prompt
   *
   * @param userRequest 用户的原始需求
   * @param constraints 约束条件
   * @returns 包含约束的完整 prompt
   */
  public buildConstrainedPrompt(userRequest: string, constraints: GenerationConstraints): string {
    logger.debug('Building constrained prompt');

    const sections: string[] = [];

    sections.push(`## Task\n\n${userRequest}`);
    sections.push('');

    if (constraints.mustUse && constraints.mustUse.length > 0) {
      sections.push(`## Must Use\n\nYou MUST use the following libraries, patterns, or approaches:\n${constraints.mustUse.map((item) => `- ${item}`).join('\n')}`);
      sections.push('');
    }

    if (constraints.mustNotUse && constraints.mustNotUse.length > 0) {
      sections.push(`## Must NOT Use\n\nYou must NOT use the following libraries, patterns, or approaches:\n${constraints.mustNotUse.map((item) => `- ${item}`).join('\n')}`);
      sections.push('');
    }

    if (constraints.mustFollow && constraints.mustFollow.length > 0) {
      sections.push(`## Rules & Standards\n\nYou must follow these rules:\n${constraints.mustFollow.map((item) => `- ${item}`).join('\n')}`);
      sections.push('');
    }

    if (constraints.mustHandle && constraints.mustHandle.length > 0) {
      sections.push(`## Edge Cases to Handle\n\nYou must handle these situations:\n${constraints.mustHandle.map((item) => `- ${item}`).join('\n')}`);
      sections.push('');
    }

    if (constraints.maxComplexity) {
      sections.push(`## Complexity Limit\n\nMaximum cyclomatic complexity: ${constraints.maxComplexity}`);
      sections.push('');
    }

    if (constraints.maxLines) {
      sections.push(`## Size Limit\n\nMaximum code length: ${constraints.maxLines} lines`);
      sections.push('');
    }

    sections.push('## Output Format\n\nReturn your response as a JSON array of code blocks:');
    sections.push('```json');
    sections.push('[');
    sections.push('  { "language": "typescript", "code": "...", "filePath": "src/example.ts" }');
    sections.push(']');
    sections.push('```');

    return sections.join('\n');
  }

  /**
   * 使用约束驱动方式生成代码
   *
   * @param userRequest 用户需求
   * @param constraints 可选的预定义约束，如果不提供则自动提取
   * @returns 生成的代码块数组
   */
  public async generate(
    userRequest: string,
    constraints?: GenerationConstraints,
  ): Promise<CodeBlock[]> {
    logger.info('Starting constraint-driven generation');

    const finalConstraints = constraints ?? await this.extractConstraints(userRequest);
    const prompt = this.buildConstrainedPrompt(userRequest, finalConstraints);

    const params: ChatParams = {
      messages: [
        {
          role: 'system',
          content: 'You are a code generation expert. Generate code that strictly follows all given constraints. Return code blocks in JSON format.',
        },
        { role: 'user', content: prompt },
      ],
      temperature: 0.2,
    };

    const response = await this.llm.chatOnce(params);
    const codeBlocks = this.parseCodeBlocks(response.content);

    logger.info(`Generated ${codeBlocks.length} code blocks`);
    return codeBlocks;
  }

  /**
   * 验证生成的代码是否满足约束条件
   *
   * @param codeBlocks 生成的代码块
   * @param constraints 约束条件
   * @returns 验证结果
   */
  public validateConstraints(
    codeBlocks: CodeBlock[],
    constraints: GenerationConstraints,
  ): ValidationResult {
    logger.debug('Validating generated code against constraints');

    const errors: string[] = [];
    const warnings: string[] = [];
    const suggestions: string[] = [];
    let totalLines = 0;

    const allCode = codeBlocks.map((block) => block.code).join('\n');

    if (constraints.mustUse) {
      for (const required of constraints.mustUse) {
        if (!allCode.includes(required)) {
          errors.push(`Missing required usage: "${required}" was not found in generated code`);
        }
      }
    }

    if (constraints.mustNotUse) {
      for (const forbidden of constraints.mustNotUse) {
        if (allCode.includes(forbidden)) {
          errors.push(`Forbidden usage found: "${forbidden}" should not be used`);
        }
      }
    }

    for (const block of codeBlocks) {
      const lineCount = block.code.split('\n').length;
      totalLines += lineCount;
    }

    if (constraints.maxLines && totalLines > constraints.maxLines) {
      errors.push(`Code exceeds maximum lines: ${totalLines} > ${constraints.maxLines}`);
    } else if (constraints.maxLines && totalLines > constraints.maxLines * 0.8) {
      warnings.push(`Code is approaching maximum lines: ${totalLines} / ${constraints.maxLines}`);
    }

    if (constraints.maxComplexity) {
      suggestions.push(`Verify that cyclomatic complexity does not exceed ${constraints.maxComplexity}`);
    }

    const valid = errors.length === 0;
    const score = this.calculateScore(valid, errors.length, warnings.length, totalLines, constraints);

    const result: ValidationResult = {
      valid,
      errors,
      warnings,
      suggestions,
      score,
    };

    logger.info(
      `Constraint validation: ${valid ? 'PASSED' : 'FAILED'} ` +
      `(errors: ${errors.length}, warnings: ${warnings.length}, score: ${score})`,
    );

    return result;
  }

  /**
   * 从 LLM 响应中提取 JSON 字符串
   */
  private extractJsonFromResponse(content: string): string {
    const codeBlockMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (codeBlockMatch) {
      return codeBlockMatch[1].trim();
    }

    const braceMatch = content.match(/\{[\s\S]*\}/);
    if (braceMatch) {
      return braceMatch[0];
    }

    return content;
  }

  /**
   * 从 LLM 响应中解析代码块数组
   */
  private parseCodeBlocks(content: string): CodeBlock[] {
    const jsonContent = this.extractJsonFromResponse(content);

    try {
      const parsed = JSON.parse(jsonContent);
      const blocks: CodeBlock[] = Array.isArray(parsed) ? parsed : [parsed];
      return blocks.map((block) => ({
        language: block.language || 'typescript',
        code: block.code || '',
        filePath: block.filePath,
      }));
    } catch (err) {
      logger.warn('Failed to parse code blocks from response, returning empty array');
      return [];
    }
  }

  /**
   * 计算约束满足度评分 (0-100)
   */
  private calculateScore(
    valid: boolean,
    errorCount: number,
    warningCount: number,
    totalLines: number,
    constraints: GenerationConstraints,
  ): number {
    let score = 100;

    score -= errorCount * 20;
    score -= warningCount * 5;

    if (constraints.maxLines && totalLines > constraints.maxLines) {
      const overflow = totalLines - constraints.maxLines;
      score -= Math.min(overflow * 0.5, 15);
    }

    return Math.max(0, Math.min(100, Math.round(score)));
  }
}
