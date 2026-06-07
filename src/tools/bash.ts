import type { Tool } from '../tools/types.js';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

interface BashToolParams {
  command: string;
  cwd?: string;
  timeout?: number;
}

export const BashTool: Tool = {
  name: 'bash',
  description: `Execute a bash command in the shell.
Use this when you need to run shell commands, scripts, or programs.
The command will be executed in the current working directory.
Always use absolute paths for file operations.`,
  parameters: {
    type: 'object',
    properties: {
      command: {
        type: 'string',
        description: 'The bash command to execute',
      },
      cwd: {
        type: 'string',
        description: 'Working directory for command execution (optional)',
      },
      timeout: {
        type: 'number',
        description: 'Timeout in seconds (default: 30)',
        default: 30,
      },
    },
    required: ['command'],
  },

  async execute(params: Record<string, unknown>) {
    const { command, cwd, timeout = 30 } = params as unknown as BashToolParams;
    const workingDir = cwd || process.cwd();
    const timeoutMs = timeout * 1000;

    try {
      const { stdout, stderr } = await execAsync(command, {
        cwd: workingDir,
        timeout: timeoutMs,
        maxBuffer: 1024 * 1024 * 5,
      });

      const hasOutput = stdout || stderr;
      return {
        success: true,
        content: hasOutput
          ? `stdout:\n${stdout}\n${stderr ? `stderr:\n${stderr}` : ''}`.trim()
          : '(Command executed successfully with no output)',
      };
    } catch (error: unknown) {
      if (error instanceof Error) {
        return {
          success: false,
          content: `Error: ${error.message}`,
          error: error.message,
        };
      }
      return {
        success: false,
        content: 'Unknown error occurred',
        error: 'Unknown error',
      };
    }
  },
};
