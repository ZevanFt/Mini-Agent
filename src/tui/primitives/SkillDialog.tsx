import { Box, Text } from 'ink';
import { TUI_THEME } from './theme.js';
import { truncateByWidth } from './text.js';

export interface Skill {
  name: string;
  description: string;
  enabled: boolean;
}

export interface SkillDialogProps {
  skills: Skill[];
  selectedIndex: number;
  termWidth: number;
  termHeight: number;
}

export function SkillDialog({ skills, selectedIndex, termWidth, termHeight }: SkillDialogProps) {
  const width = Math.min(termWidth - 8, 64);
  const contentWidth = width - 6;
  const maxVisible = Math.max(4, termHeight - 8);

  return (
    <Box flexDirection="column" width={termWidth} height={termHeight} justifyContent="center" alignItems="center">
      <Box flexDirection="column" width={width} borderStyle="double" borderColor={TUI_THEME.accent} paddingX={1} paddingY={1}>
        <Box justifyContent="space-between">
          <Text color={TUI_THEME.accent} bold>Skills</Text>
          <Text dimColor>{skills.filter(s => s.enabled).length}/{skills.length} enabled</Text>
        </Box>
        <Box marginTop={1} flexDirection="column">
          {skills.slice(0, maxVisible).map((skill, i) => {
            const isSelected = i === selectedIndex;
            return (
              <Box key={skill.name} justifyContent="space-between">
                <Text color={isSelected ? TUI_THEME.accent : TUI_THEME.muted} bold={isSelected}>
                  {isSelected ? '▸ ' : '  '}<Text color={skill.enabled ? TUI_THEME.success : TUI_THEME.muted}>{skill.enabled ? '●' : '○'}</Text> {truncateByWidth(skill.name, contentWidth - 20).text}
                </Text>
                <Text dimColor>{truncateByWidth(skill.description, 20).text}</Text>
              </Box>
            );
          })}
          {skills.length === 0 && <Text dimColor>No skills installed</Text>}
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

export interface SkillState {
  isOpen: boolean;
  selectedIndex: number;
  skills: Skill[];
}

export function createSkillState(): SkillState {
  return { isOpen: false, selectedIndex: 0, skills: [] };
}

export function openSkill(state: SkillState, skills: Skill[]): SkillState {
  return { ...state, isOpen: true, skills, selectedIndex: 0 };
}

export function closeSkill(state: SkillState): SkillState {
  return { ...state, isOpen: false };
}
