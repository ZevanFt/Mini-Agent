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
