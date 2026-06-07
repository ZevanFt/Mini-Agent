import type { LLMAdapter, ChatParams, ChatChunk } from './base.js';

interface MockLLMOptions {
  delay?: number;
  responses?: string[];
}

export class MockLLMAdapter implements LLMAdapter {
  private delay: number;
  private responses: string[];
  private callCount: number = 0;

  constructor(options: MockLLMOptions = {}) {
    this.delay = options.delay ?? 500;
    this.responses = options.responses ?? [
      '你好！我是 MiniAgent，一个本地 AI 助手。',
      '这是第二个响应',
      '这是第三个响应',
    ];
  }

  async *chat(_params: ChatParams): AsyncGenerator<ChatChunk> {
    const response = this.responses[this.callCount % this.responses.length];
    this.callCount++;

    for (const char of response) {
      await new Promise(r => setTimeout(r, this.delay));
      yield {
        type: 'content',
        content: char,
      };
    }

    yield { type: 'done' };
  }

  async chatOnce(_params: ChatParams): Promise<{ content: string; toolCalls?: any[] }> {
    const response = this.responses[this.callCount % this.responses.length];
    this.callCount++;
    return {
      content: response,
    };
  }
}
