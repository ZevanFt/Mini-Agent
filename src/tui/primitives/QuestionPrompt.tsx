import { useState } from 'react';
import { Box, Text } from 'ink';
import { TUI_THEME } from './theme.js';
import { fillByWidth, truncateByWidth } from './text.js';

export type QuestionType = 'single' | 'multi' | 'text';

export interface QuestionOption {
  label: string;
  description?: string;
  value: string;
}

export interface QuestionRequest {
  id: string;
  question: string;
  description?: string;
  type: QuestionType;
  options: QuestionOption[];
  allowCustom?: boolean;
}

export interface QuestionPromptProps {
  request: QuestionRequest;
  onAnswer: (answer: string | string[]) => void;
  onReject?: () => void;
  termWidth: number;
}

export function QuestionPrompt({ request, onAnswer: _onAnswer, onReject, termWidth }: QuestionPromptProps) {
  const [selectedIndex, _setSelectedIndex] = useState(0);
  const [selectedValues, _setSelectedValues] = useState<Set<number>>(new Set());
  const [customText, _setCustomText] = useState('');
  const [_showCustom, _setShowCustom] = useState(false);

  const contentWidth = Math.min(termWidth - 6, 72);

  return (
    <Box flexDirection="column" width={termWidth} alignItems="center" justifyContent="center">
      <Box flexDirection="column" width={Math.min(termWidth - 4, 76)} borderStyle="single" borderColor={TUI_THEME.accent} paddingX={1} paddingY={1}>
        <Text color={TUI_THEME.accent} bold>Question</Text>
        <Box marginTop={1}>
          <Text>{fillByWidth(truncateByWidth(request.question, contentWidth).text, contentWidth)}</Text>
        </Box>
        {request.description && (
          <Box marginTop={1}>
            <Text dimColor>{fillByWidth(truncateByWidth(request.description, contentWidth).text, contentWidth)}</Text>
          </Box>
        )}
        {request.type === 'text' ? (
          <Box marginTop={1}>
            <Text color={TUI_THEME.accent}>▸ </Text>
            <Text>{customText || 'Type your answer...'}</Text>
          </Box>
        ) : (
          <Box marginTop={1} flexDirection="column">
            {request.options.map((option, i) => {
              const isSelected = request.type === 'single'
                ? i === selectedIndex
                : selectedValues.has(i);
              return (
                <Text
                  key={option.value}
                  color={isSelected ? TUI_THEME.accent : TUI_THEME.muted}
                  bold={isSelected}
                >{isSelected ? (request.type === 'single' ? '▸ ' : '☑ ') : '  '}{option.label}{option.description ? ` — ${option.description}` : ''}</Text>
              );
            })}
          </Box>
        )}
        <Box marginTop={1} justifyContent="space-between">
          <Text dimColor>{request.type === 'multi' ? '↑↓ move  Space toggle' : '↑↓ move'}</Text>
          <Text dimColor>Enter confirm{onReject ? '   Esc reject' : ''}</Text>
        </Box>
      </Box>
    </Box>
  );
}

export interface QuestionState {
  pending: QuestionRequest[];
}

export function createQuestionState(): QuestionState {
  return { pending: [] };
}

export function addQuestion(state: QuestionState, request: QuestionRequest): QuestionState {
  return { ...state, pending: [...state.pending, request] };
}

export function resolveQuestion(state: QuestionState, id: string): QuestionState {
  return { ...state, pending: state.pending.filter(q => q.id !== id) };
}
