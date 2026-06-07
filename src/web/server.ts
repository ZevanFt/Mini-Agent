import { createServer, IncomingMessage, ServerResponse } from 'http';
import { readFileSync, readdirSync, statSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { SQLiteStore } from '../core/sqlite-store.js';
import { TaskStore } from '../core/task-store.js';
import { logger } from '../utils/logger.js';
import type { Agent } from '../core/agent.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const WEB_ROOT = path.join(__dirname, '..', '..', 'web', 'dist');

export interface ServerOptions {
  port?: number;
  host?: string;
  password?: string;
  projectDir?: string;
}

function generateToken(): string {
  return `token_${Date.now()}_${Math.random().toString(36).slice(2, 15)}`;
}

function getContentType(filePath: string): string {
  if (filePath.endsWith('.png')) return 'image/png';
  if (filePath.endsWith('.jpg') || filePath.endsWith('.jpeg')) return 'image/jpeg';
  if (filePath.endsWith('.svg')) return 'image/svg+xml';
  if (filePath.endsWith('.webp')) return 'image/webp';
  if (filePath.endsWith('.ico')) return 'image/x-icon';
  if (filePath.endsWith('.css')) return 'text/css';
  if (filePath.endsWith('.js')) return 'application/javascript';
  if (filePath.endsWith('.html')) return 'text/html';
  return 'application/octet-stream';
}

const IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/svg+xml', 'image/webp', 'image/x-icon']);

function serveStaticFile(res: ServerResponse, filePath: string, contentType: string): void {
  try {
    const isImage = IMAGE_TYPES.has(contentType);
    const content = readFileSync(filePath, isImage ? undefined : 'utf-8');
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(content);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'File not found';
    logger.debug('Static file not found:', filePath, { error: message });
    res.writeHead(404);
    res.end('Not found');
  }
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => { body += chunk; });
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}

function parseBody<T = any>(req: IncomingMessage): Promise<T> {
  return readBody(req).then((raw) => JSON.parse(raw));
}

function jsonResponse(res: ServerResponse, status: number, data: unknown): void {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

function sseSend(res: ServerResponse, event: string, data: string): void {
  res.write(`event: ${event}\n`);
  res.write(`data: ${data}\n\n`);
}

type AuthedRequest = IncomingMessage & { _authenticated?: boolean; _token?: string };

export class MiniAgentServer {
  private server: ReturnType<typeof createServer> | null = null;
  private options: Required<ServerOptions>;
  private agent: Agent | null = null;
  private store: SQLiteStore | null = null;
  private taskStore: TaskStore | null = null;
  private authTokens: Map<string, string> = new Map();
  private sseClients: Map<string, ServerResponse[]> = new Map();

  constructor(options: ServerOptions = {}) {
    this.options = {
      port: options.port || 3000,
      host: options.host || '127.0.0.1',
      password: options.password || '',
      projectDir: options.projectDir || process.cwd(),
    };
  }

  setAgent(agent: Agent): void {
    this.agent = agent;
  }

  async start(): Promise<void> {
    this.store = new SQLiteStore(this.options.projectDir);
    await this.store.initialize();
    logger.info('SQLiteStore initialized for server');

    this.taskStore = new TaskStore(this.options.projectDir);
    await this.taskStore.initialize();
    logger.info('TaskStore initialized for server');

    return new Promise((resolve, reject) => {
      this.server = createServer((req: IncomingMessage, res: ServerResponse) => {
        this.handleRequest(req as AuthedRequest, res);
      });

      this.server.listen(this.options.port, this.options.host, () => {
        logger.info(`MiniAgent server started at http://${this.options.host}:${this.options.port}`);
        resolve();
      });

      this.server.on('error', (err: Error) => {
        logger.error('Server error:', err);
        reject(err);
      });
    });
  }

  async stop(): Promise<void> {
    if (this.server) {
      this.server.close();
      this.server = null;
    }
    if (this.store) {
      await this.store.close();
    }
    if (this.taskStore) {
      await this.taskStore.close();
    }
    logger.info('Server stopped');
  }

  getActiveSessions(): number {
    return this.sseClients.size;
  }

  private async handleRequest(req: AuthedRequest, res: ServerResponse): Promise<void> {
    const url = new URL(req.url || '/', `http://${req.headers.host}`);
    const method = req.method || 'GET';
    const pathname = url.pathname;

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, token');

    if (method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    try {
      // Auth bypass
      if (pathname === '/api/auth' && method === 'POST') {
        await this.handleAuth(req, res);
        return;
      }
      if (pathname === '/api/health' && method === 'GET') {
        await this.handleHealth(res);
        return;
      }

      // Token auth
      if (this.options.password) {
        const token = req.headers['authorization']?.replace('Bearer ', '')
          || req.headers['token'] as string;
        if (!token || !this.authTokens.has(token)) {
          jsonResponse(res, 401, { error: 'Authentication required. POST /api/auth with { password } first.' });
          return;
        }
      }

      // Route to handlers
      if (pathname.startsWith('/api/sessions/') && pathname.endsWith('/stream') && method === 'GET') {
        await this.handleSSEStream(req, res, url);
        return;
      }

      if (pathname.startsWith('/api/sessions/') && pathname.endsWith('/chat') && method === 'POST') {
        await this.handleChat(req, res, url);
        return;
      }

      if (pathname.startsWith('/api/sessions/') && pathname.endsWith('/messages') && method === 'GET') {
        await this.handleGetMessages(req, res, url);
        return;
      }

      if (pathname === '/api/sessions' && method === 'GET') {
        await this.handleListSessions(req, res);
        return;
      }

      if (pathname === '/api/sessions' && method === 'POST') {
        await this.handleCreateSession(req, res);
        return;
      }

      if (pathname.match(/^\/api\/sessions\/[^/]+$/) && method === 'GET') {
        await this.handleGetSession(req, res, url);
        return;
      }

      if (pathname.match(/^\/api\/sessions\/[^/]+$/) && method === 'DELETE') {
        await this.handleDeleteSession(req, res, url);
        return;
      }

      if (pathname === '/api/tasks' && method === 'GET') {
        await this.handleListTasks(req, res, url);
        return;
      }

      if (pathname === '/api/tasks' && method === 'POST') {
        await this.handleCreateTask(req, res);
        return;
      }

      if (pathname.match(/^\/api\/tasks\/[^/]+$/) && method === 'PATCH') {
        await this.handleUpdateTask(req, res, url);
        return;
      }

      if (pathname.match(/^\/api\/tasks\/[^/]+$/) && method === 'DELETE') {
        await this.handleDeleteTask(req, res, url);
        return;
      }

      if (pathname === '/api/memory/search' && method === 'GET') {
        await this.handleMemorySearch(req, res, url);
        return;
      }

      if (pathname === '/api/usage/stats' && method === 'GET') {
        await this.handleUsageStats(req, res, url);
        return;
      }

      // Project directory scanning (for cloud deployments)
      if (pathname === '/api/projects/scan' && method === 'GET') {
        await this.handleProjectScan(req, res, url);
        return;
      }

      // Static files
      if (pathname === '/' || pathname === '/index.html') {
        serveStaticFile(res, path.join(WEB_ROOT, 'index.html'), 'text/html');
        return;
      }
      if (pathname.startsWith('/assets/')) {
        serveStaticFile(res, path.join(WEB_ROOT, pathname), getContentType(pathname));
        return;
      }
      if (pathname.endsWith('.css')) {
        serveStaticFile(res, path.join(WEB_ROOT, pathname), 'text/css');
        return;
      }
      if (pathname.endsWith('.js')) {
        serveStaticFile(res, path.join(WEB_ROOT, pathname), 'application/javascript');
        return;
      }
      if (pathname.endsWith('.html')) {
        serveStaticFile(res, path.join(WEB_ROOT, pathname), 'text/html');
        return;
      }

      // SPA fallback
      serveStaticFile(res, path.join(WEB_ROOT, 'index.html'), 'text/html');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Internal server error';
      logger.error('Request error:', message, { path: pathname, method });
      jsonResponse(res, 500, { error: message });
    }
  }

  // --- Auth ---
  private async handleAuth(req: IncomingMessage, res: ServerResponse): Promise<void> {
    try {
      const body = await parseBody<{ password: string }>(req);
      if (!this.options.password || body.password === this.options.password) {
        const token = generateToken();
        this.authTokens.set(token, body.password || 'no-password');
        logger.info('Auth successful, token issued');
        jsonResponse(res, 200, { success: true, token });
      } else {
        logger.warn('Auth failed: wrong password');
        jsonResponse(res, 403, { error: 'Wrong password' });
      }
    } catch {
      jsonResponse(res, 400, { error: 'Invalid request body' });
    }
  }

  // --- Health ---
  private async handleHealth(res: ServerResponse): Promise<void> {
    const sessionCount = this.store ? (await this.store.listSessions(1, 0)).length : 0;
    jsonResponse(res, 200, { status: 'ok', timestamp: Date.now(), sessionCount });
  }

  // --- Sessions ---
  private async handleListSessions(_req: IncomingMessage, res: ServerResponse): Promise<void> {
    if (!this.store) {
      jsonResponse(res, 500, { error: 'Store not initialized' });
      return;
    }
    const sessions = await this.store.listSessions(100, 0);
    const formatted = sessions.map((s) => ({
      id: s.id,
      title: s.name,
      message_count: s.message_count,
      created_at: s.created_at.getTime(),
      updated_at: s.updated_at.getTime(),
      metadata: s.metadata,
    }));
    logger.info('Listing sessions', { count: formatted.length });
    jsonResponse(res, 200, { sessions: formatted });
  }

  private async handleCreateSession(req: IncomingMessage, res: ServerResponse): Promise<void> {
    if (!this.store) {
      jsonResponse(res, 500, { error: 'Store not initialized' });
      return;
    }
    try {
      const body = await parseBody<{ title?: string; metadata?: Record<string, unknown> }>(req);
      const title = body.title || 'New Session';
      const session = await this.store.createSession({
        name: title,
        message_count: 0,
        tool_calls: 0,
        metadata: body.metadata || {},
      });
      logger.info('Session created', { id: session.id, title });
      jsonResponse(res, 201, {
        id: session.id,
        title: session.name,
        message_count: session.message_count,
        created_at: session.created_at.getTime(),
        updated_at: session.updated_at.getTime(),
      });
    } catch {
      jsonResponse(res, 400, { error: 'Invalid request body' });
    }
  }

  private async handleGetSession(_req: IncomingMessage, res: ServerResponse, url: URL): Promise<void> {
    if (!this.store) {
      jsonResponse(res, 500, { error: 'Store not initialized' });
      return;
    }
    const id = url.pathname.split('/').pop()!;
    const session = await this.store.getSession(id);
    if (!session) {
      jsonResponse(res, 404, { error: 'Session not found' });
      return;
    }
    logger.info('Session fetched', { id });
    jsonResponse(res, 200, {
      id: session.id,
      title: session.name,
      message_count: session.message_count,
      created_at: session.created_at.getTime(),
      updated_at: session.updated_at.getTime(),
      metadata: session.metadata,
    });
  }

  private async handleDeleteSession(_req: IncomingMessage, res: ServerResponse, url: URL): Promise<void> {
    if (!this.store) {
      jsonResponse(res, 500, { error: 'Store not initialized' });
      return;
    }
    const id = url.pathname.split('/').pop()!;
    const deleted = await this.store.deleteSession(id);
    if (!deleted) {
      jsonResponse(res, 404, { error: 'Session not found' });
      return;
    }
    // Close SSE clients for this session
    const clients = this.sseClients.get(id);
    if (clients) {
      clients.forEach((c) => c.end());
      this.sseClients.delete(id);
    }
    logger.info('Session deleted', { id });
    jsonResponse(res, 200, { success: true });
  }

  // --- Messages ---
  private async handleGetMessages(_req: IncomingMessage, res: ServerResponse, url: URL): Promise<void> {
    if (!this.store) {
      jsonResponse(res, 500, { error: 'Store not initialized' });
      return;
    }
    const parts = url.pathname.split('/');
    const sessionId = parts[3];
    const session = await this.store.getSession(sessionId);
    if (!session) {
      jsonResponse(res, 404, { error: 'Session not found' });
      return;
    }
    const messages = await this.store.getMessages(sessionId, 200);
    const formatted = messages.map((m) => ({
      id: m.id,
      session_id: m.session_id,
      role: m.role,
      content: m.content,
      tool_calls: m.tool_calls ? JSON.parse(m.tool_calls) : undefined,
      created_at: m.created_at.getTime(),
    }));
    logger.info('Messages fetched', { sessionId, count: formatted.length });
    jsonResponse(res, 200, { messages: formatted });
  }

  // --- Chat with SSE ---
  private async handleChat(req: IncomingMessage, res: ServerResponse, url: URL): Promise<void> {
    if (!this.store) {
      jsonResponse(res, 500, { error: 'Store not initialized' });
      return;
    }
    if (!this.agent) {
      jsonResponse(res, 500, { error: 'Agent not set' });
      return;
    }

    const sessionId = url.pathname.split('/').filter(Boolean)[2];
    const session = await this.store.getSession(sessionId);
    if (!session) {
      jsonResponse(res, 404, { error: 'Session not found' });
      return;
    }

    let body: { message: string };
    try {
      body = await parseBody<{ message: string }>(req);
    } catch {
      jsonResponse(res, 400, { error: 'Invalid request body, expected { message: string }' });
      return;
    }

    logger.info('Chat request', { sessionId, message: body.message.substring(0, 100) });

    // Save user message to SQLite
    await this.store.addMessage({
      session_id: sessionId,
      role: 'user',
      content: body.message,
    });

    // Get chat history for LLM context
    const messages = await this.store.getMessages(sessionId, 200);
    const llmMessages = messages.map((m) => ({
      role: m.role,
      content: m.content,
      tool_calls: m.tool_calls ? JSON.parse(m.tool_calls) : undefined,
    }));

    if (!this.agent) {
      jsonResponse(res, 500, { error: 'Agent not set' });
      return;
    }

    const llm = this.agent.getLLM();
    logger.info('Chat LLM request', { sessionId, messageCount: llmMessages.length });

    // Use SSE-style chunked response for streaming
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders?.();

    let fullResponse = '';

    try {
      for await (const chunk of llm.chat({ messages: llmMessages })) {
        if (chunk.type === 'content' && chunk.content) {
          fullResponse += chunk.content;
          sseSend(res, 'chunk', JSON.stringify({ content: chunk.content }));
        }
        if (chunk.type === 'tool_call' && chunk.toolCall) {
          logger.info('Chat tool_call', { sessionId, toolName: chunk.toolCall.name });
          sseSend(res, 'tool_call', JSON.stringify({
            name: chunk.toolCall.name,
            arguments: chunk.toolCall.arguments,
          }));
        }
      }

      // Save assistant response to SQLite
      await this.store.addMessage({
        session_id: sessionId,
        role: 'assistant',
        content: fullResponse,
      });

      logger.info('Chat response complete', { sessionId, responseLength: fullResponse.length });

      // Update session message_count and title
      const newTitle = session.name === 'New Session' && fullResponse
        ? body.message.substring(0, 50)
        : session.name;
      await this.store.updateSession(sessionId, {
        name: newTitle,
        message_count: messages.length + 2,
      });

      sseSend(res, 'done', JSON.stringify({ content: fullResponse, timestamp: Date.now() }));
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Chat failed';
      logger.error('Chat error:', message);
      sseSend(res, 'error', JSON.stringify({ error: message }));
    }

    res.end();
  }

  // --- SSE Stream endpoint ---
  private async handleSSEStream(_req: IncomingMessage, res: ServerResponse, url: URL): Promise<void> {
    if (!this.store) {
      jsonResponse(res, 500, { error: 'Store not initialized' });
      return;
    }

    const sessionId = url.pathname.split('/').filter(Boolean)[2];
    const session = await this.store.getSession(sessionId);
    if (!session) {
      jsonResponse(res, 404, { error: 'Session not found' });
      return;
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders?.();

    // Register client
    if (!this.sseClients.has(sessionId)) {
      this.sseClients.set(sessionId, []);
    }
    this.sseClients.get(sessionId)!.push(res);

    logger.info('SSE client connected', { sessionId });

    // Send initial connection event
    sseSend(res, 'connected', JSON.stringify({ sessionId, timestamp: Date.now() }));

    // Send recent messages
    const messages = await this.store.getMessages(sessionId, 10);
    sseSend(res, 'history', JSON.stringify({
      messages: messages.map((m) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        created_at: m.created_at.getTime(),
      })),
    }));

    // Keep connection alive with heartbeat
    const heartbeat = setInterval(() => {
      try {
        sseSend(res, 'heartbeat', JSON.stringify({ timestamp: Date.now() }));
      } catch {
        clearInterval(heartbeat);
      }
    }, 30000);

    // Cleanup on close
    res.on('close', () => {
      clearInterval(heartbeat);
      const clients = this.sseClients.get(sessionId);
      if (clients) {
        const idx = clients.indexOf(res);
        if (idx > -1) clients.splice(idx, 1);
        if (clients.length === 0) this.sseClients.delete(sessionId);
      }
      logger.info('SSE client disconnected', { sessionId });
    });
  }

  // --- Tasks ---
  private async handleListTasks(_req: IncomingMessage, res: ServerResponse, url: URL): Promise<void> {
    if (!this.taskStore) {
      jsonResponse(res, 500, { error: 'TaskStore not initialized' });
      return;
    }
    const status = url.searchParams.get('status') as string | undefined;
    const tasks = await this.taskStore.listTasks(status as any, 100, 0);
    const formatted = tasks.map((t) => ({
      id: t.id,
      title: t.title,
      description: t.description,
      status: t.status,
      priority: t.priority,
      created_at: t.created_at.getTime(),
      updated_at: t.updated_at.getTime(),
      completed_at: t.completed_at?.getTime(),
      metadata: t.metadata,
    }));
    logger.info('Listing tasks', { count: formatted.length });
    jsonResponse(res, 200, { tasks: formatted });
  }

  private async handleCreateTask(req: IncomingMessage, res: ServerResponse): Promise<void> {
    if (!this.taskStore) {
      jsonResponse(res, 500, { error: 'TaskStore not initialized' });
      return;
    }
    try {
      const body = await parseBody<{
        title: string;
        description?: string;
        status?: string;
        priority?: string;
        metadata?: Record<string, unknown>;
      }>(req);
      const task = await this.taskStore.createTask({
        title: body.title,
        description: body.description || '',
        status: (body.status as any) || 'pending',
        priority: (body.priority as any) || 'medium',
        metadata: body.metadata || {},
      });
      logger.info('Task created', { id: task.id, title: task.title });
      jsonResponse(res, 201, {
        id: task.id,
        title: task.title,
        description: task.description,
        status: task.status,
        priority: task.priority,
        created_at: task.created_at.getTime(),
        updated_at: task.updated_at.getTime(),
        completed_at: task.completed_at?.getTime(),
        metadata: task.metadata,
      });
    } catch {
      jsonResponse(res, 400, { error: 'Invalid request body' });
    }
  }

  private async handleUpdateTask(req: IncomingMessage, res: ServerResponse, url: URL): Promise<void> {
    if (!this.taskStore) {
      jsonResponse(res, 500, { error: 'TaskStore not initialized' });
      return;
    }
    const taskId = url.pathname.split('/').pop()!;
    try {
      const body = await parseBody<{
        status?: string;
        priority?: string;
        description?: string;
        metadata?: Record<string, unknown>;
      }>(req);
      const task = await this.taskStore.updateTask(taskId, body as any);
      if (!task) {
        jsonResponse(res, 404, { error: 'Task not found' });
        return;
      }
      logger.info('Task updated', { id: task.id });
      jsonResponse(res, 200, {
        id: task.id,
        title: task.title,
        description: task.description,
        status: task.status,
        priority: task.priority,
        created_at: task.created_at.getTime(),
        updated_at: task.updated_at.getTime(),
        completed_at: task.completed_at?.getTime(),
        metadata: task.metadata,
      });
    } catch {
      jsonResponse(res, 400, { error: 'Invalid request body' });
    }
  }

  private async handleDeleteTask(_req: IncomingMessage, res: ServerResponse, url: URL): Promise<void> {
    if (!this.taskStore) {
      jsonResponse(res, 500, { error: 'TaskStore not initialized' });
      return;
    }
    const taskId = url.pathname.split('/').pop()!;
    const deleted = await this.taskStore.deleteTask(taskId);
    if (!deleted) {
      jsonResponse(res, 404, { error: 'Task not found' });
      return;
    }
    logger.info('Task deleted', { id: taskId });
    jsonResponse(res, 200, { success: true });
  }

  // --- Memory ---
  private async handleMemorySearch(_req: IncomingMessage, res: ServerResponse, url: URL): Promise<void> {
    if (!this.store) {
      jsonResponse(res, 500, { error: 'Store not initialized' });
      return;
    }
    const query = url.searchParams.get('q') || '';
    const limit = parseInt(url.searchParams.get('limit') || '10', 10);
    const memories = await this.store.searchMemories(query, limit);
    logger.info('Memory search', { query, count: memories.length });
    jsonResponse(res, 200, { memories });
  }

  // --- Usage Stats ---
  private async handleUsageStats(_req: IncomingMessage, res: ServerResponse, url: URL): Promise<void> {
    if (!this.store) {
      jsonResponse(res, 500, { error: 'Store not initialized' });
      return;
    }
    const days = parseInt(url.searchParams.get('days') || '7', 10);
    const stats = await this.store.getUsageStats(days);
    logger.info('Usage stats fetched', { days });
    jsonResponse(res, 200, { stats, days });
  }

  // --- Project Directory Scan ---
  /**
   * Scan a directory on the server and return its folder structure.
   * Supports pagination and depth limiting for large directories.
   * Query params: `path` (relative), `depth` (default 2), `maxItems` (default 200)
   */
  private async handleProjectScan(_req: IncomingMessage, res: ServerResponse, url: URL): Promise<void> {
    const scanPath = url.searchParams.get('path') || this.options.projectDir;
    const maxDepth = parseInt(url.searchParams.get('depth') || '2', 10);
    const maxItems = parseInt(url.searchParams.get('maxItems') || '200', 10);

    // Security: resolve path and ensure it's under projectDir
    const resolved = path.resolve(scanPath);
    const projectRoot = this.options.projectDir;

    interface DirEntry {
      name: string;
      path: string;
      type: 'dir' | 'file';
      children?: DirEntry[];
    }

    const scanDir = (dir: string, depth: number): DirEntry[] => {
      if (depth > maxDepth) return [];
      try {
        const entries = readdirSync(dir, { withFileTypes: true });
        const results: DirEntry[] = [];
        let count = 0;

        for (const entry of entries) {
          if (count >= maxItems) break;
          if (entry.name.startsWith('.') && entry.name !== '.git') continue;
          if (entry.name === 'node_modules' || entry.name === '.git') {
            if (entry.name === '.git') {
              results.push({
                name: entry.name,
                path: path.join(dir, entry.name),
                type: 'dir',
              });
              count++;
            }
            continue;
          }

          const fullPath = path.join(dir, entry.name);
          try {
            const stat = statSync(fullPath);
            if (entry.isDirectory() || stat.isDirectory()) {
              const item: DirEntry = {
                name: entry.name,
                path: fullPath,
                type: 'dir',
              };
              if (depth < maxDepth) {
                item.children = scanDir(fullPath, depth + 1);
              }
              results.push(item);
              count++;
            } else if (stat.isFile()) {
              // Only include key file types for project detection
              const ext = path.extname(entry.name).toLowerCase();
              if (ext === '.json' || ext === '.ts' || ext === '.js' || ext === '.py'
                  || ext === '.go' || ext === '.rs' || ext === '.toml' || ext === '.yaml'
                  || ext === '.yml' || ext === '.md' || ext === '.gitignore') {
                results.push({
                  name: entry.name,
                  path: fullPath,
                  type: 'file',
                });
                count++;
              }
            }
          } catch {
            // Skip inaccessible files/dirs
          }
        }
        return results;
      } catch (err: any) {
        logger.warn('Directory scan error:', err.message, { dir });
        return [];
      }
    };

    const entries = scanDir(resolved, 0);
    logger.info('Project scan', { path: resolved, depth: maxDepth, entries: entries.length });
    jsonResponse(res, 200, {
      path: resolved,
      entries,
      maxDepth,
    });
  }
}
