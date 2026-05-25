/**
 * MCP SSE Client - MCP SSE 客户端实现
 *
 * 实现 MCP 协议的 SSE 传输层客户端：
 * - 通过 SSE (EventSource) 接收服务端推送的消息
 * - 通过 POST 发送 JSON-RPC 消息
 * - 自动重连（指数退避）
 * - 支持 Node.js 和浏览器环境
 *
 * 连接流程：
 * 1. 建立 SSE 连接到 /sse
 * 2. 接收 session/init 消息获取 sessionId
 * 3. 通过 POST /message 发送请求（携带 X-Session-ID）
 * 4. 通过 SSE 流接收响应
 *
 * 重连策略：
 * - 初始延迟：1s
 * - 最大延迟：30s
 * - 倍数：2x
 * - 最大重试次数：10
 */

import { EventEmitter } from 'events';
import { logger } from '../utils/logger.js';

interface JsonRpcMessageLike {
  jsonrpc: string;
  id?: number | string;
  method?: string;
  params?: Record<string, unknown>;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
}

/**
 * SSE 客户端配置
 */
export interface McpSseClientConfig {
  /** 服务器 URL（不含路径），如 http://localhost:8080 */
  baseUrl: string;
  /** 连接超时（毫秒），默认 10000 */
  connectTimeout?: number;
  /** 最大重连次数，默认 10 */
  maxRetries?: number;
  /** 初始重连延迟（毫秒），默认 1000 */
  initialRetryDelay?: number;
  /** 最大重连延迟（毫秒），默认 30000 */
  maxRetryDelay?: number;
}

/**
 * JSON-RPC 请求
 */
interface JsonRpcRequest {
  jsonrpc: '2.0';
  id: number | string;
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
 * JSON-RPC 通知
 */
interface JsonRpcNotification {
  jsonrpc: '2.0';
  method: string;
  params?: Record<string, unknown>;
}

/**
 * 延迟请求对象
 */
interface PendingRequest {
  id: number | string;
  resolve: (result: unknown) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

/**
 * MCP SSE 客户端
 */
export class McpSseClient extends EventEmitter {
  private baseUrl: string;
  private connectTimeout: number;
  private maxRetries: number;
  private initialRetryDelay: number;
  private maxRetryDelay: number;

  private eventSource: EventSource | null = null;
  private sessionId: string | null = null;
  private pendingRequests: Map<number | string, PendingRequest> = new Map();
  private requestIdCounter = 0;
  private isConnecting = false;
  private retryCount = 0;
  private isShutdown = false;

  constructor(config: McpSseClientConfig) {
    super();
    this.baseUrl = config.baseUrl.replace(/\/+$/, '');
    this.connectTimeout = config.connectTimeout ?? 10000;
    this.maxRetries = config.maxRetries ?? 10;
    this.initialRetryDelay = config.initialRetryDelay ?? 1000;
    this.maxRetryDelay = config.maxRetryDelay ?? 30000;
  }

  /**
   * 获取当前 sessionId
   */
  getSessionId(): string | null {
    return this.sessionId;
  }

  /**
   * 连接状态
   */
  isConnected(): boolean {
    return this.sessionId !== null && this.eventSource !== null;
  }

  /**
   * 建立 SSE 连接
   */
  async connect(): Promise<void> {
    if (this.isConnected()) {
      logger.info('[MCP SSE Client] Already connected');
      return;
    }

    if (this.isConnecting) {
      logger.info('[MCP SSE Client] Connection in progress');
      return;
    }

    this.isShutdown = false;
    this.isConnecting = true;
    this.retryCount = 0;

    logger.info(`[MCP SSE Client] Connecting to ${this.baseUrl}`);

    return new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.isConnecting = false;
        this.closeEventSource();
        reject(new Error('Connection timeout'));
      }, this.connectTimeout);

      this.setupEventSource(resolve, reject, timeout);
    });
  }

  /**
   * 断开连接
   */
  async disconnect(): Promise<void> {
    logger.info('[MCP SSE Client] Disconnecting...');
    this.isShutdown = true;
    this.isConnecting = false;

    // 拒绝所有待处理请求
    for (const [id, req] of this.pendingRequests) {
      clearTimeout(req.timer);
      req.reject(new Error('Client disconnected'));
    }
    this.pendingRequests.clear();

    this.closeEventSource();
    this.sessionId = null;

    logger.info('[MCP SSE Client] Disconnected');
  }

  /**
   * 发送 JSON-RPC 请求
   */
  async sendRequest(method: string, params?: Record<string, unknown>): Promise<unknown> {
    if (!this.isConnected()) {
      throw new Error('Not connected. Call connect() first.');
    }

    const id = ++this.requestIdCounter;
    const request: JsonRpcRequest = {
      jsonrpc: '2.0',
      id,
      method,
      params,
    };

    logger.debug(`[MCP SSE Client] Sending request: ${method} (id=${id})`);

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error(`Request timeout: ${method} (id=${id})`));
      }, this.connectTimeout);

      this.pendingRequests.set(id, { id, resolve, reject, timer });
      this.postMessage(request);
    });
  }

  /**
   * 发送通知（不需要响应）
   */
  async sendNotification(method: string, params?: Record<string, unknown>): Promise<void> {
    if (!this.isConnected()) {
      throw new Error('Not connected. Call connect() first.');
    }

    const notification: JsonRpcNotification = {
      jsonrpc: '2.0',
      method,
      params,
    };

    logger.debug(`[MCP SSE Client] Sending notification: ${method}`);
    this.postMessage(notification);
  }

  /**
   * 建立 EventSource 连接
   */
  private setupEventSource(
    resolve: () => void,
    reject: (error: Error) => void,
    timeout: ReturnType<typeof setTimeout>,
  ): void {
    try {
      // 在 Node.js 中，EventSource 需要全局可用
      // 这里使用 fetch 作为 SSE 的替代方案，或者使用 node EventSource
      const EventSourceClass = this.getEventSource();
      if (!EventSourceClass) {
        reject(new Error('EventSource not available in this environment'));
        return;
      }

      const sseUrl = `${this.baseUrl}/sse`;
      logger.info(`[MCP SSE Client] Creating EventSource to ${sseUrl}`);

      this.eventSource = new EventSourceClass(sseUrl) as EventSource;

      this.eventSource.onopen = () => {
        logger.info('[MCP SSE Client] SSE connection opened');
      };

      this.eventSource.addEventListener('message', (event: MessageEvent) => {
        this.handleSseMessage(event);
      });

      this.eventSource.onmessage = (event: MessageEvent) => {
        this.handleSseMessage(event);
      };

      this.eventSource.onerror = (error: Event) => {
        logger.error('[MCP SSE Client] SSE error:', error);

        if (!this.sessionId) {
          // 初始连接失败
          clearTimeout(timeout);
          this.isConnecting = false;
          this.closeEventSource();
          reject(new Error('Failed to establish SSE connection'));
        } else {
          // 连接已建立后断开，触发重连
          this.handleReconnect();
        }
      };

      // 监听 session/init 消息来确认连接成功
      const initCheck = setInterval(() => {
        if (this.sessionId) {
          clearInterval(initCheck);
          clearTimeout(timeout);
          this.isConnecting = false;
          this.retryCount = 0;
          logger.info(`[MCP SSE Client] Connected with session: ${this.sessionId}`);
          this.emit('connected', this.sessionId);
          resolve();
        }
      }, 100);
    } catch (error) {
      clearTimeout(timeout);
      this.isConnecting = false;
      this.closeEventSource();
      reject(error instanceof Error ? error : new Error(String(error)));
    }
  }

  /**
   * 获取 EventSource 构造函数
   */
  private getEventSource(): typeof EventSource | null {
    // 浏览器环境
    if (typeof globalThis.EventSource !== 'undefined') {
      return globalThis.EventSource;
    }

    // Node.js 环境 - 尝试动态导入
    // 对于 Node.js >= 22, EventSource 是内置的
    // 对于 Node.js < 22, 需要安装 eventsource 包
    return null;
  }

  /**
   * 处理 SSE 消息
   */
  private handleSseMessage(event: MessageEvent): void {
    const data = event.data;
    logger.debug('[MCP SSE Client] Received SSE message:', data);

    // 心跳或注释
    if (!data || data.startsWith(':')) {
      return;
    }

    let message: unknown;
    try {
      message = JSON.parse(data);
    } catch (error) {
      logger.error('[MCP SSE Client] Failed to parse SSE message:', error);
      return;
    }

    const msg = message as JsonRpcMessageLike;

    if (msg.method === 'session/init') {
      if (msg.params?.sessionId) {
        this.sessionId = msg.params.sessionId as string;
        logger.info(`[MCP SSE Client] Session initialized: ${this.sessionId}`);
      }
      return;
    }

    if (msg.id !== undefined) {
      const pending = this.pendingRequests.get(msg.id);
      if (pending) {
        clearTimeout(pending.timer);
        this.pendingRequests.delete(msg.id);

        if (msg.error) {
          logger.error(`[MCP SSE Client] Request ${msg.id} failed:`, msg.error.message);
          pending.reject(new Error(msg.error.message));
        } else {
          logger.debug(`[MCP SSE Client] Request ${msg.id} succeeded`);
          pending.resolve(msg.result);
        }
      } else {
        logger.warn(`[MCP SSE Client] No pending request for id: ${msg.id}`);
      }
      return;
    }

    logger.debug(`[MCP SSE Client] Notification: ${msg.method}`);
    this.emit('notification', msg);
  }

  /**
   * 通过 POST 发送消息
   */
  private async postMessage(message: JsonRpcRequest | JsonRpcNotification): Promise<void> {
    if (!this.sessionId) {
      throw new Error('No session ID. Connect first.');
    }

    const url = `${this.baseUrl}/message`;
    const body = JSON.stringify(message);

    logger.debug(`[MCP SSE Client] POST ${url}:`, body);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Session-ID': this.sessionId,
        },
        body,
      });

      if (!response.ok) {
        const errorText = await response.text();
        logger.error(`[MCP SSE Client] POST failed (${response.status}):`, errorText);
        throw new Error(`POST /message failed: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();
      logger.debug('[MCP SSE Client] POST response:', result);
    } catch (error) {
      logger.error('[MCP SSE Client] POST error:', error);

      // 如果连接错误，尝试重连
      if (error instanceof TypeError) {
        this.handleReconnect();
      }

      throw error;
    }
  }

  /**
   * 处理重连
   */
  private handleReconnect(): void {
    if (this.isShutdown || this.isConnecting) {
      return;
    }

    this.retryCount++;
    if (this.retryCount > this.maxRetries) {
      logger.error(`[MCP SSE Client] Max retries (${this.maxRetries}) exceeded`);
      this.closeEventSource();
      this.sessionId = null;
      this.emit('max_retries_exceeded');
      return;
    }

    // 指数退避
    const delay = Math.min(
      this.initialRetryDelay * Math.pow(2, this.retryCount - 1),
      this.maxRetryDelay,
    );

    logger.info(`[MCP SSE Client] Reconnecting in ${delay}ms (attempt ${this.retryCount}/${this.maxRetries})`);

    setTimeout(() => {
      if (this.isShutdown) return;

      this.closeEventSource();
      this.sessionId = null;
      this.isConnecting = true;

      // 重新建立连接（不需要返回 promise）
      const newEventSource = this.getEventSource();
      if (!newEventSource) {
        logger.error('[MCP SSE Client] EventSource not available');
        this.isConnecting = false;
        return;
      }

      const sseUrl = `${this.baseUrl}/sse`;
      logger.info(`[MCP SSE Client] Reconnecting to ${sseUrl}`);

      this.eventSource = new newEventSource(sseUrl) as EventSource;

      this.eventSource.addEventListener('message', (event: MessageEvent) => {
        this.handleSseMessage(event);
      });

      this.eventSource.onmessage = (event: MessageEvent) => {
        this.handleSseMessage(event);
      };

      this.eventSource.onopen = () => {
        logger.info('[MCP SSE Client] SSE reconnection opened');
      };

      this.eventSource.onerror = () => {
        logger.error('[MCP SSE Client] SSE error during reconnection');
        this.handleReconnect();
      };

      // 等待 session/init
      const initCheck = setInterval(() => {
        if (this.sessionId) {
          clearInterval(initCheck);
          this.isConnecting = false;
          this.retryCount = 0;
          logger.info(`[MCP SSE Client] Reconnected with session: ${this.sessionId}`);
          this.emit('reconnected', this.sessionId);
        }
      }, 100);
    }, delay);
  }

  /**
   * 关闭 EventSource
   */
  private closeEventSource(): void {
    if (this.eventSource) {
      logger.info('[MCP SSE Client] Closing EventSource');
      this.eventSource.close();
      this.eventSource = null;
    }
  }
}
