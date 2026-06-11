export interface Message {
  role: 'user' | 'assistant';
  content: string;
  type?: 'thought' | 'tool' | 'code' | 'text' | 'error';
  toolName?: string;
  duration?: string;
  createdAt?: number;
}
