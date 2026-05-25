/**
 * MCP Client - MCP 客户端实现
 * 
 * 学习笔记：
 * MCP Client 负责与 MCP Server 建立连接并通信。
 * 
 * 支持两种传输方式：
 * 1. stdio: 通过 spawn 启动子进程，使用 stdin/stdout 通信
 *    - 适合本地工具（如文件系统、git 等）
 *    - 生命周期与 Host 进程绑定
 * 
 * 2. SSE: 通过 HTTP SSE 连接到远程服务器
 *    - 适合远程服务（如 GitHub、Slack 等）
 *    - 支持跨网络通信
 * 
 * JSON-RPC 2.0 通信：
 * - 请求: { jsonrpc: "2.0", id: 1, method: "tools/list", params: {} }
 * - 响应: { jsonrpc: "2.0", id: 1, result: { tools: [...] } }
 * - 通知: { jsonrpc: "2.0", method: "notifications/...", params: {} }
 * 
 * 初始化流程：
 * 1. 启动/连接到 Server
 * 2. 发送 initialize 请求
 * 3. 收到 serverInfo 和 capabilities
 * 4. 发送 initialized 通知
 * 5. 发现 tools/resources/prompts
 */

import { spawn, type ChildProcess } from 'child_process';
import http from 'http';
import type {
  MCPServerConfig,
  MCPToolDefinition,
  MCPResource,
  MCPPrompt,
  MCPServerInfo,
  MCPToolResult,
  MCPResourceContent,
  JsonRpcRequest,
  JsonRpcResponse,
  JsonRpcNotification,
} from './types.js';
import { logger } from '../utils/logger.js';

interface Deferred<T = unknown> {
  resolve: (value: T) => void;
  reject: (error: Error) => void;
  promise: Promise<T>;
}

function createDeferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { resolve, reject, promise };
}

interface JsonRpcMessageLike {
  jsonrpc: string;
  id?: number | string;
  method?: string;
  params?: Record<string, unknown>;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
}

export class MCPClient {
  private config: MCPServerConfig;
  private process: ChildProcess | null = null;
  private requestQueue: Map<number | string, Deferred> = new Map();
  private requestIdCounter = 0;
  private serverInfo: MCPServerInfo;
  private messageBuffer = '';

  private sseSessionId: string | null = null;
  private sseConnection: http.ClientRequest | null = null;
  private sseBuffer = '';
  private connectTimeoutMs = 10000;

  constructor(config: MCPServerConfig) {
    this.config = config;
    this.serverInfo = {
      name: config.name,
      status: 'disconnected',
      capabilities: {},
    };
  }

  getInfo(): MCPServerInfo {
    return { ...this.serverInfo };
  }

  async connect(): Promise<void> {
    this.serverInfo.status = 'connecting';

    try {
      if (this.config.transport === 'stdio') {
        await this.connectStdio();
      } else {
        await this.connectSSE();
      }

      await this.initialize();
      await this.discoverCapabilities();

      this.serverInfo.status = 'connected';
    } catch (error) {
      this.serverInfo.status = 'error';
      this.serverInfo.error = error instanceof Error ? error.message : String(error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    if (this.process) {
      this.process.kill('SIGTERM');
      this.process = null;
    }

    if (this.sseConnection) {
      this.sseConnection.destroy();
      this.sseConnection = null;
    }
    this.sseSessionId = null;
    this.sseBuffer = '';

    this.requestQueue.clear();
    this.serverInfo.status = 'disconnected';
  }

  async listTools(): Promise<MCPToolDefinition[]> {
    const result = await this.sendRequest('tools/list');
    const tools = (result as any)?.tools || [];
    return tools as MCPToolDefinition[];
  }

  async callTool(name: string, args: Record<string, unknown>): Promise<MCPToolResult> {
    try {
      const result = await this.sendRequest('tools/call', {
        name,
        arguments: args,
      });
      return result as MCPToolResult;
    } catch (error) {
      return {
        success: false,
        content: [],
        error: error instanceof Error ? error.message : String(error),
        isError: true,
      };
    }
  }

  async listResources(): Promise<MCPResource[]> {
    const result = await this.sendRequest('resources/list');
    const resources = (result as any)?.resources || [];
    return resources as MCPResource[];
  }

  async readResource(uri: string): Promise<MCPResourceContent> {
    const result = await this.sendRequest('resources/read', { uri });
    return result as MCPResourceContent;
  }

  async listPrompts(): Promise<MCPPrompt[]> {
    const result = await this.sendRequest('prompts/list');
    const prompts = (result as any)?.prompts || [];
    return prompts as MCPPrompt[];
  }

  async getPrompt(name: string, args?: Record<string, string>): Promise<{ messages: Array<{ role: string; content: { type: string; text: string } }> }> {
    const result = await this.sendRequest('prompts/get', {
      name,
      arguments: args,
    });
    return result as any;
  }

  private async sendRequest(method: string, params?: Record<string, unknown>): Promise<unknown> {
    const id = ++this.requestIdCounter;
    const deferred = createDeferred();

    this.requestQueue.set(id, deferred);

    const request: JsonRpcRequest = {
      jsonrpc: '2.0',
      id,
      method,
      params,
    };

    await this.sendMessage(request);

    return deferred.promise;
  }

  private async sendMessage(message: JsonRpcRequest | JsonRpcResponse | JsonRpcNotification): Promise<void> {
    if (this.config.transport === 'stdio') {
      const data = JSON.stringify(message) + '\n';
      if (this.process?.stdin) {
        this.process.stdin.write(data);
      }
    } else {
      await this.sendSseMessage(message);
    }
  }

  private async connectStdio(): Promise<void> {
    if (!this.config.command) {
      throw new Error('stdio transport requires command');
    }

    this.process = spawn(this.config.command, this.config.args || [], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, ...this.config.env },
    });

    this.process.stdout?.on('data', (data: Buffer) => {
      this.handleData(data.toString());
    });

    this.process.stderr?.on('data', (data: Buffer) => {
      logger.warn(`[MCP ${this.config.name}] stderr: ${data.toString()}`);
    });

    this.process.on('exit', (code) => {
      logger.info(`[MCP ${this.config.name}] Process exited with code ${code}`);
      this.serverInfo.status = 'disconnected';
      this.rejectAllPending(new Error(`Process exited with code ${code}`));
    });

    this.process.on('error', (error) => {
      logger.error(`[MCP ${this.config.name}] Process error:`, error);
      this.serverInfo.status = 'error';
      this.serverInfo.error = error.message;
      this.rejectAllPending(error);
    });

    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  private async connectSSE(): Promise<void> {
    if (!this.config.url) {
      throw new Error('sse transport requires url');
    }

    logger.info(`[MCP ${this.config.name}] Connecting via SSE to ${this.config.url}`);

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('SSE connection timeout'));
      }, this.connectTimeoutMs);

      this.establishSseConnection(resolve, reject, timeout);
    });
  }

  private establishSseConnection(
    resolve: () => void,
    reject: (error: Error) => void,
    timeout: ReturnType<typeof setTimeout>,
  ): void {
    const url = new URL(this.config.url!);
    url.pathname = '/sse';

    const options: http.RequestOptions = {
      hostname: url.hostname,
      port: url.port || 80,
      path: url.pathname,
      method: 'GET',
      headers: {
        'Accept': 'text/event-stream',
        'Cache-Control': 'no-cache',
      },
    };

    this.sseConnection = http.request(options);

    this.sseConnection.on('response', (response) => {
      logger.info(`[MCP ${this.config.name}] SSE connection established (status: ${response.statusCode})`);

      response.on('data', (chunk: Buffer) => {
        this.handleSseData(chunk.toString());
      });

      response.on('end', () => {
        logger.info(`[MCP ${this.config.name}] SSE connection ended`);
        this.sseConnection = null;
        this.sseSessionId = null;
        this.rejectAllPending(new Error('SSE connection closed'));
      });

      response.on('error', (error) => {
        logger.error(`[MCP ${this.config.name}] SSE response error:`, error);
        this.sseConnection = null;
        reject(error);
      });
    });

    this.sseConnection.on('error', (error) => {
      logger.error(`[MCP ${this.config.name}] SSE request error:`, error);
      reject(error);
    });

    this.sseConnection.end();

    const sessionCheck = setInterval(() => {
      if (this.sseSessionId) {
        clearInterval(sessionCheck);
        clearTimeout(timeout);
        logger.info(`[MCP ${this.config.name}] SSE session established: ${this.sseSessionId}`);
        resolve();
      }
    }, 100);
  }

  private handleSseData(data: string): void {
    this.sseBuffer += data;

    const events = this.sseBuffer.split('\n\n');
    this.sseBuffer = events.pop() || '';

    for (const event of events) {
      if (!event.trim() || event.startsWith(':')) continue;

      let jsonData = '';
      const lines = event.split('\n');
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          jsonData += line.slice(6);
        } else if (line === 'data') {
          jsonData += '\n';
        }
      }

      if (!jsonData) continue;

      try {
        const message = JSON.parse(jsonData) as JsonRpcMessageLike;
        logger.debug(`[MCP ${this.config.name}] SSE message:`, JSON.stringify(message));
        this.handleMessage(message);
      } catch (error) {
        logger.error(`[MCP ${this.config.name}] Failed to parse SSE message:`, jsonData);
      }
    }
  }

  private async sendSseMessage(message: JsonRpcRequest | JsonRpcResponse | JsonRpcNotification): Promise<void> {
    if (!this.sseSessionId) {
      throw new Error('SSE session not established');
    }

    const url = new URL(this.config.url!);
    url.pathname = '/message';

    const body = JSON.stringify(message);
    logger.debug(`[MCP ${this.config.name}] POST ${url.href}:`, body);

    const sessionId = this.sseSessionId;

    return new Promise((resolve, reject) => {
      const options: http.RequestOptions = {
        hostname: url.hostname,
        port: url.port || 80,
        path: url.pathname,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body),
          'X-Session-ID': sessionId,
        },
      };

      const req = http.request(options, (res) => {
        let resBody = '';
        res.on('data', (chunk: Buffer) => { resBody += chunk.toString(); });
        res.on('end', () => {
          if (res.statusCode === 202 || res.statusCode === 200) {
            logger.debug(`[MCP ${this.config.name}] POST success:`, resBody);
            resolve();
          } else {
            reject(new Error(`POST /message failed: ${res.statusCode} ${resBody}`));
          }
        });
      });

      req.on('error', (error) => {
        logger.error(`[MCP ${this.config.name}] POST error:`, error);
        reject(error);
      });

      req.write(body);
      req.end();
    });
  }

  private handleData(data: string): void {
    this.messageBuffer += data;

    const lines = this.messageBuffer.split('\n');
    this.messageBuffer = lines.pop() || '';

    for (const line of lines) {
      if (!line.trim()) continue;

      try {
        const message = JSON.parse(line) as JsonRpcMessageLike;
        this.handleMessage(message);
      } catch (error) {
        logger.error(`[MCP ${this.config.name}] Failed to parse message: ${line}`);
      }
    }
  }

  private handleMessage(message: JsonRpcMessageLike): void {
    if (message.method === 'session/init' && message.params) {
      this.sseSessionId = (message.params as any).sessionId || null;
      logger.info(`[MCP ${this.config.name}] Session init: ${this.sseSessionId}`);
      return;
    }

    if (message.id !== undefined) {
      const deferred = this.requestQueue.get(message.id);
      if (deferred) {
        if (message.error) {
          deferred.reject(new Error(message.error.message));
        } else {
          deferred.resolve(message.result);
        }
        this.requestQueue.delete(message.id);
      }
    }
  }

  private async initialize(): Promise<void> {
    const result = await this.sendRequest('initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {
        tools: {},
        resources: {},
        prompts: {},
      },
      clientInfo: {
        name: 'miniagent',
        version: '1.0.0',
      },
    });

    this.serverInfo.serverInfo = (result as any)?.serverInfo;
    this.serverInfo.capabilities = (result as any)?.capabilities || {};

    this.sendNotification('notifications/initialized');
  }

  private sendNotification(method: string, params?: Record<string, unknown>): void {
    const notification = {
      jsonrpc: '2.0' as const,
      method,
      params,
    };
    this.sendMessage(notification as any);
  }

  private async discoverCapabilities(): Promise<void> {
    try {
      await this.listTools();
      this.serverInfo.capabilities.tools = true;
    } catch {
      this.serverInfo.capabilities.tools = false;
    }

    try {
      await this.listResources();
      this.serverInfo.capabilities.resources = true;
    } catch {
      this.serverInfo.capabilities.resources = false;
    }

    try {
      await this.listPrompts();
      this.serverInfo.capabilities.prompts = true;
    } catch {
      this.serverInfo.capabilities.prompts = false;
    }
  }

  private rejectAllPending(error: Error): void {
    for (const deferred of this.requestQueue.values()) {
      deferred.reject(error);
    }
    this.requestQueue.clear();
  }
}
