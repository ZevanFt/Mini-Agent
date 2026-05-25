/**
 * MCP SSE Transport - MCP SSE 服务器端实现
 *
 * 实现 MCP 协议的 SSE 传输层：
 * - /sse 端点：建立 SSE 长连接，服务端向客户端推送消息
 * - /message 端点：客户端通过 POST 发送 JSON-RPC 消息
 * - 支持多并发 SSE 连接
 * - Session 管理
 *
 * 架构：
 * Client                              Server
 *   │                                   │
 *   │──── GET /sse ────────────────────▶│  建立 SSE 连接
 *   │◀─── SSE stream (event: message) ─│  服务端推送
 *   │                                   │
 *   │──── POST /message ───────────────▶│  客户端发送请求
 *   │◀─── 202 Accepted ────────────────│  立即响应
 *   │◀─── SSE event: message ──────────│  异步返回结果
 */

import http, { type IncomingMessage, type ServerResponse } from 'http';
import { randomUUID } from 'crypto';
import { logger } from '../utils/logger.js';

/**
 * SSE 会话
 */
interface SseSession {
  sessionId: string;
  response: ServerResponse;
  connectedAt: Date;
}

/**
 * JSON-RPC 通知消息
 */
interface JsonRpcNotification {
  jsonrpc: '2.0';
  method: string;
  params?: Record<string, unknown>;
}

/**
 * JSON-RPC 响应
 */
interface JsonRpcResponse {
  jsonrpc: '2.0';
  id?: number | string;
  result?: unknown;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}

/**
 * MCP SSE 服务器配置
 */
export interface McpSseServerConfig {
  /** 监听端口，默认 8080 */
  port?: number;
  /** 监听主机，默认 127.0.0.1 */
  host?: string;
}

/**
 * MCP SSE 服务器
 *
 * 管理 HTTP 服务器、SSE 连接、消息路由
 */
export class McpSseServer {
  private server: http.Server | null = null;
  private sessions: Map<string, SseSession> = new Map();
  private port: number;
  private host: string;
  private messageHandler: ((
    message: unknown,
    sessionId: string,
    sendResponse: (response: JsonRpcResponse) => void,
  ) => void) | null = null;

  constructor(config: McpSseServerConfig = {}) {
    this.port = config.port ?? 8080;
    this.host = config.host ?? '127.0.0.1';
  }

  /**
   * 设置消息处理器
   *
   * @param handler 接收客户端消息的回调函数
   *   - message: 客户端发送的 JSON-RPC 消息
   *   - sessionId: 发送消息的会话 ID
   *   - sendResponse: 向客户端发送响应的函数
   */
  setMessageHandler(
    handler: (
      message: unknown,
      sessionId: string,
      sendResponse: (response: JsonRpcResponse) => void,
    ) => void,
  ): void {
    this.messageHandler = handler;
  }

  /**
   * 启动 SSE 服务器
   */
  async start(): Promise<void> {
    logger.info(`[MCP SSE Server] Starting on ${this.host}:${this.port}`);

    this.server = http.createServer((req, res) => {
      this.handleRequest(req, res);
    });

    return new Promise<void>((resolve, reject) => {
      this.server!.on('error', (err) => {
        logger.error('[MCP SSE Server] Server error:', err);
        reject(err);
      });

      this.server!.listen(this.port, this.host, () => {
        logger.info(`[MCP SSE Server] Listening on http://${this.host}:${this.port}`);
        resolve();
      });
    });
  }

  /**
   * 停止 SSE 服务器
   */
  async stop(): Promise<void> {
    logger.info('[MCP SSE Server] Stopping...');

    // 关闭所有 SSE 连接
    for (const [sessionId, session] of this.sessions) {
      logger.info(`[MCP SSE Server] Closing session: ${sessionId}`);
      session.response.end();
    }
    this.sessions.clear();

    return new Promise<void>((resolve) => {
      if (this.server) {
        this.server.close(() => {
          logger.info('[MCP SSE Server] Stopped');
          this.server = null;
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  /**
   * 向指定会话发送消息
   */
  sendToSession(sessionId: string, message: JsonRpcResponse | JsonRpcNotification): void {
    const session = this.sessions.get(sessionId);
    if (!session) {
      logger.warn(`[MCP SSE Server] Session ${sessionId} not found, cannot send message`);
      return;
    }

    const data = JSON.stringify(message);
    logger.debug(`[MCP SSE Server] Sending to session ${sessionId}:`, data);

    const retry = session.response.req?.socket?.remoteAddress ? 0 : 1000;
    const sseData = `event: message\ndata: ${data}\nretry: ${retry}\n\n`;

    try {
      session.response.write(sseData);
    } catch (error) {
      logger.error(`[MCP SSE Server] Failed to send to session ${sessionId}:`, error);
      this.removeSession(sessionId);
    }
  }

  /**
   * 向所有会话广播消息
   */
  broadcast(message: JsonRpcResponse | JsonRpcNotification): void {
    for (const sessionId of this.sessions.keys()) {
      this.sendToSession(sessionId, message);
    }
  }

  /**
   * 获取活跃会话数
   */
  getActiveSessionCount(): number {
    return this.sessions.size;
  }

  /**
   * 获取端口
   */
  getPort(): number {
    return this.port;
  }

  /**
   * 处理 HTTP 请求
   */
  private handleRequest(req: IncomingMessage, res: ServerResponse): void {
    const url = new URL(req.url || '/', `http://${req.headers.host}`);
    const pathname = url.pathname;

    logger.debug(`[MCP SSE Server] ${req.method} ${pathname}`);

    // CORS 预检
    if (req.method === 'OPTIONS') {
      this.setCorsHeaders(res);
      res.writeHead(204);
      res.end();
      return;
    }

    this.setCorsHeaders(res);

    if (req.method === 'GET' && pathname === '/sse') {
      this.handleSseConnection(req, res);
    } else if (req.method === 'POST' && pathname === '/message') {
      this.handleMessage(req, res);
    } else if (req.method === 'GET' && pathname === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        status: 'ok',
        sessions: this.sessions.size,
        port: this.port,
      }));
    } else {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Not found' }));
    }
  }

  /**
   * 设置 CORS 头
   */
  private setCorsHeaders(res: ServerResponse): void {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept');
    res.setHeader('Access-Control-Max-Age', '86400');
  }

  /**
   * 处理 SSE 连接建立
   */
  private handleSseConnection(req: IncomingMessage, res: ServerResponse): void {
    const sessionId = randomUUID();

    logger.info(`[MCP SSE Server] New SSE connection: ${sessionId} from ${req.socket.remoteAddress}`);

    // 设置 SSE 响应头
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    });

    // 发送初始 session 信息
    const initMessage = JSON.stringify({
      jsonrpc: '2.0',
      method: 'session/init',
      params: { sessionId },
    });
    res.write(`event: message\ndata: ${initMessage}\n\n`);

    const session: SseSession = {
      sessionId,
      response: res,
      connectedAt: new Date(),
    };
    this.sessions.set(sessionId, session);

    // 发送心跳
    const heartbeatInterval = setInterval(() => {
      try {
        res.write(': heartbeat\n\n');
      } catch {
        clearInterval(heartbeatInterval);
        this.removeSession(sessionId);
      }
    }, 30000);

    // 连接断开
    req.on('close', () => {
      clearInterval(heartbeatInterval);
      logger.info(`[MCP SSE Server] SSE connection closed: ${sessionId}`);
      this.removeSession(sessionId);
    });

    req.on('error', (error) => {
      clearInterval(heartbeatInterval);
      logger.error(`[MCP SSE Server] SSE connection error: ${sessionId}`, error);
      this.removeSession(sessionId);
    });
  }

  /**
   * 处理客户端消息（POST /message）
   */
  private async handleMessage(req: IncomingMessage, res: ServerResponse): Promise<void> {
    let body = '';

    req.on('data', (chunk: Buffer) => {
      body += chunk.toString();
    });

    req.on('end', () => {
      logger.debug(`[MCP SSE Server] Received message body:`, body);

      let message: unknown;
      try {
        message = JSON.parse(body);
      } catch (error) {
        logger.error('[MCP SSE Server] Failed to parse message:', error);
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          error: 'Invalid JSON',
          details: error instanceof Error ? error.message : String(error),
        }));
        return;
      }

      // 获取 session ID（从 header 或消息 params 中）
      const sessionId = req.headers['x-session-id'] as string ||
        (message as any)?.params?.sessionId;

      if (!sessionId || !this.sessions.has(sessionId)) {
        logger.warn(`[MCP SSE Server] Invalid or missing session: ${sessionId}`);
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          error: 'Invalid session',
          sessionId,
        }));
        return;
      }

      logger.info(`[MCP SSE Server] Message from session ${sessionId}:`,
        (message as any)?.method || '(response)');

      // 调用消息处理器
      if (this.messageHandler) {
        try {
          this.messageHandler(message, sessionId, (response: JsonRpcResponse) => {
            this.sendToSession(sessionId, response);
          });

          // 立即返回 202 Accepted
          res.writeHead(202, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            status: 'accepted',
            sessionId,
          }));
        } catch (error) {
          logger.error(`[MCP SSE Server] Handler error for session ${sessionId}:`, error);
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            error: 'Internal server error',
            details: error instanceof Error ? error.message : String(error),
          }));
        }
      } else {
        logger.warn('[MCP SSE Server] No message handler set');
        res.writeHead(503, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          error: 'No message handler configured',
        }));
      }
    });

    req.on('error', (error) => {
      logger.error('[MCP SSE Server] Request error:', error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        error: 'Request error',
        details: error instanceof Error ? error.message : String(error),
      }));
    });
  }

  /**
   * 移除会话
   */
  private removeSession(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      try {
        session.response.end();
      } catch {
        // 连接可能已经关闭
      }
      this.sessions.delete(sessionId);
      logger.info(`[MCP SSE Server] Session removed: ${sessionId} (active: ${this.sessions.size})`);
    }
  }
}

/**
 * 创建并启动 MCP SSE 服务器
 *
 * @param config 服务器配置
 * @returns MCP SSE 服务器实例
 */
export async function createMcpSseServer(
  config: McpSseServerConfig = {},
): Promise<McpSseServer> {
  const server = new McpSseServer(config);
  await server.start();
  return server;
}
