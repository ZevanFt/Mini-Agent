import type { Tool, ToolCall, ToolResult } from './types.js';

interface ExecuteOptions {
  askOnFailure?: boolean;
  maxRetries?: number;
}

export class ToolExecutor {

  async execute(tool: Tool, params: Record<string, unknown>, options: ExecuteOptions = {}): Promise<ToolResult> {
    const maxRetries = options.maxRetries ?? 1;
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const result = await tool.execute(params);
        return result;
      } catch (error) {
        lastError = error as Error;
        if (attempt < maxRetries) {
          await new Promise(r => setTimeout(r, 1000 * attempt));
        }
      }
    }

    return {
      success: false,
      error: `Tool ${tool.name} failed after ${maxRetries} attempts: ${lastError?.message}`,
    };
  }

  async executeBatch(
    toolCalls: ToolCall[],
    tools: Map<string, Tool>,
  ): Promise<(ToolResult & { toolName: string })[]> {
    const results: (ToolResult & { toolName: string })[] = [];

    for (const call of toolCalls) {
      const tool = tools.get(call.name);
      if (!tool) {
        results.push({
          toolName: call.name,
          success: false,
          error: `Unknown tool: ${call.name}`,
        });
        continue;
      }

      const result = await this.execute(tool, call.arguments);
      results.push({ toolName: call.name, ...result });
    }

    return results;
  }
}
