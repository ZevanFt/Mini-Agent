/**
 * FileEditTool - 精细文件编辑工具（Claude Code 风格）
 * 
 * 学习笔记：
 * Claude Code 的 Edit 工具使用 SEARCH/REPLACE 模式：
 * 1. 先读取文件确认 SEARCH 内容存在
 * 2. 精确定位要替换的代码块
 * 3. 只替换该块，不影响其他代码
 * 
 * 与 file_write 的区别：
 * - file_write: 完全覆盖文件内容
 * - file_edit: 精确替换特定代码块，保留其他内容
 * 
 * 格式：
 * ```
 * <<<<<<< SEARCH
 * 原始代码
 * =======
 * 新代码
 * >>>>>>> REPLACE
 * ```
 * 
 * 或使用 JSON 参数：
 * { "path": "file.ts", "search": "old_code", "replace": "new_code" }
 */

import type { Tool, ToolResult } from '../tools/types.js';
import { readFileSync, writeFileSync } from 'fs';

interface FileEditParams {
  path: string;
  search: string;
  replace: string;
}

export const FileEditTool: Tool = {
  name: 'file_edit',
  description: `Make precise edits to a file by replacing a specific code block.

Use this when:
- You need to modify part of a file without rewriting everything
- You want to preserve surrounding code
- You're making surgical changes

IMPORTANT: The search block must exactly match the code in the file.
- Include enough surrounding lines to uniquely match
- Match indentation, whitespace, and newlines exactly
- Do not include code blocks that don't need to change

Format:
<<<<<<< SEARCH
existing code here
=======
new code here
>>>>>>> REPLACE

Or use JSON parameters with "search" and "replace" fields.`,

  parameters: {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: 'Path to the file to edit',
      },
      search: {
        type: 'string',
        description: 'The exact code block to find and replace (must match file content)',
      },
      replace: {
        type: 'string',
        description: 'The new code to insert',
      },
    },
    required: ['path', 'search', 'replace'],
  },

  async execute(params: Record<string, unknown>): Promise<ToolResult> {
    const { path: filePath, search, replace } = params as unknown as FileEditParams;

    try {
      // 1. 读取文件
      if (!filePath || filePath.trim() === '') {
        return { success: false, content: 'Missing file path.' };
      }

      let content: string;
      try {
        content = readFileSync(filePath, 'utf-8');
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          success: false,
          content: `Cannot read file: ${message}. The file must exist for editing.`,
          error: message,
        };
      }

      // 2. 检查 SEARCH 内容是否存在
      const searchIndex = content.indexOf(search);
      if (searchIndex === -1) {
        // 提供更详细的错误信息
        const lines = content.split('\n');
        const searchLines = search.split('\n');
        let bestMatch = -1;
        let bestScore = 0;

        // 尝试逐行匹配，找到最接近的行
        for (let i = 0; i < lines.length; i++) {
          let score = 0;
          for (let j = 0; j < searchLines.length; j++) {
            if (i + j < lines.length && lines[i + j].trim() === searchLines[j].trim()) {
              score++;
            }
          }
          if (score > bestScore) {
            bestScore = score;
            bestMatch = i;
          }
        }

        let hint = '';
        if (bestMatch >= 0 && bestScore > 0) {
          hint = `\n\nClosest match at line ${bestMatch + 1} (${bestScore}/${searchLines.length} lines match):\n${lines.slice(bestMatch, bestMatch + 3).join('\n')}`;
        }

        return {
          success: false,
          content: `Search block not found in file. The code to search must exactly match the file content.${hint}`,
          error: 'SEARCH_NOT_FOUND',
        };
      }

      // 3. 执行替换
      const newContent = content.substring(0, searchIndex) + replace + content.substring(searchIndex + search.length);

      // 4. 写回文件
      writeFileSync(filePath, newContent, 'utf-8');

      const originalLines = content.split('\n').length;
      const newLines = newContent.split('\n').length;
      const lineDiff = newLines - originalLines;

      return {
        success: true,
        content: `File edited successfully: ${filePath} (${originalLines} → ${newLines} lines, ${lineDiff > 0 ? '+' : ''}${lineDiff} lines)`,
        metadata: { path: filePath, originalLines, newLines, lineDiff },
      };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        content: `Error editing file: ${message}`,
        error: message,
      };
    }
  },
};
