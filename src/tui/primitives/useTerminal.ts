import { useState, useEffect } from 'react';

export interface TerminalDimensions {
  width: number;
  height: number;
}

export function useTerminalDimensions(defaultWidth = 120, defaultHeight = 30): TerminalDimensions {
  const [dims, setDims] = useState<TerminalDimensions>({
    width: process.stdout.columns || defaultWidth,
    height: process.stdout.rows || defaultHeight,
  });

  useEffect(() => {
    const update = () => {
      if (process.stdout.columns) {
        setDims(prev => prev.width !== process.stdout.columns ? { ...prev, width: process.stdout.columns! } : prev);
      }
      if (process.stdout.rows) {
        setDims(prev => prev.height !== process.stdout.rows ? { ...prev, height: process.stdout.rows! } : prev);
      }
    };
    update();
    process.stdout.on('resize', update);
    return () => { process.stdout.off('resize', update); };
  }, []);

  return dims;
}

export interface UseAlternateScreenOptions {
  enabled?: boolean;
}

export function useAlternateScreen(options: UseAlternateScreenOptions = {}) {
  const { enabled = true } = options;

  useEffect(() => {
    if (!enabled) return;
    process.stdout.write('\x1b[?1049h');
    return () => {
      process.stdout.write('\x1b[?1049l');
    };
  }, [enabled]);
}

export function useCursorVisibility(visible: boolean) {
  useEffect(() => {
    if (visible) {
      process.stdout.write('\x1b[?25h');
    } else {
      process.stdout.write('\x1b[?25l');
    }
    return () => {
      process.stdout.write('\x1b[?25h');
    };
  }, [visible]);
}

export function useTerminalTitle(title: string) {
  useEffect(() => {
    process.stdout.write(`\x1b]0;${title}\x07`);
  }, [title]);
}

export function useTerminalSize() {
  return {
    columns: process.stdout.columns || 120,
    rows: process.stdout.rows || 30,
  };
}
