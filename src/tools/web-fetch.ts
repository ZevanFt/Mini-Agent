import type { Tool } from '../tools/types.js';

interface WebFetchParams {
  url: string;
  maxChars?: number;
}

export const WebFetchTool: Tool = {
  name: 'web_fetch',
  description: `Fetch content from a URL.
Use this when you need to retrieve web page content, API responses, or online resources.
The content will be returned as plain text.`,
  parameters: {
    type: 'object',
    properties: {
      url: {
        type: 'string',
        description: 'The URL to fetch content from',
      },
      max_chars: {
        type: 'number',
        description: 'Maximum number of characters to return (default: 5000)',
        default: 5000,
      },
    },
    required: ['url'],
  },

  async execute(params: Record<string, unknown>) {
    const { url, max_chars: maxChars = 5000 } = params as unknown as WebFetchParams & { max_chars?: number };

    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'MiniAgent/0.1.0',
        },
      });

      if (!response.ok) {
        return {
          success: false,
          content: `HTTP Error: ${response.status} ${response.statusText}`,
          error: `HTTP ${response.status}`,
        };
      }

      let content = await response.text();

      // Truncate if needed
      if (content.length > maxChars) {
        content = content.substring(0, maxChars) + '\n... (content truncated)';
      }

      return {
        success: true,
        content,
        metadata: {
          url,
          status: response.status,
          contentLength: content.length,
          truncated: content.endsWith('(content truncated)'),
        },
      };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return {
        success: false,
        content: `Fetch error: ${message}`,
        error: message,
      };
    }
  },
};
