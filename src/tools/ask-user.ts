import type { Tool } from '../tools/types.js';

interface AskUserParams {
  question: string;
  options?: string[];
  timeout?: number;
}

export function createAskUserTool(onAskUser: (params: AskUserParams) => Promise<string>): Tool {
  return {
    name: 'ask_user',
    description: `Ask the user a question and wait for their response.
Use this when:
- You need clarification on ambiguous instructions
- Multiple valid approaches exist and you want user input
- Important decisions need confirmation
- You need additional context only the user has`,
    parameters: {
      type: 'object',
      properties: {
        question: {
          type: 'string',
          description: 'The question to ask the user',
        },
        options: {
          type: 'array',
          items: { type: 'string' },
          description: 'Optional predefined choices for the user',
        },
        timeout: {
          type: 'number',
          description: 'Wait timeout in seconds (default: 300)',
          default: 300,
        },
      },
      required: ['question'],
    },

    async execute(params: Record<string, unknown>) {
      const { question, options, timeout = 300 } = params as unknown as AskUserParams;

      try {
        const answer = await onAskUser({ question, options, timeout });

        return {
          success: true,
          content: `User response: ${answer}`,
          metadata: { question, answer },
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
