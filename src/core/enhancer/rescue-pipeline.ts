import type { LLMAdapter } from '../../llm/base.js';
import { logger } from '../../utils/logger.js';
import { PostProcessor } from './post-processor.js';
import { MultiSampleVoter } from './multi-sample-voter.js';
import { ProgressiveGenerator } from './progressive-generator.js';
import { FailurePatternLearner } from './failure-pattern-learner.js';
import { SnippetLibrary } from './snippet-library.js';
import { ConstraintDrivenGenerator } from './constraint-driven-generator.js';
import { QualityScorer, type QualityScoreResult } from './quality-scorer.js';
import type { CodeBlock, GenerationConstraints } from './types.js';

export interface RescueStep {
  name: string;
  success: boolean;
  duration: number;
  details: unknown;
}

export interface RescueResult {
  originalCode: string;
  rescuedCode: string;
  qualityBefore: number;
  qualityAfter: number;
  steps: RescueStep[];
  totalDuration: number;
  strategy: 'postprocess' | 'resample' | 'progressive' | 'injection';
  passed: boolean;
}

export interface RescueContext {
  userRequest?: string;
  projectPath?: string;
  constraints?: GenerationConstraints;
  framework?: string;
  [key: string]: unknown;
}

export interface RescueOptions {
  maxSamples?: number;
  skipPostProcess?: boolean;
  skipSnippetInjection?: boolean;
  forceProgressive?: boolean;
  qualityThreshold?: number;
}

const DEFAULT_QUALITY_THRESHOLD = 60;
const DEFAULT_MAX_SAMPLES = 5;

export class RescuePipeline {
  private readonly postProcessor: PostProcessor;
  private readonly multiSampleVoter: MultiSampleVoter;
  private readonly progressiveGenerator: ProgressiveGenerator;
  private readonly failurePatternLearner: FailurePatternLearner;
  private readonly snippetLibrary: SnippetLibrary;
  private readonly constraintDrivenGenerator: ConstraintDrivenGenerator;
  private readonly qualityScorer: QualityScorer;

  constructor(llm: LLMAdapter) {
    this.postProcessor = new PostProcessor();
    this.multiSampleVoter = new MultiSampleVoter(llm);
    this.progressiveGenerator = new ProgressiveGenerator(llm);
    this.failurePatternLearner = new FailurePatternLearner();
    this.snippetLibrary = new SnippetLibrary();
    this.constraintDrivenGenerator = new ConstraintDrivenGenerator(llm);
    this.qualityScorer = new QualityScorer();
  }

  public async rescue(
    code: string,
    language: string,
    context?: RescueContext,
    options?: RescueOptions,
  ): Promise<RescueResult> {
    const startTime = Date.now();
    const steps: RescueStep[] = [];
    let currentCode = code;
    let strategy: RescueResult['strategy'] = 'postprocess';
    const qualityThreshold = options?.qualityThreshold ?? DEFAULT_QUALITY_THRESHOLD;

    logger.info(
      `[RescuePipeline] Starting rescue: code length=${code.length}, language=${language}`,
    );

    const qualityBeforeResult = this.runStep(
      steps,
      'quality-scoring',
      () => this.qualityScorer.score(code, language),
    );
    const qualityBefore = qualityBeforeResult.score;

    logger.info(`[RescuePipeline] Initial quality score: ${qualityBefore}`);

    if (qualityBefore >= qualityThreshold) {
      logger.info(`[RescuePipeline] Quality already sufficient (${qualityBefore} >= ${qualityThreshold}), skipping rescue`);
      return this.buildResult(code, code, qualityBefore, qualityBefore, steps, startTime, 'postprocess', true);
    }

    if (!options?.skipPostProcess) {
      const postProcessResult = await this.runStepAsync(
        steps,
        'post-processing',
        async () => this.postProcessor.process(currentCode, language),
      );

      if (postProcessResult.success && postProcessResult.code) {
        currentCode = postProcessResult.code;
        logger.info(`[RescuePipeline] Post-processing applied, code length: ${currentCode.length}`);
      }

      const afterPostScore = this.qualityScorer.score(currentCode, language).score;
      logger.info(`[RescuePipeline] Quality after post-processing: ${afterPostScore}`);

      if (afterPostScore >= qualityThreshold) {
        logger.info(`[RescuePipeline] Post-processing sufficient, score=${afterPostScore}`);
        return this.buildResult(code, currentCode, qualityBefore, afterPostScore, steps, startTime, 'postprocess', true);
      }
    }

    if (context?.userRequest) {
      const constraintResult = await this.runStepAsync(
        steps,
        'constraint-validation',
        async () => {
          try {
            const constraints = context.constraints ??
              await this.constraintDrivenGenerator.extractConstraints(context.userRequest!);
            const blocks: CodeBlock[] = [{ language, code: currentCode }];
            const validationResult = this.constraintDrivenGenerator.validateConstraints(blocks, constraints);
            return { success: true, details: { constraints, validationResult } };
          } catch (error) {
            return { success: false, details: { error: error instanceof Error ? error.message : String(error) } };
          }
        },
      );

      if (constraintResult.success && constraintResult.details) {
        const details = constraintResult.details as { validationResult: { valid: boolean } };
        if (!details.validationResult.valid) {
          logger.warn(`[RescuePipeline] Constraint validation failed, will continue rescue`);
        }
      }
    }

    if (!options?.skipSnippetInjection && context?.framework) {
      const injectionResult = this.runStep(
        steps,
        'snippet-injection',
        () => this.injectSnippets(currentCode, language, context),
      );

      if (injectionResult.success && injectionResult.code) {
        currentCode = injectionResult.code;
        strategy = 'injection';
        logger.info(`[RescuePipeline] Snippet injection applied`);

        const afterInjectionScore = this.qualityScorer.score(currentCode, language).score;
        logger.info(`[RescuePipeline] Quality after injection: ${afterInjectionScore}`);

        if (afterInjectionScore >= qualityThreshold) {
          return this.buildResult(code, currentCode, qualityBefore, afterInjectionScore, steps, startTime, 'injection', true);
        }
      }
    }

    const currentScore = this.qualityScorer.score(currentCode, language).score;

    if (currentScore < qualityThreshold) {
      const resampleResult = await this.runStepAsync(
        steps,
        'multi-sample-voting',
        async () => {
          const maxSamples = options?.maxSamples ?? DEFAULT_MAX_SAMPLES;
          const request = context?.userRequest ?? `Improve the quality of this ${language} code`;
          return this.multiSampleVoter.vote(currentCode, request, language, maxSamples);
        },
      );

      if (resampleResult.success && resampleResult.code) {
        currentCode = resampleResult.code;
        strategy = 'resample';
        logger.info(`[RescuePipeline] Multi-sample voting applied`);

        const afterResampleScore = this.qualityScorer.score(currentCode, language).score;
        logger.info(`[RescuePipeline] Quality after resampling: ${afterResampleScore}`);

        if (afterResampleScore >= qualityThreshold) {
          return this.buildResult(code, currentCode, qualityBefore, afterResampleScore, steps, startTime, 'resample', true);
        }
      }
    }

    const currentScore2 = this.qualityScorer.score(currentCode, language).score;

    if (currentScore2 < qualityThreshold || options?.forceProgressive) {
      const progressiveResult = await this.runStepAsync(
        steps,
        'progressive-generation',
        async () => {
          const request = context?.userRequest ?? `Regenerate and improve this ${language} code with proper structure and error handling`;
          return this.progressiveGenerator.generateProgressively(request, language);
        },
      );

      if (progressiveResult.success && progressiveResult.code) {
        currentCode = progressiveResult.code;
        strategy = 'progressive';
        logger.info(`[RescuePipeline] Progressive generation applied`);
      }
    }

    const qualityAfterResult = this.qualityScorer.score(currentCode, language);
    const qualityAfter = qualityAfterResult.score;
    const passed = qualityAfter >= qualityThreshold;

    this.runStep(
      steps,
      'failure-pattern-recording',
      () => {
        if (!passed) {
          this.failurePatternLearner.recordFailure({
            request: context?.userRequest ?? 'unknown',
            generatedCode: currentCode,
            failureReason: `Quality score ${qualityAfter} below threshold ${qualityThreshold} after all rescue attempts`,
            failureType: this.classifyFailureType(qualityAfterResult),
            fixStrategy: `Applied rescue pipeline with strategy: ${strategy}`,
            fixCode: currentCode,
          });
          logger.info(`[RescuePipeline] Failure pattern recorded for learning`);
        }
        return { recorded: !passed };
      },
    );

    logger.info(
      `[RescuePipeline] Rescue complete: quality ${qualityBefore} -> ${qualityAfter}, passed=${passed}, strategy=${strategy}`,
    );

    return this.buildResult(code, currentCode, qualityBefore, qualityAfter, steps, startTime, strategy, passed);
  }

  private runStep<T>(
    steps: RescueStep[],
    name: string,
    fn: () => T,
  ): T {
    const start = Date.now();
    logger.info(`[RescuePipeline] Step started: ${name}`);

    try {
      const result = fn();
      const duration = Date.now() - start;
      steps.push({ name, success: true, duration, details: result });
      logger.info(`[RescuePipeline] Step completed: ${name} (${duration}ms)`);
      return result;
    } catch (error) {
      const duration = Date.now() - start;
      const errorMsg = error instanceof Error ? error.message : String(error);
      steps.push({ name, success: false, duration, details: { error: errorMsg } });
      logger.error(`[RescuePipeline] Step failed: ${name}: ${errorMsg}`);
      throw error;
    }
  }

  private async runStepAsync<T extends { success: boolean; code?: string; details?: unknown }>(
    steps: RescueStep[],
    name: string,
    fn: () => Promise<T>,
  ): Promise<T> {
    const start = Date.now();
    logger.info(`[RescuePipeline] Async step started: ${name}`);

    try {
      const result = await fn();
      const duration = Date.now() - start;
      steps.push({ name, success: result.success, duration, details: result.details ?? result });
      logger.info(`[RescuePipeline] Async step completed: ${name} (${duration}ms)`);
      return result;
    } catch (error) {
      const duration = Date.now() - start;
      const errorMsg = error instanceof Error ? error.message : String(error);
      steps.push({ name, success: false, duration, details: { error: errorMsg } });
      logger.error(`[RescuePipeline] Async step failed: ${name}: ${errorMsg}`);
      return { success: false } as T;
    }
  }

  private injectSnippets(
    code: string,
    language: string,
    context: RescueContext,
  ): { success: boolean; code?: string; framework?: string } {
    const framework = context.framework ?? '';
    const userRequest = context.userRequest ?? '';

    const matches = this.snippetLibrary.findBestMatches(`${framework} ${userRequest}`);

    if (matches.length === 0) {
      logger.info(`[RescuePipeline] No matching snippets found for injection`);
      return { success: false };
    }

    let enhancedCode = code;

    for (const match of matches.slice(0, 3)) {
      const snippetCode = match.snippet.code;

      if (language.toLowerCase().includes(match.snippet.language.toLowerCase())) {
        const hasImports = snippetCode.includes('import') || snippetCode.includes('require');
        const hasClass = snippetCode.includes('class ') || snippetCode.includes('function ');

        if (hasImports) {
          const importLines = snippetCode.split('\n').filter(
            line => line.includes('import') || line.includes('require')
          );

          const existingLines = enhancedCode.split('\n');
          let firstNonImportIndex = 0;
          for (let i = 0; i < existingLines.length; i++) {
            if (!existingLines[i].includes('import') && !existingLines[i].includes('require') && existingLines[i].trim() !== '') {
              firstNonImportIndex = i;
              break;
            }
          }

          for (const importLine of importLines) {
            if (!enhancedCode.includes(importLine.trim())) {
              existingLines.splice(firstNonImportIndex, 0, importLine);
              firstNonImportIndex++;
            }
          }

          enhancedCode = existingLines.join('\n');
        }

        if (hasClass && !enhancedCode.includes(snippetCode.trim().substring(0, 50))) {
          enhancedCode += `\n\n// Framework pattern injected: ${match.snippet.name}\n${snippetCode}`;
        }
      }
    }

    return { success: enhancedCode !== code, code: enhancedCode, framework };
  }

  private classifyFailureType(result: QualityScoreResult): 'syntax' | 'logic' | 'security' | 'performance' | 'context' {
    if (result.errors.some(e => e.toLowerCase().includes('syntax') || e.toLowerCase().includes('brace') || e.toLowerCase().includes('parenthesis') || e.toLowerCase().includes('indent'))) {
      return 'syntax';
    }
    if (result.errors.some(e => e.toLowerCase().includes('secret') || e.toLowerCase().includes('eval') || e.toLowerCase().includes('exec') || e.toLowerCase().includes('xss'))) {
      return 'security';
    }
    if (result.warnings.some(w => w.toLowerCase().includes('performance') || w.toLowerCase().includes('nested loop') || w.toLowerCase().includes('blocks'))) {
      return 'performance';
    }
    if (result.errors.some(e => e.toLowerCase().includes('empty') || e.toLowerCase().includes('todo') || e.toLowerCase().includes('fixme'))) {
      return 'logic';
    }
    return 'context';
  }

  private buildResult(
    originalCode: string,
    rescuedCode: string,
    qualityBefore: number,
    qualityAfter: number,
    steps: RescueStep[],
    startTime: number,
    strategy: RescueResult['strategy'],
    passed: boolean,
  ): RescueResult {
    return {
      originalCode,
      rescuedCode,
      qualityBefore,
      qualityAfter,
      steps,
      totalDuration: Date.now() - startTime,
      strategy,
      passed,
    };
  }
}
