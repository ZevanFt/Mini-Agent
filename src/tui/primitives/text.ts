export function getStringWidth(str: string): number {
  let width = 0;
  for (const char of str) {
    width += char.charCodeAt(0) > 127 ? 2 : 1;
  }
  return width;
}

export function truncateByWidth(text: string, maxWidth: number): { text: string; charCount: number } {
  let currentWidth = 0;
  let result = '';
  for (const char of text) {
    const charWidth = char.charCodeAt(0) > 127 ? 2 : 1;
    if (currentWidth + charWidth > maxWidth) break;
    result += char;
    currentWidth += charWidth;
  }
  return { text: result, charCount: result.length };
}

export function fillByWidth(text: string, width: number): string {
  const clipped = truncateByWidth(text, width).text;
  return clipped + ' '.repeat(Math.max(0, width - getStringWidth(clipped)));
}

export function wrapByWidth(text: string, width: number): string[] {
  if (!text) return [''];
  const lines: string[] = [];
  for (const rawLine of text.split('\n')) {
    let remaining = rawLine;
    while (getStringWidth(remaining) > width) {
      const chunk = truncateByWidth(remaining, width);
      lines.push(chunk.text);
      remaining = remaining.slice(chunk.charCount);
    }
    lines.push(remaining);
  }
  return lines;
}
