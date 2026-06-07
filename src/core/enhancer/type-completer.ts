import { logger } from '../../utils/logger.js';
import type { LLMAdapter } from '../../llm/base.js';

export interface TypeCompletionResult {
  typedCode: string;
  typesAdded: number;
}

export interface TypeCompletionOptions {
  temperature?: number;
  maxTokens?: number;
  addReturnTypeAnnotations?: boolean;
  addParameterAnnotations?: boolean;
  addVariableAnnotations?: boolean;
  generateInterfaces?: boolean;
  typeStyle?: 'typescript' | 'python' | 'auto';
}

const DEFAULT_TEMPERATURE = 0.2;
const DEFAULT_MAX_TOKENS = 8192;

const DEFAULT_OPTIONS: Required<Omit<TypeCompletionOptions, 'typeStyle'>> & Pick<TypeCompletionOptions, 'typeStyle'> = {
  temperature: DEFAULT_TEMPERATURE,
  maxTokens: DEFAULT_MAX_TOKENS,
  addReturnTypeAnnotations: true,
  addParameterAnnotations: true,
  addVariableAnnotations: true,
  generateInterfaces: true,
  typeStyle: 'auto',
};

export class TypeCompleter {
  private llm: LLMAdapter;

  constructor(llm: LLMAdapter) {
    this.llm = llm;
    logger.info('[TypeCompleter] initialized');
  }

  async completeTypes(
    code: string,
    language: string,
    options?: TypeCompletionOptions
  ): Promise<TypeCompletionResult> {
    logger.info('[TypeCompleter] completing types...', { language, codeLength: code.length });

    const opts = { ...DEFAULT_OPTIONS, ...options };
    const typeStyle = opts.typeStyle === 'auto' ? this.detectTypeStyle(language) : (opts.typeStyle ?? 'typescript');

    try {
      const prompt = this.buildTypePrompt(code, language, typeStyle, opts);

      const result = await this.llm.chatOnce({
        messages: [{ role: 'user', content: prompt }],
        systemPrompt: this.buildSystemPrompt(language, typeStyle),
        temperature: opts.temperature,
        maxTokens: opts.maxTokens,
      });

      const typedCode = this.extractTypedCode(result.content ?? '');
      const typesAdded = this.countTypesAdded(typedCode, code, typeStyle);

      logger.info('[TypeCompleter] type completion complete', { typeStyle, typesAdded });

      return { typedCode, typesAdded };
    } catch (error) {
      logger.error('[TypeCompleter] type completion failed:', error);
      throw new Error(`Type completion failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private buildTypePrompt(
    code: string,
    language: string,
    typeStyle: string,
    options: Required<Omit<TypeCompletionOptions, 'typeStyle'>> & Pick<TypeCompletionOptions, 'typeStyle'>
  ): string {
    const sections: string[] = [];

    sections.push(`## Source Code

Add type annotations to the following ${language} code:

\`\`\`${language}
${code}
\`\`\`
`);

    sections.push(`## Type Annotation Requirements

Style: ${typeStyle}

Add type annotations for:`);

    if (options.addParameterAnnotations) {
      sections.push(typeStyle === 'typescript'
        ? '- Function parameters: add type annotations to all parameters'
        : '- Function parameters: add type hints to all parameters'
      );
    }
    if (options.addReturnTypeAnnotations) {
      sections.push(typeStyle === 'typescript'
        ? '- Return types: add return type annotations to all functions/methods'
        : '- Return types: add return type hints to all functions/methods'
      );
    }
    if (options.addVariableAnnotations) {
      sections.push(typeStyle === 'typescript'
        ? '- Variables: add type annotations to variable declarations'
        : '- Variables: add type hints to variable assignments'
      );
    }
    if (options.generateInterfaces) {
      sections.push(typeStyle === 'typescript'
        ? '- Interfaces: generate interface/type definitions for objects and complex data structures'
        : '- Type aliases: generate type aliases for complex data structures'
      );
    }

    sections.push(`
## Instructions

1. Analyze all functions, classes, and data structures
2. Infer types from usage patterns, return values, and assignments
3. Add precise type annotations (avoid 'any' where possible)
4. Generate interface/type definitions for complex objects
5. Use union types, intersection types, or generics where appropriate
6. Preserve all existing code logic unchanged
7. Output only the typed code, no additional explanation`);

    return sections.join('\n');
  }

  private buildSystemPrompt(language: string, typeStyle: string): string {
    return `You are an expert type system specialist for ${language}.

Your task is to add complete, accurate type annotations to existing code.

Type style: ${typeStyle}

Rules:
- Add precise type annotations (avoid 'any')
- Use generics where appropriate
- Create interface/type definitions for complex objects
- Annotate all function parameters and return types
- Annotate variable declarations
- Use union types for multiple possible types
- Use optional types (T? or T | undefined) where appropriate
- Preserve all existing code logic and structure
- Do not modify any existing code, only add type annotations
- Output only the typed code, no markdown or explanations`;
  }

  private extractTypedCode(content: string): string {
    const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;
    const match = codeBlockRegex.exec(content);

    if (match) {
      return match[2].trim();
    }

    return content.trim();
  }

  private countTypesAdded(original: string, typed: string, typeStyle: string): number {
    let count = 0;

    if (typeStyle === 'typescript') {
      const originalColons = (original.match(/:\s*(string|number|boolean|void|any|unknown|never|object|symbol|bigint|Array|Record|Promise|Map|Set|Partial|Required|Readonly)/g) || []).length;
      const typedColons = (typed.match(/:\s*(string|number|boolean|void|any|unknown|never|object|symbol|bigint|Array|Record|Promise|Map|Set|Partial|Required|Readonly|[A-Z]\w+)/g) || []).length;
      count = Math.max(0, typedColons - originalColons);

      const originalInterfaces = (original.match(/^(interface|type)\s+/gm) || []).length;
      const typedInterfaces = (typed.match(/^(interface|type)\s+/gm) || []).length;
      count += Math.max(0, typedInterfaces - originalInterfaces);
    } else if (typeStyle === 'python') {
      const originalHints = (original.match(/:\s*(str|int|float|bool|list|dict|tuple|set|None|Any|Optional|Union|List|Dict|Tuple|Set|Callable|Iterable|Iterator|Generator|Sequence|Mapping)/g) || []).length;
      const typedHints = (typed.match(/:\s*(str|int|float|bool|list|dict|tuple|set|None|Any|Optional|Union|List|Dict|Tuple|Set|Callable|Iterable|Iterator|Generator|Sequence|Mapping|[A-Z]\w+)/g) || []).length;
      count = Math.max(0, typedHints - originalHints);

      const originalReturnHints = (original.match(/->\s*\w+/g) || []).length;
      const typedReturnHints = (typed.match(/->\s*\w+/g) || []).length;
      count += Math.max(0, typedReturnHints - originalReturnHints);
    }

    return count;
  }

  private detectTypeStyle(language: string): string {
    const lang = language.toLowerCase();

    if (lang === 'python') return 'python';
    if (lang === 'typescript' || lang === 'javascript') return 'typescript';

    return 'typescript';
  }
}
