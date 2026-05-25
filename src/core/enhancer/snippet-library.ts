import * as fs from 'fs';
import * as path from 'path';
import { logger } from '@/utils/logger';
import type { CodeSnippet } from './types';

/**
 * Search filters for snippet queries
 */
export interface SnippetFilters {
  language?: string;
  tags?: string[];
  category?: string;
  query?: string;
}

/**
 * Scored match result for intelligent matching
 */
export interface SnippetMatch {
  snippet: CodeSnippet;
  score: number;
  matchReasons: string[];
}

/**
 * Exportable snippet library data
 */
export interface SnippetLibraryData {
  version: string;
  exportedAt: string;
  snippets: CodeSnippet[];
}

/**
 * Code snippet library system
 *
 * Provides CRUD operations, search, variable substitution,
 * intelligent matching, and import/export for code templates.
 */
export class SnippetLibrary {
  private snippets: Map<string, CodeSnippet> = new Map();
  private snippetDir: string;

  constructor(snippetDir: string = '.miniagent/snippets') {
    this.snippetDir = snippetDir;
  }

  /**
   * Load all snippet files from the snippet directory
   */
  public async loadFromDirectory(): Promise<number> {
    const absoluteDir = path.resolve(this.snippetDir);

    if (!fs.existsSync(absoluteDir)) {
      logger.info(`Snippet directory not found: ${absoluteDir}, creating it`);
      fs.mkdirSync(absoluteDir, { recursive: true });
      return 0;
    }

    let loaded = 0;
    const files = this.findAllSnippetFiles(absoluteDir);

    for (const file of files) {
      try {
        const content = fs.readFileSync(file, 'utf-8');
        const snippet = this.parseSnippetFile(content, file);
        if (snippet) {
          this.snippets.set(snippet.id, snippet);
          loaded++;
          logger.debug(`Loaded snippet: ${snippet.name} (${snippet.id})`);
        }
      } catch (error) {
        logger.error(`Failed to load snippet from ${file}:`, error);
      }
    }

    logger.info(`Loaded ${loaded} snippets from ${absoluteDir}`);
    return loaded;
  }

  /**
   * Get a snippet by ID
   */
  public getSnippet(id: string): CodeSnippet | undefined {
    return this.snippets.get(id);
  }

  /**
   * Get all snippets
   */
  public getAllSnippets(): CodeSnippet[] {
    return Array.from(this.snippets.values());
  }

  /**
   * Add a new snippet to the library
   */
  public addSnippet(snippet: CodeSnippet): void {
    if (this.snippets.has(snippet.id)) {
      logger.warn(`Snippet "${snippet.id}" already exists, use updateSnippet instead`);
    }
    const cloned = { ...snippet, lastModified: new Date().toISOString() };
    this.snippets.set(snippet.id, cloned);
    logger.info(`Added snippet: ${snippet.name} (${snippet.id})`);
  }

  /**
   * Update an existing snippet
   */
  public updateSnippet(id: string, updates: Partial<CodeSnippet>): boolean {
    const existing = this.snippets.get(id);
    if (!existing) {
      logger.warn(`Snippet "${id}" not found for update`);
      return false;
    }
    const updated = { ...existing, ...updates, lastModified: new Date().toISOString() };
    this.snippets.set(id, updated);
    logger.info(`Updated snippet: ${updated.name} (${id})`);
    return true;
  }

  /**
   * Delete a snippet from the library
   */
  public deleteSnippet(id: string): boolean {
    const existed = this.snippets.delete(id);
    if (existed) {
      logger.info(`Deleted snippet: ${id}`);
    } else {
      logger.warn(`Snippet "${id}" not found for deletion`);
    }
    return existed;
  }

  /**
   * Search snippets by filters
   */
  public searchSnippets(filters: SnippetFilters): CodeSnippet[] {
    let results = this.getAllSnippets();

    if (filters.language) {
      const lang = filters.language.toLowerCase();
      results = results.filter((s) => s.language.toLowerCase() === lang);
    }

    if (filters.category) {
      const cat = filters.category.toLowerCase();
      results = results.filter((s) => s.category.toLowerCase() === cat);
    }

    if (filters.tags && filters.tags.length > 0) {
      const searchTags = filters.tags.map((t) => t.toLowerCase());
      results = results.filter((s) =>
        searchTags.some((tag) => s.tags.map((t) => t.toLowerCase()).includes(tag))
      );
    }

    if (filters.query) {
      const q = filters.query.toLowerCase();
      results = results.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          s.description.toLowerCase().includes(q) ||
          s.code.toLowerCase().includes(q) ||
          s.tags.some((t) => t.toLowerCase().includes(q))
      );
    }

    return results;
  }

  /**
   * Intelligently match the most relevant snippets for a user request
   */
  public findBestMatches(userRequest: string, limit: number = 5): SnippetMatch[] {
    const requestWords = this.tokenize(userRequest);
    const requestLower = userRequest.toLowerCase();

    const scored: SnippetMatch[] = this.getAllSnippets().map((snippet) => {
      let score = 0;
      const reasons: string[] = [];

      const snippetNameLower = snippet.name.toLowerCase();
      const snippetDescLower = snippet.description.toLowerCase();
      const snippetTagsLower = snippet.tags.map((t) => t.toLowerCase());
      const snippetCodeLower = snippet.code.toLowerCase();
      const snippetCategoryLower = snippet.category.toLowerCase();

      for (const word of requestWords) {
        if (snippetNameLower.includes(word)) {
          score += 10;
          if (!reasons.includes('name match')) reasons.push('name match');
        }
        if (snippetDescLower.includes(word)) {
          score += 5;
          if (!reasons.includes('description match')) reasons.push('description match');
        }
        if (snippetTagsLower.includes(word)) {
          score += 8;
          if (!reasons.includes('tag match')) reasons.push('tag match');
        }
        if (snippetCategoryLower.includes(word)) {
          score += 6;
          if (!reasons.includes('category match')) reasons.push('category match');
        }
        if (snippetCodeLower.includes(word)) {
          score += 2;
          if (!reasons.includes('code content match')) reasons.push('code content match');
        }
      }

      if (requestLower.includes(snippet.language.toLowerCase())) {
        score += 4;
        if (!reasons.includes('language match')) reasons.push('language match');
      }

      const exactPhraseMatch = this.checkExactPhraseMatch(requestLower, snippet);
      if (exactPhraseMatch > 0) {
        score += exactPhraseMatch;
        if (!reasons.includes('exact phrase match')) reasons.push('exact phrase match');
      }

      return { snippet, score, matchReasons: reasons };
    });

    scored.sort((a, b) => b.score - a.score);

    const topMatches = scored.filter((s) => s.score > 0).slice(0, limit);

    logger.debug(`findBestMatches: found ${topMatches.length} matches for request "${userRequest}"`);

    return topMatches;
  }

  /**
   * Replace template variables in snippet code
   *
   * Supports {{variableName}} syntax
   */
  public renderSnippet(id: string, variables: Record<string, string>): string | undefined {
    const snippet = this.snippets.get(id);
    if (!snippet) {
      logger.warn(`Snippet "${id}" not found for rendering`);
      return undefined;
    }

    let rendered = snippet.code;

    for (const [key, value] of Object.entries(variables)) {
      const placeholder = `{{${key}}}`;
      const regex = new RegExp(this.escapeRegex(placeholder), 'g');
      rendered = rendered.replace(regex, value);
    }

    const unmatched = this.findUnmatchedVariables(rendered);
    if (unmatched.length > 0) {
      logger.warn(`Unmatched variables in snippet "${id}": ${unmatched.join(', ')}`);
    }

    logger.debug(`Rendered snippet "${id}" with ${Object.keys(variables).length} variables`);

    return rendered;
  }

  /**
   * Export the entire snippet library to a JSON file
   */
  public exportLibrary(filePath: string): boolean {
    try {
      const data: SnippetLibraryData = {
        version: '1.0.0',
        exportedAt: new Date().toISOString(),
        snippets: this.getAllSnippets(),
      };

      const dir = path.dirname(filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
      logger.info(`Exported ${data.snippets.length} snippets to ${filePath}`);
      return true;
    } catch (error) {
      logger.error(`Failed to export library to ${filePath}:`, error);
      return false;
    }
  }

  /**
   * Import snippets from a JSON export file
   */
  public importLibrary(filePath: string, overwrite: boolean = false): number {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const data = JSON.parse(content) as SnippetLibraryData;

      if (!data.snippets || !Array.isArray(data.snippets)) {
        logger.error(`Invalid library format in ${filePath}`);
        return 0;
      }

      let imported = 0;
      for (const snippet of data.snippets) {
        const snippetId = snippet.id || 'unknown';
        if (!this.validateSnippet(snippet)) {
          logger.warn(`Skipping invalid snippet: ${snippetId}`);
          continue;
        }

        if (this.snippets.has(snippet.id) && !overwrite) {
          logger.debug(`Snippet "${snippet.id}" already exists, skipping (use overwrite=true to replace)`);
          continue;
        }

        this.snippets.set(snippet.id, snippet);
        imported++;
      }

      logger.info(`Imported ${imported} snippets from ${filePath}`);
      return imported;
    } catch (error) {
      logger.error(`Failed to import library from ${filePath}:`, error);
      return 0;
    }
  }

  /**
   * Get statistics about the library
   */
  public getStats(): {
    total: number;
    byLanguage: Record<string, number>;
    byCategory: Record<string, number>;
    topTags: Record<string, number>;
  } {
    const all = this.getAllSnippets();
    const byLanguage: Record<string, number> = {};
    const byCategory: Record<string, number> = {};
    const topTags: Record<string, number> = {};

    for (const s of all) {
      byLanguage[s.language] = (byLanguage[s.language] || 0) + 1;
      byCategory[s.category] = (byCategory[s.category] || 0) + 1;
      for (const tag of s.tags) {
        topTags[tag] = (topTags[tag] || 0) + 1;
      }
    }

    return { total: all.length, byLanguage, byCategory, topTags };
  }

  // ------------------------------------------------------------------
  // Private helpers
  // ------------------------------------------------------------------

  /**
   * Recursively find all .snippet.json and .snippet.md files
   */
  private findAllSnippetFiles(dir: string): string[] {
    const results: string[] = [];

    const walk = (currentDir: string) => {
      const entries = fs.readdirSync(currentDir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(currentDir, entry.name);

        if (entry.isDirectory()) {
          walk(fullPath);
        } else if (entry.isFile()) {
          if (entry.name.endsWith('.snippet.json') || entry.name.endsWith('.snippet.md')) {
            results.push(fullPath);
          }
        }
      }
    };

    walk(dir);
    return results;
  }

  /**
   * Parse a snippet file content into a CodeSnippet object
   */
  private parseSnippetFile(content: string, filePath: string): CodeSnippet | null {
    if (filePath.endsWith('.snippet.json')) {
      try {
        const parsed = JSON.parse(content) as CodeSnippet;
        if (this.validateSnippet(parsed)) {
          return parsed;
        }
      } catch (error) {
        logger.error(`Invalid JSON in snippet file ${filePath}:`, error);
      }
    }

    if (filePath.endsWith('.snippet.md')) {
      return this.parseMarkdownSnippet(content, filePath);
    }

    return null;
  }

  /**
   * Parse a markdown snippet file with YAML-like frontmatter
   */
  private parseMarkdownSnippet(content: string, filePath: string): CodeSnippet | null {
    const frontmatterRegex = /^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/;
    const match = content.match(frontmatterRegex);

    if (!match) {
      logger.warn(`No frontmatter found in ${filePath}`);
      return null;
    }

    const [, frontmatterRaw, codeBody] = match;
    const frontmatter = this.parseFrontmatter(frontmatterRaw);

    const id = frontmatter.id || path.basename(filePath, '.snippet.md');
    const name = frontmatter.name || id;
    const description = frontmatter.description || '';
    const language = frontmatter.language || 'plaintext';
    const category = frontmatter.category || 'general';
    const tags = frontmatter.tags ? frontmatter.tags.split(',').map((t: string) => t.trim()) : [];
    const variablesRaw = frontmatter.variables || '';
    const variables = variablesRaw
      ? variablesRaw.split(',').map((v: string) => v.trim())
      : this.extractVariables(codeBody);
    const usage = frontmatter.usage || '';

    const snippet: CodeSnippet = {
      id,
      name,
      description,
      language,
      category,
      code: codeBody.trim(),
      tags,
      variables,
      usage,
      lastModified: fs.statSync(filePath).mtime.toISOString(),
    };

    return snippet;
  }

  /**
   * Parse frontmatter key-value pairs
   */
  private parseFrontmatter(raw: string): Record<string, string> {
    const result: Record<string, string> = {};
    for (const line of raw.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const colonIndex = trimmed.indexOf(':');
      if (colonIndex > 0) {
        const key = trimmed.slice(0, colonIndex).trim();
        const value = trimmed.slice(colonIndex + 1).trim();
        result[key] = value;
      }
    }
    return result;
  }

  /**
   * Validate that a CodeSnippet has all required fields
   */
  private validateSnippet(snippet: Partial<CodeSnippet>): snippet is CodeSnippet {
    const required = ['id', 'name', 'description', 'language', 'category', 'code', 'tags', 'variables', 'usage'];
    for (const field of required) {
      if (!(field in snippet)) {
        logger.warn(`Snippet missing required field: ${field}`);
        return false;
      }
    }
    return true;
  }

  /**
   * Extract template variables from code body
   */
  private extractVariables(code: string): string[] {
    const regex = /\{\{(\w+)\}\}/g;
    const vars = new Set<string>();
    let match: RegExpExecArray | null;
    while ((match = regex.exec(code)) !== null) {
      vars.add(match[1]);
    }
    return Array.from(vars);
  }

  /**
   * Tokenize text into meaningful words
   */
  private tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9\s_-]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 1);
  }

  /**
   * Check for exact phrase matches in the snippet
   */
  private checkExactPhraseMatch(requestLower: string, snippet: CodeSnippet): number {
    const phrases = [snippet.name.toLowerCase(), snippet.description.toLowerCase()];
    let bonus = 0;

    for (const phrase of phrases) {
      if (phrase && requestLower.includes(phrase)) {
        bonus += 15;
      }
    }

    return bonus;
  }

  /**
   * Find unmatched {{variable}} placeholders in rendered code
   */
  private findUnmatchedVariables(code: string): string[] {
    const regex = /\{\{(\w+)\}\}/g;
    const vars = new Set<string>();
    let match: RegExpExecArray | null;
    while ((match = regex.exec(code)) !== null) {
      vars.add(match[1]);
    }
    return Array.from(vars);
  }

  /**
   * Escape special regex characters in a string
   */
  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}
