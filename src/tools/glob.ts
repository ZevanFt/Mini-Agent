import type { Tool } from '../tools/types.js';
import { glob } from 'glob';

interface GlobParams {
  pattern: string;
  cwd?: string;
  ignore?: string[];
}

export const GlobTool: Tool = {
  name: 'glob',
  description: `Search for files matching a glob pattern.
Use this when you need to find files by name patterns like *.ts, src/**/*.tsx, etc.
Returns a list of matching file paths.`,
  parameters: {
    type: 'object',
    properties: {
      pattern: {
        type: 'string',
        description: 'The glob pattern to search for (e.g., "*.ts", "src/**/*.tsx")',
      },
      cwd: {
        type: 'string',
        description: 'Working directory for the search (optional, defaults to current)',
      },
      ignore: {
        type: 'array',
        description: 'Patterns to exclude (optional)',
        items: {
          type: 'string',
        },
      },
    },
    required: ['pattern'],
  },

  async execute(params: Record<string, unknown>) {
    const { pattern, cwd = process.cwd(), ignore = [] } = params as unknown as GlobParams;

    try {
      const files = await glob(pattern, {
        cwd,
        ignore: [...ignore, '**/node_modules/**', '**/.git/**'],
        nodir: true,
      });

      return {
        success: true,
        content: files.length > 0 ? files.join('\n') : 'No files matched the pattern',
        metadata: {
          pattern,
          cwd,
          count: files.length,
          files,
        },
      };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return {
        success: false,
        content: `Glob error: ${message}`,
        error: message,
      };
    }
  },
};
