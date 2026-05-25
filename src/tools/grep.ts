import type { Tool } from '../tools/types.js';
import { readFileSync, existsSync, statSync } from 'fs';
import path from 'path';

interface GrepParams {
  pattern: string;
  path?: string;
  include?: string;
  maxResults?: number;
  caseSensitive?: boolean;
}

export const GrepTool: Tool = {
  name: 'grep',
  description: `Search for a pattern in file contents.
Use this when you need to find specific text or code patterns across files.
Returns matching lines with file paths and line numbers.`,
  parameters: {
    type: 'object',
    properties: {
      pattern: {
        type: 'string',
        description: 'The text pattern to search for',
      },
      path: {
        type: 'string',
        description: 'File or directory to search in (defaults to current directory)',
      },
      include: {
        type: 'string',
        description: 'File pattern to include in search (e.g., "*.ts")',
      },
      maxResults: {
        type: 'number',
        description: 'Maximum number of results to return (default: 100)',
        default: 100,
      },
      caseSensitive: {
        type: 'boolean',
        description: 'Whether the search is case-sensitive (default: false)',
        default: false,
      },
    },
    required: ['pattern'],
  },

  async execute(params: Record<string, unknown>) {
    const {
      pattern,
      path: searchPath = process.cwd(),
      include,
      maxResults = 100,
      caseSensitive = false,
    } = params as unknown as GrepParams;

    try {
      const results: Array<{ file: string; line: number; content: string }> = [];
      const flags = caseSensitive ? '' : 'i';
      const regex = new RegExp(pattern, flags);

      function searchDir(dir: string): void {
        if (results.length >= maxResults) return;

        const entries = require('fs').readdirSync(dir);
        for (const entry of entries) {
          if (entry === 'node_modules' || entry === '.git') continue;

          const fullPath = path.join(dir, entry);
          if (!existsSync(fullPath)) continue;

          const stat = statSync(fullPath);
          if (stat.isDirectory()) {
            searchDir(fullPath);
          } else if (stat.isFile()) {
            if (include && !require('minimatch')(entry, include)) continue;

            try {
              const content = readFileSync(fullPath, 'utf-8');
              const lines = content.split('\n');
              for (let i = 0; i < lines.length; i++) {
                if (regex.test(lines[i])) {
                  results.push({
                    file: fullPath,
                    line: i + 1,
                    content: lines[i].trim(),
                  });
                  if (results.length >= maxResults) return;
                }
              }
            } catch {
              // Skip binary or unreadable files
            }
          }
        }
      }

      if (existsSync(searchPath)) {
        const stat = statSync(searchPath);
        if (stat.isDirectory()) {
          searchDir(searchPath);
        } else {
          const content = readFileSync(searchPath, 'utf-8');
          const lines = content.split('\n');
          for (let i = 0; i < lines.length && results.length < maxResults; i++) {
            if (regex.test(lines[i])) {
              results.push({
                file: searchPath,
                line: i + 1,
                content: lines[i].trim(),
              });
            }
          }
        }
      }

      if (results.length === 0) {
        return {
          success: true,
          content: 'No matches found',
          metadata: { pattern, count: 0 },
        };
      }

      const output = results
        .map(r => `${r.file}:${r.line}: ${r.content}`)
        .join('\n');

      return {
        success: true,
        content: `${results.length} matches found:\n${output}`,
        metadata: { pattern, count: results.length, results },
      };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return {
        success: false,
        content: `Grep error: ${message}`,
        error: message,
      };
    }
  },
};
