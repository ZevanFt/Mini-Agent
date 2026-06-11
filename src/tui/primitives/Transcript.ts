import { safeCopy } from './Clipboard.js';
import type { Message } from '../types.js';

export function formatTranscript(messages: Message[], options: {
  includeTimestamps?: boolean;
  includeToolDetails?: boolean;
  modelName?: string;
} = {}): string {
  const { includeTimestamps = false, includeToolDetails = true, modelName } = options;
  const lines: string[] = [];

  lines.push('# MiniAgent Conversation');
  lines.push('');
  if (modelName) lines.push(`Model: ${modelName}`);
  lines.push(`Exported: ${new Date().toISOString()}`);
  lines.push('');
  lines.push('---');
  lines.push('');

  for (const msg of messages) {
    const createdAt = (msg as unknown as Record<string, unknown>).createdAt;
    const timestamp = includeTimestamps && typeof createdAt === 'number' ? ` [${new Date(createdAt).toLocaleTimeString()}]` : '';
    const label = msg.role === 'user' ? 'User' : msg.type === 'error' ? 'MiniAgent Error' : 'MiniAgent';

    lines.push(`## ${label}${timestamp}`);
    lines.push('');

    if (msg.type === 'tool' && !includeToolDetails) {
      lines.push(`*Tool call: ${msg.toolName || 'unknown'}*`);
    } else {
      lines.push(msg.content);
    }

    if (msg.type === 'thought' && msg.duration) {
      lines.push('');
      lines.push(`*Thinking time: ${msg.duration}*`);
    }

    lines.push('');
  }

  return lines.join('\n');
}

export function formatTranscriptPlain(messages: Message[]): string {
  return messages.map(msg => {
    const label = msg.role === 'user' ? 'You' : 'Assistant';
    return `[${label}]\n${msg.content}`;
  }).join('\n\n');
}

export async function copyTranscript(messages: Message[], options?: {
  includeTimestamps?: boolean;
  includeToolDetails?: boolean;
  modelName?: string;
}): Promise<{ ok: boolean; error?: string }> {
  const text = formatTranscript(messages, options);
  return safeCopy(text);
}

export async function copyTranscriptPlain(messages: Message[]): Promise<{ ok: boolean; error?: string }> {
  const text = formatTranscriptPlain(messages);
  return safeCopy(text);
}

export function exportTranscriptMarkdown(filePath: string, messages: Message[], options?: {
  includeTimestamps?: boolean;
  includeToolDetails?: boolean;
  modelName?: string;
}): Promise<void> {
  const content = formatTranscript(messages, options);
  const { writeFile, mkdir } = require('fs/promises');
  const path = require('path');
  return mkdir(path.dirname(filePath), { recursive: true })
    .then(() => writeFile(filePath, content, 'utf8'));
}
