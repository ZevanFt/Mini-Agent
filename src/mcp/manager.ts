/**
 * MCP Manager - MCP 管理器
 * 
 * 负责管理多个 MCP Server 连接，提供统一的工具注册接口
 * 支持 SSE 服务器端模式，允许外部客户端连接
 */

import { MCPClient } from './client.js';
import { McpSseServer } from './sse-transport.js';
import type { MCPServerConfig, MCPToolDefinition, MCPServerInfo, MCPToolResult, JsonRpcResponse, JsonRpcNotification } from './types.js';
import { logger } from '../utils/logger.js';

/**
 * MCP 管理器
 */
export class MCPManager {
  private clients: Map<string, MCPClient> = new Map();
  private configs: Map<string, MCPServerConfig> = new Map();
  private sseServer: McpSseServer | null = null;

  /**
   * 启动 MCP SSE 服务器
   *
   * 允许外部客户端通过 SSE 连接到本机的 MCP 工具
   */
  async startSseServer(port: number = 8080, host: string = '127.0.0.1'): Promise<void> {
    if (this.sseServer) {
      logger.warn('[MCP Manager] SSE server already running');
      return;
    }

    logger.info(`[MCP Manager] Starting SSE server on ${host}:${port}`);

    this.sseServer = new McpSseServer({ port, host });

    // 设置消息处理器：路由到内部 MCP 客户端
    this.sseServer.setMessageHandler(async (message, sessionId, sendResponse) => {
      await this.handleSseMessage(message, sessionId, sendResponse);
    });

    await this.sseServer.start();
    logger.info(`[MCP Manager] SSE server started on port ${port}`);
  }

  /**
   * 停止 MCP SSE 服务器
   */
  async stopSseServer(): Promise<void> {
    if (!this.sseServer) {
      logger.warn('[MCP Manager] SSE server not running');
      return;
    }

    logger.info('[MCP Manager] Stopping SSE server');
    await this.sseServer.stop();
    this.sseServer = null;
    logger.info('[MCP Manager] SSE server stopped');
  }

  /**
   * 获取 SSE 服务器实例
   */
  getSseServer(): McpSseServer | null {
    return this.sseServer;
  }

  /**
   * 处理来自 SSE 客户端的消息
   */
  private async handleSseMessage(
    message: unknown,
    sessionId: string,
    sendResponse: (response: JsonRpcResponse) => void,
  ): Promise<void> {
    const msg = message as { jsonrpc: string; id?: number | string; method?: string; params?: Record<string, unknown> };

    logger.info(`[MCP Manager] SSE message from ${sessionId}: ${msg.method || '(response)'}`);

    // 处理 initialize
    if (msg.method === 'initialize') {
      sendResponse({
        jsonrpc: '2.0',
        id: msg.id,
        result: {
          protocolVersion: '2024-11-05',
          capabilities: {
            tools: true,
            resources: true,
            prompts: true,
          },
          serverInfo: {
            name: 'miniagent-mcp-bridge',
            version: '1.0.0',
          },
        },
      });
      return;
    }

    // 处理 initialized 通知
    if (msg.method === 'notifications/initialized') {
      logger.info(`[MCP Manager] Client ${sessionId} initialized`);
      return;
    }

    // 处理 tools/list
    if (msg.method === 'tools/list') {
      try {
        const tools = await this.listAllTools();
        sendResponse({
          jsonrpc: '2.0',
          id: msg.id,
          result: {
            tools: tools.map(t => t.tool),
          },
        });
      } catch (error) {
        sendResponse({
          jsonrpc: '2.0',
          id: msg.id,
          error: {
            code: -32603,
            message: error instanceof Error ? error.message : String(error),
          },
        });
      }
      return;
    }

    // 处理 tools/call
    if (msg.method === 'tools/call') {
      const toolName = msg.params?.name as string;
      const toolArgs = msg.params?.arguments as Record<string, unknown> | undefined;
      const serverName = msg.params?.server as string | undefined;

      try {
        // 如果指定了 server，直接调用
        if (serverName) {
          const result = await this.callTool(serverName, toolName, toolArgs || {});
          sendResponse({
            jsonrpc: '2.0',
            id: msg.id,
            result,
          });
          return;
        }

        // 否则尝试在所有服务器上调用
        let found = false;
        for (const [name] of this.clients) {
          try {
            const result = await this.callTool(name, toolName, toolArgs || {});
            if (result.success) {
              sendResponse({
                jsonrpc: '2.0',
                id: msg.id,
                result,
              });
              found = true;
              break;
            }
          } catch {
            // 忽略，尝试下一个
          }
        }

        if (!found) {
          sendResponse({
            jsonrpc: '2.0',
            id: msg.id,
            error: {
              code: -32601,
              message: `Tool '${toolName}' not found on any server`,
            },
          });
        }
      } catch (error) {
        sendResponse({
          jsonrpc: '2.0',
          id: msg.id,
          error: {
            code: -32603,
            message: error instanceof Error ? error.message : String(error),
          },
        });
      }
      return;
    }

    // 处理 resources/list
    if (msg.method === 'resources/list') {
      try {
        const resources = await this.listAllResources();
        sendResponse({
          jsonrpc: '2.0',
          id: msg.id,
          result: {
            resources: resources.map(r => ({
              uri: r.uri,
              name: r.name,
              description: r.description,
            })),
          },
        });
      } catch (error) {
        sendResponse({
          jsonrpc: '2.0',
          id: msg.id,
          error: {
            code: -32603,
            message: error instanceof Error ? error.message : String(error),
          },
        });
      }
      return;
    }

    // 处理 resources/read
    if (msg.method === 'resources/read') {
      const uri = msg.params?.uri as string;
      const serverName = msg.params?.server as string | undefined;

      try {
        if (serverName) {
          const content = await this.readResource(serverName, uri);
          sendResponse({
            jsonrpc: '2.0',
            id: msg.id,
            result: content,
          });
          return;
        }

        // 尝试所有服务器
        let found = false;
        for (const [name] of this.clients) {
          try {
            const content = await this.readResource(name, uri);
            sendResponse({
              jsonrpc: '2.0',
              id: msg.id,
              result: content,
            });
            found = true;
            break;
          } catch {
            // 忽略
          }
        }

        if (!found) {
          sendResponse({
            jsonrpc: '2.0',
            id: msg.id,
            error: {
              code: -32601,
              message: `Resource '${uri}' not found`,
            },
          });
        }
      } catch (error) {
        sendResponse({
          jsonrpc: '2.0',
          id: msg.id,
          error: {
            code: -32603,
            message: error instanceof Error ? error.message : String(error),
          },
        });
      }
      return;
    }

    // 处理 prompts/list
    if (msg.method === 'prompts/list') {
      try {
        const prompts: Array<{ name: string; description?: string }> = [];
        for (const [name, client] of this.clients) {
          try {
            const serverPrompts = await client.listPrompts();
            for (const p of serverPrompts) {
              prompts.push({ name: p.name, description: p.description });
            }
          } catch {
            // 忽略
          }
        }
        sendResponse({
          jsonrpc: '2.0',
          id: msg.id,
          result: { prompts },
        });
      } catch (error) {
        sendResponse({
          jsonrpc: '2.0',
          id: msg.id,
          error: {
            code: -32603,
            message: error instanceof Error ? error.message : String(error),
          },
        });
      }
      return;
    }

    // 未知方法
    sendResponse({
      jsonrpc: '2.0',
      id: msg.id,
      error: {
        code: -32601,
        message: `Method not found: ${msg.method || '(no method)'}`,
      },
    });
  }

  /**
   * 连接 MCP Server
   */
  async connectServer(config: MCPServerConfig): Promise<void> {
    if (this.clients.has(config.name)) {
      await this.disconnectServer(config.name);
    }

    const client = new MCPClient(config);
    await client.connect();

    this.clients.set(config.name, client);
    this.configs.set(config.name, config);

    // 如果 SSE 服务器正在运行，广播通知
    if (this.sseServer) {
      this.sseServer.broadcast({
        jsonrpc: '2.0',
        method: 'notifications/servers/changed',
        params: {
          servers: this.listServers(),
        },
      } as JsonRpcNotification);
    }
  }

  /**
   * 断开 MCP Server
   */
  async disconnectServer(name: string): Promise<void> {
    const client = this.clients.get(name);
    if (client) {
      await client.disconnect();
      this.clients.delete(name);
      this.configs.delete(name);

      // 如果 SSE 服务器正在运行，广播通知
      if (this.sseServer) {
        this.sseServer.broadcast({
          jsonrpc: '2.0',
          method: 'notifications/servers/changed',
          params: {
            servers: this.listServers(),
          },
        } as JsonRpcNotification);
      }
    }
  }

  /**
   * 列出所有服务器
   */
  listServers(): MCPServerInfo[] {
    const result: MCPServerInfo[] = [];
    for (const [name, client] of this.clients) {
      result.push(client.getInfo());
    }
    return result;
  }

  /**
   * 获取客户端
   */
  getClient(name: string): MCPClient | undefined {
    return this.clients.get(name);
  }

  /**
   * 列出所有工具（来自所有服务器）
   */
  async listAllTools(): Promise<Array<{ server: string; tool: MCPToolDefinition }>> {
    const result: Array<{ server: string; tool: MCPToolDefinition }> = [];

    for (const [name, client] of this.clients) {
      try {
        const tools = await client.listTools();
        for (const tool of tools) {
          result.push({ server: name, tool });
        }
      } catch {
        // 忽略不支持工具的服务器
      }
    }

    return result;
  }

  /**
   * 调用工具
   */
  async callTool(server: string, toolName: string, args: Record<string, unknown>): Promise<MCPToolResult> {
    const client = this.clients.get(server);
    if (!client) {
      return {
        success: false,
        content: [],
        error: `MCP server '${server}' not found`,
        isError: true,
      };
    }

    return client.callTool(toolName, args);
  }

  /**
   * 列出所有资源
   */
  async listAllResources(): Promise<Array<{ server: string; uri: string; name: string; description?: string }>> {
    const result: Array<{ server: string; uri: string; name: string; description?: string }> = [];

    for (const [name, client] of this.clients) {
      try {
        const resources = await client.listResources();
        for (const resource of resources) {
          result.push({
            server: name,
            uri: resource.uri,
            name: resource.name,
            description: resource.description,
          });
        }
      } catch {
        // 忽略不支持资源的服务器
      }
    }

    return result;
  }

  /**
   * 读取资源
   */
  async readResource(server: string, uri: string) {
    const client = this.clients.get(server);
    if (!client) {
      throw new Error(`MCP server '${server}' not found`);
    }
    return client.readResource(uri);
  }

  /**
   * 断开所有连接
   */
  async disconnectAll(): Promise<void> {
    // 先停止 SSE 服务器
    if (this.sseServer) {
      await this.stopSseServer();
    }

    const promises = Array.from(this.clients.keys()).map(name => this.disconnectServer(name));
    await Promise.all(promises);
  }
}
