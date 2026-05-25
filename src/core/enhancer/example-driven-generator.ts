import type { LLMAdapter, ChatParams } from '@/llm/base.js';
import { logger } from '@/utils/logger.js';
import { glob } from 'glob';
import * as fs from 'fs';

export interface CodeExample {
  source: string;
  code: string;
  language: string;
  description: string;
  similarity: number;
  tags: string[];
}

export interface CodeBlock {
  language: string;
  code: string;
  filePath?: string;
}

interface ScanOptions {
  maxFiles?: number;
  maxExamplesPerFile?: number;
  languages?: string[];
  includeDirs?: string[];
  excludeDirs?: string[];
}

interface GenerationOptions {
  maxExamples?: number;
  temperature?: number;
  maxTokens?: number;
  systemPrompt?: string;
}

const DEFAULT_SCAN_OPTIONS: Required<ScanOptions> = {
  maxFiles: 50,
  maxExamplesPerFile: 5,
  languages: ['ts', 'js', 'py', 'tsx', 'jsx'],
  includeDirs: ['src', 'lib', 'core'],
  excludeDirs: ['node_modules', 'dist', '.git', 'build'],
};

const DEFAULT_GENERATION_OPTIONS: Required<Omit<GenerationOptions, 'systemPrompt'>> & Pick<GenerationOptions, 'systemPrompt'> = {
  maxExamples: 5,
  temperature: 0.3,
  maxTokens: 4096,
  systemPrompt: undefined,
};

const LANGUAGE_EXTENSIONS: Record<string, string[]> = {
  typescript: ['ts', 'tsx'],
  javascript: ['js', 'jsx', 'mjs', 'cjs'],
  python: ['py', 'pyi'],
};

const LANGUAGE_PATTERNS: Record<string, RegExp[]> = {
  typescript: [
    /interface\s+\w+/g,
    /class\s+\w+/g,
    /function\s+\w+/g,
    /const\s+\w+\s*=\s*\(.*?\)\s*=>/g,
    /export\s+(default\s+)?(function|class|const|interface|type|enum)/g,
  ],
  javascript: [
    /function\s+\w+/g,
    /const\s+\w+\s*=\s*\(.*?\)\s*=>/g,
    /module\.exports/g,
    /export\s+(default\s+)?(function|class|const)/g,
    /class\s+\w+/g,
  ],
  python: [
    /def\s+\w+/g,
    /class\s+\w+/g,
    /async\s+def\s+\w+/g,
  ],
};

export class ExampleDrivenGenerator {
  private llm: LLMAdapter;
  private exampleCache: Map<string, CodeExample[]> = new Map();
  private scannedExamples: CodeExample[] = [];
  private scanComplete: boolean = false;

  constructor(llm: LLMAdapter) {
    this.llm = llm;
    logger.debug('[ExampleDrivenGenerator] initialized');
  }

  async scanProjectExamples(options?: ScanOptions): Promise<CodeExample[]> {
    const opts = { ...DEFAULT_SCAN_OPTIONS, ...options };
    logger.info('[ExampleDrivenGenerator] scanning project examples...', opts);

    const allExamples: CodeExample[] = [];
    let filesScanned = 0;

    try {
      for (const includeDir of opts.includeDirs) {
        const files = await this.findCodeFiles(includeDir, opts);
        for (const file of files) {
          if (filesScanned >= opts.maxFiles) {
            logger.debug(`[ExampleDrivenGenerator] reached maxFiles limit (${opts.maxFiles})`);
            break;
          }
          const fileExamples = await this.extractExamplesFromFile(file, opts);
          allExamples.push(...fileExamples);
          filesScanned++;
        }
        if (filesScanned >= opts.maxFiles) break;
      }

      this.scannedExamples = allExamples;
      this.scanComplete = true;
      logger.info(`[ExampleDrivenGenerator] scan complete: ${allExamples.length} examples from ${filesScanned} files`);
    } catch (error) {
      logger.error('[ExampleDrivenGenerator] scan failed:', error);
      this.scannedExamples = [];
      this.scanComplete = false;
    }

    return this.scannedExamples;
  }

  findSimilarExamples(
    request: string,
    options?: { maxResults?: number; minSimilarity?: number; languageFilter?: string }
  ): CodeExample[] {
    const maxResults = options?.maxResults ?? DEFAULT_GENERATION_OPTIONS.maxExamples;
    const minSimilarity = options?.minSimilarity ?? 0.0;
    const languageFilter = options?.languageFilter;

    logger.debug(`[ExampleDrivenGenerator] finding similar examples for: "${request.substring(0, 60)}..."`);

    if (!this.scanComplete || this.scannedExamples.length === 0) {
      logger.warn('[ExampleDrivenGenerator] no scanned examples available');
      return [];
    }

    let candidates = [...this.scannedExamples];

    if (languageFilter) {
      const normalizedFilter = languageFilter.toLowerCase();
      candidates = candidates.filter((ex) => {
        const exLang = ex.language.toLowerCase();
        const exSource = ex.source.toLowerCase();
        return exLang.includes(normalizedFilter) || exSource.includes(normalizedFilter);
      });
      logger.debug(`[ExampleDrivenGenerator] filtered to ${candidates.length} examples by language: ${languageFilter}`);
    }

    if (candidates.length === 0) {
      logger.warn('[ExampleDrivenGenerator] no examples match language filter');
      return [];
    }

    const scored = candidates.map((example) => ({
      example,
      score: this.computeSimilarity(request, example),
    }));

    scored.sort((a, b) => b.score - a.score);

    const results = scored
      .filter((s) => s.score >= minSimilarity)
      .slice(0, maxResults)
      .map((s) => ({
        ...s.example,
        similarity: s.score,
      }));

    logger.info(`[ExampleDrivenGenerator] found ${results.length} similar examples`);
    return results;
  }

  async generateWithExamples(
    request: string,
    options?: GenerationOptions
  ): Promise<CodeBlock> {
    const opts = { ...DEFAULT_GENERATION_OPTIONS, ...options };
    logger.info('[ExampleDrivenGenerator] generating with examples...', { request: request.substring(0, 80) });

    const similarExamples = this.findSimilarExamples(request, {
      maxResults: opts.maxExamples,
      languageFilter: this.detectLanguageFromRequest(request),
    });

    const prompt = this.buildExampleDrivenPrompt(request, similarExamples);

    logger.debug('[ExampleDrivenGenerator] sending prompt to LLM');
    logger.debug('[ExampleDrivenGenerator] examples used:', similarExamples.length);

    try {
      const result = await this.llm.chatOnce({
        messages: [{ role: 'user', content: prompt }],
        systemPrompt: opts.systemPrompt || this.buildDefaultSystemPrompt(),
        temperature: opts.temperature,
        maxTokens: opts.maxTokens,
      });

      const codeBlock = this.parseGeneratedCode(result.content);
      logger.info('[ExampleDrivenGenerator] generation complete', { language: codeBlock.language, codeLength: codeBlock.code.length });
      return codeBlock;
    } catch (error) {
      logger.error('[ExampleDrivenGenerator] generation failed:', error);
      throw new Error(`Example-driven generation failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  extractCodePattern(example: CodeExample): {
    patterns: string[];
    style: string;
    conventions: string[];
    imports: string[];
  } {
    logger.debug('[ExampleDrivenGenerator] extracting code patterns from:', example.source);

    const patterns: string[] = [];
    const conventions: string[] = [];
    const imports: string[] = [];

    const lines = example.code.split('\n');

    const importLines = lines.filter(
      (line) =>
        /^\s*(import\s|from\s)/.test(line) ||
        /^\s*require\s*\(/.test(line) ||
        /^\s*#\s*import\s/.test(example.language === 'python' ? line : '')
    );
    imports.push(...importLines.map((l) => l.trim()));

    const hasAsync = /async\s+(function|def|=>)/.test(example.code);
    if (hasAsync) patterns.push('async/await');

    const hasClass = /class\s+\w+/.test(example.code);
    if (hasClass) patterns.push('class-based');

    const hasArrow = /=>/.test(example.code) && example.language !== 'python';
    if (hasArrow) patterns.push('arrow-function');

    const hasTypeAnnotation = /:\s*(string|number|boolean|void|Promise|Array|Record|string\[\]|[A-Z]\w+)/.test(example.code);
    if (hasTypeAnnotation) conventions.push('type-annotations');

    const hasJSDoc = /\/\*\*[\s\S]*?\*\//.test(example.code);
    if (hasJSDoc) conventions.push('jsdoc-comments');

    const hasDecorators = /^\s*@/.test(example.code);
    if (hasDecorators) conventions.push('decorators');

    const hasErrorHandling = /(try\s*{)|(catch\s*\()|(except\s*:)/.test(example.code);
    if (hasErrorHandling) patterns.push('error-handling');

    const usesDestructuring = /const\s*\{/.test(example.code);
    if (usesDestructuring) patterns.push('destructuring');

    const usesOptionalChaining = /\?\.|dict\.get\(/.test(example.code);
    if (usesOptionalChaining) patterns.push('optional-chaining');

    const style = this.inferCodingStyle(example.code, example.language);

    logger.debug('[ExampleDrivenGenerator] patterns extracted:', { patterns: patterns.length, conventions: conventions.length, imports: imports.length });

    return { patterns, style, conventions, imports };
  }

  getCacheStats(): { totalExamples: number; cacheSize: number; scanComplete: boolean } {
    return {
      totalExamples: this.scannedExamples.length,
      cacheSize: this.exampleCache.size,
      scanComplete: this.scanComplete,
    };
  }

  clearCache(): void {
    this.exampleCache.clear();
    this.scannedExamples = [];
    this.scanComplete = false;
    logger.debug('[ExampleDrivenGenerator] cache cleared');
  }

  private async findCodeFiles(dir: string, options: Required<ScanOptions>): Promise<string[]> {
    const allExtensions = options.languages.flatMap((lang) => {
      return LANGUAGE_EXTENSIONS[lang] || [lang];
    });

    try {
      const patterns = allExtensions.map((ext) => `${dir}/**/*.${ext}`);
      const ignorePatterns = options.excludeDirs.map((d) => `**/${d}/**`);
      const rawFiles = await glob(patterns, {
        cwd: process.cwd(),
        ignore: ignorePatterns,
        nodir: true,
      });
      return rawFiles.slice(0, options.maxFiles);
    } catch (error) {
      logger.warn('[ExampleDrivenGenerator] glob failed, skipping file scan for:', dir, error);
      return [];
    }
  }

  private async extractExamplesFromFile(
    filePath: string,
    options: Required<ScanOptions>
  ): Promise<CodeExample[]> {
    const cacheKey = filePath;
    if (this.exampleCache.has(cacheKey)) {
      return this.exampleCache.get(cacheKey)!;
    }

    const examples: CodeExample[] = [];

    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const language = this.detectLanguage(filePath);
      const patterns = this.findCodeBlocks(content, language);

      for (let i = 0; i < Math.min(patterns.length, options.maxExamplesPerFile); i++) {
        const block = patterns[i];
        const description = this.generateBlockDescription(block, language);
        examples.push({
          source: filePath,
          code: block,
          language,
          description,
          similarity: 0,
          tags: this.extractTags(block, language),
        });
      }

      this.exampleCache.set(cacheKey, examples);
      logger.debug(`[ExampleDrivenGenerator] extracted ${examples.length} examples from ${filePath}`);
    } catch (error) {
      logger.warn('[ExampleDrivenGenerator] failed to extract examples from:', filePath, error);
    }

    return examples;
  }

  private findCodeBlocks(content: string, language: string): string[] {
    const blocks: string[] = [];
    const patterns = LANGUAGE_PATTERNS[language];

    if (!patterns) return blocks;

    const lines = content.split('\n');
    let currentBlock: string[] = [];
    let inBlock = false;
    let braceDepth = 0;
    let parenDepth = 0;

    for (const line of lines) {
      const isStart = patterns.some((p) => {
        p.lastIndex = 0;
        return p.test(line);
      });

      if (isStart && !inBlock) {
        inBlock = true;
        currentBlock = [line];
        braceDepth = 0;
        parenDepth = 0;
      } else if (inBlock) {
        currentBlock.push(line);
      }

      if (inBlock) {
        braceDepth += (line.match(/{/g) || []).length - (line.match(/}/g) || []).length;
        parenDepth += (line.match(/\(/g) || []).length - (line.match(/\)/g) || []).length;

        if (language === 'python') {
          if (line.trim() === '' || (line.trim() && !line.startsWith(' ') && !line.startsWith('\t') && !line.startsWith('#') && !line.startsWith('@') && currentBlock.length > 2)) {
            if (currentBlock.length >= 2) {
              blocks.push(currentBlock.join('\n'));
            }
            inBlock = false;
            currentBlock = [];
          }
        } else {
          if (braceDepth <= 0 && currentBlock.length > 1) {
            blocks.push(currentBlock.join('\n'));
            inBlock = false;
            currentBlock = [];
          }
        }
      }
    }

    if (inBlock && currentBlock.length >= 2) {
      blocks.push(currentBlock.join('\n'));
    }

    return blocks;
  }

  private computeSimilarity(request: string, example: CodeExample): number {
    const requestTokens = this.tokenize(request);
    const exampleTokens = this.tokenize(example.description + ' ' + example.code.substring(0, 500) + ' ' + example.tags.join(' '));

    const intersection = requestTokens.filter((t) => exampleTokens.includes(t));
    const jaccard = intersection.length / (requestTokens.length + exampleTokens.length - intersection.length + 1);

    const tagBonus = example.tags.filter((tag) =>
      request.toLowerCase().includes(tag.toLowerCase())
    ).length * 0.1;

    const keywordBonus = this.countKeywordMatches(request, example.code) * 0.05;

    return Math.min(jaccard + tagBonus + keywordBonus, 1.0);
  }

  private tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9_\s]/g, ' ')
      .split(/\s+/)
      .filter((t) => t.length > 2);
  }

  private countKeywordMatches(request: string, code: string): number {
    const keywords = [
      'class', 'function', 'async', 'interface', 'type', 'enum',
      'const', 'let', 'var', 'def', 'import', 'export', 'return',
      'try', 'catch', 'if', 'for', 'while', 'switch',
    ];
    let count = 0;
    for (const kw of keywords) {
      if (request.toLowerCase().includes(kw) && code.toLowerCase().includes(kw)) {
        count++;
      }
    }
    return count;
  }

  private buildExampleDrivenPrompt(request: string, examples: CodeExample[]): string {
    const sections: string[] = [];

    sections.push(`## Task

Generate code for the following request:

<request>
${request}
</request>
`);

    if (examples.length > 0) {
      sections.push('## Reference Examples\n');
      sections.push('Here are similar code examples from the project. Study their patterns, style, and conventions, then generate code that follows the same style:\n');

      examples.forEach((example, index) => {
        sections.push(`### Example ${index + 1}: ${example.source}`);
        sections.push(`Language: ${example.language}`);
        sections.push(`Description: ${example.description}`);
        sections.push(`Tags: ${example.tags.join(', ')}`);
        sections.push(`Similarity: ${(example.similarity * 100).toFixed(0)}%`);
        sections.push('');
        sections.push('```' + example.language);
        sections.push(example.code);
        sections.push('```\n');
      });

      sections.push(`## Instructions

Based on the reference examples above, generate code that:
1. Follows the same coding style and conventions
2. Uses similar patterns (async/await, class structure, error handling, etc.)
3. Matches the import/dependency patterns shown
4. Is complete, runnable, and well-structured

Generate only the code, no additional explanation.`);
    } else {
      sections.push(`## Instructions

No similar examples found in the project. Generate the best code you can for the request above.
Make sure the code is complete, runnable, and follows best practices for the target language.`);
    }

    return sections.join('\n');
  }

  private buildDefaultSystemPrompt(): string {
    return `You are an expert code generator. Your task is to generate high-quality, production-ready code based on the user's request.

When reference examples are provided, carefully study their patterns, style conventions, and structure. Mimic the coding style, import patterns, error handling approaches, and naming conventions from the examples.

Rules:
- Generate complete, runnable code
- Follow the style of the reference examples
- Include proper error handling
- Use clear naming conventions
- Add comments where necessary
- Output only the code, no markdown or explanations unless asked`;
  }

  private parseGeneratedCode(content: string): CodeBlock {
    const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;
    let match = codeBlockRegex.exec(content);

    if (match) {
      return {
        language: match[1] || 'text',
        code: match[2].trim(),
      };
    }

    return {
      language: 'text',
      code: content.trim(),
    };
  }

  private detectLanguage(filePath: string): string {
    const ext = filePath.split('.').pop()?.toLowerCase() || '';

    for (const [language, extensions] of Object.entries(LANGUAGE_EXTENSIONS)) {
      if (extensions.includes(ext)) {
        return language;
      }
    }

    return 'unknown';
  }

  private detectLanguageFromRequest(request: string): string | undefined {
    const lower = request.toLowerCase();

    if (/\b(typescript|\.ts|\.tsx|interface|type\s+\w+\s*=)\b/.test(lower)) return 'typescript';
    if (/\b(javascript|\.js|\.jsx|const\s+\w+\s*=\s*(?:\(|function|async))\b/.test(lower)) return 'javascript';
    if (/\b(python|\.py|def\s+\w+|import\s+\w+|pip)\b/.test(lower)) return 'python';

    return undefined;
  }

  private generateBlockDescription(codeBlock: string, language: string): string {
    const firstLine = codeBlock.split('\n')[0].trim();

    if (language === 'python') {
      const defMatch = firstLine.match(/(?:async\s+)?def\s+(\w+)/);
      if (defMatch) return `Python function: ${defMatch[1]}`;
      const classMatch = firstLine.match(/class\s+(\w+)/);
      if (classMatch) return `Python class: ${classMatch[1]}`;
    } else {
      const funcMatch = firstLine.match(/(?:export\s+)?(?:default\s+)?(?:async\s+)?(?:function|const)\s+(\w+)/);
      if (funcMatch) return `${language} function: ${funcMatch[1]}`;
      const classMatch = firstLine.match(/(?:export\s+)?(?:default\s+)?class\s+(\w+)/);
      if (classMatch) return `${language} class: ${classMatch[1]}`;
      const interfaceMatch = firstLine.match(/(?:export\s+)?interface\s+(\w+)/);
      if (interfaceMatch) return `${language} interface: ${interfaceMatch[1]}`;
    }

    return `${language} code block (${firstLine.substring(0, 40)})`;
  }

  private extractTags(codeBlock: string, language: string): string[] {
    const tags: string[] = [language];

    if (/async|await|Promise/.test(codeBlock)) tags.push('async');
    if (/class\s+\w+/.test(codeBlock)) tags.push('class');
    if (/interface\s+\w+/.test(codeBlock)) tags.push('interface');
    if (/export/.test(codeBlock)) tags.push('export');
    if (/test|describe|it\(/.test(codeBlock)) tags.push('test');
    if (/try\s*{|catch\s*\(/.test(codeBlock)) tags.push('error-handling');
    if (/=>/.test(codeBlock)) tags.push('arrow-function');
    if (/import\s+/.test(codeBlock)) tags.push('module');

    return tags;
  }

  private inferCodingStyle(code: string, language: string): string {
    const lines = code.split('\n');
    const usesTabs = lines.some((l) => l.startsWith('\t'));
    const usesSpaces = lines.some((l) => l.startsWith('  '));
    const indentSize = this.detectIndentSize(lines);

    const parts: string[] = [];
    parts.push(usesTabs ? 'tabs' : `spaces(${indentSize})`);

    const avgLineLength = code.length / Math.max(lines.length, 1);
    if (avgLineLength > 100) parts.push('long-lines');
    else if (avgLineLength < 60) parts.push('short-lines');

    if (/;\s*$/.test(code) && language !== 'python') parts.push('semicolons');
    if (/single_quotes/.test(code) || code.includes("'")) parts.push('single-quotes');

    return parts.join(', ');
  }

  private detectIndentSize(lines: string[]): number {
    const indents = lines
      .filter((l) => l.match(/^ +/))
      .map((l) => l.match(/^( +)/)?.[1].length || 0)
      .filter((n) => n > 0);

    if (indents.length === 0) return 2;

    const counts: Record<number, number> = {};
    for (const n of indents) {
      counts[n] = (counts[n] || 0) + 1;
    }

    return parseInt(Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0], 10) || 2;
  }
}
