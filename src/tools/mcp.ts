/**
 * MCP Tools - MCP 工具包装
 * 
 * 将 MCP Server 发现的工具包装为 MiniAgent 标准 Tool 格式
 * 同时提供通用的 MCP 调用工具
 */

import type { Tool, ToolResult } from '../tools/types.js';
import { MCPManager } from '../mcp/manager.js';

/**
 * 创建通用 MCP 调用工具
 * 允许 Agent 直接调用任意 MCP 工具
 */
export function createMCPTool(manager: MCPManager): Tool {
  return {
    name: 'mcp_call',
    description: `Call a tool from a connected MCP (Model Context Protocol) server.

Use this when:
- You need to use a tool from an external MCP server
- The MCP server provides specialized tools (GitHub, Slack, etc.)

First use mcp_list_servers to see available servers,
then mcp_list_tools to see available tools on a server.`,

    parameters: {
      type: 'object',
      properties: {
        server: {
          type: 'string',
          description: 'MCP server name',
        },
        tool: {
          type: 'string',
          description: 'Tool name on the MCP server',
        },
        arguments: {
          type: 'object',
          description: 'Arguments to pass to the tool',
        },
      },
      required: ['server', 'tool'],
    },

    async execute(params: Record<string, unknown>): Promise<ToolResult> {
      const p = params as unknown as {
        server: string;
        tool: string;
        arguments?: Record<string, unknown>;
      };
      try {
        const result = await manager.callTool(p.server, p.tool, p.arguments || {});
        
        if (!result.success || result.isError) {
          return {
            success: false,
            content: `MCP tool call failed: ${result.error || 'Unknown error'}`,
          };
        }

        // 合并所有内容
        const content = result.content
          .map((c: { type: string; text?: string }) => c.type === 'text' ? c.text : `[${c.type} data]`)
          .join('\n');

        return {
          success: true,
          content: content || '(no content)',
        };
      } catch (error) {
        return {
          success: false,
          content: `MCP tool call error: ${error instanceof Error ? error.message : String(error)}`,
        };
      }
    },
  };
}

/**
 * 列出 MCP 服务器
 */
export function createMCPListServersTool(manager: MCPManager): Tool {
  return {
    name: 'mcp_list_servers',
    description: 'List all connected MCP servers and their status',

    parameters: {
      type: 'object',
      properties: {},
    },

    async execute(): Promise<ToolResult> {
      const servers = manager.listServers();
      
      if (servers.length === 0) {
        return {
          success: true,
          content: 'No MCP servers connected.',
        };
      }

      const lines = servers.map((s: { name: string; status: string; capabilities: { tools?: boolean; resources?: boolean; prompts?: boolean } }) => {
        const caps = [];
        if (s.capabilities.tools) caps.push('tools');
        if (s.capabilities.resources) caps.push('resources');
        if (s.capabilities.prompts) caps.push('prompts');
        
        return `- ${s.name} (${s.status}): ${caps.join(', ') || 'no capabilities'}`;
      });

      return {
        success: true,
        content: `Connected MCP servers:\n${lines.join('\n')}`,
      };
    },
  };
}

/**
 * 列出 MCP 资源
 */
export function createMCPListResourcesTool(manager: MCPManager): Tool {
  return {
    name: 'mcp_list_resources',
    description: 'List available resources from all connected MCP servers',

    parameters: {
      type: 'object',
      properties: {
        server: {
          type: 'string',
          description: 'Filter by server name (optional)',
        },
      },
    },

    async execute(params: Record<string, unknown>): Promise<ToolResult> {
      const p = params as unknown as { server?: string };
      try {
        const resources = await manager.listAllResources();
        
        const filtered = p.server
          ? resources.filter((r: { server: string }) => r.server === p.server)
          : resources;

        if (filtered.length === 0) {
          return {
            success: true,
            content: p.server 
              ? `No resources on server '${p.server}'.`
              : 'No MCP resources available.',
          };
        }

        const lines = filtered.map((r: { server: string; uri: string; name: string; description?: string }) => `- [${r.server}] ${r.uri}: ${r.name}${r.description ? ` (${r.description})` : ''}`);

        return {
          success: true,
          content: `Available MCP resources:\n${lines.join('\n')}`,
        };
      } catch (error) {
        return {
          success: false,
          content: `Error listing resources: ${error instanceof Error ? error.message : String(error)}`,
        };
      }
    },
  };
}

/**
 * 读取 MCP 资源
 */
export function createMCPReadResourceTool(manager: MCPManager): Tool {
  return {
    name: 'mcp_read_resource',
    description: 'Read content from an MCP resource',

    parameters: {
      type: 'object',
      properties: {
        server: {
          type: 'string',
          description: 'MCP server name',
        },
        uri: {
          type: 'string',
          description: 'Resource URI',
        },
      },
      required: ['server', 'uri'],
    },

    async execute(params: Record<string, unknown>): Promise<ToolResult> {
      const p = params as unknown as { server: string; uri: string };
      try {
        const content = await manager.readResource(p.server, p.uri);
        
        const text = content.text || content.blob || '(empty)';
        
        return {
          success: true,
          content: text.substring(0, 5000),
        };
      } catch (error) {
        return {
          success: false,
          content: `Error reading resource: ${error instanceof Error ? error.message : String(error)}`,
        };
      }
    },
  };
}

/**
 * 创建所有 MCP 工具
 */
export function createMCPTools(manager: MCPManager): Tool[] {
  return [
    createMCPTool(manager),
    createMCPListServersTool(manager),
    createMCPListResourcesTool(manager),
    createMCPReadResourceTool(manager),
  ];
}
