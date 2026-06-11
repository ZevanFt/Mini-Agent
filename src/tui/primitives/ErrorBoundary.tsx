import React from 'react';
import { Box, Text } from 'ink';
import { TUI_THEME } from './theme.js';

export interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

export interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    this.setState({ errorInfo });
    this.props.onError?.(error, errorInfo);
  }

  reset(): void {
    this.setState({ hasError: false, error: null, errorInfo: null });
  }

  render(): React.ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return <ErrorFallback error={this.state.error} errorInfo={this.state.errorInfo} onReset={() => this.reset()} />;
    }
    return this.props.children;
  }
}

export function ErrorFallback({ error, errorInfo, onReset: _onReset }: { error: Error | null; errorInfo: React.ErrorInfo | null; onReset: () => void }) {
  return (
    <Box flexDirection="column" padding={1}>
      <Text color="red" bold>Something went wrong</Text>
      <Box marginTop={1}>
        <Text color={TUI_THEME.error}>{error?.message || 'Unknown error'}</Text>
      </Box>
      {errorInfo && (
        <Box marginTop={1} flexDirection="column">
          <Text dimColor>Stack trace:</Text>
          <Text dimColor>{error?.stack?.split('\n').slice(0, 5).join('\n') || 'No stack trace available'}</Text>
        </Box>
      )}
      <Box marginTop={1}>
        <Text dimColor>Press Enter to reset, or Ctrl+C to exit</Text>
      </Box>
    </Box>
  );
}
