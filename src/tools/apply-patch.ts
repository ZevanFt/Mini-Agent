import { readFileSync, writeFileSync, existsSync } from 'fs';
import type { Tool, ToolResult } from './types.js';
import path from 'path';

interface ApplyPatchParams {
  patch_text: string;
  file_path?: string;
}

function parseUnifiedPatch(patchText: string): PatchFile[] {
  const files: PatchFile[] = [];
  const lines = patchText.split('\n');
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Match diff header: diff --git a/path b/path or --- a/path or +++ b/path
    const diffMatch = line.match(/^diff --git a\/(.+?) b\/(.+?)$/);
    const minusMatch = line.match(/^--- (?:a\/)?(.+?)$/);

    if (diffMatch) {
      const filePath = diffMatch[2];
      const patches = parseHunks(lines, i + 1);
      files.push({ path: filePath, hunks: patches.hunks, nextIndex: patches.nextIndex });
      i = patches.nextIndex;
    } else if (minusMatch && i + 1 < lines.length && lines[i + 1].match(/^\+\+\+/)) {
      const filePath = minusMatch[1];
      const patches = parseHunks(lines, i + 2);
      files.push({ path: filePath, hunks: patches.hunks, nextIndex: patches.nextIndex });
      i = patches.nextIndex;
    } else {
      i++;
    }
  }

  return files;
}

interface PatchFile {
  path: string;
  hunks: PatchHunk[];
  nextIndex: number;
}

interface PatchHunk {
  oldStart: number;
  oldCount: number;
  newStart: number;
  newCount: number;
  lines: string[];
}

function parseHunkHeader(line: string): PatchHunk | null {
  const match = line.match(/^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/);
  if (!match) return null;

  return {
    oldStart: parseInt(match[1], 10),
    oldCount: parseInt(match[2] || '1', 10),
    newStart: parseInt(match[3], 10),
    newCount: parseInt(match[4] || '1', 10),
    lines: [],
  };
}

function parseHunks(lines: string[], startIndex: number): { hunks: PatchHunk[]; nextIndex: number } {
  const hunks: PatchHunk[] = [];
  let i = startIndex;
  let currentHunk: PatchHunk | null = null;

  while (i < lines.length) {
    const line = lines[i];

    // Check for new hunk header
    if (line.startsWith('@@')) {
      currentHunk = parseHunkHeader(line);
      if (currentHunk) {
        hunks.push(currentHunk);
      }
      i++;
      continue;
    }

    if (line.startsWith('diff --git') || line.startsWith('--- ') || i >= lines.length) {
      break;
    }

    if (currentHunk) {
      currentHunk.lines.push(line);
    }

    i++;
  }

  return { hunks, nextIndex: i };
}

function applyHunkToContent(content: string, hunk: PatchHunk): string {
  const contentLines = content.split('\n');

  // Build expected old lines from hunk
  const oldLines: string[] = [];
  const newLines: string[] = [];

  for (const line of hunk.lines) {
    if (line.startsWith('-')) {
      oldLines.push(line.slice(1));
    } else if (line.startsWith('+')) {
      newLines.push(line.slice(1));
    } else if (line.startsWith(' ')) {
      oldLines.push(line.slice(1));
      newLines.push(line.slice(1));
    }
  }

  // Find the old lines in content
  const startLine = hunk.oldStart - 1; // Convert to 0-based

  // Try exact match at expected position first
  const expectedSlice = contentLines.slice(startLine, startLine + oldLines.length).join('\n');
  const expectedMatch = oldLines.join('\n');

  if (expectedSlice === expectedMatch) {
    // Replace at expected position
    contentLines.splice(startLine, oldLines.length, ...newLines);
    return contentLines.join('\n');
  }

  // Fuzzy search: find the old lines elsewhere in the content
  for (let i = 0; i <= contentLines.length - oldLines.length; i++) {
    const slice = contentLines.slice(i, i + oldLines.length).join('\n');
    if (slice === expectedMatch) {
      contentLines.splice(i, oldLines.length, ...newLines);
      return contentLines.join('\n');
    }
  }

  throw new Error(`Could not match hunk context at line ${hunk.oldStart}`);
}

export const ApplyPatchTool: Tool = {
  name: 'apply_patch',
  description: `Apply a unified diff patch to files in the codebase.
Use this when you have a diff/patch that needs to be applied to existing files.
This is more precise than rewriting entire files, especially for large files.

The patch_text should be a unified diff format:
- Lines starting with '+' are additions
- Lines starting with '-' are deletions
- Lines starting with ' ' are context lines

Example:
--- a/src/example.ts
+++ b/src/example.ts
@@ -1,3 +1,4 @@
 existing line
-old line
+new line
+added line
 another existing line`,
  parameters: {
    type: 'object',
    properties: {
      patch_text: {
        type: 'string',
        description: 'The unified diff patch text to apply. Should be in standard unified diff format.',
      },
      file_path: {
        type: 'string',
        description: 'Optional: Target file path if patch is for a single file. If omitted, file paths are extracted from the patch.',
      },
    },
    required: ['patch_text'],
  },

  async execute(params: Record<string, unknown>): Promise<ToolResult> {
    const { patch_text, file_path } = params as unknown as ApplyPatchParams;

    if (!patch_text || !patch_text.trim()) {
      return {
        success: false,
        content: 'Error: patch_text is required',
        error: 'patch_text required',
      };
    }

    const results: string[] = [];
    let successCount = 0;
    let failCount = 0;

    try {
      // Parse the patch
      const patchFiles = parseUnifiedPatch(patch_text);

      if (patchFiles.length === 0 && file_path) {
        // If no patch files parsed but file_path is provided, try to apply as a simple patch
        // This handles cases where the patch doesn't have standard headers
        const lines = patch_text.split('\n');
        const filePath = file_path;
        const absolutePath = path.isAbsolute(filePath) ? filePath : path.resolve(process.cwd(), filePath);

        if (!existsSync(absolutePath)) {
          return {
            success: false,
            content: `File not found: ${filePath}`,
            error: 'File not found',
          };
        }

        let content = readFileSync(absolutePath, 'utf-8');
        const contentLines = content.split('\n');

        // Process patch lines directly
        for (const line of lines) {
          if (line.startsWith('+')) {
            contentLines.push(line.slice(1));
          } else if (line.startsWith('-')) {
            // Remove the line if it exists
            const idx = contentLines.indexOf(line.slice(1));
            if (idx !== -1) {
              contentLines.splice(idx, 1);
            }
          } else if (line.trim() && !line.startsWith('diff') && !line.startsWith('@@') && !line.startsWith('---') && !line.startsWith('+++')) {
            contentLines.push(line);
          }
        }

        writeFileSync(absolutePath, contentLines.join('\n'), 'utf-8');
        return {
          success: true,
          content: `Patch applied to ${filePath}`,
        };
      }

      for (const patchFile of patchFiles) {
        const filePath = patchFile.path;
        const absolutePath = path.isAbsolute(filePath) ? filePath : path.resolve(process.cwd(), filePath);

        if (!existsSync(absolutePath)) {
          // Check if this is a new file creation (all hunks are additions)
          const isNewFile = patchFile.hunks.every(hunk =>
            hunk.lines.every(line => line.startsWith('+') || line.startsWith('\\'))
          );

          if (isNewFile) {
            // Create new file with added content
            const newContent: string[] = [];
            for (const hunk of patchFile.hunks) {
              for (const line of hunk.lines) {
                if (line.startsWith('+')) {
                  newContent.push(line.slice(1));
                }
              }
            }
            writeFileSync(absolutePath, newContent.join('\n'), 'utf-8');
            successCount++;
            results.push(`Created new file: ${filePath}`);
          } else {
            failCount++;
            results.push(`Failed: ${filePath}: file not found`);
          }
          continue;
        }

        try {
          let content = readFileSync(absolutePath, 'utf-8');

          // Apply each hunk
          for (const hunk of patchFile.hunks) {
            content = applyHunkToContent(content, hunk);
          }

          writeFileSync(absolutePath, content, 'utf-8');
          successCount++;
          results.push(`Applied patch to: ${filePath} (${patchFile.hunks.length} hunks)`);
        } catch (error) {
          failCount++;
          const message = error instanceof Error ? error.message : String(error);
          results.push(`Failed: ${filePath}: ${message}`);
        }
      }

      if (successCount === 0 && failCount === 0) {
        return {
          success: false,
          content: 'No valid patch operations found in patch_text',
          error: 'No operations found',
        };
      }

      return {
        success: failCount === 0,
        content: `Patch applied: ${successCount} succeeded, ${failCount} failed.\n${results.join('\n')}`,
      };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        content: `Failed to apply patch: ${message}`,
        error: message,
      };
    }
  },
};
