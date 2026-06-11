import { Box, Text } from 'ink';
import { TUI_THEME } from './theme.js';

export interface AgentSwitchMarkerProps {
  agentName: string;
  width: number;
}

export function AgentSwitchMarker({ agentName, width }: AgentSwitchMarkerProps) {
  return (
    <Box width={width} justifyContent="center" marginTop={1} marginBottom={1}>
      <Text color={TUI_THEME.muted}>── </Text>
      <Text color={TUI_THEME.accent} bold>{agentName}</Text>
      <Text color={TUI_THEME.muted}> ──</Text>
    </Box>
  );
}

export interface ModelSwitchMarkerProps {
  modelName: string;
  width: number;
}

export function ModelSwitchMarker({ modelName, width }: ModelSwitchMarkerProps) {
  return (
    <Box width={width} justifyContent="center" marginTop={1} marginBottom={1}>
      <Text color={TUI_THEME.muted}>── </Text>
      <Text color={TUI_THEME.warning} bold>Model: {modelName}</Text>
      <Text color={TUI_THEME.muted}> ──</Text>
    </Box>
  );
}
