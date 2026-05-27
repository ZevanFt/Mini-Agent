export interface Session {
  id: string;
  title: string;
  message_count: number;
  created_at: number;
  updated_at: number;
  metadata?: Record<string, unknown>;
}

export interface ChatMessage {
  id?: string;
  session_id?: string;
  role: 'user' | 'assistant' | 'system' | 'tool' | 'thought';
  content: string;
  tool_calls?: unknown[];
  tokens?: { input: number; output: number };
  timestamp?: number;
}

export interface SessionUsage {
  input: number;
  output: number;
  total: number;
}

export interface AppSettings {
  language: 'en' | 'zh';
  fontSize: number;
  model: string;
  temperature: number;
  maxTokens: number;
  tools: { bash: string; fileWrite: string };
}

export interface ChatChunk {
  type: 'content' | 'tool_call' | 'done' | 'error';
  content?: string;
  toolCall?: { name: string; arguments?: unknown };
  error?: string;
}

export const DEFAULT_SETTINGS: AppSettings = {
  language: 'en',
  fontSize: 14,
  model: 'qwen2.5-coder:3b',
  temperature: 0.7,
  maxTokens: 4096,
  tools: { bash: 'allow', fileWrite: 'allow' },
};

export const MODEL_OPTIONS = [
  { value: 'qwen2.5-coder:3b', label: 'Qwen2.5 Coder 3B' },
  { value: 'qwen2.5:7b', label: 'Qwen 2.5 7B' },
  { value: 'qwen2.5:14b', label: 'Qwen 2.5 14B' },
  { value: 'llama3.2:3b', label: 'Llama 3.2 3B' },
  { value: 'llama3.1:8b', label: 'Llama 3.1 8B' },
  { value: 'deepseek-coder:6.7b', label: 'DeepSeek Coder 6.7B' },
  { value: 'mistral:7b', label: 'Mistral 7B' },
  { value: 'codellama:7b', label: 'CodeLlama 7B' },
  { value: 'phi3:3.8b', label: 'Phi-3 3.8B' },
];
