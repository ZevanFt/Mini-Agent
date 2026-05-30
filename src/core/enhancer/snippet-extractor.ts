import * as fs from 'fs';
import * as path from 'path';
import { logger } from '@/utils/logger';
import type { LLMAdapter, ChatParams } from '@/llm/base.js';

// ------------------------------------------------------------------
// Public interfaces
// ------------------------------------------------------------------

export interface ExtractedSnippet {
  name: string;
  code: string;
  language: string;
  filePath: string;
  lineStart: number;
  lineEnd: number;
  type: 'function' | 'class' | 'hook' | 'component' | 'utility' | 'middleware' | 'pattern' | 'interface';
  dependencies: string[];
  qualityScore: number;
}

export interface CategorizedSnippet extends ExtractedSnippet {
  category: string;
  subcategory: string;
  tags: string[];
  usageExample: string;
  documentation: string;
}

// ------------------------------------------------------------------
// Constants
// ------------------------------------------------------------------

const LANGUAGE_EXTENSIONS: Record<string, string> = {
  ts: 'typescript',
  tsx: 'typescript',
  js: 'javascript',
  jsx: 'javascript',
  py: 'python',
};

const SUPPORTED_EXTENSIONS = new Set(Object.keys(LANGUAGE_EXTENSIONS));

const IGNORE_DIRS = new Set([
  'node_modules',
  '.git',
  'dist',
  'build',
  '.next',
  'coverage',
  '__pycache__',
  '.venv',
  'venv',
  '.cache',
  '.svelte-kit',
]);

// ------------------------------------------------------------------
// Rule-based extraction patterns
// ------------------------------------------------------------------

interface ExtractionRule {
  regex: RegExp;
  type: ExtractedSnippet['type'];
  nameGroup: number;
}

const TS_PATTERNS: ExtractionRule[] = [
  { regex: /(?:export\s+)?(?:abstract\s+)?class\s+(\w+)/g, type: 'class', nameGroup: 1 },
  { regex: /(?:export\s+)?interface\s+(\w+)/g, type: 'interface', nameGroup: 1 },
  { regex: /(?:export\s+)?type\s+(\w+)\s*=/g, type: 'interface', nameGroup: 1 },
  { regex: /(?:export\s+)?(?:const\s+)?(?:async\s+)?function\s+(\w+)\s*\(/g, type: 'function', nameGroup: 1 },
  { regex: /(?:export\s+)?const\s+(\w+)\s*=\s*(?:async\s+)?\([^)]*\)\s*(?::\s*[^=]+)?\s*=>/g, type: 'function', nameGroup: 1 },
  { regex: /(?:export\s+)?const\s+(\w+)\s*=\s*(?:async\s+)?function\s*\(/g, type: 'function', nameGroup: 1 },
];

const HOOK_PATTERNS: ExtractionRule[] = [
  { regex: /(?:export\s+)?(?:const\s+)?(?:async\s+)?function\s+(use[A-Z]\w*)\s*\(/g, type: 'hook', nameGroup: 1 },
  { regex: /(?:export\s+)?const\s+(use[A-Z]\w*)\s*=\s*(?:async\s+)?\(/g, type: 'hook', nameGroup: 1 },
];

const PY_PATTERNS: ExtractionRule[] = [
  { regex: /(?:async\s+)?def\s+(\w+)\s*\(/g, type: 'function', nameGroup: 1 },
  { regex: /class\s+(\w+)(?:\s*\([^)]*\))?\s*:/g, type: 'class', nameGroup: 1 },
];

const PATTERNS_BY_LANG: Record<string, { base: ExtractionRule[]; hooks: ExtractionRule[] }> = {
  typescript: { base: TS_PATTERNS, hooks: HOOK_PATTERNS },
  javascript: { base: TS_PATTERNS, hooks: HOOK_PATTERNS },
  python: { base: PY_PATTERNS, hooks: [] },
};

// ------------------------------------------------------------------
// Category keyword mappings
// ------------------------------------------------------------------

interface CategoryRule {
  keywords: string[];
  category: string;
  subcategory: string;
  tags: string[];
}

const CATEGORY_RULES: CategoryRule[] = [
  { keywords: ['react', 'jsx', 'tsx', 'component', 'useState', 'useEffect', 'useMemo', 'useCallback', 'ReactDOM'], category: 'frontend', subcategory: 'react', tags: ['react', 'component'] },
  { keywords: ['use', 'hook', 'useRef', 'useContext', 'useReducer', 'useImperative'], category: 'frontend', subcategory: 'hooks', tags: ['hook', 'react'] },
  { keywords: ['vue', 'ref(', 'computed(', 'watch(', 'nextTick'], category: 'frontend', subcategory: 'vue', tags: ['vue', 'component'] },
  { keywords: ['express', 'app.get', 'app.post', 'app.use', 'router.get', 'router.post', 'middleware'], category: 'backend', subcategory: 'express', tags: ['express', 'node'] },
  { keywords: ['fastify', 'fastify('], category: 'backend', subcategory: 'fastify', tags: ['fastify'] },
  { keywords: ['django', 'urlpatterns', 'models.Model', 'views.py'], category: 'backend', subcategory: 'django', tags: ['django', 'python'] },
  { keywords: ['flask', '@app.route', 'Flask('], category: 'backend', subcategory: 'flask', tags: ['flask', 'python'] },
  { keywords: ['api', 'endpoint', 'controller', 'handler', 'route('], category: 'backend', subcategory: 'api', tags: ['api'] },
  { keywords: ['auth', 'token', 'jwt', 'session', 'passport', 'authenticate', 'authorize'], category: 'middleware', subcategory: 'authentication', tags: ['auth', 'security'] },
  { keywords: ['cors', 'helmet', 'rate-limit', 'throttle', 'csrf'], category: 'middleware', subcategory: 'security', tags: ['security'] },
  { keywords: ['interceptor', 'guard', 'filter', 'pipe', 'middleware'], category: 'middleware', subcategory: 'request', tags: ['middleware'] },
  { keywords: ['sequelize', 'typeorm', 'prisma', 'knex', 'repository', 'entity', 'queryBuilder'], category: 'database', subcategory: 'orm', tags: ['database', 'orm'] },
  { keywords: ['mongoose', 'Schema(', 'model(', 'mongodb'], category: 'database', subcategory: 'mongoose', tags: ['mongoose', 'mongodb'] },
  { keywords: ['sql', 'sqlite', 'postgres', 'mysql', 'query('], category: 'database', subcategory: 'sql', tags: ['database', 'sql'] },
  { keywords: ['describe(', 'it(', 'test(', 'expect(', 'jest', 'mocha', 'vitest', 'assert'], category: 'test', subcategory: 'unit', tags: ['test', 'unit'] },
  { keywords: ['playwright', 'cypress', 'puppeteer', 'e2e'], category: 'test', subcategory: 'e2e', tags: ['test', 'e2e'] },
  { keywords: ['logger', 'logging', 'debug(', 'error(', 'warn('], category: 'utility', subcategory: 'logging', tags: ['logging'] },
  { keywords: ['config', 'env', 'settings', 'dotenv'], category: 'utility', subcategory: 'configuration', tags: ['config'] },
  { keywords: ['format', 'parse', 'validate', 'convert', 'transform', 'utils', 'helpers'], category: 'utility', subcategory: 'general', tags: ['utility', 'helper'] },
];

// ------------------------------------------------------------------
// SnippetExtractor
// ------------------------------------------------------------------

export class SnippetExtractor {
  private llm: LLMAdapter;

  constructor(llm: LLMAdapter) {
    this.llm = llm;
  }

  public async extractFromProject(projectPath: string): Promise<ExtractedSnippet[]> {
    const absolutePath = path.resolve(projectPath);
    logger.info(`[SnippetExtractor] Starting project scan: ${absolutePath}`);

    if (!fs.existsSync(absolutePath)) {
      logger.error(`[SnippetExtractor] Project path does not exist: ${absolutePath}`);
      return [];
    }

    const allSnippets: ExtractedSnippet[] = [];
    const files = this.collectCodeFiles(absolutePath);
    logger.info(`[SnippetExtractor] Found ${files.length} code files`);

    for (const file of files) {
      try {
        const snippets = await this.extractFromFile(file);
        allSnippets.push(...snippets);
        logger.debug(`[SnippetExtractor] Extracted ${snippets.length} snippets from ${file}`);
      } catch (error) {
        logger.error(`[SnippetExtractor] Failed to extract from ${file}:`, error);
      }
    }

    logger.info(`[SnippetExtractor] Done. Total: ${allSnippets.length} snippets`);
    return allSnippets;
  }

  public async extractFromFile(filePath: string): Promise<ExtractedSnippet[]> {
    const ext = path.extname(filePath).replace('.', '');
    if (!SUPPORTED_EXTENSIONS.has(ext)) {
      logger.debug(`[SnippetExtractor] Skip unsupported: ${filePath}`);
      return [];
    }

    const language = LANGUAGE_EXTENSIONS[ext];
    const content = fs.readFileSync(filePath, 'utf-8');
    const snippets = await this.extractSnippets(content, language);

    for (const s of snippets) {
      s.filePath = filePath;
    }

    return snippets;
  }

  public async extractSnippets(code: string, language: string): Promise<ExtractedSnippet[]> {
    const langConfig = PATTERNS_BY_LANG[language];
    if (!langConfig) {
      logger.warn(`[SnippetExtractor] No patterns for language: ${language}`);
      return [];
    }

    const rules = [...langConfig.base, ...langConfig.hooks];
    const lines = code.split('\n');
    const rawHits: Array<{ match: RegExpExecArray; rule: ExtractionRule }> = [];

    for (const rule of rules) {
      const regex = new RegExp(rule.regex.source, 'g');
      let m: RegExpExecArray | null;
      while ((m = regex.exec(code)) !== null) {
        rawHits.push({ match: m, rule });
      }
    }

    const fileDependencies = this.extractDependencies(code, language);
    const snippets: ExtractedSnippet[] = [];

    for (const { match, rule } of rawHits) {
      const lineStart = this.posToLine(code, match.index);
      const lineEnd = this.findBlockEnd(lines, lineStart, language);
      const snippetCode = lines.slice(lineStart - 1, lineEnd).join('\n').trim();

      const rawName = match[rule.nameGroup] || 'unnamed';
      const name = this.normalizeName(rawName, rule);
      const dependencies = [...fileDependencies];
      const qualityScore = this.computeQuality(snippetCode, dependencies, language);

      snippets.push({
        name,
        code: snippetCode,
        language,
        filePath: '',
        lineStart,
        lineEnd,
        type: rule.type,
        dependencies,
        qualityScore,
      });
    }

    logger.debug(`[SnippetExtractor] Extracted ${snippets.length} snippets from ${language} source`);
    return snippets;
  }

  public async categorizeSnippet(snippet: ExtractedSnippet, projectContext?: string): Promise<CategorizedSnippet> {
    const searchable = `${snippet.code} ${snippet.name} ${snippet.type} ${projectContext || ''}`.toLowerCase();

    let best: { category: string; subcategory: string; tags: string[]; score: number } | null = null;

    for (const rule of CATEGORY_RULES) {
      let score = 0;
      for (const kw of rule.keywords) {
        if (searchable.includes(kw.toLowerCase())) {
          score++;
        }
      }
      if (score > 0 && (!best || score > best.score)) {
        best = { category: rule.category, subcategory: rule.subcategory, tags: rule.tags, score };
      }
    }

    const usageExample = await this.generateUsageExample(snippet);
    const documentation = await this.generateDocumentation(snippet);

    const result: CategorizedSnippet = {
      ...snippet,
      category: best?.category || 'general',
      subcategory: best?.subcategory || 'general',
      tags: best?.tags || ['general'],
      usageExample,
      documentation,
    };

    logger.debug(`[SnippetExtractor] Categorized "${snippet.name}" -> ${result.category}/${result.subcategory}`);
    return result;
  }

  public async generateUsageExample(snippet: ExtractedSnippet): Promise<string> {
    const prompt =
      `Generate a concise, practical usage example for this code.\n\n` +
      `Name: ${snippet.name}\n` +
      `Type: ${snippet.type}\n` +
      `Language: ${snippet.language}\n\n` +
      `Code:\n\`\`\`${snippet.language}\n${snippet.code}\n\`\`\`\n\n` +
      `Return only the example code. No explanations.`;

    try {
      const params: ChatParams = {
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        maxTokens: 500,
      };
      const result = await this.llm.chatOnce(params);
      logger.debug(`[SnippetExtractor] Generated usage example for "${snippet.name}"`);
      return this.stripCodeBlock(result.content);
    } catch (error) {
      logger.error(`[SnippetExtractor] Usage example generation failed for "${snippet.name}":`, error);
      return `// Failed to generate usage example for ${snippet.name}`;
    }
  }

  public async generateDocumentation(snippet: ExtractedSnippet): Promise<string> {
    const prompt =
      `Generate clear, concise documentation for this code.\n\n` +
      `Name: ${snippet.name}\n` +
      `Type: ${snippet.type}\n` +
      `Language: ${snippet.language}\n\n` +
      `Code:\n\`\`\`${snippet.language}\n${snippet.code}\n\`\`\`\n\n` +
      `Include:\n` +
      `- One-line description\n` +
      `- Parameters (if any)\n` +
      `- Return value (if any)\n` +
      `- Notable behavior or side effects\n` +
      `- External dependencies\n\n` +
      `Keep it brief.`;

    try {
      const params: ChatParams = {
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.2,
        maxTokens: 400,
      };
      const result = await this.llm.chatOnce(params);
      logger.debug(`[SnippetExtractor] Generated documentation for "${snippet.name}"`);
      return result.content;
    } catch (error) {
      logger.error(`[SnippetExtractor] Documentation generation failed for "${snippet.name}":`, error);
      return `Documentation for ${snippet.name}: generation failed.`;
    }
  }

  public scoreSnippet(snippet: ExtractedSnippet): number {
    return this.computeQuality(snippet.code, snippet.dependencies, snippet.language);
  }

  // ------------------------------------------------------------------
  // Private helpers
  // ------------------------------------------------------------------

  private collectCodeFiles(dir: string, results: string[] = []): string[] {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return results;
    }

    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (!IGNORE_DIRS.has(entry.name)) {
          this.collectCodeFiles(full, results);
        }
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).replace('.', '');
        if (SUPPORTED_EXTENSIONS.has(ext)) {
          results.push(full);
        }
      }
    }

    return results;
  }

  private posToLine(code: string, pos: number): number {
    return code.slice(0, pos).split('\n').length;
  }

  private findBlockEnd(lines: string[], startLine: number, language: string): number {
    const maxLines = lines.length;
    let braces = 0;
    let parens = 0;
    let opened = false;
    let inStr = false;
    let strChar = '';

    for (let i = startLine - 1; i < maxLines; i++) {
      const line = lines[i];
      for (let j = 0; j < line.length; j++) {
        const ch = line[j];
        const prev = j > 0 ? line[j - 1] : '';

        if (inStr) {
          if (ch === strChar && prev !== '\\') inStr = false;
          continue;
        }

        if (ch === '"' || ch === "'" || ch === '`') {
          inStr = true;
          strChar = ch;
          continue;
        }

        if (ch === '{') { braces++; opened = true; }
        if (ch === '}') braces--;
        if (ch === '(') parens++;
        if (ch === ')') parens--;
      }

      if (opened && braces <= 0 && parens <= 0) return i + 1;

      if (language === 'python' && opened) {
        const next = i + 1 < maxLines ? lines[i + 1] : '';
        if (line.trim() && !line.trim().endsWith('\\') && next && !/^\s/.test(next) && next.trim()) {
          return i + 1;
        }
      }
    }

    return Math.min(startLine + 50, maxLines);
  }

  private normalizeName(raw: string, rule: ExtractionRule): string {
    let name = raw.trim();
    if (rule.type === 'hook') {
      const m = name.match(/use[A-Z]\w*/);
      if (m) name = m[0];
    }
    if (name.length > 80) name = name.slice(0, 77) + '...';
    return name;
  }

  private extractDependencies(code: string, language: string): string[] {
    const deps = new Set<string>();

    if (language === 'typescript' || language === 'javascript') {
      const re = /(?:import\s+.*?from\s+['"]([^'"]+)['"]|require\(['"]([^'"]+)['"]\))/g;
      let m: RegExpExecArray | null;
      while ((m = re.exec(code)) !== null) {
        const dep = m[1] || m[2];
        if (dep && !dep.startsWith('.') && !dep.startsWith('/')) deps.add(dep);
      }
    }

    if (language === 'python') {
      const re = /(?:import\s+(\w+)|from\s+(\w+)\s+import)/g;
      let m: RegExpExecArray | null;
      while ((m = re.exec(code)) !== null) {
        const dep = m[1] || m[2];
        if (dep) deps.add(dep);
      }
    }

    return Array.from(deps);
  }

  private computeQuality(code: string, dependencies: string[], _language: string): number {
    let score = 50;
    const lines = code.split('\n').filter((l) => l.trim()).length;

    if (lines >= 5 && lines <= 80) score += 20;
    else if (lines < 3) score -= 20;
    else if (lines > 150) score -= 10;

    const hasComment = /\/\//.test(code) || /\/\*/.test(code) || /'''/.test(code) || /"""/.test(code);
    if (hasComment) score += 10;

    const hasErrorHandling =
      /try\s*{/.test(code) ||
      /catch\s*\(/.test(code) ||
      /throw\s+/.test(code) ||
      /except\b/.test(code) ||
      /if\s*\(\s*!/.test(code) ||
      /if\s+not\s+/.test(code);
    if (hasErrorHandling) score += 10;

    const extDeps = dependencies.filter((d) => !d.startsWith('.')).length;
    if (extDeps <= 3) score += 5;
    else if (extDeps > 8) score -= 5;

    const hasParams = /\([^)]+\)/.test(code);
    const hasReturn = /:\s*\w+/.test(code) || /->\s*\w+/.test(code);
    if (hasParams && hasReturn) score += 10;

    const isReusable = !code.includes('process.exit') && !code.includes('console.log') && !code.includes('print(');
    if (isReusable) score += 5;

    return Math.max(0, Math.min(100, score));
  }

  private stripCodeBlock(content: string): string {
    const trimmed = content.trim();
    const m = trimmed.match(/^```[\w]*\n([\s\S]*?)```$/);
    return m ? m[1].trim() : trimmed;
  }
}
