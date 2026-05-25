export interface Tool {
  name: string;
  description: string;
  parameters: ToolParameters;
  execute: (params: Record<string, unknown>) => Promise<ToolResult>;
}

export interface ToolParameters {
  type: 'object';
  properties: Record<string, ToolProperty>;
  required?: string[];
}

export interface ToolProperty {
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  description?: string;
  default?: unknown;
  enum?: unknown[];
  items?: ToolProperty;
  properties?: Record<string, ToolProperty>;
  required?: string[];
}

export interface ToolResult {
  success: boolean;
  content?: string;
  error?: string;
  metadata?: Record<string, unknown>;
}

export interface ToolCall {
  name: string;
  arguments: Record<string, unknown>;
}

export interface ToolDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: ToolParameters;
  };
}
