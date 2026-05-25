import type { Tool } from '../tools/types.js';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import path from 'path';

interface FileWriteParams {
  path: string;
  content: string;
  createDirs?: boolean;
}

export const FileWriteTool: Tool = {
  name: 'file_write',
  description: `Write content to a file, creating it if it doesn't exist.
Use this when you need to create new files or overwrite existing ones.
Always use absolute paths for file operations.`,
  parameters: {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: 'Absolute or relative path to the file',
      },
      content: {
        type: 'string',
        description: 'The content to write to the file',
      },
      create_dirs: {
        type: 'boolean',
        description: 'Create parent directories if they don\'t exist (default: true)',
        default: true,
      },
    },
    required: ['path', 'content'],
  },

  async execute(params: Record<string, unknown>) {
    const { path: filePath, content, create_dirs: createDirs = true } = params as unknown as FileWriteParams & { create_dirs?: boolean };

    try {
      if (createDirs) {
        const dir = path.dirname(filePath);
        if (!existsSync(dir)) {
          mkdirSync(dir, { recursive: true });
        }
      }

      writeFileSync(filePath, content, 'utf-8');

      return {
        success: true,
        content: `File written successfully: ${filePath}`,
        metadata: { path: filePath, bytes: Buffer.byteLength(content, 'utf-8') },
      };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return {
        success: false,
        content: `Error writing file: ${message}`,
        error: message,
      };
    }
  },
};
