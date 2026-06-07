import { logger } from '../utils/logger.js';

export interface InjectionConfig {
  includeFunctionEntry?: boolean;
  includeParameters?: boolean;
  includeReturnValue?: boolean;
  includeExceptionHandling?: boolean;
  logLevel?: 'debug' | 'info' | 'warn' | 'error';
}

export class LogInjector {
  private readonly defaultConfig: Required<InjectionConfig> = {
    includeFunctionEntry: true,
    includeParameters: true,
    includeReturnValue: true,
    includeExceptionHandling: true,
    logLevel: 'debug',
  };

  inject(code: string, language: string, config: InjectionConfig = {}): string {
    const fullConfig = { ...this.defaultConfig, ...config };

    switch (language.toLowerCase()) {
      case 'typescript':
      case 'javascript':
        return this.injectJavaScript(code, fullConfig);
      case 'python':
        return this.injectPython(code, fullConfig);
      default:
        logger.warn(`No log injector for language: ${language}`);
        return code;
    }
  }

  private injectJavaScript(code: string, config: Required<InjectionConfig>): string {
    let result = code;

    const functionRegex = /(async\s+)?(function\s+\w+|const\s+\w+\s*=\s*(async\s+)?\()/g;
    let match: RegExpExecArray | null;

    while ((match = functionRegex.exec(code)) !== null) {
      const startIndex = match.index;
      const funcStart = code.indexOf('{', startIndex);

      if (funcStart === -1) continue;

      const funcNameMatch = code.slice(startIndex).match(/(function\s+|const\s+|let\s+|var\s+)?(\w+)/);
      const funcName = funcNameMatch ? funcNameMatch[2] : 'anonymous';

      const injection = `
    logger.${config.logLevel}('Entering ${funcName}');
`;

      result = result.slice(0, funcStart + 1) + injection + result.slice(funcStart + 1);
    }

    return result;
  }

  private injectPython(code: string, _config: Required<InjectionConfig>): string {
    let funcName = 'anonymous';
    const lines = code.split('\n');
    const injectedLines: string[] = [];

    let inFunction = false;
    let functionIndent = 0;

    for (const line of lines) {
      injectedLines.push(line);

      const funcMatch = line.match(/^(async\s+)?def\s+(\w+)/);
      if (funcMatch) {
        funcName = funcMatch[2];
        inFunction = true;
        functionIndent = line.search(/\S/);
        continue;
      }

      if (inFunction && line.trim() !== '') {
        const currentIndent = line.search(/\S/);
        if (currentIndent > functionIndent) {
          injectedLines.push(
            ' '.repeat(functionIndent + 4) +
            `logger.debug('Entering ${funcName}')`
          );
          inFunction = false;
        }
      }
    }

    return injectedLines.join('\n');
  }
}
