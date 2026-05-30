import { logger } from '@/utils/logger';
import type { LLMAdapter, ChatParams } from '@/llm/base.js';

export interface DocGenerationResult {
  documentedCode: string;
  docStrings: number;
}

export interface DocGenerationOptions {
  temperature?: number;
  maxTokens?: number;
  includeModuleDocs?: boolean;
  includeFunctionDocs?: boolean;
  includeClassDocs?: boolean;
  docStyle?: 'jsdoc' | 'docstring' | 'auto';
}

const DEFAULT_OPTIONS: Required<Omit<DocGenerationOptions, 'docStyle'>> & Pick<DocGenerationOptions, 'docStyle'> = {
  temperature: 0.2,
  maxTokens: 8192,
  includeModuleDocs: true,
  includeFunctionDocs: true,
  includeClassDocs: true,
  docStyle: 'auto',
};

export class DocGenerator {
  private llm: LLMAdapter;

  constructor(llm: LLMAdapter) {
    this.llm = llm;
    logger.info('[DocGenerator] initialized');
  }

  async generateDocs(
    code: string,
    language: string,
    options?: DocGenerationOptions
  ): Promise<DocGenerationResult> {
    logger.info('[DocGenerator] generating docs...', { language, codeLength: code.length });

    const opts = { ...DEFAULT_OPTIONS, ...options };
    const docStyle = opts.docStyle === 'auto' ? this.detectDocStyle(language) : (opts.docStyle ?? 'jsdoc');

    try {
      const prompt = this.buildDocPrompt(code, language, docStyle, opts);

      const result = await this.llm.chatOnce({
        messages: [{ role: 'user', content: prompt }],
        systemPrompt: this.buildSystemPrompt(language, docStyle),
        temperature: opts.temperature,
        maxTokens: opts.maxTokens,
      });

      const documentedCode = this.extractDocumentedCode(result.content ?? '');
      const docStrings = this.countDocStrings(documentedCode, docStyle);

      logger.info('[DocGenerator] doc generation complete', { docStyle, docStrings });

      return { documentedCode, docStrings };
    } catch (error) {
      logger.error('[DocGenerator] doc generation failed:', error);
      throw new Error(`Doc generation failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private buildDocPrompt(
    code: string,
    language: string,
    docStyle: string,
    options: Required<Omit<DocGenerationOptions, 'docStyle'>> & Pick<DocGenerationOptions, 'docStyle'>
  ): string {
    const sections: string[] = [];

    sections.push(`## Source Code

Add documentation to the following ${language} code:

\`\`\`${language}
${code}
\`\`\`
`);

    sections.push(`## Documentation Requirements

Doc style: ${docStyle}

Generate documentation for:`);

    if (options.includeModuleDocs) {
      sections.push('- Module-level documentation: purpose, overview, usage examples');
    }
    if (options.includeClassDocs) {
      sections.push('- Classes: class description, attributes, inheritance');
    }
    if (options.includeFunctionDocs) {
      sections.push('- Functions/methods: description, parameters, return values, exceptions, examples');
    }

    sections.push(`
## Documentation Format

Use ${docStyle} format:
${docStyle === 'jsdoc' ? '- JSDoc comments: /** ... */ with @param, @returns, @throws, @example tags' : '- Python docstrings: """ ... """ with Args, Returns, Raises sections'}

## Instructions

1. Analyze all functions, classes, and module structure
2. Write clear, concise documentation for each element
3. Document all parameters with types and descriptions
4. Document return values and their types
5. Document exceptions/errors that may be raised
6. Include usage examples for complex functions
7. Preserve all existing code logic unchanged
8. Output only the documented code, no additional explanation`);

    return sections.join('\n');
  }

  private buildSystemPrompt(language: string, docStyle: string): string {
    return `You are an expert technical writer specializing in code documentation for ${language}.

Your task is to add comprehensive documentation to existing code.

Documentation style: ${docStyle}

Rules:
- Write clear, accurate, and complete documentation
- Use ${docStyle} format consistently
- Document all public functions, classes, and methods
- Include parameter descriptions, return values, and exceptions
- Add usage examples for complex functions
- Write module-level documentation summarizing the purpose
- Preserve all existing code logic and structure
- Do not modify any existing code, only add documentation
- Output only the documented code, no markdown or explanations`;
  }

  private extractDocumentedCode(content: string): string {
    const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;
    const match = codeBlockRegex.exec(content);

    if (match) {
      return match[2].trim();
    }

    return content.trim();
  }

  private countDocStrings(code: string, docStyle: string): number {
    let count = 0;

    if (docStyle === 'jsdoc') {
      count = (code.match(/\/\*\*[\s\S]*?\*\//g) || []).length;
    } else if (docStyle === 'docstring') {
      const tripleDouble = (code.match(/"""[\s\S]*?"""/g) || []).length;
      const tripleSingle = (code.match(/'''[\s\S]*?'''/g) || []).length;
      count = tripleDouble + tripleSingle;
    }

    return count;
  }

  private detectDocStyle(language: string): string {
    const lang = language.toLowerCase();

    if (lang === 'python') return 'docstring';
    if (lang === 'typescript' || lang === 'javascript') return 'jsdoc';

    return 'jsdoc';
  }
}
