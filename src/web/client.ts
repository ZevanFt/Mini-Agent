export interface ClientOptions {
  baseUrl?: string;
  token?: string;
  password?: string;
  sseReconnectBaseDelay?: number;
  sseReconnectMaxDelay?: number;
  sseReconnectMaxAttempts?: number;
}

export interface Session {
  id: string;
  title: string;
  message_count: number;
  created_at: number;
  updated_at: number;
  metadata?: Record<string, unknown>;
}

export interface Message {
  id: string;
  session_id: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  tool_calls?: Array<{ name: string; args: Record<string, unknown>; result?: string }>;
  created_at: number;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'cancelled';
  priority: 'low' | 'medium' | 'high';
  created_at: number;
  updated_at: number;
  completed_at?: number;
  metadata?: Record<string, unknown>;
}

export interface AuthResponse {
  success: boolean;
  token: string;
}

export interface SSEEvent {
  event: string;
  data: string;
  raw: string;
}

export interface SSEHandlers {
  onChunk?: (content: string) => void;
  onToolCall?: (name: string, args: Record<string, unknown>) => void;
  onDone?: (fullContent: string, timestamp: number) => void;
  onError?: (error: string) => void;
  onConnected?: (sessionId: string, timestamp: number) => void;
  onHistory?: (messages: Message[]) => void;
  onHeartbeat?: (timestamp: number) => void;
}

interface FetchOptions {
  method?: string;
  body?: unknown;
}

export class MiniAgentClient {
  private baseUrl: string;
  private token: string | null;
  private sseReconnectBaseDelay: number;
  private sseReconnectMaxDelay: number;
  private sseReconnectMaxAttempts: number;
  private sseAbortControllers: Map<string, AbortController>;

  constructor(options: ClientOptions = {}) {
    this.baseUrl = options.baseUrl || 'http://127.0.0.1:3000';
    this.token = options.token || null;
    this.sseReconnectBaseDelay = options.sseReconnectBaseDelay || 1000;
    this.sseReconnectMaxDelay = options.sseReconnectMaxDelay || 30000;
    this.sseReconnectMaxAttempts = options.sseReconnectMaxAttempts || 10;
    this.sseAbortControllers = new Map();
  }

  setToken(token: string): void {
    this.token = token;
  }

  getToken(): string | null {
    return this.token;
  }

  async authenticate(password: string): Promise<AuthResponse> {
    const res = await this.fetch('/api/auth', {
      method: 'POST',
      body: { password },
    });
    const data = await res.json() as AuthResponse;
    if (data.success) {
      this.token = data.token;
    }
    return data;
  }

  async healthCheck(): Promise<{ status: string; timestamp: number; sessionCount: number }> {
    const res = await this.fetch('/api/health');
    return res.json() as Promise<{ status: string; timestamp: number; sessionCount: number }>;
  }

  async listSessions(): Promise<Session[]> {
    const res = await this.fetch('/api/sessions');
    const data = await res.json() as { sessions: Session[] };
    return data.sessions;
  }

  async createSession(title?: string, metadata?: Record<string, unknown>): Promise<Session> {
    const res = await this.fetch('/api/sessions', {
      method: 'POST',
      body: { title, metadata },
    });
    return res.json() as Promise<Session>;
  }

  async getSession(id: string): Promise<Session> {
    const res = await this.fetch(`/api/sessions/${id}`);
    if (!res.ok) {
      const error = await res.json() as { error: string };
      throw new Error(error.error);
    }
    return res.json() as Promise<Session>;
  }

  async deleteSession(id: string): Promise<boolean> {
    const res = await this.fetch(`/api/sessions/${id}`, { method: 'DELETE' });
    const data = await res.json() as { success: boolean };
    return data.success;
  }

  async getMessages(sessionId: string): Promise<Message[]> {
    const res = await this.fetch(`/api/sessions/${sessionId}/messages`);
    const data = await res.json() as { messages: Message[] };
    return data.messages;
  }

  async sendChat(sessionId: string, message: string, handlers?: SSEHandlers): Promise<string> {
    const url = `${this.baseUrl}/api/sessions/${sessionId}/chat`;
    let fullContent = '';

    return new Promise<string>((resolve, reject) => {
      const controller = new AbortController();
      this.sseAbortControllers.set(sessionId, controller);

      fetch(url, {
        method: 'POST',
        headers: this.buildHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ message }),
        signal: controller.signal,
      }).then(async (response) => {
        if (!response.ok) {
          const error = await response.json() as { error: string };
          reject(new Error(error.error));
          return;
        }

        if (!response.body) {
          reject(new Error('No response body'));
          return;
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            let currentEvent = 'message';
            for (const line of lines) {
              if (line.startsWith('event: ')) {
                currentEvent = line.slice(7).trim();
              } else if (line.startsWith('data: ')) {
                const dataStr = line.slice(6).trim();
                this.handleSSEEvent(currentEvent, dataStr, handlers, (content) => {
                  fullContent = content;
                });
              }
            }
          }

          // Process remaining buffer
          if (buffer) {
            let currentEvent = 'message';
            for (const line of buffer.split('\n')) {
              if (line.startsWith('event: ')) {
                currentEvent = line.slice(7).trim();
              } else if (line.startsWith('data: ')) {
                const dataStr = line.slice(6).trim();
                this.handleSSEEvent(currentEvent, dataStr, handlers, (content) => {
                  fullContent = content;
                });
              }
            }
          }

          resolve(fullContent);
        } catch (err) {
          reject(err);
        } finally {
          this.sseAbortControllers.delete(sessionId);
        }
      }).catch((err) => {
        if (err.name === 'AbortError') {
          reject(new Error('Chat request aborted'));
        } else {
          reject(err);
        }
      });
    });
  }

  abortChat(sessionId: string): void {
    const controller = this.sseAbortControllers.get(sessionId);
    if (controller) {
      controller.abort();
      this.sseAbortControllers.delete(sessionId);
    }
  }

  connectStream(sessionId: string, handlers: SSEHandlers): { disconnect: () => void } {
    const url = `${this.baseUrl}/api/sessions/${sessionId}/stream`;
    let reconnectAttempt = 0;
    let isManuallyDisconnected = false;

    const connect = () => {
      const controller = new AbortController();
      this.sseAbortControllers.set(sessionId, controller);

      fetch(url, {
        headers: this.buildHeaders(),
        signal: controller.signal,
      }).then(async (response) => {
        if (!response.ok) {
          const error = await response.json() as { error: string };
          handlers.onError?.(error.error);
          return;
        }

        if (!response.body) {
          handlers.onError?.('No response body');
          return;
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        reconnectAttempt = 0;

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            let currentEvent = 'message';
            for (const line of lines) {
              if (line.startsWith('event: ')) {
                currentEvent = line.slice(7).trim();
              } else if (line.startsWith('data: ')) {
                const dataStr = line.slice(6).trim();
                this.handleSSEEvent(currentEvent, dataStr, handlers, () => {});
              }
            }
          }
        } catch {
          // Stream closed, try reconnect
        } finally {
          this.sseAbortControllers.delete(sessionId);
        }

        if (!isManuallyDisconnected && reconnectAttempt < this.sseReconnectMaxAttempts) {
          const delay = Math.min(
            this.sseReconnectBaseDelay * Math.pow(2, reconnectAttempt),
            this.sseReconnectMaxDelay
          );
          reconnectAttempt++;
          console.log(`[SSE] Reconnecting in ${delay}ms (attempt ${reconnectAttempt})`);
          setTimeout(connect, delay);
        }
      }).catch((err) => {
        if (err.name === 'AbortError') return;

        if (!isManuallyDisconnected && reconnectAttempt < this.sseReconnectMaxAttempts) {
          const delay = Math.min(
            this.sseReconnectBaseDelay * Math.pow(2, reconnectAttempt),
            this.sseReconnectMaxDelay
          );
          reconnectAttempt++;
          console.log(`[SSE] Reconnecting in ${delay}ms (attempt ${reconnectAttempt})`);
          setTimeout(connect, delay);
        }
      });
    };

    connect();

    return {
      disconnect: () => {
        isManuallyDisconnected = true;
        const controller = this.sseAbortControllers.get(sessionId);
        if (controller) {
          controller.abort();
          this.sseAbortControllers.delete(sessionId);
        }
      },
    };
  }

  async listTasks(status?: Task['status']): Promise<Task[]> {
    const params = status ? `?status=${status}` : '';
    const res = await this.fetch(`/api/tasks${params}`);
    const data = await res.json() as { tasks: Task[] };
    return data.tasks;
  }

  async createTask(task: {
    title: string;
    description?: string;
    status?: Task['status'];
    priority?: Task['priority'];
    metadata?: Record<string, unknown>;
  }): Promise<Task> {
    const res = await this.fetch('/api/tasks', {
      method: 'POST',
      body: task,
    });
    return res.json() as Promise<Task>;
  }

  async updateTask(id: string, updates: {
    status?: Task['status'];
    priority?: Task['priority'];
    description?: string;
    metadata?: Record<string, unknown>;
  }): Promise<Task> {
    const res = await this.fetch(`/api/tasks/${id}`, {
      method: 'PATCH',
      body: updates,
    });
    if (!res.ok) {
      const error = await res.json() as { error: string };
      throw new Error(error.error);
    }
    return res.json() as Promise<Task>;
  }

  async deleteTask(id: string): Promise<boolean> {
    const res = await this.fetch(`/api/tasks/${id}`, { method: 'DELETE' });
    const data = await res.json() as { success: boolean };
    return data.success;
  }

  async searchMemories(query: string, limit: number = 10): Promise<any[]> {
    const res = await this.fetch(`/api/memory/search?q=${encodeURIComponent(query)}&limit=${limit}`);
    const data = await res.json() as { memories: any[] };
    return data.memories;
  }

  async getUsageStats(days: number = 7): Promise<any[]> {
    const res = await this.fetch(`/api/usage/stats?days=${days}`);
    const data = await res.json() as { stats: any[] };
    return data.stats;
  }

  private async fetch(path: string, options: FetchOptions = {}): Promise<Response> {
    const { method = 'GET', body } = options;

    const init: RequestInit = {
      method,
      headers: this.buildHeaders(body ? { 'Content-Type': 'application/json' } : {}),
    };

    if (body) {
      init.body = JSON.stringify(body);
    }

    const response = await fetch(`${this.baseUrl}${path}`, init);
    return response;
  }

  private buildHeaders(extra?: Record<string, string>): Record<string, string> {
    const headers: Record<string, string> = { ...extra };
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }
    return headers;
  }

  private handleSSEEvent(
    event: string,
    dataStr: string,
    handlers: SSEHandlers | undefined,
    setFullContent: (content: string) => void
  ): void {
    try {
      const data = JSON.parse(dataStr);

      switch (event) {
        case 'chunk':
          if (data.content) {
            handlers?.onChunk?.(data.content);
          }
          break;
        case 'tool_call':
          handlers?.onToolCall?.(data.name, data.arguments);
          break;
        case 'done':
          setFullContent(data.content || '');
          handlers?.onDone?.(data.content || '', data.timestamp);
          break;
        case 'error':
          handlers?.onError?.(data.error);
          break;
        case 'connected':
          handlers?.onConnected?.(data.sessionId, data.timestamp);
          break;
        case 'history':
          handlers?.onHistory?.(data.messages || []);
          break;
        case 'heartbeat':
          handlers?.onHeartbeat?.(data.timestamp);
          break;
      }
    } catch {
      // Non-JSON data, skip parsing
    }
  }
}
