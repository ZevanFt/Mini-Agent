import { readdir } from 'fs/promises';
import path from 'path';
import { Box, Text } from 'ink';
import { truncateByWidth } from './text.js';
import { TUI_THEME } from './theme.js';

export interface FileEntry {
  path: string;
  name: string;
  isDirectory: boolean;
  relativePath: string;
}

export async function listFiles(dir: string, cwd: string, maxResults = 30): Promise<FileEntry[]> {
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    const results: FileEntry[] = [];
    for (const entry of entries.slice(0, maxResults)) {
      if (entry.name.startsWith('.') && entry.name !== '.env') continue;
      if (entry.name === 'node_modules') continue;
      if (entry.name === '.git') continue;
      const fullPath = path.join(dir, entry.name);
      const relativePath = path.relative(cwd, fullPath);
      results.push({
        path: fullPath,
        name: entry.name,
        isDirectory: entry.isDirectory(),
        relativePath,
      });
    }
    return results.sort((a, b) => {
      if (a.isDirectory && !b.isDirectory) return -1;
      if (!a.isDirectory && b.isDirectory) return 1;
      return a.name.localeCompare(b.name);
    });
  } catch {
    return [];
  }
}

export function findAtTrigger(text: string, cursorCol: number): { start: number; query: string } | null {
  const before = text.slice(0, cursorCol);
  const atIdx = before.lastIndexOf('@');
  if (atIdx === -1) return null;
  // Check no whitespace between @ and cursor
  const between = before.slice(atIdx + 1);
  if (/\s/.test(between)) return null;
  return { start: atIdx, query: between };
}

export function filterFiles(files: FileEntry[], query: string): FileEntry[] {
  if (!query) return files;
  const lower = query.toLowerCase();
  return files.filter(f =>
    f.name.toLowerCase().includes(lower) ||
    f.relativePath.toLowerCase().includes(lower)
  );
}

export interface AutocompletePopupProps {
  files: FileEntry[];
  selectedIndex: number;
  width: number;
  query: string;
}

export function AutocompletePopup({ files, selectedIndex, width, query }: AutocompletePopupProps) {
  const contentWidth = Math.max(10, width - 4);
  const maxVisible = Math.min(8, files.length);
  const startIndex = Math.max(0, selectedIndex - Math.floor(maxVisible / 2));
  const visible = files.slice(startIndex, startIndex + maxVisible);

  return (
    <Box flexDirection="column" width={width} borderStyle="single" borderColor={TUI_THEME.accent} paddingX={1}>
      <Box justifyContent="space-between">
        <Text color={TUI_THEME.accent}>Files</Text>
        <Text dimColor>{query ? `Filter: ${query}` : `${files.length} files`}</Text>
      </Box>
      {visible.map((file, i) => {
        const idx = startIndex + i;
        const isSelected = idx === selectedIndex;
        return (
          <Box key={file.path} justifyContent="space-between">
            <Text
              color={isSelected ? TUI_THEME.accent : file.isDirectory ? TUI_THEME.warning : undefined}
              bold={isSelected}
            >{isSelected ? '▸ ' : '  '}{file.isDirectory ? '📁 ' : '📄 '}{truncateByWidth(file.name, contentWidth - 20).text}</Text>
            <Text dimColor>{truncateByWidth(file.relativePath, 18).text}</Text>
          </Box>
        );
      })}
      {files.length === 0 && <Text dimColor>No matching files</Text>}
      <Box marginTop={1} justifyContent="space-between">
        <Text dimColor>↑↓ move</Text>
        <Text dimColor>Tab/Enter insert</Text>
        <Text dimColor>Esc close</Text>
      </Box>
    </Box>
  );
}
