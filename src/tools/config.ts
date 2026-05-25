/**
 * ConfigTool - 配置管理工具
 * 
 * 学习笔记：
 * ConfigTool 允许 Agent 查看和修改自身的配置。
 * 
 * 配置范围：
 * - model: 当前使用的模型
 * - temperature: 温度参数
 * - maxTokens: 最大 token 数
 * - maxIterations: 最大迭代次数
 * - verbose: 是否显示调试信息
 * 
 * Claude Code 中 config 命令用于管理行为设置。
 */

import type { Tool, ToolResult } from '../tools/types.js';

interface ConfigData {
  model: string;
  temperature: number;
  maxTokens: number;
  maxIterations: number;
  verbose: boolean;
  cwd: string;
  [key: string]: unknown;
}

let globalConfig: ConfigData = {
  model: 'qwen2:1.5b',
  temperature: 0.7,
  maxTokens: 4096,
  maxIterations: 20,
  verbose: false,
  cwd: process.cwd(),
};

export const ConfigTool: Tool = {
  name: 'config',
  description: `Get or set MiniAgent configuration.

Use this when:
- You need to check the current configuration
- You need to change model, temperature, or other settings
- You want to enable/disable verbose mode
- You need to adjust max tokens or iterations

Available config keys:
- model: Current model name
- temperature: Temperature (0.0-1.0)
- max_tokens: Maximum tokens per response
- max_iterations: Maximum tool-call iterations
- verbose: Debug mode (true/false)
- cwd: Working directory`,

  parameters: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        enum: ['get', 'set', 'list', 'reset'],
        description: 'Configuration action to perform',
      },
      key: {
        type: 'string',
        description: 'Configuration key (for get/set actions)',
      },
      value: {
        type: 'string',
        description: 'Configuration value (for set action)',
      },
    },
    required: ['action'],
  },

  async execute(params: Record<string, unknown>): Promise<ToolResult> {
    const { action, key, value } = params as {
      action: 'get' | 'set' | 'list' | 'reset';
      key?: string;
      value?: string;
    };

    try {
      switch (action) {
        case 'get':
          return handleGet(key);

        case 'set':
          return handleSet(key, value);

        case 'list':
          return handleList();

        case 'reset':
          return handleReset(key);

        default:
          return {
            success: false,
            content: `Unknown action: ${action}. Use get, set, list, or reset.`,
          };
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        content: `Config error: ${message}`,
        error: message,
      };
    }
  },
};

function handleGet(key?: string): ToolResult {
  if (!key) {
    return {
      success: false,
      content: 'Missing key. Usage: config get <key>',
    };
  }

  if (!(key in globalConfig)) {
    return {
      success: false,
      content: `Unknown config key: ${key}\nAvailable keys: ${Object.keys(globalConfig).join(', ')}`,
    };
  }

  return {
    success: true,
    content: `${key} = ${JSON.stringify(globalConfig[key])}`,
  };
}

function handleSet(key?: string, value?: string): ToolResult {
  if (!key) {
    return {
      success: false,
      content: 'Missing key. Usage: config set <key> <value>',
    };
  }

  if (value === undefined) {
    return {
      success: false,
      content: 'Missing value. Usage: config set <key> <value>',
    };
  }

  if (!(key in globalConfig)) {
    return {
      success: false,
      content: `Unknown config key: ${key}\nAvailable keys: ${Object.keys(globalConfig).join(', ')}`,
    };
  }

  // 类型转换
  const currentValue = globalConfig[key];
  if (typeof currentValue === 'number') {
    globalConfig[key] = Number(value) as never;
  } else if (typeof currentValue === 'boolean') {
    globalConfig[key] = (value === 'true') as never;
  } else {
    globalConfig[key] = value as never;
  }

  return {
    success: true,
    content: `Set ${key} = ${JSON.stringify(globalConfig[key])}`,
  };
}

function handleList(): ToolResult {
  const lines = Object.entries(globalConfig).map(([key, value]) => 
    `${key}: ${JSON.stringify(value)}`
  );

  return {
    success: true,
    content: `Configuration:\n${lines.join('\n')}`,
  };
}

function handleReset(key?: string): ToolResult {
  const defaults: ConfigData = {
    model: 'qwen2:1.5b',
    temperature: 0.7,
    maxTokens: 4096,
    maxIterations: 20,
    verbose: false,
    cwd: process.cwd(),
  };

  if (key) {
    if (!(key in defaults)) {
      return {
        success: false,
        content: `Unknown config key: ${key}`,
      };
    }
    globalConfig[key] = defaults[key] as never;
    return {
      success: true,
      content: `Reset ${key} to default: ${JSON.stringify(defaults[key])}`,
    };
  }

  // 重置所有配置
  globalConfig = { ...defaults };
  return {
    success: true,
    content: 'All configuration reset to defaults.',
  };
}
