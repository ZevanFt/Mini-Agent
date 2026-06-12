import { useState, useEffect } from 'react';
import { Text, Box } from 'ink';
import { TUI_THEME } from './theme.js';

export interface ScannerProps {
  width?: number;
  color?: string;
  trailColor?: string;
  bgColor?: string;
  interval?: number;
}

/**
 * Knight Rider style scanner animation - a bright dot moves back and forth
 * with a fading trail, indicating processing/thinking state
 */
export function Scanner({
  width = 12,
  color = TUI_THEME.accent,
  trailColor = TUI_THEME.muted,
  bgColor,
  interval = 80,
}: ScannerProps) {
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setFrame(prev => prev + 1);
    }, interval);
    return () => clearInterval(timer);
  }, [interval]);

  // Calculate scanner position (bidirectional: forward then backward)
  const totalFrames = width * 2 - 2;
  const cycleFrame = frame % totalFrames;
  const position = cycleFrame < width ? cycleFrame : totalFrames - cycleFrame;

  // Build the scanner line with trail effect
  const chars: string[] = [];
  const colors: string[] = [];

  for (let i = 0; i < width; i++) {
    const distance = Math.abs(i - position);
    if (distance === 0) {
      // Brightest - the scanner head
      chars.push('●');
      colors.push(color);
    } else if (distance <= 2) {
      // Trail - fading dots
      chars.push(distance === 1 ? '○' : '·');
      colors.push(trailColor);
    } else {
      // Empty space
      chars.push('·');
      colors.push(TUI_THEME.muted);
    }
  }

  return (
    <Box flexDirection="row">
      {chars.map((char, i) => (
        <Text key={i} color={colors[i]} backgroundColor={bgColor}>
          {char}
        </Text>
      ))}
    </Box>
  );
}

/**
 * Simple inline scanner text for use within a Text component
 */
export function scannerText(frame: number, width: number = 12): string {
  const totalFrames = width * 2 - 2;
  const cycleFrame = frame % totalFrames;
  const position = cycleFrame < width ? cycleFrame : totalFrames - cycleFrame;

  const chars: string[] = [];
  for (let i = 0; i < width; i++) {
    const distance = Math.abs(i - position);
    if (distance === 0) {
      chars.push('●');
    } else if (distance === 1) {
      chars.push('○');
    } else if (distance === 2) {
      chars.push('·');
    } else {
      chars.push('·');
    }
  }
  return chars.join('');
}
