import { readFileSync, existsSync } from 'fs';
import { statSync } from 'fs';
import type { Tool, ToolResult } from './types.js';
import path from 'path';

const SUPPORTED_FORMATS = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg'];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

interface ReadImageParams {
  file_path: string;
}

function isImageFile(filePath: string): boolean {
  const ext = path.extname(filePath).toLowerCase();
  return SUPPORTED_FORMATS.includes(ext);
}

function encodeImageToBase64(filePath: string): string {
  const content = readFileSync(filePath);
  return content.toString('base64');
}

function getMimeType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  const mimeTypes: Record<string, string> = {
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.svg': 'image/svg+xml',
  };
  return mimeTypes[ext] || 'application/octet-stream';
}

export const ReadImageTool: Tool = {
  name: 'read_image',
  description: `Read an image file and return its base64-encoded content for LLM vision analysis.
Use this when you need to:
- Analyze UI designs, mockups, or screenshots
- Understand visual layouts or diagrams
- Extract text from images (OCR)
- Analyze charts, graphs, or visualizations

Supported formats: PNG, JPG, JPEG, GIF, WEBP, SVG
Max file size: 10MB

Example:
{ "file_path": "designs/homepage-mockup.png" }`,
  parameters: {
    type: 'object',
    properties: {
      file_path: {
        type: 'string',
        description: 'Path to the image file to read',
      },
    },
    required: ['file_path'],
  },

  async execute(params: Record<string, unknown>): Promise<ToolResult> {
    const { file_path } = params as unknown as ReadImageParams;

    const absolutePath = path.isAbsolute(file_path) ? file_path : path.resolve(process.cwd(), file_path);

    if (!existsSync(absolutePath)) {
      return {
        success: false,
        content: `File not found: ${file_path}`,
        error: 'File not found',
      };
    }

    if (!isImageFile(absolutePath)) {
      return {
        success: false,
        content: `Not a supported image format: ${path.extname(file_path)}\nSupported: PNG, JPG, JPEG, GIF, WEBP, SVG`,
        error: 'Unsupported format',
      };
    }

    const fileSize = statSync(absolutePath).size;
    if (fileSize > MAX_FILE_SIZE) {
      return {
        success: false,
        content: `File too large: ${(fileSize / 1024 / 1024).toFixed(2)}MB (max 10MB)`,
        error: 'File too large',
      };
    }

    try {
      const base64 = encodeImageToBase64(absolutePath);
      const mimeType = getMimeType(absolutePath);

      return {
        success: true,
        content: `Image loaded: ${file_path}\nFormat: ${mimeType}\nSize: ${(fileSize / 1024).toFixed(2)}KB\n\nBase64 data URI: data:${mimeType};base64,${base64.substring(0, 100)}...`,
        metadata: {
          file_path,
          mime_type: mimeType,
          size_bytes: fileSize,
          base64: `data:${mimeType};base64,${base64}`,
        },
      };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        content: `Failed to read image: ${message}`,
        error: message,
      };
    }
  },
};
