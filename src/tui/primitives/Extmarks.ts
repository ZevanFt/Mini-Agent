// Extmarks: virtual text markers for file/agent mentions in prompt
// These are styled text overlays that represent special content

export interface Extmark {
  id: string;
  startCol: number;
  endCol: number;
  type: 'file' | 'agent' | 'model' | 'reference';
  label: string;
  path?: string;
  style: ExtmarkStyle;
}

export interface ExtmarkStyle {
  color: string;
  bold?: boolean;
  italic?: boolean;
  backgroundColor?: string;
  prefix?: string;
  suffix?: string;
}

export const EXTMARK_STYLES: Record<string, ExtmarkStyle> = {
  file: { color: '#58a6ff', bold: false, prefix: '📄 ' },
  agent: { color: '#d2a8ff', bold: true, prefix: '@' },
  model: { color: '#7ee787', bold: false, prefix: '🤖 ' },
  reference: { color: '#ffa657', italic: true, prefix: '#' },
};

export function createExtmark(
  id: string,
  startCol: number,
  endCol: number,
  type: Extmark['type'],
  label: string,
  path?: string,
): Extmark {
  return {
    id,
    startCol,
    endCol,
    type,
    label,
    path,
    style: EXTMARK_STYLES[type] || EXTMARK_STYLES.file,
  };
}

// Render a line with extmarks applied
export function renderLineWithExtmarks(
  line: string,
  extmarks: Extmark[],
): { segments: { text: string; style?: ExtmarkStyle }[] } {
  if (extmarks.length === 0) {
    return { segments: [{ text: line }] };
  }

  const sorted = [...extmarks].sort((a, b) => a.startCol - b.startCol);
  const segments: { text: string; style?: ExtmarkStyle }[] = [];
  let lastEnd = 0;

  for (const mark of sorted) {
    if (mark.startCol > lastEnd) {
      segments.push({ text: line.slice(lastEnd, mark.startCol) });
    }
    const prefix = mark.style.prefix || '';
    const suffix = mark.style.suffix || '';
    segments.push({
      text: `${prefix}${mark.label}${suffix}`,
      style: mark.style,
    });
    lastEnd = mark.endCol;
  }

  if (lastEnd < line.length) {
    segments.push({ text: line.slice(lastEnd) });
  }

  return { segments };
}

// Find trigger position in text (@ / #)
export function findTrigger(text: string, col: number): { trigger: '@' | '/' | '#' | null; startCol: number } | null {
  // Look backwards from cursor for trigger character
  for (let i = col - 1; i >= 0 && i >= col - 50; i--) {
    const ch = text[i];
    if (ch === '@' || ch === '/' || ch === '#') {
      // Check it's at start of word or after space
      if (i === 0 || text[i - 1] === ' ' || text[i - 1] === '\n') {
        return { trigger: ch as '@' | '/' | '#', startCol: i + 1 };
      }
    }
    if (ch === ' ' || ch === '\n') break;
  }
  return null;
}
