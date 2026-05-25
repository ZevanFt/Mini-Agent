/**
 * MemoryTool - 记忆管理工具
 * 
 * 允许 Agent 主动存储和检索长期记忆
 */

import type { Tool, ToolResult } from '../tools/types.js';
import { LongTermMemory, type MemoryCategory } from '../memory/long-term.js';

export function createMemoryTool(memory: LongTermMemory): Tool {
  return {
    name: 'memory',
    description: `Store or retrieve information from long-term memory.

Use this when:
- You learned something important that should be remembered
- You need to recall a previous decision or context
- You want to store user preferences
- You need to search for past information

Actions:
- store: Save a memory entry
- get: Retrieve a specific memory by key
- search: Search memories by keyword
- list: List all memories
- forget: Delete a memory`,

    parameters: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: ['store', 'get', 'search', 'list', 'forget'],
          description: 'Action to perform',
        },
        key: {
          type: 'string',
          description: 'Memory key (for get/forget actions)',
        },
        value: {
          type: 'string',
          description: 'Memory content (for store action)',
        },
        category: {
          type: 'string',
          enum: ['project', 'preference', 'context', 'code_pattern', 'decision', 'error', 'fact', 'custom'],
          description: 'Memory category (for store action)',
        },
        query: {
          type: 'string',
          description: 'Search query (for search action)',
        },
        importance: {
          type: 'number',
          description: 'Importance rating 1-5 (for store action, default: 3)',
        },
      },
      required: ['action'],
    },

    async execute(params: Record<string, unknown>): Promise<ToolResult> {
      const { action, key, value, category, query, importance } = params as {
        action: 'store' | 'get' | 'search' | 'list' | 'forget';
        key?: string;
        value?: string;
        category?: MemoryCategory;
        query?: string;
        importance?: number;
      };

      try {
        switch (action) {
          case 'store': {
            if (!key || !value) {
              return { success: false, content: 'Missing key or value for store action.' };
            }
            const entry = memory.store(key, value, category || 'custom', importance || 3);
            return { success: true, content: `Stored memory: ${key} (${entry.category}, importance: ${entry.importance})` };
          }

          case 'get': {
            if (!key) {
              return { success: false, content: 'Missing key for get action.' };
            }
            const entry = memory.get(key);
            if (!entry) {
              return { success: false, content: `Memory not found: ${key}` };
            }
            return { success: true, content: `${key}: ${entry.value}` };
          }

          case 'search': {
            if (!query) {
              return { success: false, content: 'Missing query for search action.' };
            }
            const results = memory.search(query);
            if (results.length === 0) {
              return { success: true, content: `No memories found for: "${query}"` };
            }
            const lines = results.map(r => `[${r.category}] ${r.key}: ${r.value.substring(0, 100)}`);
            return { success: true, content: `Found ${results.length} memories:\n${lines.join('\n')}` };
          }

          case 'list': {
            const entries = memory.list(category);
            if (entries.length === 0) {
              return { success: true, content: 'No memories stored.' };
            }
            const lines = entries.map(e => `[${e.category}] ${e.key} (importance: ${e.importance})`);
            return { success: true, content: `Memories (${entries.length}):\n${lines.join('\n')}` };
          }

          case 'forget': {
            if (!key) {
              return { success: false, content: 'Missing key for forget action.' };
            }
            const removed = memory.forget(key);
            return { success: removed, content: removed ? `Forgot memory: ${key}` : `Memory not found: ${key}` };
          }

          default:
            return { success: false, content: `Unknown action: ${action}` };
        }
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        return { success: false, content: `Memory error: ${message}`, error: message };
      }
    },
  };
}
