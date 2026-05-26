export interface Message {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  tool_calls?: Array<{ name: string; args: Record<string, unknown> }>;
  tool_call_id?: string;
}

export interface ChatUsage {
  input: number;
  output: number;
  total: number;
}

export interface ChatChunk {
  type: 'content' | 'tool_call' | 'done' | 'error';
  content?: string;
  toolCall?: {
    name: string;
    arguments: Record<string, unknown>;
  };
  error?: string;
  usage?: ChatUsage;
}

export interface ChatParams {
  messages: Message[];
  tools?: Array<{
    type: 'function';
    function: {
      name: string;
      description: string;
      parameters: Record<string, unknown>;
    };
  }>;
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
}

export interface LLMAdapter {
  chat(params: ChatParams): AsyncGenerator<ChatChunk>;
  chatOnce(params: ChatParams): Promise<{ content: string; toolCalls?: any[] }>;
}
