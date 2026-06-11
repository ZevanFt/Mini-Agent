export interface CollapseOptions {
  maxLines: number;
  maxChars: number;
  ellipsis: string;
}

export const DEFAULT_COLLAPSE_OPTIONS: CollapseOptions = {
  maxLines: 50,
  maxChars: 4000,
  ellipsis: '\n... (output truncated)',
};

// Per-tool thresholds matching opencode's behavior
export const TOOL_COLLAPSE_PRESETS: Record<string, Partial<CollapseOptions>> = {
  bash: { maxLines: 10 },
  shell: { maxLines: 10 },
  exec: { maxLines: 10 },
  file_read: { maxLines: 3 },
  file_write: { maxLines: 3 },
  file_edit: { maxLines: 3 },
  multi_edit: { maxLines: 3 },
  glob: { maxLines: 3 },
  grep: { maxLines: 3 },
  web_fetch: { maxLines: 5 },
  web_search: { maxLines: 5 },
  default: { maxLines: 3 },
};

// Width-aware maxChars calculation (matches opencode: maxLines * max(20, width - 6))
export function getWidthAwareMaxChars(maxLines: number, termWidth: number): number {
  return maxLines * Math.max(20, termWidth - 6);
}

// Get collapse options for a specific tool, width-aware
export function getToolCollapseOptions(toolName: string, termWidth: number): CollapseOptions {
  const preset = TOOL_COLLAPSE_PRESETS[toolName] || TOOL_COLLAPSE_PRESETS['default'];
  const maxLines = preset.maxLines ?? 3;
  const maxChars = getWidthAwareMaxChars(maxLines, termWidth);
  return {
    maxLines,
    maxChars,
    ellipsis: DEFAULT_COLLAPSE_OPTIONS.ellipsis,
  };
}

export function collapseToolOutput(output: string, options: Partial<CollapseOptions> = {}): { text: string; collapsed: boolean; originalLines: number; originalChars: number } {
  const opts = { ...DEFAULT_COLLAPSE_OPTIONS, ...options };
  const lines = output.split('\n');
  const originalLines = lines.length;
  const originalChars = output.length;

  if (lines.length <= opts.maxLines && output.length <= opts.maxChars) {
    return { text: output, collapsed: false, originalLines, originalChars };
  }

  let truncated = lines.slice(0, opts.maxLines).join('\n');
  if (truncated.length > opts.maxChars) {
    truncated = truncated.slice(0, opts.maxChars);
  }

  return {
    text: truncated + opts.ellipsis,
    collapsed: true,
    originalLines,
    originalChars,
  };
}

export function formatCollapsedSummary(originalLines: number, originalChars: number): string {
  if (originalChars > 1000) {
    return `${originalLines} lines (${(originalChars / 1000).toFixed(1)}k chars)`;
  }
  return `${originalLines} lines`;
}
