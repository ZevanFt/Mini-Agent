import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';
import { Box, Text } from 'ink';
import { TUI_THEME } from './theme.js';
import { fillByWidth } from './text.js';

export interface DialogEntry {
  id: string;
  kind: 'confirm' | 'select' | 'prompt' | 'alert' | 'custom';
  title: string;
  meta?: string;
  width?: number;
}

export interface DialogStackState {
  stack: DialogEntry[];
  size: number;
}

export function createDialogStackState(): DialogStackState {
  return { stack: [], size: 0 };
}

export function pushDialog(state: DialogStackState, entry: DialogEntry): DialogStackState {
  if (state.stack.some(d => d.id === entry.id)) return state;
  return { stack: [...state.stack, entry], size: state.stack.length + 1 };
}

export function popDialog(state: DialogStackState): DialogStackState {
  if (state.stack.length === 0) return state;
  return { stack: state.stack.slice(0, -1), size: state.stack.length - 1 };
}

export function replaceDialog(state: DialogStackState, entry: DialogEntry): DialogStackState {
  if (state.stack.length === 0) return pushDialog(state, entry);
  return {
    stack: [...state.stack.slice(0, -1), entry],
    size: state.stack.length,
  };
}

export function clearDialogs(_state: DialogStackState): DialogStackState {
  return { stack: [], size: 0 };
}

export function topDialog(state: DialogStackState): DialogEntry | undefined {
  return state.stack[state.stack.length - 1];
}

export interface DialogStackContextValue {
  state: DialogStackState;
  push: (entry: DialogEntry) => void;
  pop: () => void;
  replace: (entry: DialogEntry) => void;
  clear: () => void;
  top: DialogEntry | undefined;
}

const DialogStackContext = createContext<DialogStackContextValue | null>(null);

export function useDialogStack(): DialogStackContextValue {
  const ctx = useContext(DialogStackContext);
  if (!ctx) throw new Error('useDialogStack must be used within DialogStackProvider');
  return ctx;
}

export function DialogStackProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<DialogStackState>(createDialogStackState);
  const push = useCallback((entry: DialogEntry) => setState(s => pushDialog(s, entry)), []);
  const pop = useCallback(() => setState(s => popDialog(s)), []);
  const replace = useCallback((entry: DialogEntry) => setState(s => replaceDialog(s, entry)), []);
  const clear = useCallback(() => setState(s => clearDialogs(s)), []);
  const value = useMemo(() => ({
    state,
    push,
    pop,
    replace,
    clear,
    top: topDialog(state),
  }), [state, push, pop, replace, clear]);

  return (
    <DialogStackContext.Provider value={value}>
      {children}
    </DialogStackContext.Provider>
  );
}

export interface DialogOverlayProps {
  termWidth: number;
  termHeight: number;
  opacity?: number;
}

export function DialogOverlay({ termWidth, termHeight }: DialogOverlayProps) {
  const rows = Math.max(0, termHeight - 2);
  const cols = Math.max(0, termWidth);
  return (
    <Box flexDirection="column" width={termWidth} height={termHeight}>
      {Array.from({ length: rows }).map((_, i) => (
        <Text key={`overlay-${i}`} backgroundColor={TUI_THEME.panel}>
          {fillByWidth('', cols)}
        </Text>
      ))}
    </Box>
  );
}

export function DialogConfirm({
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  termWidth,
  termHeight,
  width = 54,
}: {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm?: () => void;
  onCancel?: () => void;
  termWidth: number;
  termHeight: number;
  width?: number;
}) {
  const contentWidth = Math.max(20, width - 6);
  return (
    <Box flexDirection="column" width={termWidth} height={termHeight} alignItems="center" justifyContent="center">
      <Box flexDirection="column" width={width} borderStyle="single" borderColor={TUI_THEME.warning} paddingX={1} paddingY={1}>
        <Text color={TUI_THEME.warning} bold>{title}</Text>
        {message && <Text>{fillByWidth(message, contentWidth)}</Text>}
        <Box marginTop={1} justifyContent="space-between">
          <Text dimColor>{confirmLabel}</Text>
          <Text dimColor>{cancelLabel}</Text>
        </Box>
      </Box>
    </Box>
  );
}
