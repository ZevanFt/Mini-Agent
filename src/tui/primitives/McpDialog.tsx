import { Box, Text } from 'ink';
import { TUI_THEME } from './theme.js';
import { truncateByWidth } from './text.js';

export interface McpServer {
  name: string;
  status: 'connected' | 'error' | 'disconnected';
  tools: number;
  error?: string;
}

export interface McpDialogProps {
  servers: McpServer[];
  selectedIndex: number;
  termWidth: number;
  termHeight: number;
}

export function McpDialog({ servers, selectedIndex, termWidth, termHeight }: McpDialogProps) {
  const width = Math.min(termWidth - 8, 64);
  const contentWidth = width - 4;
  const maxVisible = Math.max(4, termHeight - 8);

  const statusIcon = (s: string) => {
    if (s === 'connected') return '●';
    if (s === 'error') return '✗';
    return '○';
  };

  const statusColor = (s: string) => {
    if (s === 'connected') return TUI_THEME.success;
    if (s === 'error') return 'red';
    return TUI_THEME.muted;
  };

  return (
    <Box flexDirection="column" width={termWidth} height={termHeight} justifyContent="center" alignItems="center">
      <Box flexDirection="column" width={width} borderStyle="double" borderColor={TUI_THEME.accent} paddingX={1} paddingY={1}>
        <Box justifyContent="space-between">
          <Text color={TUI_THEME.accent} bold>MCP Servers</Text>
          <Text dimColor>{servers.filter(s => s.status === 'connected').length}/{servers.length} connected</Text>
        </Box>
        <Box marginTop={1} flexDirection="column">
          {servers.slice(0, maxVisible).map((server, i) => {
            const isSelected = i === selectedIndex;
            return (
              <Box key={server.name} justifyContent="space-between">
                <Text color={isSelected ? TUI_THEME.accent : TUI_THEME.muted} bold={isSelected}>
                  {isSelected ? '▸ ' : '  '}<Text color={statusColor(server.status)}>{statusIcon(server.status)}</Text> {truncateByWidth(server.name, contentWidth - 20).text}
                </Text>
                <Text dimColor>{server.tools} tools</Text>
              </Box>
            );
          })}
          {servers.length === 0 && <Text dimColor>No MCP servers configured</Text>}
        </Box>
        <Box marginTop={1} justifyContent="space-between">
          <Text dimColor>↑↓ move</Text>
          <Text dimColor>Space toggle</Text>
          <Text dimColor>Esc close</Text>
        </Box>
      </Box>
    </Box>
  );
}

export interface McpState {
  isOpen: boolean;
  selectedIndex: number;
  servers: McpServer[];
}

export function createMcpState(): McpState {
  return { isOpen: false, selectedIndex: 0, servers: [] };
}

export function openMcp(state: McpState, servers: McpServer[]): McpState {
  return { ...state, isOpen: true, servers, selectedIndex: 0 };
}

export function closeMcp(state: McpState): McpState {
  return { ...state, isOpen: false };
}
