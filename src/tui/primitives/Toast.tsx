import { useState, useEffect, useCallback, useMemo, createContext, useContext } from 'react';
import { Box, Text } from 'ink';
import { TUI_THEME } from './theme.js';

export type ToastVariant = 'info' | 'success' | 'warning' | 'error';

export interface ToastEntry {
  id: string;
  message: string;
  variant: ToastVariant;
  duration: number;
  createdAt: number;
}

export interface ToastState {
  toasts: ToastEntry[];
}

export function createToastState(): ToastState {
  return { toasts: [] };
}

let toastCounter = 0;
export function toastId(): string {
  return `toast-${++toastCounter}-${Date.now()}`;
}

export function addToast(state: ToastState, message: string, variant: ToastVariant = 'info', duration = 2500): ToastState {
  const entry: ToastEntry = {
    id: toastId(),
    message,
    variant,
    duration,
    createdAt: Date.now(),
  };
  return { toasts: [...state.toasts, entry] };
}

export function removeToast(state: ToastState, id: string): ToastState {
  return { toasts: state.toasts.filter(t => t.id !== id) };
}

export function pruneExpiredToasts(state: ToastState): ToastState {
  const now = Date.now();
  return { toasts: state.toasts.filter(t => now - t.createdAt < t.duration) };
}

const VARIANT_COLORS: Record<ToastVariant, string> = {
  info: TUI_THEME.accent,
  success: TUI_THEME.success,
  warning: TUI_THEME.warning,
  error: 'red',
};

const VARIANT_ICONS: Record<ToastVariant, string> = {
  info: 'ℹ',
  success: '✓',
  warning: '⚠',
  error: '✗',
};

export interface ToastContextValue {
  toasts: ToastEntry[];
  show: (message: string, variant?: ToastVariant, duration?: number) => void;
  dismiss: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<ToastState>(createToastState);

  useEffect(() => {
    const timer = setInterval(() => {
      setState(s => pruneExpiredToasts(s));
    }, 500);
    return () => clearInterval(timer);
  }, []);

  const show = useCallback((message: string, variant: ToastVariant = 'info', duration = 2500) => {
    setState(s => addToast(s, message, variant, duration));
  }, []);

  const dismiss = useCallback((id: string) => {
    setState(s => removeToast(s, id));
  }, []);

  const value = useMemo(() => ({
    toasts: state.toasts,
    show,
    dismiss,
  }), [state.toasts, show, dismiss]);

  return (
    <ToastContext.Provider value={value}>
      {children}
    </ToastContext.Provider>
  );
}

export interface ToastListProps {
  maxVisible?: number;
}

export function ToastList({ maxVisible = 3 }: ToastListProps) {
  const { toasts } = useToast();
  const visible = toasts.slice(-maxVisible);

  if (visible.length === 0) return null;

  return (
    <Box flexDirection="column">
      {visible.map((toast) => {
        const color = VARIANT_COLORS[toast.variant];
        const icon = VARIANT_ICONS[toast.variant];
        return (
          <Box key={toast.id}>
            <Text color={color} bold>{icon} </Text>
            <Text>{toast.message}</Text>
          </Box>
        );
      })}
    </Box>
  );
}

export function ToastRenderer() {
  const { toasts } = useToast();
  const visible = toasts.slice(-3);
  if (visible.length === 0) return null;

  return (
    <Box flexDirection="column">
      {visible.map((toast) => (
        <ToastItem key={toast.id} toast={toast} />
      ))}
    </Box>
  );
}

function ToastItem({ toast }: { toast: ToastEntry }) {
  const color = VARIANT_COLORS[toast.variant];
  const icon = VARIANT_ICONS[toast.variant];
  return (
    <Box>
      <Text color={color} bold>{icon} </Text>
      <Text>{toast.message}</Text>
    </Box>
  );
}
