import type { Tool } from '../tools/types.js';
import { readFileSync, existsSync } from 'fs';

interface FileReadParams {
  path: string;
  limit?: number;
}

export const FileReadTool: Tool = {
  name: 'file_read',
  description: `Read the contents of a file from the filesystem.
Use this when you need to examine existing code or text files.
Supports any text-based file format.`,
  parameters: {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: 'Absolute or relative path to the file to read',
      },
      limit: {
        type: 'number',
        description: 'Maximum number of lines to read (optional, reads all if not specified)',
      },
    },
    required: ['path'],
  },

  async execute(params: Record<string, unknown>) {
    const { path: filePath, limit } = params as unknown as FileReadParams;

    try {
      if (!existsSync(filePath)) {
        return {
          success: false,
          content: `File not found: ${filePath}`,
          error: 'FILE_NOT_FOUND',
        };
      }

      let content = readFileSync(filePath, 'utf-8');
      const totalLines = content.split('\n').length;

      if (limit) {
        const lines = content.split('\n').slice(0, limit);
        content = lines.join('\n');
      }

      return {
        success: true,
        content,
        metadata: {
          path: filePath,
          lines: limit ? Math.min(limit, totalLines) : totalLines,
          totalLines,
          truncated: limit ? limit < totalLines : false,
        },
      };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return {
        success: false,
        content: `Error reading file: ${message}`,
        error: message,
      };
    }
  },
};
