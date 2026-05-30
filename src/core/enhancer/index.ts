/**
 * 统一代码增强器 - 智能「救+升」双管线系统主入口
 *
 * 核心理念：
 * - 烂代码要救：1.3B 生成的代码，通过后处理/投票/渐进生成救到能跑
 * - 好代码要升：3B 生成的代码，不能放着不动，要提升到生产级
 *
 * 架构：
 * 1. 质量检测 → 2. 智能路由 → 3. 救烂管线 / 提升管线 → 4. 最终验证
 */

import type { LLMAdapter } from '@/llm/base.js';
import { logger } from '@/utils/logger.js';

import { RescuePipeline } from './rescue-pipeline.js';
import { ElevationPipeline } from './elevation-pipeline.js';
import { QualityScorer } from './quality-scorer.js';
import { CodeEvaluator, type EvaluationCriteria, type EvaluationReport } from './code-evaluator.js';
import { SnippetExtractor, type ExtractedSnippet, type CategorizedSnippet } from './snippet-extractor.js';

export interface DualPipelineConfig {
  llm: LLMAdapter;
  snippetDir?: string;
  projectDir?: string;
  rescueThreshold?: number;
  elevateThreshold?: number;
  productionThreshold?: number;
  maxRescueAttempts?: number;
  enableRescue?: boolean;
  enableElevation?: boolean;
}

export interface ProcessResult {
  originalCode: string;
  finalCode: string;
  route: 'rescue' | 'elevate' | 'pass';
  qualityBefore: number;
  qualityAfter: number;
  tier: 'rescue' | 'elevate' | 'production';
  summary: string;
  testCode?: string;
  duration: number;
  steps: Array<{ name: string; success: boolean; duration: number }>;
}

export interface BuildSnippetLibraryOptions {
  scanPaths: string[];
  outputDir?: string;
  minQualityScore?: number;
  categories?: string[];
}

export interface BuildLibraryResult {
  totalSnippets: number;
  categorizedCount: number;
  byCategory: Record<string, number>;
  qualityDistribution: {
    excellent: number;
    good: number;
    fair: number;
    poor: number;
  };
}

const DEFAULT_CONFIG: Required<Omit<DualPipelineConfig, 'llm'>> = {
  rescueThreshold: 40,
  elevateThreshold: 70,
  productionThreshold: 85,
  maxRescueAttempts: 2,
  enableRescue: true,
  enableElevation: true,
  snippetDir: '.miniagent/snippets',
  projectDir: process.cwd(),
};

export class DualPipelineEnhancer {
  private readonly config: Required<DualPipelineConfig>;
  private readonly qualityScorer: QualityScorer;
  private readonly rescuePipeline: RescuePipeline;
  private readonly elevationPipeline: ElevationPipeline;
  private readonly codeEvaluator: CodeEvaluator;
  private readonly snippetExtractor: SnippetExtractor;

  constructor(config: DualPipelineConfig) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.qualityScorer = new QualityScorer();
    this.rescuePipeline = new RescuePipeline(this.config.llm);
    this.elevationPipeline = new ElevationPipeline(this.config.llm);
    this.codeEvaluator = new CodeEvaluator(this.config.llm);
    this.snippetExtractor = new SnippetExtractor(this.config.llm);

    logger.info(
      '[DualPipelineEnhancer] initialized: rescueThreshold=%d, elevateThreshold=%d',
      this.config.rescueThreshold,
      this.config.elevateThreshold,
    );
  }

  async process(
    code: string,
    language: string,
    context?: { userRequest?: string; framework?: string; projectPath?: string },
  ): Promise<ProcessResult> {
    const startTime = Date.now();
    logger.info('[DualPipelineEnhancer] process started: language=%s, codeLength=%d', language, code.length);

    const scoreResult = this.qualityScorer.score(code, language);
    const { score, tier } = scoreResult;

    logger.info(
      '[DualPipelineEnhancer] quality scored: %d, tier=%s',
      score,
      tier,
    );

    if (score >= this.config.productionThreshold) {
      logger.info('[DualPipelineEnhancer] code already production-quality, skipping');
      return this.buildPassResult(code, score, Date.now() - startTime);
    }

    if (tier === 'rescue' && this.config.enableRescue) {
      return this.handleRescue(code, language, score, context, startTime);
    }

    if (tier === 'elevate' && this.config.enableElevation) {
      return this.handleElevation(code, language, score, startTime);
    }

    logger.info('[DualPipelineEnhancer] no action needed for tier=%s', tier);
    return this.buildPassResult(code, score, Date.now() - startTime);
  }

  async compare(
    codeA: string,
    codeB: string,
    language: string,
    criteria?: EvaluationCriteria,
  ): Promise<EvaluationReport> {
    logger.info('[DualPipelineEnhancer] comparing two code samples: language=%s', language);
    const report = await this.codeEvaluator.evaluate(codeA, codeB, language, criteria);
    logger.info(
      '[DualPipelineEnhancer] comparison complete: winner=%s, A=%d, B=%d',
      report.winner,
      report.codeAScore,
      report.codeBScore,
    );
    return report;
  }

  async buildSnippetLibrary(options: BuildSnippetLibraryOptions): Promise<BuildLibraryResult> {
    logger.info('[DualPipelineEnhancer] building snippet library from %d paths', options.scanPaths.length);

    const allSnippets: ExtractedSnippet[] = [];
    const minQuality = options.minQualityScore ?? 60;

    for (const scanPath of options.scanPaths) {
      try {
        const snippets = await this.snippetExtractor.extractFromProject(scanPath);
        const filtered = snippets.filter((s) => s.qualityScore >= minQuality);
        allSnippets.push(...filtered);
        logger.info(
          '[DualPipelineEnhancer] scanned %s: %d/%d snippets passed quality filter',
          scanPath,
          filtered.length,
          snippets.length,
        );
      } catch (error) {
        logger.error('[DualPipelineEnhancer] failed to scan %s:', scanPath, error);
      }
    }

    const categorized: CategorizedSnippet[] = [];
    for (const snippet of allSnippets) {
      try {
        const cat = await this.snippetExtractor.categorizeSnippet(snippet);
        categorized.push(cat);
      } catch (error) {
        logger.error('[DualPipelineEnhancer] failed to categorize snippet "%s":', snippet.name, error);
      }
    }

    const byCategory: Record<string, number> = {};
    for (const cat of categorized) {
      const key = `${cat.category}/${cat.subcategory}`;
      byCategory[key] = (byCategory[key] ?? 0) + 1;
    }

    const qualityDistribution = { excellent: 0, good: 0, fair: 0, poor: 0 };
    for (const s of allSnippets) {
      if (s.qualityScore >= 80) qualityDistribution.excellent++;
      else if (s.qualityScore >= 60) qualityDistribution.good++;
      else if (s.qualityScore >= 40) qualityDistribution.fair++;
      else qualityDistribution.poor++;
    }

    logger.info(
      '[DualPipelineEnhancer] snippet library built: %d total, %d categorized',
      allSnippets.length,
      categorized.length,
    );

    return {
      totalSnippets: allSnippets.length,
      categorizedCount: categorized.length,
      byCategory,
      qualityDistribution,
    };
  }

  async extractAndCategorize(code: string, language: string, filePath?: string): Promise<CategorizedSnippet[]> {
    const snippets = await this.snippetExtractor.extractSnippets(code, language);
    const results: CategorizedSnippet[] = [];
    for (const s of snippets) {
      if (filePath) s.filePath = filePath;
      results.push(await this.snippetExtractor.categorizeSnippet(s));
    }
    return results;
  }

  private async handleRescue(
    code: string,
    language: string,
    score: number,
    context: { userRequest?: string; framework?: string; projectPath?: string } | undefined,
    startTime: number,
  ): Promise<ProcessResult> {
    logger.info('[DualPipelineEnhancer] routing to RESCUE pipeline');

    let attempts = 0;
    let currentCode = code;
    let currentScore = score;
    const allSteps: Array<{ name: string; success: boolean; duration: number }> = [];

    while (attempts < this.config.maxRescueAttempts) {
      attempts++;
      logger.info('[DualPipelineEnhancer] rescue attempt %d/%d', attempts, this.config.maxRescueAttempts);

      const rescueResult = await this.rescuePipeline.rescue(currentCode, language, {
        userRequest: context?.userRequest,
        framework: context?.framework,
        projectPath: context?.projectPath,
      });

      allSteps.push(
        ...rescueResult.steps.map((s) => ({
          name: `rescue-attempt-${attempts}/${s.name}`,
          success: s.success,
          duration: s.duration,
        })),
      );

      currentCode = rescueResult.rescuedCode;
      currentScore = rescueResult.qualityAfter;

      if (rescueResult.passed) {
        logger.info(
          '[DualPipelineEnhancer] rescue SUCCEEDED on attempt %d: %d -> %d',
          attempts,
          score,
          currentScore,
        );

        const totalDuration = Date.now() - startTime;
        const summary = this.buildRescueSummary(rescueResult, attempts);

        return {
          originalCode: code,
          finalCode: currentCode,
          route: 'rescue',
          qualityBefore: score,
          qualityAfter: currentScore,
          tier: 'rescue',
          summary,
          duration: totalDuration,
          steps: allSteps,
        };
      }

      const newScoreResult = this.qualityScorer.score(currentCode, language);
      currentScore = newScoreResult.score;

      if (currentScore > score) {
        logger.info('[DualPipelineEnhancer] quality improved: %d -> %d, continuing', score, currentScore);
        score = currentScore;
      } else {
        logger.info('[DualPipelineEnhancer] quality not improved, trying elevation instead');
        return this.handleElevation(currentCode, language, currentScore, startTime);
      }
    }

    logger.warn('[DualPipelineEnhancer] rescue failed after %d attempts, falling back to elevation', attempts);
    return this.handleElevation(currentCode, language, currentScore, startTime);
  }

  private async handleElevation(
    code: string,
    language: string,
    score: number,
    startTime: number,
  ): Promise<ProcessResult> {
    logger.info('[DualPipelineEnhancer] routing to ELEVATION pipeline');

    const elevationResult = await this.elevationPipeline.elevate(code, language);

    const totalDuration = Date.now() - startTime;
    const finalScoreResult = this.qualityScorer.score(elevationResult.elevatedCode, language);
    const finalScore = finalScoreResult.score;

    const steps = elevationResult.steps.map((s) => ({
      name: `elevation/${s.name}`,
      success: s.success,
      duration: s.duration,
    }));

    logger.info(
      '[DualPipelineEnhancer] elevation complete: %d -> %d, steps=%d succeeded/%d failed',
      score,
      finalScore,
      steps.filter((s) => s.success).length,
      steps.filter((s) => !s.success).length,
    );

    return {
      originalCode: code,
      finalCode: elevationResult.elevatedCode,
      route: 'elevate',
      qualityBefore: score,
      qualityAfter: finalScore,
      tier: 'elevate',
      summary: elevationResult.summary,
      testCode: elevationResult.testCode,
      duration: totalDuration,
      steps,
    };
  }

  private buildPassResult(
    code: string,
    score: number,
    duration: number,
  ): ProcessResult {
    return {
      originalCode: code,
      finalCode: code,
      route: 'pass',
      qualityBefore: score,
      qualityAfter: score,
      tier: 'production',
      summary: `Code passed quality check with score ${score}/100. No enhancement needed.`,
      duration,
      steps: [{ name: 'quality-check', success: true, duration: 0 }],
    };
  }

  private buildRescueSummary(rescueResult: any, attempts: number): string {
    const lines: string[] = [];
    lines.push(
      `Rescue pipeline succeeded on attempt ${attempts}: quality ${rescueResult.qualityBefore} -> ${rescueResult.qualityAfter}.`,
    );
    lines.push(`Strategy used: ${rescueResult.strategy}`);
    lines.push(`Steps executed: ${rescueResult.steps.length}`);
    lines.push(`Steps succeeded: ${rescueResult.steps.filter((s: any) => s.success).length}`);
    return lines.join('\n');
  }
}

export { RescuePipeline, ElevationPipeline, QualityScorer, CodeEvaluator, SnippetExtractor };
export type { ExtractedSnippet, CategorizedSnippet } from './snippet-extractor.js';
export type { EvaluationCriteria, EvaluationReport } from './code-evaluator.js';
export type { RescueResult, RescueStep, RescueContext } from './rescue-pipeline.js';
export type { ElevationResult, ElevationStepResult, ElevationOptions } from './elevation-pipeline.js';
export type { QualityScoreResult } from './quality-scorer.js';
