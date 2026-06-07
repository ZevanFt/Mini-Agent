import { logger } from '../utils/logger.js';
import { exec } from 'child_process';
import path from 'path';

export type RunStrategy = 'immediate' | 'delayed' | 'manual';

export interface RunConfig {
  command: string;
  args?: string[];
  cwd?: string;
  timeout?: number;
  strategy: RunStrategy;
  language: string;
}

export interface RunResult {
  success: boolean;
  output?: string;
  error?: string;
  exitCode?: number;
}

export class AutoRunner {
  private readonly languageRunners: Record<string, (filePath: string) => RunConfig> = {
    javascript: (filePath) => ({
      command: 'node',
      args: [filePath],
      strategy: 'immediate',
      language: 'javascript',
    }),
    typescript: (filePath) => ({
      command: 'npx',
      args: ['tsx', filePath],
      strategy: 'delayed',
      language: 'typescript',
    }),
    python: (filePath) => ({
      command: 'python',
      args: [filePath],
      strategy: 'immediate',
      language: 'python',
    }),
  };

  private readonly highRiskPatterns = [
    /rm\s+-rf/,
    /drop\s+table/i,
    /delete\s+from/i,
    /shutdown/i,
    /reboot/i,
  ];

  async runFile(filePath: string, language?: string): Promise<RunResult> {
    const ext = path.extname(filePath).slice(1);
    const detectedLanguage = language || this.detectLanguage(ext);

    const config = this.getRunConfig(filePath, detectedLanguage);
    if (!config) {
      return {
        success: false,
        error: `No runner available for language: ${detectedLanguage}`,
      };
    }

    if (config.strategy === 'manual') {
      return {
        success: false,
        error: 'This operation requires manual confirmation',
      };
    }

    logger.info(`Running ${filePath} with strategy: ${config.strategy}`);

    try {
      return await this.execute(config);
    } catch (error) {
      logger.error('Auto run failed', { error });
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async runCommand(command: string, args: string[] = [], cwd?: string): Promise<RunResult> {
    const fullCmd = [command, ...args].join(' ');
    const isHighRisk = this.highRiskPatterns.some(p => p.test(fullCmd));

    if (isHighRisk) {
      logger.warn('High-risk command detected', { command: fullCmd });
      return {
        success: false,
        error: 'High-risk commands require manual confirmation',
      };
    }

    logger.info('Executing command', { command: fullCmd, cwd });

    return new Promise((resolve) => {
      exec(fullCmd, { cwd }, (error, stdout, stderr) => {
        if (error) {
          resolve({
            success: false,
            error: stderr || error.message,
            exitCode: error.code,
          });
        } else {
          resolve({
            success: true,
            output: stdout,
            exitCode: 0,
          });
        }
      });
    });
  }

  private getRunConfig(filePath: string, language: string): RunConfig | null {
    const runner = this.languageRunners[language];
    if (runner) {
      const config = runner(filePath);
      config.cwd = path.dirname(filePath);
      return config;
    }

    return null;
  }

  private detectLanguage(ext: string): string {
    const map: Record<string, string> = {
      js: 'javascript',
      mjs: 'javascript',
      cjs: 'javascript',
      ts: 'typescript',
      tsx: 'typescript',
      py: 'python',
    };
    return map[ext] || 'unknown';
  }

  private async execute(config: RunConfig): Promise<RunResult> {
    const fullCmd = [config.command, ...(config.args || [])].join(' ');

    logger.info('Executing', { command: fullCmd, cwd: config.cwd });

    return new Promise((resolve) => {
      const timeout = config.timeout || 30000;

      exec(
        fullCmd,
        { cwd: config.cwd, timeout },
        (error, stdout, stderr) => {
          if (error) {
            resolve({
              success: false,
              error: stderr || error.message,
              exitCode: error.code,
            });
          } else {
            resolve({
              success: true,
              output: stdout,
              exitCode: 0,
            });
          }
        }
      );
    });
  }
}
