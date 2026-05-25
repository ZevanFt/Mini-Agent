import { readFileSync, writeFileSync } from 'fs';
import type { Tool, ToolResult } from './types.js';

interface FileEdit {
  path: string;
  search: string;
  replace: string;
}

export const MultiEditTool: Tool = {
  name: 'multi_edit',
  description: `Make edits to multiple files simultaneously.
Format: JSON array of {path, search, replace} objects.

Example:
[
  {"path": "src/a.ts", "search": "old", "replace": "new"},
  {"path": "src/b.ts", "search": "foo", "replace": "bar"}
]`,
  parameters: {
    type: 'object',
    properties: {
      edits: {
        type: 'array',
        description: 'Array of file edits to apply',
      },
    },
    required: ['edits'],
  },
  async execute(params: Record<string, unknown>): Promise<ToolResult> {
    const edits = params.edits as FileEdit[];
    if (!Array.isArray(edits)) {
      return { success: false, content: 'Error: edits must be an array' };
    }

    const results: string[] = [];
    let successCount = 0;
    let failCount = 0;

    for (const edit of edits) {
      try {
        if (!edit.path || !edit.path.trim()) {
          failCount++;
          results.push(`Failed: empty path`);
          continue;
        }

        const content = readFileSync(edit.path, 'utf-8');

        const searchIndex = content.indexOf(edit.search);
        if (searchIndex === -1) {
          failCount++;
          results.push(`Failed: ${edit.path}: search string not found`);
          continue;
        }

        const newContent = content.substring(0, searchIndex) + edit.replace + content.substring(searchIndex + edit.search.length);
        writeFileSync(edit.path, newContent, 'utf-8');

        successCount++;
        results.push(`Edited: ${edit.path}`);
      } catch (error) {
        failCount++;
        results.push(`Failed: ${edit.path}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    return {
      success: failCount === 0,
      content: `Multi-edit complete: ${successCount} succeeded, ${failCount} failed.\n${results.join('\n')}`,
    };
  },
};
