/**
 * MCP (Model Context Protocol) - 类型定义
 * 
 * 学习笔记：
 * MCP 是 Anthropic 提出的协议，允许 AI 应用（Host）通过标准接口
 * 连接到外部工具和数据源（Server）。
 * 
 * 架构：
 * ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
 * │   Host      │────▶│   Client    │────▶│   Server    │
 * │  (MiniAgent)│◀────│  (MCP SDK)  │◀────│  (工具提供者)│
 * └─────────────┘     └─────────────┘     └─────────────┘
 * 
 * 通信方式：
 * - JSON-RPC 2.0 协议
 * - stdio 传输（本地进程通信）
 * - SSE/HTTP 传输（远程服务器）
 * 
 * 核心能力：
 * 1. Tools: 远程工具调用
 * 2. Resources: 读取远程数据
 * 3. Prompts: 预定义的 Prompt 模板
 */

/**
 * MCP 服务器配置
 * 
 * 支持两种连接方式：
 * 1. stdio: 启动本地进程，通过 stdin/stdout 通信
 * 2. sse: 连接到远程 SSE 服务器
 */
export interface MCPServerConfig {
  /** 服务器名称（唯一标识） */
  name: string;
  /** 连接方式 */
  transport: 'stdio' | 'sse';
  
  // stdio 配置
  /** 启动命令 */
  command?: string;
  /** 命令行参数 */
  args?: string[];
  /** 环境变量 */
  env?: Record<string, string>;
  
  // sse 配置
  /** SSE 端点 URL */
  url?: string;
}

/**
 * MCP 工具定义（从服务器发现）
 */
export interface MCPToolDefinition {
  /** 工具名称 */
  name: string;
  /** 工具描述 */
  description: string;
  /** JSON Schema 参数 */
  inputSchema: {
    type: 'object';
    properties?: Record<string, unknown>;
    required?: string[];
  };
}

/**
 * MCP 资源定义
 */
export interface MCPResource {
  /** 资源 URI */
  uri: string;
  /** 资源名称 */
  name: string;
  /** 资源描述 */
  description?: string;
  /** MIME 类型 */
  mimeType?: string;
}

/**
 * MCP Prompt 模板
 */
export interface MCPPrompt {
  /** Prompt 名称 */
  name: string;
  /** Prompt 描述 */
  description?: string;
  /** 参数定义 */
  arguments?: Array<{
    name: string;
    description?: string;
    required?: boolean;
  }>;
}

/**
 * MCP 服务器信息
 */
export interface MCPServerInfo {
  /** 服务器名称 */
  name: string;
  /** 连接状态 */
  status: 'connecting' | 'connected' | 'disconnected' | 'error';
  /** 服务器能力 */
  capabilities: {
    tools?: boolean;
    resources?: boolean;
    prompts?: boolean;
  };
  /** 服务器信息 */
  serverInfo?: {
    name: string;
    version: string;
  };
  /** 错误信息 */
  error?: string;
}

/**
 * MCP 工具调用结果
 */
export interface MCPToolResult {
  /** 是否成功 */
  success: boolean;
  /** 返回内容 */
  content: Array<{
    type: 'text' | 'image';
    text?: string;
    data?: string;
    mimeType?: string;
  }>;
  /** 错误信息 */
  error?: string;
  /** 是否可重试 */
  isError?: boolean;
}

/**
 * MCP 资源内容
 */
export interface MCPResourceContent {
  /** 资源 URI */
  uri: string;
  /** 文本内容 */
  text?: string;
  /** Blob 数据 */
  blob?: string;
  /** MIME 类型 */
  mimeType?: string;
}

/**
 * JSON-RPC 请求
 */
export interface JsonRpcRequest {
  jsonrpc: '2.0';
  id: number | string;
  method: string;
  params?: Record<string, unknown>;
}

/**
 * JSON-RPC 响应
 */
export interface JsonRpcResponse {
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
 * JSON-RPC 通知（无 id）
 */
export interface JsonRpcNotification {
  jsonrpc: '2.0';
  id?: number | string;
  method?: string;
  params?: Record<string, unknown>;
}

/**
 * JSON-RPC 任意消息
 */
export type JsonRpcMessage = JsonRpcRequest | JsonRpcResponse | JsonRpcNotification;
