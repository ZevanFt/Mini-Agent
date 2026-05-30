import { logger } from '@/utils/logger';
import type { LLMAdapter } from '@/llm/base.js';
import { SecurityHardener } from './security-hardener';
import { TypeCompleter } from './type-completer';
import { DocGenerator } from './doc-generator';
import { TestGenerator } from './test-generator';
import { LogInjector } from '../log-injector';

export interface ElevationStepResult {
  name: string;
  success: boolean;
  duration: number;
  result: any;
}

export interface ElevationResult {
  originalCode: string;
  elevatedCode: string;
  steps: ElevationStepResult[];
  totalDuration: number;
  testCode: string;
  summary: string;
}

export interface ElevationOptions {
  securityHardening?: boolean;
  typeCompletion?: boolean;
  documentation?: boolean;
  testGeneration?: boolean;
  logInjection?: boolean;
}

const DEFAULT_OPTIONS: Required<ElevationOptions> = {
  securityHardening: true,
  typeCompletion: true,
  documentation: true,
  testGeneration: true,
  logInjection: true,
};

export class ElevationPipeline {
  private llm: LLMAdapter;
  private securityHardener: SecurityHardener;
  private typeCompleter: TypeCompleter;
  private docGenerator: DocGenerator;
  private testGenerator: TestGenerator;
  private logInjector: LogInjector;

  constructor(llm: LLMAdapter) {
    this.llm = llm;
    this.securityHardener = new SecurityHardener(llm);
    this.typeCompleter = new TypeCompleter(llm);
    this.docGenerator = new DocGenerator(llm);
    this.testGenerator = new TestGenerator(llm);
    this.logInjector = new LogInjector();
    logger.info('[ElevationPipeline] initialized');
  }

  async elevate(
    code: string,
    language: string,
    options?: ElevationOptions
  ): Promise<ElevationResult> {
    const startTime = Date.now();
    const opts = { ...DEFAULT_OPTIONS, ...options };

    logger.info('[ElevationPipeline] elevate started', { language, codeLength: code.length, options: opts });

    let currentCode = code;
    const steps: ElevationStepResult[] = [];
    let testCode = '';

    if (opts.securityHardening) {
      const step = await this.runStep(
        'Security Hardening',
        async () => {
          const result = await this.securityHardener.harden(currentCode, language);
          currentCode = result.hardenedCode;
          return { issuesFixed: result.issuesFixed, suggestions: result.suggestions };
        }
      );
      steps.push(step);
    }

    if (opts.typeCompletion) {
      const step = await this.runStep(
        'Type Completion',
        async () => {
          const result = await this.typeCompleter.completeTypes(currentCode, language);
          currentCode = result.typedCode;
          return { typesAdded: result.typesAdded };
        }
      );
      steps.push(step);
    }

    if (opts.documentation) {
      const step = await this.runStep(
        'Documentation Generation',
        async () => {
          const result = await this.docGenerator.generateDocs(currentCode, language);
          currentCode = result.documentedCode;
          return { docStrings: result.docStrings };
        }
      );
      steps.push(step);
    }

    if (opts.testGeneration) {
      const step = await this.runStep(
        'Test Generation',
        async () => {
          const result = await this.testGenerator.generateTests(currentCode, language);
          testCode = result.testCode;
          return { framework: result.framework, testCount: result.testCount };
        }
      );
      steps.push(step);
    }

    if (opts.logInjection) {
      const step = await this.runStep(
        'Log Injection',
        async () => {
          const result = this.logInjector.inject(currentCode, language);
          currentCode = result;
          return { injected: true };
        }
      );
      steps.push(step);
    }

    const totalDuration = Date.now() - startTime;
    const summary = this.buildSummary(steps, language);

    logger.info('[ElevationPipeline] elevate completed', {
      totalDuration,
      stepsCompleted: steps.length,
      stepsSucceeded: steps.filter((s) => s.success).length,
    });

    return {
      originalCode: code,
      elevatedCode: currentCode,
      steps,
      totalDuration,
      testCode,
      summary,
    };
  }

  private async runStep(
    name: string,
    fn: () => Promise<any>
  ): Promise<ElevationStepResult> {
    const stepStart = Date.now();
    logger.info(`[ElevationPipeline] step started: ${name}`);

    try {
      const result = await fn();
      const duration = Date.now() - stepStart;
      logger.info(`[ElevationPipeline] step completed: ${name}`, { duration, result });
      return { name, success: true, duration, result };
    } catch (error) {
      const duration = Date.now() - stepStart;
      logger.error(`[ElevationPipeline] step failed: ${name}`, {
        duration,
        error: error instanceof Error ? error.message : String(error),
      });
      return {
        name,
        success: false,
        duration,
        result: { error: error instanceof Error ? error.message : String(error) },
      };
    }
  }

  private buildSummary(steps: ElevationStepResult[], language: string): string {
    const lines: string[] = [];
    lines.push(`Elevation pipeline completed for ${language} code.`);
    lines.push(`Steps executed: ${steps.length}`);
    lines.push(`Steps succeeded: ${steps.filter((s) => s.success).length}`);
    lines.push(`Steps failed: ${steps.filter((s) => !s.success).length}`);
    lines.push('');

    for (const step of steps) {
      const status = step.success ? 'SUCCESS' : 'FAILED';
      const duration = `${step.duration}ms`;
      lines.push(`  [${status}] ${step.name} (${duration})`);

      if (step.success && step.result) {
        if (step.result.issuesFixed !== undefined) {
          lines.push(`    - Security issues fixed: ${step.result.issuesFixed}`);
        }
        if (step.result.typesAdded !== undefined) {
          lines.push(`    - Type annotations added: ${step.result.typesAdded}`);
        }
        if (step.result.docStrings !== undefined) {
          lines.push(`    - Doc strings added: ${step.result.docStrings}`);
        }
        if (step.result.testCount !== undefined) {
          lines.push(`    - Test cases generated: ${step.result.testCount}`);
        }
        if (step.result.injected) {
          lines.push('    - Logging statements injected');
        }
      }

      if (!step.success && step.result?.error) {
        lines.push(`    - Error: ${step.result.error}`);
      }
    }

    return lines.join('\n');
  }
}
