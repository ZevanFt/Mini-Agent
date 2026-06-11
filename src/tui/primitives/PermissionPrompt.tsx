import { useState } from 'react';
import { Box, Text } from 'ink';
import { TUI_THEME } from './theme.js';
import { fillByWidth, truncateByWidth } from './text.js';

export type PermissionAction = 'allow_once' | 'allow_always' | 'reject';
export type PermissionToolType = 'bash' | 'edit' | 'read' | 'glob' | 'grep' | 'write' | 'task' | 'webfetch' | 'websearch' | 'external_directory' | 'unknown';

export interface PermissionRequest {
  id: string;
  toolType: PermissionToolType;
  toolName: string;
  description: string;
  command?: string;
  filePath?: string;
  diff?: string;
  pattern?: string;
}

export interface PermissionPromptProps {
  request: PermissionRequest;
  onDecide: (action: PermissionAction, message?: string) => void;
  termWidth: number;
  termHeight?: number;
}

const TOOL_ICONS: Record<PermissionToolType, string> = {
  bash: '⚡',
  edit: '✏',
  read: '📖',
  glob: '🔍',
  grep: '🔎',
  write: '📝',
  task: '📋',
  webfetch: '🌐',
  websearch: '🔍',
  external_directory: '📁',
  unknown: '?',
};

const TOOL_COLORS: Record<PermissionToolType, string> = {
  bash: TUI_THEME.warning,
  edit: TUI_THEME.accent,
  read: TUI_THEME.muted,
  glob: TUI_THEME.muted,
  grep: TUI_THEME.muted,
  write: TUI_THEME.accent,
  task: TUI_THEME.success,
  webfetch: TUI_THEME.accent,
  websearch: TUI_THEME.accent,
  external_directory: TUI_THEME.warning,
  unknown: TUI_THEME.muted,
};

export function PermissionPrompt({ request, onDecide: _onDecide, termWidth, termHeight: _termHeight }: PermissionPromptProps) {
  const [selectedIndex, _setSelectedIndex] = useState(0);
  const [rejectMessage, _setRejectMessage] = useState('');
  const [showRejectInput, _setShowRejectInput] = useState(false);
  const [diffScrollOffset, _setDiffScrollOffset] = useState(0);
  const actions: PermissionAction[] = ['allow_once', 'allow_always', 'reject'];
  const actionLabels: Record<PermissionAction, string> = {
    allow_once: 'Allow once',
    allow_always: 'Allow always',
    reject: 'Reject',
  };
  const actionColors: Record<PermissionAction, string> = {
    allow_once: TUI_THEME.success,
    allow_always: TUI_THEME.accent,
    reject: 'red',
  };

  const contentWidth = Math.min(termWidth - 6, 72);
  const icon = TOOL_ICONS[request.toolType];
  const color = TOOL_COLORS[request.toolType];
  const maxDiffLines = 12;

  return (
    <Box flexDirection="column" width={termWidth} alignItems="center" justifyContent="center">
      <Box flexDirection="column" width={Math.min(termWidth - 4, 76)} borderStyle="double" borderColor={color} paddingX={1} paddingY={1}>
        <Box justifyContent="space-between">
          <Text color={color} bold>{icon} {request.toolName}</Text>
          <Text dimColor>{request.toolType}</Text>
        </Box>
        <Box marginTop={1}>
          <Text>{fillByWidth(truncateByWidth(request.description, contentWidth).text, contentWidth)}</Text>
        </Box>
        {request.pattern && (
          <Box marginTop={1}>
            <Text dimColor>Pattern: </Text>
            <Text color={TUI_THEME.warning}>{truncateByWidth(request.pattern, contentWidth - 10).text}</Text>
          </Box>
        )}
        {request.command && (
          <Box marginTop={1}>
            <Text dimColor>$ </Text>
            <Text color={TUI_THEME.warning}>{truncateByWidth(request.command, contentWidth - 2).text}</Text>
          </Box>
        )}
        {request.filePath && (
          <Box marginTop={1}>
            <Text dimColor>File: </Text>
            <Text>{truncateByWidth(request.filePath, contentWidth - 6).text}</Text>
          </Box>
        )}
        {request.diff && (
          <Box marginTop={1} flexDirection="column">
            <Box justifyContent="space-between">
              <Text dimColor>Diff preview:</Text>
              <Text dimColor>{request.diff.split('\n').length} lines{request.diff.split('\n').length > maxDiffLines ? ` (scroll ${diffScrollOffset + 1}-${Math.min(diffScrollOffset + maxDiffLines, request.diff.split('\n').length)}/${request.diff.split('\n').length})` : ''}</Text>
            </Box>
            {request.diff.split('\n').slice(diffScrollOffset, diffScrollOffset + maxDiffLines).map((line, i) => (
              <Text key={i} color={line.startsWith('+') ? TUI_THEME.success : line.startsWith('-') ? 'red' : line.startsWith('@') ? TUI_THEME.warning : TUI_THEME.muted}>
                {truncateByWidth(line, contentWidth).text}
              </Text>
            ))}
            {request.diff.split('\n').length > maxDiffLines && (
              <Text dimColor>  ↑↓ scroll diff</Text>
            )}
          </Box>
        )}
        {showRejectInput ? (
          <Box marginTop={1} flexDirection="column">
            <Text dimColor>Rejection message (Enter to confirm):</Text>
            <Box>
              <Text color="red">▸ </Text>
              <Text>{rejectMessage || 'Type reason...'}</Text>
            </Box>
          </Box>
        ) : (
          <>
            <Box marginTop={1} justifyContent="space-between">
              {actions.map((action, i) => (
                <Text
                  key={action}
                  color={i === selectedIndex ? actionColors[action] : TUI_THEME.muted}
                  bold={i === selectedIndex}
                  backgroundColor={i === selectedIndex ? TUI_THEME.panel : undefined}
                >{i === selectedIndex ? `▸ ${actionLabels[action]}` : `  ${actionLabels[action]}`}</Text>
              ))}
            </Box>
            <Box marginTop={1} justifyContent="space-between">
              <Text dimColor>← → select  h/l vim</Text>
              <Text dimColor>1/2/3 number</Text>
              <Text dimColor>Enter confirm</Text>
            </Box>
          </>
        )}
      </Box>
    </Box>
  );
}

export interface PermissionState {
  pending: PermissionRequest[];
  alwaysAllow: Set<string>;
  rejectMessages: Map<string, string>;
}

export function createPermissionState(): PermissionState {
  return { pending: [], alwaysAllow: new Set(), rejectMessages: new Map() };
}

export function isAlwaysAllowed(state: PermissionState, toolType: PermissionToolType, toolName: string): boolean {
  return state.alwaysAllow.has(`${toolType}:${toolName}`) || state.alwaysAllow.has(`${toolType}:*`);
}

export function addPermissionRequest(state: PermissionState, request: PermissionRequest): PermissionState {
  return { ...state, pending: [...state.pending, request] };
}

export function resolvePermission(state: PermissionState, id: string, action: PermissionAction, message?: string): PermissionState {
  const request = state.pending.find(r => r.id === id);
  const pending = state.pending.filter(r => r.id !== id);
  if (action === 'allow_always' && request) {
    return {
      pending,
      alwaysAllow: new Set([...state.alwaysAllow, `${request.toolType}:${request.toolName}`]),
      rejectMessages: state.rejectMessages,
    };
  }
  if (action === 'reject' && message) {
    const rejectMessages = new Map(state.rejectMessages);
    rejectMessages.set(id, message);
    return { pending, alwaysAllow: state.alwaysAllow, rejectMessages };
  }
  return { ...state, pending };
}
