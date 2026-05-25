/**
 * 统一代码增强器 - 小模型代码质量增强系统主入口
 * 
 * 核心理念：让本地小模型也能输出高质量、可运行的代码
 * 
 * 整合以下增强机制：
 * 1. SnippetLibrary - 代码模板库系统
 * 2. ExampleDrivenGenerator - 示例驱动生成
 * 3. ProgressiveGenerator - 渐进式复杂度生成
 * 4. MultiRoleReviewer - 多角色审查系统
 * 5. ConstraintDrivenGenerator - 约束驱动生成
 * 6. FailurePatternLearner - 失败模式学习系统
 */

import type { LLMAdapter } from '@/llm/base.js';
import { logger } from '@/utils/logger.js';
import { SnippetLibrary } from './snippet-library.js';
import { ExampleDrivenGenerator } from './example-driven-generator.js';
import { ProgressiveGenerator } from './progressive-generator.js';
import { MultiRoleReviewer } from './multi-role-reviewer.js';
import { ConstraintDrivenGenerator } from './constraint-driven-generator.js';
import { FailurePatternLearner } from './failure-pattern-learner.js';
import type { 
  CodeSnippet, 
  CodeExample, 
  ValidationResult, 
  GenerationConstraints, 
  EnhancementResult 
} from './types.js';

export interface EnhancerConfig {
  /** LLM 适配器 */
  llm: LLMAdapter;
  /** 代码模板库目录 */
  snippetDir?: string;
  /** 项目示例扫描目录 */
  projectDir?: string;
  /** 失败模式日志路径 */
  failureLogPath?: string;
  /** 最大审查循环次数 */
  maxReviewCycles?: number;
  /** 最大重试次数 */
  maxRetries?: number;
  /** 启用代码模板库 */
  enableSnippetLibrary?: boolean;
  /** 启用示例驱动生成 */
  enableExampleDriven?: boolean;
  /** 启用渐进式复杂度生成 */
  enableProgressiveGeneration?: boolean;
  /** 启用多角色审查 */
  enableMultiRoleReview?: boolean;
  /** 启用约束驱动生成 */
  enableConstraintDriven?: boolean;
  /** 启用失败模式学习 */
  enableFailureLearning?: boolean;
}

export interface GenerateOptions {
  /** 用户请求 */
  request: string;
  /** 目标语言 */
  language?: string;
  /** 目标文件路径 */
  filePath?: string;
  /** 自定义约束 */
  constraints?: GenerationConstraints;
  /** 是否使用渐进式生成 */
  useProgressive?: boolean;
  /** 是否启用审查 */
  enableReview?: boolean;
}

export class CodeEnhancer {
  private readonly llm: LLMAdapter;
  private readonly snippetLibrary: SnippetLibrary;
  private readonly exampleDriven: ExampleDrivenGenerator;
  private readonly progressiveGen: ProgressiveGenerator;
  private readonly multiRoleReview: MultiRoleReviewer;
  private readonly constraintDriven: ConstraintDrivenGenerator;
  private readonly failureLearner: FailurePatternLearner;
  private readonly config: Required<EnhancerConfig>;

  constructor(config: EnhancerConfig) {
    this.llm = config.llm;
    this.config = {
      llm: config.llm,
      snippetDir: config.snippetDir ?? '.miniagent/snippets',
      projectDir: config.projectDir ?? process.cwd(),
      failureLogPath: config.failureLogPath ?? '.miniagent/failures.json',
      maxReviewCycles: config.maxReviewCycles ?? 3,
      maxRetries: config.maxRetries ?? 3,
      enableSnippetLibrary: config.enableSnippetLibrary ?? true,
      enableExampleDriven: config.enableExampleDriven ?? true,
      enableProgressiveGeneration: config.enableProgressiveGeneration ?? true,
      enableMultiRoleReview: config.enableMultiRoleReview ?? true,
      enableConstraintDriven: config.enableConstraintDriven ?? true,
      enableFailureLearning: config.enableFailureLearning ?? true,
    };

    // 初始化所有增强模块
    this.snippetLibrary = new SnippetLibrary(this.config.snippetDir);
    this.exampleDriven = new ExampleDrivenGenerator(this.llm);
    this.progressiveGen = new ProgressiveGenerator(this.llm, this.config.maxRetries);
    this.multiRoleReview = new MultiRoleReviewer(this.llm);
    this.constraintDriven = new ConstraintDrivenGenerator(this.llm);
    this.failureLearner = new FailurePatternLearner(this.config.failureLogPath);

    logger.info('CodeEnhancer initialized with all enhancement modules');
  }

  /**
   * 加载代码模板库
   */
  async loadSnippetLibrary(): Promise<void> {
    if (!this.config.enableSnippetLibrary) {
      return;
    }

    try {
      await this.snippetLibrary.loadFromDirectory();
      const stats = this.snippetLibrary.getStats();
      logger.info(`Snippet library loaded: ${stats.total} snippets`);
    } catch (error) {
      logger.warn('Failed to load snippet library:', error);
    }
  }

  /**
   * 扫描项目示例代码
   */
  async scanProjectExamples(): Promise<void> {
    if (!this.config.enableExampleDriven) {
      return;
    }

    try {
      await this.exampleDriven.scanProjectExamples();
      logger.info('Project examples scanned');
    } catch (error) {
      logger.warn('Failed to scan project examples:', error);
    }
  }

  /**
   * 统一代码生成入口
   * 
   * 智能选择最佳生成策略：
   * 1. 查找相似模板/示例
   * 2. 提取约束
   * 3. 查询历史失败经验
   * 4. 选择生成策略（渐进式 vs 直接生成）
   * 5. 多角色审查
   * 6. 验证并返回结果
   */
  async generate(options: GenerateOptions): Promise<EnhancementResult> {
    const startTime = Date.now();
    const result: EnhancementResult = {
      code: '',
      steps: [],
      reviews: [],
      validation: { valid: false, errors: [], warnings: [], suggestions: [] },
      usedSnippets: [],
      usedExamples: [],
      appliedConstraints: null,
      retryCount: 0,
      success: false,
    };

    try {
      logger.info(`Generating code for request: ${options.request.substring(0, 100)}...`);

      // 步骤 1: 查找相似模板
      const snippets = await this.findRelevantSnippets(options);
      result.usedSnippets = snippets.map(s => s.id);

      // 步骤 2: 查找相似示例
      const examples = await this.findRelevantExamples(options);
      result.usedExamples = examples.map(e => e.source);

      // 步骤 3: 提取约束
      const constraints = await this.extractConstraints(options);
      result.appliedConstraints = constraints;

      // 步骤 4: 查询历史失败经验
      const preventionTips = await this.getPreventionTips(options.request);

      // 步骤 5: 选择生成策略并生成
      let code: string;
      if (this.config.enableProgressiveGeneration && options.useProgressive !== false) {
        // 渐进式生成
        const progressiveResult = await this.progressiveGen.generateProgressively(
          options.request,
          options.language ?? 'typescript'
        );
        code = progressiveResult.code;
        result.steps = progressiveResult.steps.map(s => s.name);
      } else if (examples.length > 0 && this.config.enableExampleDriven) {
        // 示例驱动生成
        const exampleResult = await this.exampleDriven.generateWithExamples(options.request, {
          maxExamples: 3,
        });
        code = exampleResult.code;
        result.steps = ['example-driven-generation'];
      } else if (constraints && this.config.enableConstraintDriven) {
        // 约束驱动生成
        const constraintResults = await this.constraintDriven.generate(options.request, constraints);
        code = constraintResults.map(b => b.code).join('\n\n');
        result.steps = ['constraint-driven-generation'];
      } else {
        // 直接生成（兜底）
        const response = await this.llm.chatOnce({
          messages: [{ role: 'user', content: options.request }],
          maxTokens: 2048,
        });
        code = response.content;
        result.steps = ['direct-generation'];
      }

      // 注入预防建议到代码注释
      if (preventionTips.length > 0) {
        code = this.injectPreventionTips(code, preventionTips);
      }

      result.code = code;

      // 步骤 6: 多角色审查
      if (this.config.enableMultiRoleReview && options.enableReview !== false) {
        const reviewResults = await this.multiRoleReview.reviewAll(
          code,
          options.language ?? 'typescript'
        );
        result.reviews = reviewResults.byRole.map((r: { role: string; result: ValidationResult }) => ({
          role: r.role,
          result: r.result,
        }));

        // 如果有严重错误，尝试修复
        if (reviewResults.overall.errors.length > 0) {
          const fixedCode = await this.fixBasedOnReview(code, reviewResults.overall, options.language ?? 'typescript');
          if (fixedCode !== code) {
            result.code = fixedCode;
            result.retryCount++;
          }
        }
      }

      // 步骤 7: 最终验证
      result.validation = await this.validateCode(result.code, options.language ?? 'typescript');
      result.success = result.validation.valid;

      // 记录结果
      const elapsed = Date.now() - startTime;
      logger.info(
        `Code generation completed in ${elapsed}ms: ${result.success ? 'SUCCESS' : 'FAILED'}, ` +
        `${result.reviews.length} reviews, ${result.retryCount} retries`
      );

      return result;
    } catch (error) {
      logger.error('Code generation failed:', error);
      
      // 记录失败模式
      await this.failureLearner.recordFailure({
        request: options.request,
        generatedCode: result.code,
        failureReason: error instanceof Error ? error.message : String(error),
        failureType: 'context',
        fixStrategy: 'Try progressive generation or provide more constraints',
        fixCode: '',
      });

      return result;
    }
  }

  /**
   * 查找相关代码模板
   */
  private async findRelevantSnippets(options: GenerateOptions): Promise<CodeSnippet[]> {
    if (!this.config.enableSnippetLibrary) {
      return [];
    }

    try {
      const matches = this.snippetLibrary.findBestMatches(options.request, 3);
      if (matches.length > 0 && matches[0].score > 0.5) {
        logger.info(`Found ${matches.length} relevant snippets`);
        return matches.map(m => m.snippet);
      }
    } catch (error) {
      logger.warn('Failed to find snippets:', error);
    }

    return [];
  }

  /**
   * 查找相关项目示例
   */
  private async findRelevantExamples(options: GenerateOptions): Promise<CodeExample[]> {
    if (!this.config.enableExampleDriven) {
      return [];
    }

    try {
      const examples = await this.exampleDriven.findSimilarExamples(options.request, {
        maxResults: 3,
        minSimilarity: 0.1,
      });
      if (examples.length > 0 && examples[0].similarity > 0.3) {
        logger.info(`Found ${examples.length} relevant examples`);
        return examples;
      }
    } catch (error) {
      logger.warn('Failed to find examples:', error);
    }

    return [];
  }

  /**
   * 提取生成约束
   */
  private async extractConstraints(options: GenerateOptions): Promise<GenerationConstraints | null> {
    if (!this.config.enableConstraintDriven) {
      return options.constraints ?? null;
    }

    try {
      // 如果用户提供了自定义约束，直接使用
      if (options.constraints) {
        return options.constraints;
      }

      // 否则自动从请求中提取
      const constraints = await this.constraintDriven.extractConstraints(
        options.request
      );
      
      if (constraints.mustUse?.length || constraints.mustNotUse?.length || constraints.mustFollow?.length) {
        logger.info(`Extracted constraints: ${JSON.stringify(constraints)}`);
        return constraints;
      }
    } catch (error) {
      logger.warn('Failed to extract constraints:', error);
    }

    return options.constraints ?? null;
  }

  /**
   * 获取历史失败经验的预防建议
   */
  private async getPreventionTips(request: string): Promise<string[]> {
    if (!this.config.enableFailureLearning) {
      return [];
    }

    try {
      const similarFailures = await this.failureLearner.findSimilarFailures(request);
      if (similarFailures.length > 0) {
        const tips = await this.failureLearner.getPreventionTips();
        logger.info(`Found ${similarFailures.length} similar failures, ${tips.length} prevention tips`);
        return tips.map(t => t.prevention);
      }
    } catch (error) {
      logger.warn('Failed to get prevention tips:', error);
    }

    return [];
  }

  /**
   * 将预防建议注入代码注释
   */
  private injectPreventionTips(code: string, tips: string[]): string {
    if (tips.length === 0) {
      return code;
    }

    const commentBlock = [
      '/**',
      ' * ⚠️ Prevention Tips (based on historical failures):',
      ...tips.map(tip => ` * - ${tip}`),
      ' */',
    ].join('\n');

    return commentBlock + '\n' + code;
  }

  /**
   * 基于审查结果修复代码
   */
  private async fixBasedOnReview(
    code: string,
    reviewResult: ValidationResult,
    language: string
  ): Promise<string> {
    if (reviewResult.errors.length === 0) {
      return code;
    }

    try {
      logger.info(`Attempting to fix ${reviewResult.errors.length} issues found in review`);

      const fixPrompt = `Fix the following issues in this ${language} code:

Issues to fix:
${reviewResult.errors.map((e, i) => `${i + 1}. ${e}`).join('\n')}

Original code:
\`\`\`${language}
${code}
\`\`\`

Return only the fixed code, no explanations.`;

      const response = await this.llm.chatOnce({
        messages: [{ role: 'user', content: fixPrompt }],
        maxTokens: 2048,
      });

      return response.content.trim();
    } catch (error) {
      logger.error('Failed to fix code based on review:', error);
      return code;
    }
  }

  /**
   * 验证代码质量
   */
  private async validateCode(code: string, language: string): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];
    const suggestions: string[] = [];

    // 基础语法检查
    if (language === 'typescript' || language === 'javascript') {
      // 括号匹配
      const openBraces = (code.match(/{/g) || []).length;
      const closeBraces = (code.match(/}/g) || []).length;
      if (openBraces !== closeBraces) {
        errors.push(`Mismatched braces: ${openBraces} opening, ${closeBraces} closing`);
      }

      // 检查是否有明显的语法错误
      if (code.includes(';;') || code.includes('  ;')) {
        warnings.push('Possible syntax issues detected');
      }
    }

    if (language === 'python') {
      // Python 缩进检查
      const lines = code.split('\n');
      for (let i = 1; i < lines.length; i++) {
        const prevIndent = lines[i - 1].search(/\S/);
        const currIndent = lines[i].search(/\S/);
        
        if (currIndent > prevIndent && !lines[i - 1].trimEnd().endsWith(':') && lines[i - 1].trim() !== '') {
          warnings.push(`Possible indentation issue at line ${i + 1}`);
        }
      }
    }

    // 安全检查
    if (code.includes('eval(') || code.includes('exec(')) {
      warnings.push('Code contains eval/exec, consider safer alternatives');
    }

    if (code.includes('password') || code.includes('secret') || code.includes('api_key')) {
      suggestions.push('Avoid hardcoding secrets, use environment variables instead');
    }

    // 质量建议
    if (code.length > 500) {
      suggestions.push('Consider breaking this into smaller functions');
    }

    const valid = errors.length === 0;
    const score = valid ? Math.max(0, 100 - warnings.length * 10 - suggestions.length * 5) : 0;

    return {
      valid,
      errors,
      warnings,
      suggestions,
      score,
    };
  }

  /**
   * 获取增强器状态
   */
  getStatus(): {
    snippetLibrary: number;
    cachedExamples: number;
    failurePatterns: number;
  } {
    return {
      snippetLibrary: this.snippetLibrary.getStats().total,
      cachedExamples: this.exampleDriven.getCacheStats().totalExamples,
      failurePatterns: this.failureLearner.getAllPatterns().length,
    };
  }

  /**
   * 获取所有代码模板
   */
  getAllSnippets(): CodeSnippet[] {
    return this.snippetLibrary.getAllSnippets();
  }

  /**
   * 导出代码模板库到文件
   */
  exportSnippets(filePath: string): boolean {
    return this.snippetLibrary.exportLibrary(filePath);
  }

  /**
   * 从文件导入代码模板库
   */
  importSnippets(filePath: string, overwrite: boolean = false): number {
    const count = this.snippetLibrary.importLibrary(filePath, overwrite);
    logger.info(`Imported ${count} snippets`);
    return count;
  }

  /**
   * 获取失败模式统计
   */
  getFailureStats(): {
    totalPatterns: number;
    patternsByType: Record<string, number>;
    topFailures: Array<{ request: string; reason: string; count: number }>;
  } {
    const patterns = this.failureLearner.getAllPatterns();
    const patternsByTypeResult = this.failureLearner.getPatternsByType();
    
    return {
      totalPatterns: patterns.length,
      patternsByType: Object.fromEntries(Object.entries(patternsByTypeResult).map(([k, v]) => [k, v.length])),
      topFailures: [], // 可以扩展实现
    };
  }
}
