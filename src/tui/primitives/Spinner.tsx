import { useState, useEffect } from 'react';
import { Text } from 'ink';

const DOTS = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
const FRAMES = ['-', '\\', '|', '/'];
const DOT_INTERVAL = 80;
const FRAME_INTERVAL = 100;

export interface SpinnerProps {
  color?: string;
  frames?: 'dots' | 'line';
  label?: string;
}

export function Spinner({ color = 'cyan', frames = 'dots', label }: SpinnerProps) {
  const [index, setIndex] = useState(0);
  const frameset = frames === 'dots' ? DOTS : FRAMES;
  const interval = frames === 'dots' ? DOT_INTERVAL : FRAME_INTERVAL;

  useEffect(() => {
    const timer = setInterval(() => {
      setIndex(prev => (prev + 1) % frameset.length);
    }, interval);
    return () => clearInterval(timer);
  }, [frameset.length, interval]);

  return (
    <Text color={color}>
      {frameset[index]}{label ? ` ${label}` : ''}
    </Text>
  );
}

export function spinnerText(frame: number, kind: 'dots' | 'line' = 'dots'): string {
  const frameset = kind === 'dots' ? DOTS : FRAMES;
  return frameset[frame % frameset.length];
}
