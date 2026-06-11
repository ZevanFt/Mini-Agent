// Paste summarization: detect large pastes and create summaries

export interface PasteSummaryResult {
  isLargePaste: boolean;
  summary: string;
  lineCount: number;
  charCount: number;
}

export function detectPaste(text: string, options: { maxLines?: number; maxChars?: number } = {}): PasteSummaryResult {
  const maxLines = options.maxLines ?? 3;
  const maxChars = options.maxChars ?? 150;

  const lines = text.split('\n');
  const lineCount = lines.length;
  const charCount = text.length;

  const isLargePaste = lineCount > maxLines || charCount > maxChars;

  if (!isLargePaste) {
    return { isLargePaste: false, summary: text, lineCount, charCount };
  }

  // Create summary
  const preview = lines.slice(0, 2).join('\n').slice(0, 60);
  const summary = `[Pasted ~${lineCount} lines] ${preview}${lines.length > 2 ? '...' : ''}`;

  return { isLargePaste: true, summary, lineCount, charCount };
}

// Format paste summary for display
export function formatPasteSummary(result: PasteSummaryResult): string {
  if (!result.isLargePaste) return '';
  return `[Pasted ~${result.lineCount} lines, ${result.charCount} chars]`;
}
