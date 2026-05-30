import type { LLMAdapter, ChatParams } from '@/llm/base.js';
import { logger } from '@/utils/logger';

interface VoteResult {
  success: boolean;
  code: string;
}

interface SampleScore {
  index: number;
  code: string;
  score: number;
  metrics: {
    braceBalance: boolean;
    hasImports: boolean;
    hasErrorHandling: boolean;
    lineCount: number;
    emptyFuncCount: number;
  };
}

export class MultiSampleVoter {
  private readonly llm: LLMAdapter;

  constructor(llm: LLMAdapter) {
    this.llm = llm;
  }

  async vote(code: string, request: string, language: string, n: number): Promise<VoteResult> {
    logger.info(`[MultiSampleVoter] Starting voting, n=${n}, language=${language}, code length=${code.length}`);

    try {
      const samples = await this.generateSamples(code, request, language, n);

      if (samples.length === 0) {
        logger.warn(`[MultiSampleVoter] No samples generated`);
        return { success: false, code };
      }

      logger.info(`[MultiSampleVoter] Generated ${samples.length} samples, scoring each`);

      const scoredSamples = samples.map((sampleCode, index) => {
        const metrics = this.computeMetrics(sampleCode, language);
        const score = this.computeQualityScore(metrics, sampleCode, language);
        return {
          index,
          code: sampleCode,
          score,
          metrics,
        };
      });

      scoredSamples.forEach((sample) => {
        logger.info(`[MultiSampleVoter] Sample ${sample.index}: score=${sample.score}, metrics=${JSON.stringify(sample.metrics)}`);
      });

      const bestSample = scoredSamples.reduce((best, current) =>
        current.score > best.score ? current : best
      , scoredSamples[0]);

      logger.info(`[MultiSampleVoter] Best sample selected: index=${bestSample.index}, score=${bestSample.score}`);

      return { success: true, code: bestSample.code };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error(`[MultiSampleVoter] Voting failed: ${message}`);
      return { success: false, code };
    }
  }

  private async generateSamples(code: string, request: string, language: string, n: number): Promise<string[]> {
    const samples: string[] = [];
    const prompt = this.buildSamplingPrompt(code, request, language);

    for (let i = 0; i < n; i++) {
      logger.info(`[MultiSampleVoter] Generating sample ${i + 1}/${n}`);

      try {
        const params: ChatParams = {
          messages: [
            { role: 'user', content: prompt },
          ],
          temperature: 0.7 + (i * 0.05),
          maxTokens: 4096,
        };

        const response = await this.llm.chatOnce(params);
        const sampleCode = this.extractCodeFromResponse(response.content, language);

        if (sampleCode.trim().length > 0) {
          samples.push(sampleCode);
          logger.info(`[MultiSampleVoter] Sample ${i + 1} generated, length=${sampleCode.length}`);
        } else {
          logger.warn(`[MultiSampleVoter] Sample ${i + 1} returned empty code`);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logger.error(`[MultiSampleVoter] Failed to generate sample ${i + 1}: ${message}`);
      }
    }

    return samples;
  }

  private buildSamplingPrompt(originalCode: string, request: string, language: string): string {
    return `You are an expert code generator. Please regenerate the following ${language} code with these improvements:
- Better error handling (try-catch/try-except blocks)
- Cleaner code structure and organization
- Proper imports for all used modules
- Follow best practices for ${language}
- Add necessary validation and edge case handling
- Ensure all functions have meaningful implementations (no empty bodies)
- Maintain the same functionality but with improved quality

Original request: ${request}

Original code:
\`\`\`${language}
${originalCode}
\`\`\`

Output only the improved code in a single \`\`\`${language} code block.`;
  }

  private extractCodeFromResponse(content: string, language: string): string {
    const codeBlockRegex = new RegExp('```' + language.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*([\\s\\S]*?)```', 'g');
    const matches = [...content.matchAll(codeBlockRegex)];

    if (matches.length > 0) {
      return matches[0][1].trim();
    }

    const genericCodeBlockRegex = /```[\s\S]*?```/g;
    const genericMatches = [...content.matchAll(genericCodeBlockRegex)];

    if (genericMatches.length > 0) {
      return genericMatches[0][0].replace(/^```[^\n]*\n?/m, '').replace(/```$/m, '').trim();
    }

    return content.trim();
  }

  private computeMetrics(code: string, language: string): SampleScore['metrics'] {
    const braceBalance = this.checkBraceBalance(code, language);
    const hasImports = this.checkHasImports(code, language);
    const hasErrorHandling = this.checkHasErrorHandling(code, language);
    const lineCount = code.split('\n').length;
    const emptyFuncCount = this.countEmptyFunctions(code, language);

    return {
      braceBalance,
      hasImports,
      hasErrorHandling,
      lineCount,
      emptyFuncCount,
    };
  }

  private computeQualityScore(metrics: SampleScore['metrics'], code: string, language: string): number {
    let score = 0;

    score += metrics.braceBalance ? 25 : 0;

    score += metrics.hasImports ? 15 : 0;

    score += metrics.hasErrorHandling ? 25 : 0;

    score += metrics.emptyFuncCount === 0 ? 20 : Math.max(0, 20 - (metrics.emptyFuncCount * 10));

    score += metrics.lineCount >= 10 ? 10 : metrics.lineCount * 1;

    const hasComments = this.checkHasComments(code);
    score += hasComments ? 5 : 0;

    return Math.min(100, Math.max(0, score));
  }

  private checkBraceBalance(code: string, language: string): boolean {
    const isBraceLanguage = ['typescript', 'javascript', 'java', 'c', 'cpp', 'csharp', 'go', 'rust', 'php', 'swift', 'kotlin'];

    if (!isBraceLanguage.includes(language.toLowerCase())) {
      return true;
    }

    const openBraces = (code.match(/{/g) || []).length;
    const closeBraces = (code.match(/}/g) || []).length;
    const openParens = (code.match(/\(/g) || []).length;
    const closeParens = (code.match(/\)/g) || []).length;

    return openBraces === closeBraces && openParens === closeParens;
  }

  private checkHasImports(code: string, _language: string): boolean {
    const importPatterns = [
      /^import\s+/m,
      /^from\s+.+\s+import/m,
      /require\(/,
    ];

    return importPatterns.some((pattern) => pattern.test(code));
  }

  private checkHasErrorHandling(code: string, language: string): boolean {
    const errorHandlingPatterns = language.toLowerCase() === 'python'
      ? [/try\s*:/, /except\s+/, /raise\s+/]
      : [/try\s*{/, /catch\s*\(/, /finally\s*{/, /throw\s+/, /\.catch\(/];

    return errorHandlingPatterns.some((pattern) => pattern.test(code));
  }

  private countEmptyFunctions(code: string, language: string): number {
    let count = 0;

    if (language.toLowerCase() === 'python') {
      const emptyPatterns = [
        /^(\s*)def\s+\w+\s*\([^)]*\)\s*:\s*pass\s*$/gm,
        /^(\s*)def\s+\w+\s*\([^)]*\)\s*:\s*\.\.\.\s*$/gm,
      ];
      for (const pattern of emptyPatterns) {
        const matches = code.match(pattern);
        if (matches) count += matches.length;
      }
    } else {
      const emptyPatterns = [
        /function\s+\w+\s*\([^)]*\)\s*\{\s*\}/g,
        /const\s+\w+\s*=\s*\([^)]*\)\s*=>\s*\{\s*\}/g,
      ];
      for (const pattern of emptyPatterns) {
        const matches = code.match(pattern);
        if (matches) count += matches.length;
      }
    }

    return count;
  }

  private checkHasComments(code: string): boolean {
    return code.includes('//') || code.includes('/*') || code.includes('#') || code.includes('/**');
  }
}
