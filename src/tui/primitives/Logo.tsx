import React from 'react';
import { Box, Text } from 'ink';

// ============================================================
// MINI-AGENT Logo Component
//
// Thick block-character style (like MiMo Code).
// Edit the LOGO_LINES below to change the logo design.
// Each string = one line of the logo. Keep all lines the same
// length for proper alignment.
//
// Gradient: orange (#ff8c00) → gray (#888888) applied per-char.
// ============================================================

// ---- EDIT THIS: 5 lines, each ~38 chars ----
const LOGO_LINES: string[] = [
  '▄▄  ▄▄  █  █ ▄▄  ▄▄      ▄▄  ▄▄  ▄▄  ▄▄  ▄▄',
  '█▀▀ █▄▄ ██ ██ █  █ █  █  █  █ █  █ █  █ █  █',
  '█▄▄ █  █ █ ██ █  █ █  ▀  █  █ █  █ █  █ █  █',
  '█   █  █ █  █ █▄▄▀ █▄▄   █▀▀█ █  █ █  █ █▀▀█',
  '▀   ▀▀▀  ▀  ▀  ▀▀   ▀  ▀  ▀  ▀ ▀▀▀  ▀  ▀ ▀  ▀',
];

// ---- Gradient helpers ----
function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return { r, g, b };
}

function lerpColor(from: string, to: string, t: number): string {
  const f = hexToRgb(from);
  const p = hexToRgb(to);
  const r = Math.round(f.r + t * (p.r - f.r));
  const g = Math.round(f.g + t * (p.g - f.g));
  const b = Math.round(f.b + t * (p.b - f.b));
  const h = (n: number) => Math.max(0, Math.min(255, n)).toString(16).padStart(2, '0');
  return `#${h(r)}${h(g)}${h(b)}`;
}

// ---- Count non-space chars for gradient ----
function countChars(line: string): number {
  let n = 0;
  for (const ch of line) if (ch !== ' ') n++;
  return n;
}

export interface LogoProps {
  /** Subtitle shown above the logo (e.g. "by Zevan") */
  subtitle?: string;
  /** Color of the subtitle */
  subtitleColor?: string;
}

/**
 * MINI-AGENT logo rendered in thick block-character style
 * with orange → gray gradient coloring.
 */
export function Logo({ subtitle, subtitleColor = '#666666' }: LogoProps) {
  // Find the max char count across all lines for gradient range
  const maxChars = Math.max(...LOGO_LINES.map(countChars));

  return (
    <Box flexDirection="column" alignItems="center" marginBottom={1}>
      {subtitle && (
        <Text color={subtitleColor}>{subtitle}</Text>
      )}
      {LOGO_LINES.map((line, lineIdx) => {
        // Build gradient per non-space character
        let charIdx = 0;
        const segments: React.ReactNode[] = [];

        for (let i = 0; i < line.length; i++) {
          const ch = line[i];
          if (ch === ' ') {
            segments.push(<Text key={`${lineIdx}-${i}`}>{' '}</Text>);
          } else {
            const t = maxChars <= 1 ? 0 : charIdx / (maxChars - 1);
            const color = lerpColor('#ff8c00', '#888888', t);
            segments.push(
              <Text key={`${lineIdx}-${i}`} color={color} bold>
                {ch}
              </Text>,
            );
            charIdx++;
          }
        }

        return <Box key={lineIdx}>{segments}</Box>;
      })}
    </Box>
  );
}
