import { logger } from '@/utils/logger';
import type { LLMAdapter, ChatParams } from '@/llm/base.js';

export interface TestGenerationResult {
  testCode: string;
  framework: string;
  testCount: number;
}

export interface TestGenerationOptions {
  framework?: 'pytest' | 'jest';
  temperature?: number;
  maxTokens?: number;
  includeHappyPath?: boolean;
  includeEdgeCases?: boolean;
  includeErrorPaths?: boolean;
}

const DEFAULT_OPTIONS: Required<Omit<TestGenerationOptions, 'framework'>> & Pick<TestGenerationOptions, 'framework'> = {
  framework: undefined,
  temperature: 0.3,
  maxTokens: 4096,
  includeHappyPath: true,
  includeEdgeCases: true,
  includeErrorPaths: true,
};

export class TestGenerator {
  private llm: LLMAdapter;

  constructor(llm: LLMAdapter) {
    this.llm = llm;
    logger.info('[TestGenerator] initialized');
  }

  async generateTests(
    code: string,
    language: string,
    options?: TestGenerationOptions
  ): Promise<TestGenerationResult> {
    logger.info('[TestGenerator] generating tests...', { language, codeLength: code.length });

    const opts = { ...DEFAULT_OPTIONS, ...options };
    const framework = opts.framework || this.detectTestFramework(language);

    try {
      const prompt = this.buildTestPrompt(code, language, framework, opts);

      const result = await this.llm.chatOnce({
        messages: [{ role: 'user', content: prompt }],
        systemPrompt: this.buildSystemPrompt(framework),
        temperature: opts.temperature,
        maxTokens: opts.maxTokens,
      });

      const testCode = this.extractTestCode(result.content);
      const testCount = this.countTests(testCode, framework);

      logger.info('[TestGenerator] test generation complete', { framework, testCount });

      return { testCode, framework, testCount };
    } catch (error) {
      logger.error('[TestGenerator] test generation failed:', error);
      throw new Error(`Test generation failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private buildTestPrompt(
    code: string,
    language: string,
    framework: string,
    options: Required<Omit<TestGenerationOptions, 'framework'>> & Pick<TestGenerationOptions, 'framework'>
  ): string {
    const sections: string[] = [];

    sections.push(`## Source Code

Generate tests for the following ${language} code:

\`\`\`${language}
${code}
\`\`\`
`);

    sections.push(`## Test Requirements

Framework: ${framework}

Generate test cases covering:`);

    if (options.includeHappyPath) {
      sections.push('- Happy path tests: normal inputs and expected outputs');
    }
    if (options.includeEdgeCases) {
      sections.push('- Edge cases: empty inputs, null/undefined, boundary values, extreme values');
    }
    if (options.includeErrorPaths) {
      sections.push('- Error paths: invalid inputs, exceptions, error handling');
    }

    sections.push(`
## Instructions

1. Analyze all functions and classes in the source code
2. Generate comprehensive test cases for each public function/method
3. Use descriptive test names that explain what is being tested
4. Include setup/teardown if needed
5. Mock external dependencies where appropriate
6. Ensure all tests are independent and deterministic
7. Output only the test code, no additional explanation`);

    return sections.join('\n');
  }

  private buildSystemPrompt(framework: string): string {
    return `You are an expert test engineer specializing in ${framework}.

Your task is to generate comprehensive, production-quality unit tests.

Rules:
- Write complete, runnable test code
- Use descriptive test names (e.g., "should return correct result when given valid input")
- Cover happy paths, edge cases, and error paths
- Use appropriate assertions for the framework
- Mock external dependencies
- Follow ${framework} best practices and conventions
- Output only the test code, no markdown or explanations`;
  }

  private extractTestCode(content: string): string {
    const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;
    const match = codeBlockRegex.exec(content);

    if (match) {
      return match[2].trim();
    }

    return content.trim();
  }

  private countTests(testCode: string, framework: string): number {
    let count = 0;

    if (framework === 'pytest') {
      count = (testCode.match(/^def\s+test_/gm) || []).length;
    } else if (framework === 'jest') {
      const itCount = (testCode.match(/\bit\s*\(/g) || []).length;
      const testCount = (testCode.match(/\btest\s*\(/g) || []).length;
      count = itCount + testCount;
    }

    return count;
  }

  private detectTestFramework(language: string): string {
    const lang = language.toLowerCase();

    if (lang === 'python') return 'pytest';
    if (lang === 'typescript' || lang === 'javascript') return 'jest';

    return 'jest';
  }
}
