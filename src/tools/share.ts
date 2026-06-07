import { writeFileSync, existsSync, mkdirSync } from 'fs';
import { createHash } from 'crypto';
import type { Tool, ToolResult } from './types.js';
import path from 'path';

interface ShareParams {
  session_id?: string;
  title?: string;
}

interface ShareData {
  id: string;
  title: string;
  created_at: string;
  messages: Array<{
    role: string;
    content: string;
    timestamp: string;
  }>;
  metadata: {
    model?: string;
    tool_calls: number;
    duration_seconds: number;
  };
}

const SHARE_DIR = path.join(process.env.HOME || process.cwd(), '.miniagent', 'shares');

export function createShareTool(
  getMessages: () => Array<{ role: string; content: string }>,
  getSessionInfo: () => { id: string; model?: string; startTime: number },
): Tool {
  return {
    name: 'share',
    description: `Share the current conversation by creating a shareable link.
This will export the conversation to a local file that can be shared with others.
The shared content includes all messages in the conversation.

Use this when:
- You want to share a debugging session with a teammate
- You need to save a conversation for reference
- You want to create a record of the work done`,
    parameters: {
      type: 'object',
      properties: {
        session_id: {
          type: 'string',
          description: 'Optional session ID to share. If not provided, current session will be shared.',
        },
        title: {
          type: 'string',
          description: 'Optional title for the shared conversation',
        },
      },
      required: [],
    },

    async execute(params: Record<string, unknown>): Promise<ToolResult> {
      const { title } = params as ShareParams;
      const sessionInfo = getSessionInfo();

      try {
        const messages = getMessages();
        const hash = createHash('md5').update(`${sessionInfo.id}${Date.now()}`).digest('hex').slice(0, 8);

        const shareData: ShareData = {
          id: hash,
          title: title || `MiniAgent Session ${new Date().toISOString().split('T')[0]}`,
          created_at: new Date().toISOString(),
          messages: messages.map((msg) => ({
            role: msg.role,
            content: msg.content.slice(0, 2000), // Truncate long messages
            timestamp: new Date().toISOString(),
          })),
          metadata: {
            model: sessionInfo.model,
            tool_calls: messages.filter(m => m.role === 'assistant').length,
            duration_seconds: Math.floor((Date.now() - sessionInfo.startTime) / 1000),
          },
        };

        // Ensure share directory exists
        if (!existsSync(SHARE_DIR)) {
          mkdirSync(SHARE_DIR, { recursive: true });
        }

        const sharePath = path.join(SHARE_DIR, `${hash}.json`);
        writeFileSync(sharePath, JSON.stringify(shareData, null, 2), 'utf-8');

        const shareUrl = `miniagent://share/${hash}`;

        return {
          success: true,
          content: `Conversation shared successfully!\n\nShare ID: ${hash}\nShare URL: ${shareUrl}\nFile: ${sharePath}\n\nNote: This is a local share link. Share the file at ${sharePath} with others.`,
          metadata: { share_id: hash, share_path: sharePath, share_url: shareUrl },
        };
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          success: false,
          content: `Failed to share conversation: ${message}`,
          error: message,
        };
      }
    },
  };
}
