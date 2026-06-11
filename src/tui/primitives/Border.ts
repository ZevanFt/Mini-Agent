import { getStringWidth, fillByWidth } from './text.js';

export interface BorderChars {
  topLeft: string;
  topRight: string;
  bottomLeft: string;
  bottomRight: string;
  horizontal: string;
  vertical: string;
}

export const BORDER_SINGLE: BorderChars = {
  topLeft: '┌',
  topRight: '┐',
  bottomLeft: '└',
  bottomRight: '┘',
  horizontal: '─',
  vertical: '│',
};

export const BORDER_DOUBLE: BorderChars = {
  topLeft: '╔',
  topRight: '╗',
  bottomLeft: '╚',
  bottomRight: '╝',
  horizontal: '═',
  vertical: '║',
};

export const BORDER_ROUND: BorderChars = {
  topLeft: '╭',
  topRight: '╮',
  bottomLeft: '╰',
  bottomRight: '╯',
  horizontal: '─',
  vertical: '│',
};

export const BORDER_BOLD: BorderChars = {
  topLeft: '┏',
  topRight: '┓',
  bottomLeft: '┗',
  bottomRight: '┛',
  horizontal: '━',
  vertical: '┃',
};

export const BORDER_NONE: BorderChars = {
  topLeft: '',
  topRight: '',
  bottomLeft: '',
  bottomRight: '',
  horizontal: '',
  vertical: '',
};

export function borderTop(width: number, chars: BorderChars = BORDER_SINGLE): string {
  if (chars.topLeft === '' && chars.topRight === '' && chars.horizontal === '') return '';
  const inner = Math.max(0, width - 2);
  return `${chars.topLeft}${chars.horizontal.repeat(inner)}${chars.topRight}`;
}

export function borderBottom(width: number, chars: BorderChars = BORDER_SINGLE): string {
  if (chars.bottomLeft === '' && chars.bottomRight === '' && chars.horizontal === '') return '';
  const inner = Math.max(0, width - 2);
  return `${chars.bottomLeft}${chars.horizontal.repeat(inner)}${chars.bottomRight}`;
}

export function borderRow(content: string, width: number, chars: BorderChars = BORDER_SINGLE): string {
  const inner = Math.max(0, width - 2);
  const padded = fillByWidth(content, inner);
  return `${chars.vertical}${padded}${chars.vertical}`;
}

export function borderTopWithLabel(
  width: number,
  label: string,
  chars: BorderChars = BORDER_SINGLE,
): string {
  const inner = Math.max(0, width - 2);
  const labelWidth = getStringWidth(label);
  if (labelWidth + 2 > inner) {
    return borderTop(width, chars);
  }
  const leftPad = 1;
  const rightPad = inner - leftPad - labelWidth;
  return `${chars.topLeft}${chars.horizontal.repeat(leftPad)}${label}${chars.horizontal.repeat(rightPad)}${chars.topRight}`;
}

export function splitVertical(): string {
  return '│';
}
