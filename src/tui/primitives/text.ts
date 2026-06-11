function isWideChar(code: number): boolean {
  return (
    (code >= 0x1100 && code <= 0x115f) ||
    (code >= 0x2e80 && code <= 0x303e) ||
    (code >= 0x3040 && code <= 0x33bf) ||
    (code >= 0x3400 && code <= 0x4dbf) ||
    (code >= 0x4e00 && code <= 0x9fff) ||
    (code >= 0xa000 && code <= 0xa4cf) ||
    (code >= 0xac00 && code <= 0xd7af) ||
    (code >= 0xf900 && code <= 0xfaff) ||
    (code >= 0xfe30 && code <= 0xfe6f) ||
    (code >= 0xff01 && code <= 0xff60) ||
    (code >= 0xffe0 && code <= 0xffe6) ||
    (code >= 0x20000 && code <= 0x2fa1f) ||
    (code >= 0x30000 && code <= 0x3134f)
  );
}

function isZeroWidthChar(code: number): boolean {
  return (
    (code >= 0x0300 && code <= 0x036f) ||
    (code >= 0x1ab0 && code <= 0x1aff) ||
    (code >= 0x1dc0 && code <= 0x1dff) ||
    (code >= 0x20d0 && code <= 0x20ff) ||
    (code >= 0xfe20 && code <= 0xfe2f) ||
    code === 0x200b ||
    code === 0x200c ||
    code === 0x200d ||
    code === 0xfeff
  );
}

function charWidth(code: number): number {
  if (isZeroWidthChar(code)) return 0;
  if (isWideChar(code)) return 2;
  return 1;
}

export function getStringWidth(str: string): number {
  let width = 0;
  for (const char of str) {
    width += charWidth(char.codePointAt(0)!);
  }
  return width;
}

export function truncateByWidth(text: string, maxWidth: number): { text: string; charCount: number } {
  let currentWidth = 0;
  let result = '';
  let charCount = 0;
  for (const char of text) {
    const w = charWidth(char.codePointAt(0)!);
    if (currentWidth + w > maxWidth) break;
    result += char;
    currentWidth += w;
    charCount++;
  }
  return { text: result, charCount };
}

export function fillByWidth(text: string, width: number): string {
  const clipped = truncateByWidth(text, width).text;
  return clipped + ' '.repeat(Math.max(0, width - getStringWidth(clipped)));
}

export function wrapByWidth(text: string, width: number): string[] {
  if (!text) return [''];
  if (width <= 0) return [''];
  const lines: string[] = [];
  for (const rawLine of text.split('\n')) {
    if (getStringWidth(rawLine) <= width) {
      lines.push(rawLine);
      continue;
    }
    let remaining = rawLine;
    while (getStringWidth(remaining) > width) {
      const chunk = truncateByWidth(remaining, width);
      if (chunk.charCount === 0) break;
      lines.push(chunk.text);
      remaining = remaining.slice(chunk.charCount);
    }
    if (remaining.length > 0) lines.push(remaining);
  }
  return lines.length > 0 ? lines : [''];
}
