import type { Tool, ToolResult } from '../tools/types.js';
import { exec } from 'child_process';
import { promisify } from 'util';
import { existsSync } from 'fs';
import path from 'path';

const execAsync = promisify(exec);

interface FormatToolParams {
  paths?: string[];
  formatter?: 'prettier' | 'eslint' | 'stylelint' | 'auto';
  write?: boolean;
}

interface FormatterConfig {
  name: string;
  checkFile: string;
  command: (paths: string[], write: boolean) => string;
  supportedExtensions: string[];
}

const FORMATTERS: FormatterConfig[] = [
  {
    name: 'prettier',
    checkFile: '.prettierrc',
    command: (paths: string[], write: boolean) => 
      `npx prettier ${write ? '--write' : '--check'} ${paths.join(' ')}`,
    supportedExtensions: ['.js', '.jsx', '.ts', '.tsx', '.json', '.css', '.scss', '.less', '.html', '.vue', '.yaml', '.yml', '.md'],
  },
  {
    name: 'eslint',
    checkFile: '.eslintrc',
    command: (paths: string[], write: boolean) => 
      `npx eslint ${write ? '--fix' : ''} ${paths.join(' ')}`,
    supportedExtensions: ['.js', '.jsx', '.ts', '.tsx'],
  },
  {
    name: 'stylelint',
    checkFile: '.stylelintrc',
    command: (paths: string[], write: boolean) => 
      `npx stylelint ${write ? '--fix' : ''} ${paths.join(' ')}`,
    supportedExtensions: ['.css', '.scss', '.less'],
  },
];

async function detectFormatters(cwd: string): Promise<FormatterConfig[]> {
  const available: FormatterConfig[] = [];
  for (const formatter of FORMATTERS) {
    if (existsSync(path.join(cwd, formatter.checkFile)) || 
        existsSync(path.join(cwd, `${formatter.checkFile}.js`)) || 
        existsSync(path.join(cwd, `${formatter.checkFile}.json`)) || 
        existsSync(path.join(cwd, `${formatter.checkFile}.yaml`)) || 
        existsSync(path.join(cwd, `${formatter.checkFile}.yml`))) {
      available.push(formatter);
    }
  }
  return available;
}

function getFormatterByName(name: string): FormatterConfig | undefined {
  return FORMATTERS.find(f => f.name === name);
}

function matchFormatterToPath(formatter: FormatterConfig, filePath: string): boolean {
  const ext = path.extname(filePath).toLowerCase();
  return formatter.supportedExtensions.includes(ext);
}

export const FormatTool: Tool = {
  name: 'format',
  description: `Format files using Prettier, ESLint, or Stylelint.
Auto-detects available formatters based on config files.
Can format specific files or directories.`,

  parameters: {
    type: 'object',
    properties: {
      paths: {
        type: 'array',
        description: 'Paths to files or directories to format (default: current directory)',
        items: { type: 'string' },
      },
      formatter: {
        type: 'string',
        description: 'Specific formatter to use (prettier/eslint/stylelint/auto, default: auto)',
        enum: ['prettier', 'eslint', 'stylelint', 'auto'],
        default: 'auto',
      },
      write: {
        type: 'boolean',
        description: 'Write changes to files (default: true)',
        default: true,
      },
    },
  },

  async execute(params: Record<string, unknown>): Promise<ToolResult> {
    const { paths = ['.'], formatter = 'auto', write = true } = params as FormatToolParams;
    const cwd = process.cwd();
    
    try {
      let formattersToUse: FormatterConfig[];
      
      if (formatter === 'auto') {
        formattersToUse = await detectFormatters(cwd);
        if (formattersToUse.length === 0) {
          return {
            success: false,
            content: 'No formatters detected. Please create a .prettierrc, .eslintrc, or .stylelintrc file.',
            error: 'NO_FORMATTERS_DETECTED',
          };
        }
      } else {
        const selectedFormatter = getFormatterByName(formatter);
        if (!selectedFormatter) {
          return {
            success: false,
            content: `Unknown formatter: ${formatter}`,
            error: 'UNKNOWN_FORMATTER',
          };
        }
        formattersToUse = [selectedFormatter];
      }

      const results: string[] = [];
      
      for (const fmt of formattersToUse) {
        const relevantPaths = paths.filter(p => {
          if (p === '.' || p === './' || p === '') return true;
          return matchFormatterToPath(fmt, p);
        });
        
        if (relevantPaths.length === 0) continue;
        
        try {
          const command = fmt.command(relevantPaths, write);
          const { stdout, stderr } = await execAsync(command, {
            cwd,
            maxBuffer: 1024 * 1024 * 5,
          });
          
          results.push(`✅ ${fmt.name}:\n${stdout}${stderr ? `\n${stderr}` : ''}`);
        } catch (error: unknown) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          results.push(`❌ ${fmt.name} failed: ${errorMsg}`);
        }
      }

      return {
        success: true,
        content: `Formatting complete (${formattersToUse.map(f => f.name).join(', ')}):\n\n${results.join('\n')}`,
        metadata: {
          formatters: formattersToUse.map(f => f.name),
          paths,
          write,
        },
      };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        content: `Error formatting files: ${message}`,
        error: message,
      };
    }
  },
};
