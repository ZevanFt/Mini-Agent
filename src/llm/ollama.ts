import type { LLMAdapter, ChatParams, Message, ChatChunk, ChatUsage } from './base.js';
import ollama from 'ollama';
import { logger } from '../utils/logger.js';

/**
 * Extract tool calls from free-form text content.
 *
 * Small models (especially ≤3B) often emit tool calls as JSON inside ```json
 * markdown blocks rather than via Ollama's native tool_calls API. This parser
 * recovers those calls so the agent loop can still execute them.
 *
 * Supported formats:
 *   ```json
 *   {"name": "<tool>", "arguments": { ... }}
 *   ```
 *
 *   ```
 *   {"name": "<tool>", "parameters": { ... }}
 *   ```
 *
 *   {"name": "<tool>", "arguments": { ... }}    (raw JSON, no fence)
 */
function extractToolCallsFromText(
  text: string,
  knownTools: any[]
): Array<{ function: { name: string; arguments: any } }> {
  const toolNames = new Set(knownTools.map((t) => t.function?.name || t.name).filter(Boolean));
  const results: Array<{ function: { name: string; arguments: any } }> = [];

  // Find JSON blocks - either fenced or bare
  const fencedJsonRe = /```(?:json)?\s*\n([\s\S]*?)```/g;
  const candidates: string[] = [];

  let m: RegExpExecArray | null;
  while ((m = fencedJsonRe.exec(text)) !== null) {
    candidates.push(m[1]);
  }

  // Also try the whole text as JSON (in case there are no fences)
  candidates.push(text);

  for (const cand of candidates) {
    const trimmed = cand.trim();
    if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) continue;

    let parsed: any;
    try {
      parsed = JSON.parse(trimmed);
    } catch {
      // Try to find a JSON object inside the string
      const objMatch = trimmed.match(/\{[\s\S]*\}/);
      if (!objMatch) continue;
      try {
        parsed = JSON.parse(objMatch[0]);
      } catch {
        continue;
      }
    }

    // Normalize - might be single call or array
    const items = Array.isArray(parsed) ? parsed : [parsed];
    for (const item of items) {
      if (!item || typeof item !== 'object') continue;
      const name = item.name || item.tool || item.function?.name;
      const args = item.arguments || item.parameters || item.args || item.function?.arguments || {};
      if (typeof name === 'string' && toolNames.has(name)) {
        results.push({
          function: {
            name,
            arguments: typeof args === 'string' ? safeJsonParse(args) : args,
          },
        });
      }
    }

    if (results.length > 0) break; // Use the first match group
  }

  return results;
}

function safeJsonParse(s: string): any {
  try {
    return JSON.parse(s);
  } catch {
    return {};
  }
}

interface OllamaOptions {
  model: string;
  baseUrl?: string;
  temperature?: number;
  maxTokens?: number;
}

export class OllamaAdapter implements LLMAdapter {
  private model: string;
  private baseUrl: string;
  private temperature: number;
  private maxTokens: number;

  constructor(options: OllamaOptions) {
    this.model = options.model;
    this.baseUrl = options.baseUrl || 'http://localhost:11434';
    this.temperature = options.temperature ?? 0.7;
    this.maxTokens = options.maxTokens ?? 4096;
  }

  async *chat(params: ChatParams): AsyncGenerator<ChatChunk> {
    const messages = this.buildMessages(params);

    const response = await ollama.chat({
      model: this.model,
      messages: messages.map(m => ({
        role: m.role,
        content: m.content,
      })),
      tools: params.tools,
      stream: true,
      options: {
        temperature: this.temperature,
        num_predict: this.maxTokens,
      },
    });

    let currentToolCalls: any[] = [];
    let buffer = '';

    for await (const chunk of response) {
      if (chunk.message?.content) {
        buffer += chunk.message.content;

        yield {
          type: 'content',
          content: chunk.message.content,
        };
      }

      if (chunk.message?.tool_calls) {
        currentToolCalls = chunk.message.tool_calls;
      }

      if (chunk.done) {
        let usage: ChatUsage | undefined;
        const inputTokens = (chunk as any).prompt_eval_count ?? 0;
        const outputTokens = (chunk as any).eval_count ?? 0;
        if (inputTokens || outputTokens) {
          usage = {
            input: inputTokens,
            output: outputTokens,
            total: inputTokens + outputTokens,
          };
          logger.info('[OllamaAdapter] Token usage:', { input: inputTokens, output: outputTokens, total: usage.total });
        }

        if (currentToolCalls.length === 0 && params.tools && params.tools.length > 0) {
          const extracted = extractToolCallsFromText(buffer, params.tools);
          if (extracted.length > 0) {
            currentToolCalls = extracted;
          }
        }

        if (currentToolCalls.length > 0) {
          for (const tc of currentToolCalls) {
            yield {
              type: 'tool_call',
              toolCall: {
                name: tc.function.name,
                arguments: tc.function.arguments || {},
              },
            };
          }
        }

        yield { type: 'done', usage };
      }
    }
  }

  async chatOnce(params: ChatParams): Promise<{ content: string; toolCalls?: any[] }> {
    const messages = this.buildMessages(params);

    const response = await ollama.chat({
      model: this.model,
      messages: messages.map(m => ({
        role: m.role,
        content: m.content,
      })),
      tools: params.tools,
      stream: false,
      options: {
        temperature: this.temperature,
        num_predict: this.maxTokens,
      },
    });

    return {
      content: response.message.content || '',
      toolCalls: response.message.tool_calls || [],
    };
  }

  private buildMessages(params: ChatParams): Message[] {
    const messages: Message[] = [];

    if (params.systemPrompt) {
      messages.push({
        role: 'system',
        content: params.systemPrompt,
      });
    }

    messages.push(...params.messages);

    return messages;
  }
}
