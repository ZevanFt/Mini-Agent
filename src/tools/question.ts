import type { Tool, ToolResult } from './types.js';

export interface QuestionOption {
  label: string;
  description?: string;
}

export interface QuestionParams {
  question: string;
  header?: string;
  options?: QuestionOption[];
  multi_select?: boolean;
}

export type QuestionCallback = (params: QuestionParams) => Promise<string | string[]>;

export function createQuestionTool(onQuestion: QuestionCallback): Tool {
  return {
    name: 'question',
    description: `Ask the user a question during execution.
Use this when you need to:
- Gather user preferences or requirements
- Clarify ambiguous instructions
- Get decisions on implementation choices as you work
- Offer choices to the user about what direction to take

Each question can have a header (short label), options (multiple choices),
and an optional multi-select mode.

Examples:
- Single choice: { "question": "Which library?", "options": [{"label": "lodash"}, {"label": "ramda"}] }
- Multi choice: { "question": "Which features?", "multi_select": true, "options": [{"label": "auth"}, {"label": "logging"}, {"label": "cache"}] }
- Open text: { "question": "Describe your needs" }`,
    parameters: {
      type: 'object',
      properties: {
        question: {
          type: 'string',
          description: 'The complete question to ask the user. Should be clear, specific, and end with a question mark.',
        },
        header: {
          type: 'string',
          description: 'Very short label displayed as a chip/tag (max 12 chars). Examples: "Auth method", "Library", "Approach".',
        },
        options: {
          type: 'array',
          description: 'The available choices for this question. Must have 2-4 options. Each option should be a distinct, mutually exclusive choice (unless multiSelect is enabled). There should be no "Other" option, that will be provided automatically.',
          items: {
            type: 'object',
            properties: {
              label: {
                type: 'string',
                description: 'The display text for this option that the user will see and select.',
              },
              description: {
                type: 'string',
                description: 'Explanation of what this option means or what will happen if chosen.',
              },
            },
            required: ['label'],
          },
        },
        multi_select: {
          type: 'boolean',
          description: 'Set to true to allow the user to select multiple options instead of just one. Use when choices are not mutually exclusive.',
          default: false,
        },
      },
      required: ['question'],
    },

    async execute(params: Record<string, unknown>): Promise<ToolResult> {
      const { question, header, options, multi_select = false } = params as unknown as QuestionParams;

      try {
        const answer = await onQuestion({ question, header, options, multi_select });

        const answerText = Array.isArray(answer)
          ? answer.join(', ')
          : answer;

        return {
          success: true,
          content: `User answer: ${answerText}`,
          metadata: { question, answer: answerText },
        };
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        return {
          success: false,
          content: `Failed to get user response: ${message}`,
          error: message,
        };
      }
    },
  };
}
