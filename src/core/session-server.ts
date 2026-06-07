import { createServer, IncomingMessage, ServerResponse } from 'http';
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, unlinkSync } from 'fs';
import path from 'path';

const DEFAULT_PORT = 3456;

interface SessionData {
  id: string;
  messages: Array<{ role: string; content: string; timestamp: number }>;
  metadata: {
    model?: string;
    created_at: number;
    last_active: number;
    tool_call_count: number;
  };
}

interface ServerState {
  sessions: Map<string, SessionData>;
  port: number;
}

const SESSIONS_DIR = path.join(process.env.HOME || process.cwd(), '.miniagent', 'server-sessions');

function ensureSessionDir(): void {
  if (!existsSync(SESSIONS_DIR)) {
    mkdirSync(SESSIONS_DIR, { recursive: true });
  }
}

function saveSession(session: SessionData): void {
  ensureSessionDir();
  const filePath = path.join(SESSIONS_DIR, `${session.id}.json`);
  writeFileSync(filePath, JSON.stringify(session, null, 2), 'utf-8');
}

function loadSession(id: string): SessionData | null {
  const filePath = path.join(SESSIONS_DIR, `${id}.json`);
  if (!existsSync(filePath)) return null;
  const data = readFileSync(filePath, 'utf-8');
  return JSON.parse(data) as SessionData;
}

function listSessions(): string[] {
  ensureSessionDir();
  return readdirSync(SESSIONS_DIR)
    .filter(f => f.endsWith('.json'))
    .map(f => f.replace('.json', ''));
}

function deleteSession(id: string): boolean {
  const filePath = path.join(SESSIONS_DIR, `${id}.json`);
  if (!existsSync(filePath)) return false;
  unlinkSync(filePath);
  return true;
}

export class SessionServer {
  private state: ServerState;
  private server: ReturnType<typeof createServer> | null = null;

  constructor(port: number = DEFAULT_PORT) {
    this.state = {
      sessions: new Map(),
      port,
    };

    // Load existing sessions from disk
    ensureSessionDir();
    for (const file of readdirSync(SESSIONS_DIR)) {
      if (file.endsWith('.json')) {
        const id = file.replace('.json', '');
        const session = loadSession(id);
        if (session) {
          this.state.sessions.set(id, session);
        }
      }
    }
  }

  async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.server = createServer((req: IncomingMessage, res: ServerResponse) => {
        const url = new URL(req.url || '/', `http://localhost:${this.state.port}`);
        const method = req.method || 'GET';

        res.setHeader('Content-Type', 'application/json');

        try {
          switch (true) {
            case url.pathname === '/api/sessions' && method === 'GET':
              this.handleListSessions(res);
              break;
            case url.pathname === '/api/sessions' && method === 'POST':
              this.handleCreateSession(req, res);
              break;
            case url.pathname.match(/^\/api\/sessions\/[^/]+$/) && method === 'GET':
              this.handleGetSession(res, url.pathname.split('/').pop()!);
              break;
            case url.pathname.match(/^\/api\/sessions\/[^/]+$/) && method === 'PUT':
              this.handleUpdateSession(req, res, url.pathname.split('/').pop()!);
              break;
            case url.pathname.match(/^\/api\/sessions\/[^/]+$/) && method === 'DELETE':
              this.handleDeleteSession(res, url.pathname.split('/').pop()!);
              break;
            case url.pathname === '/api/health' && method === 'GET':
              res.writeHead(200);
              res.end(JSON.stringify({ status: 'ok', sessions: this.state.sessions.size }));
              break;
            default:
              res.writeHead(404);
              res.end(JSON.stringify({ error: 'not found' }));
          }
        } catch (error) {
          res.writeHead(500);
          res.end(JSON.stringify({ error: 'internal server error' }));
        }
      });

      this.server.listen(this.state.port, () => {
        console.log(`MiniAgent session server running on port ${this.state.port}`);
        resolve();
      });

      this.server.on('error', reject);
    });
  }

  stop(): void {
    if (this.server) {
      this.server.close();
      this.server = null;
    }
  }

  getSession(id: string): SessionData | null {
    return this.state.sessions.get(id) || loadSession(id);
  }

  createSession(id: string, model?: string): SessionData {
    const session: SessionData = {
      id,
      messages: [],
      metadata: {
        model,
        created_at: Date.now(),
        last_active: Date.now(),
        tool_call_count: 0,
      },
    };
    this.state.sessions.set(id, session);
    saveSession(session);
    return session;
  }

  updateSession(id: string, data: Partial<SessionData>): SessionData | null {
    const session = this.getSession(id);
    if (!session) return null;

    if (data.messages) session.messages = data.messages;
    if (data.metadata) session.metadata = { ...session.metadata, ...data.metadata };
    session.metadata.last_active = Date.now();

    this.state.sessions.set(id, session);
    saveSession(session);
    return session;
  }

  private handleListSessions(res: ServerResponse): void {
    const sessions = listSessions();
    res.writeHead(200);
    res.end(JSON.stringify({ sessions }));
  }

  private handleCreateSession(req: IncomingMessage, res: ServerResponse): void {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      const data = JSON.parse(body);
      const id = data.id || `session_${Date.now()}`;
      const session = this.createSession(id, data.model);
      res.writeHead(201);
      res.end(JSON.stringify(session));
    });
  }

  private handleGetSession(res: ServerResponse, id: string): void {
    const session = this.getSession(id);
    if (!session) {
      res.writeHead(404);
      res.end(JSON.stringify({ error: 'session not found' }));
      return;
    }
    res.writeHead(200);
    res.end(JSON.stringify(session));
  }

  private handleUpdateSession(req: IncomingMessage, res: ServerResponse, id: string): void {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      const data = JSON.parse(body);
      const session = this.updateSession(id, data);
      if (!session) {
        res.writeHead(404);
        res.end(JSON.stringify({ error: 'session not found' }));
        return;
      }
      res.writeHead(200);
      res.end(JSON.stringify(session));
    });
  }

  private handleDeleteSession(res: ServerResponse, id: string): void {
    this.state.sessions.delete(id);
    deleteSession(id);
    res.writeHead(200);
    res.end(JSON.stringify({ success: true }));
  }
}

export interface SessionClient {
  connect(url: string): Promise<void>;
  createSession(id: string, model?: string): Promise<SessionData>;
  getSession(id: string): Promise<SessionData | null>;
  updateSession(id: string, data: Partial<SessionData>): Promise<SessionData | null>;
  listSessions(): Promise<string[]>;
  deleteSession(id: string): Promise<boolean>;
  disconnect(): void;
}

export function createSessionClient(serverUrl: string = 'http://localhost:3456'): SessionClient {
  return {
    async connect(): Promise<void> {
      // Verify server is running
      const res = await fetch(`${serverUrl}/api/health`);
      if (!res.ok) throw new Error('Session server not available');
    },

    async createSession(id: string, model?: string): Promise<SessionData> {
      const res = await fetch(`${serverUrl}/api/sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, model }),
      });
      return (await res.json()) as SessionData;
    },

    async getSession(id: string): Promise<SessionData | null> {
      const res = await fetch(`${serverUrl}/api/sessions/${id}`);
      if (res.status === 404) return null;
      return (await res.json()) as SessionData;
    },

    async updateSession(id: string, data: Partial<SessionData>): Promise<SessionData | null> {
      const res = await fetch(`${serverUrl}/api/sessions/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (res.status === 404) return null;
      return (await res.json()) as SessionData;
    },

    async listSessions(): Promise<string[]> {
      const res = await fetch(`${serverUrl}/api/sessions`);
      const data = (await res.json()) as { sessions: string[] };
      return data.sessions;
    },

    async deleteSession(id: string): Promise<boolean> {
      const res = await fetch(`${serverUrl}/api/sessions/${id}`, {
        method: 'DELETE',
      });
      const data = (await res.json()) as { success: boolean };
      return data.success;
    },

    disconnect(): void {
      // No-op for HTTP client
    },
  };
}
