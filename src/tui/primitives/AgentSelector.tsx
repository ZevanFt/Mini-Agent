import { Box, Text } from 'ink';
import { TUI_THEME } from './theme.js';
import { truncateByWidth } from './text.js';

export interface AgentInfo {
  id: string;
  name: string;
  description: string;
  icon?: string;
  builtin?: boolean;
}

export const BUILTIN_AGENTS: AgentInfo[] = [
  { id: 'coder', name: 'Coder', description: 'General coding agent with full tool access', icon: '⚡', builtin: true },
  { id: 'task', name: 'Task', description: 'Complex task execution agent', icon: '📋', builtin: true },
  { id: 'title', name: 'Title', description: 'Generates conversation titles', icon: '📝', builtin: true },
];

export interface AgentSelectorProps {
  agents: AgentInfo[];
  selectedIndex: number;
  currentAgent: string;
  termWidth: number;
  termHeight: number;
}

export function AgentSelector({ agents, selectedIndex, currentAgent, termWidth, termHeight }: AgentSelectorProps) {
  const width = Math.min(termWidth - 8, 72);
  const contentWidth = width - 6;

  return (
    <Box flexDirection="column" width={termWidth} height={termHeight} justifyContent="center" alignItems="center">
      <Box flexDirection="column" width={width} borderStyle="double" borderColor={TUI_THEME.success} paddingX={1} paddingY={1}>
        <Box justifyContent="space-between">
          <Text color={TUI_THEME.success} bold>Select Agent</Text>
          <Text dimColor>{agents.length} agents</Text>
        </Box>
        <Box marginTop={1} flexDirection="column">
          {agents.map((agent, i) => {
            const isSelected = i === selectedIndex;
            const isCurrent = agent.id === currentAgent;
            return (
              <Box key={agent.id} justifyContent="space-between">
                <Text
                  color={isSelected ? TUI_THEME.success : isCurrent ? TUI_THEME.accent : undefined}
                  bold={isSelected}
                >{isSelected ? '▸ ' : '  '}{agent.icon || '●'} {truncateByWidth(agent.name, contentWidth - 24).text}</Text>
                <Text dimColor={isCurrent}>{isCurrent ? 'active' : truncateByWidth(agent.description, 20).text}</Text>
              </Box>
            );
          })}
        </Box>
        <Box marginTop={1} justifyContent="space-between">
          <Text dimColor>↑↓ move</Text>
          <Text dimColor>Enter select</Text>
          <Text dimColor>Esc close</Text>
        </Box>
      </Box>
    </Box>
  );
}

export interface AgentSelectorState {
  isOpen: boolean;
  selectedIndex: number;
  agents: AgentInfo[];
}

export function createAgentSelectorState(): AgentSelectorState {
  return { isOpen: false, selectedIndex: 0, agents: BUILTIN_AGENTS };
}

export function openAgentSelector(state: AgentSelectorState, agents?: AgentInfo[]): AgentSelectorState {
  return { ...state, isOpen: true, agents: agents || BUILTIN_AGENTS, selectedIndex: 0 };
}

export function closeAgentSelector(state: AgentSelectorState): AgentSelectorState {
  return { ...state, isOpen: false };
}

export function agentSelectorUp(state: AgentSelectorState): AgentSelectorState {
  return { ...state, selectedIndex: Math.max(0, state.selectedIndex - 1) };
}

export function agentSelectorDown(state: AgentSelectorState): AgentSelectorState {
  return { ...state, selectedIndex: Math.min(state.agents.length - 1, state.selectedIndex + 1) };
}
