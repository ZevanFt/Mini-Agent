import { logger } from '@/utils/logger';

interface PostProcessResult {
  success: boolean;
  code: string;
}

interface BraceBalance {
  open: number;
  close: number;
  diff: number;
}

interface ImportInfo {
  line: string;
  startIndex: number;
  endIndex: number;
}

export class PostProcessor {
  process(code: string, language: string): PostProcessResult {
    if (!code || typeof code !== 'string') {
      logger.warn('[PostProcessor] Invalid input code, returning original');
      return { success: false, code: '' };
    }
    logger.info(`[PostProcessor] Starting post-processing, language=${language}, length=${code.length}`);

    let result = code;

    try {
      result = this.fixBraces(result, language);
      result = this.fixSyntax(result, language);
      result = this.normalizeIndentation(result, language);
      result = this.fixImports(result, language);
      const emptyFuncs = this.detectEmptyFunctions(result, language);

      if (emptyFuncs.length > 0) {
        logger.warn(`[PostProcessor] ${emptyFuncs.length} empty function(s) detected`);
      }

      logger.info(`[PostProcessor] Post-processing completed, final length=${result.length}`);

      return { success: true, code: result };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error(`[PostProcessor] Post-processing failed: ${message}`);
      return { success: false, code };
    }
  }

  private fixBraces(code: string, language: string): string {
    const isBraceLanguage = ['typescript', 'javascript', 'java', 'c', 'cpp', 'csharp', 'go', 'rust', 'php', 'swift', 'kotlin'];

    if (!isBraceLanguage.includes(language.toLowerCase())) {
      return code;
    }

    logger.info(`[PostProcessor] Checking brace balance for ${language}`);

    const braces = this.countBraces(code);
    logger.info(`[PostProcessor] Brace counts: open=${braces.open}, close=${braces.close}`);

    if (braces.diff === 0) {
      logger.info(`[PostProcessor] Braces already balanced`);
      return code;
    }

    let fixed = code;
    const lines = code.split('\n');

    if (braces.diff > 0) {
      logger.info(`[PostProcessor] Adding ${braces.diff} closing brace(s)`);
      const lastNonEmptyLineIndex = lines.length - 1;
      lines.splice(lastNonEmptyLineIndex, 0, ...Array(braces.diff).fill('}'));
      fixed = lines.join('\n');
    } else if (braces.diff < 0) {
      logger.info(`[PostProcessor] Removing ${Math.abs(braces.diff)} extra closing brace(s)`);
      const linesToRemove = Math.abs(braces.diff);
      let removed = 0;
      fixed = lines.filter((line) => {
        if (removed < linesToRemove && line.trim() === '}') {
          removed++;
          return false;
        }
        return true;
      }).join('\n');
    }

    const afterFix = this.countBraces(fixed);
    if (afterFix.diff !== 0) {
      logger.warn(`[PostProcessor] Brace balance could not be fully fixed, remaining diff=${afterFix.diff}`);
    }

    return fixed;
  }

  private countBraces(code: string): BraceBalance {
    let open = 0;
    let close = 0;
    let inString = false;
    let stringChar = '';
    let escaped = false;

    for (let i = 0; i < code.length; i++) {
      const char = code[i];

      if (escaped) {
        escaped = false;
        continue;
      }

      if (char === '\\') {
        escaped = true;
        continue;
      }

      if (inString) {
        if (char === stringChar) {
          inString = false;
        }
        continue;
      }

      if (char === '"' || char === "'" || char === '`') {
        inString = true;
        stringChar = char;
        continue;
      }

      if (char === '/') {
        const nextChar = code[i + 1];
        if (nextChar === '/') {
          while (i < code.length && code[i] !== '\n') i++;
          continue;
        }
        if (nextChar === '*') {
          while (i < code.length - 1 && !(code[i] === '*' && code[i + 1] === '/')) i++;
          continue;
        }
      }

      if (char === '{') open++;
      if (char === '}') close++;
    }

    return { open, close, diff: open - close };
  }

  private fixSyntax(code: string, language: string): string {
    logger.info(`[PostProcessor] Running syntax fixes for ${language}`);

    let result = code;

    result = this.fixUnclosedStrings(result, language);
    result = this.fixMissingSemicolons(result, language);
    result = this.fixTrailingCommas(result, language);
    result = this.fixParentheses(result, language);

    return result;
  }

  private fixUnclosedStrings(code: string, _language: string): string {
    const lines = code.split('\n');
    let fixed = false;

    const fixedLines = lines.map((line) => {
      if (line.trim().startsWith('//') || line.trim().startsWith('#') || line.trim().startsWith('/*')) {
        return line;
      }

      let inSingleQuote = false;
      let inDoubleQuote = false;
      let inBacktick = false;
      let escaped = false;

      for (let i = 0; i < line.length; i++) {
        const char = line[i];

        if (escaped) {
          escaped = false;
          continue;
        }

        if (char === '\\') {
          escaped = true;
          continue;
        }

        if (char === "'" && !inDoubleQuote && !inBacktick) {
          inSingleQuote = !inSingleQuote;
        } else if (char === '"' && !inSingleQuote && !inBacktick) {
          inDoubleQuote = !inDoubleQuote;
        } else if (char === '`' && !inSingleQuote && !inDoubleQuote) {
          inBacktick = !inBacktick;
        }
      }

      if (inSingleQuote || inDoubleQuote || inBacktick) {
        const closingChar = inSingleQuote ? "'" : inDoubleQuote ? '"' : '`';
        logger.info(`[PostProcessor] Fixed unclosed string on line`);
        fixed = true;
        return line + closingChar;
      }

      return line;
    });

    if (!fixed) {
      return code;
    }

    return fixedLines.join('\n');
  }

  private fixMissingSemicolons(code: string, language: string): string {
    const isSemiColonLanguage = ['typescript', 'javascript', 'java', 'c', 'cpp', 'csharp', 'go', 'php', 'swift', 'kotlin'];

    if (!isSemiColonLanguage.includes(language.toLowerCase())) {
      return code;
    }

    logger.info(`[PostProcessor] Fixing missing semicolons for ${language}`);

    const lines = code.split('\n');
    let added = 0;

    const fixedLines = lines.map((line) => {
      const trimmed = line.trim();

      if (
        trimmed === '' ||
        trimmed.startsWith('//') ||
        trimmed.startsWith('/*') ||
        trimmed.startsWith('*') ||
        trimmed.startsWith('#') ||
        trimmed.startsWith('import ') ||
        trimmed.startsWith('export ') ||
        trimmed.startsWith('function') ||
        trimmed.startsWith('class ') ||
        trimmed.startsWith('interface ') ||
        trimmed.startsWith('type ') ||
        trimmed.startsWith('enum ') ||
        trimmed.startsWith('namespace ') ||
        trimmed.startsWith('module ') ||
        trimmed.endsWith('{') ||
        trimmed.endsWith('}') ||
        trimmed.endsWith(';') ||
        trimmed.endsWith(',') ||
        trimmed.endsWith('(') ||
        trimmed.endsWith(')') ||
        trimmed.endsWith('+') ||
        trimmed.endsWith('-') ||
        trimmed.endsWith('*') ||
        trimmed.endsWith('/') ||
        trimmed.endsWith('=') ||
        trimmed.endsWith(':') ||
        trimmed.startsWith('@') ||
        trimmed === 'try' ||
        trimmed === 'catch' ||
        trimmed === 'finally' ||
        trimmed === 'do' ||
        trimmed === 'else' ||
        trimmed.startsWith('if ') ||
        trimmed.startsWith('for ') ||
        trimmed.startsWith('while ') ||
        trimmed.startsWith('switch ') ||
        trimmed.startsWith('case ') ||
        trimmed.startsWith('default:') ||
        trimmed.endsWith('*/')
      ) {
        return line;
      }

      if (
        trimmed.endsWith('"') ||
        trimmed.endsWith("'") ||
        trimmed.endsWith('`') ||
        trimmed.endsWith(')') ||
        trimmed.endsWith(']') ||
        trimmed.endsWith('++') ||
        trimmed.endsWith('--') ||
        /^[a-zA-Z_$]/.test(trimmed)
      ) {
        if (
          trimmed.includes('=') ||
          trimmed.includes('return ') ||
          trimmed.includes('throw ') ||
          trimmed.includes('break') ||
          trimmed.includes('continue') ||
          trimmed.includes('let ') ||
          trimmed.includes('const ') ||
          trimmed.includes('var ')
        ) {
          logger.info(`[PostProcessor] Added semicolon to line: ${trimmed.substring(0, 50)}...`);
          added++;
          return line + ';';
        }
      }

      return line;
    });

    if (added > 0) {
      logger.info(`[PostProcessor] Added ${added} semicolon(s)`);
    }

    return fixedLines.join('\n');
  }

  private fixTrailingCommas(code: string, _language: string): string {
    logger.info(`[PostProcessor] Fixing trailing commas`);

    const lines = code.split('\n');
    let removed = 0;

    const fixedLines = lines.map((line, index) => {
      const trimmed = line.trim();

      if (trimmed.endsWith(',}') || trimmed.endsWith(',]')) {
        return line;
      }

      if (trimmed === ',') {
        const nextLine = lines[index + 1]?.trim() ?? '';
        if (nextLine === '}' || nextLine === ']') {
          logger.info(`[PostProcessor] Removed trailing comma before closing brace/bracket`);
          removed++;
          return '';
        }
      }

      return line;
    });

    if (removed > 0) {
      logger.info(`[PostProcessor] Removed ${removed} trailing comma(s)`);
    }

    return fixedLines.filter((l) => l !== '' || true).join('\n');
  }

  private fixParentheses(code: string, language: string): string {
    const isParenLanguage = ['typescript', 'javascript', 'java', 'c', 'cpp', 'csharp', 'go', 'rust', 'php', 'swift', 'kotlin', 'python'];

    if (!isParenLanguage.includes(language.toLowerCase())) {
      return code;
    }

    logger.info(`[PostProcessor] Checking parentheses balance for ${language}`);

    const balance = this.countParentheses(code);

    if (balance === 0) {
      logger.info(`[PostProcessor] Parentheses already balanced`);
      return code;
    }

    let fixed = code;

    if (balance > 0) {
      logger.info(`[PostProcessor] Adding ${balance} closing paren(s)`);
      const lastCloseBraceIndex = fixed.lastIndexOf('}');
      if (lastCloseBraceIndex !== -1) {
        fixed = fixed.substring(0, lastCloseBraceIndex) + ')'.repeat(balance) + fixed.substring(lastCloseBraceIndex);
      } else {
        fixed += ')'.repeat(balance);
      }
    } else {
      logger.info(`[PostProcessor] Removing ${Math.abs(balance)} extra closing paren(s) - skipping to avoid breaking syntax`);
    }

    return fixed;
  }

  private countParentheses(code: string): number {
    let open = 0;
    let close = 0;
    let inString = false;
    let stringChar = '';
    let escaped = false;

    for (let i = 0; i < code.length; i++) {
      const char = code[i];

      if (escaped) {
        escaped = false;
        continue;
      }

      if (char === '\\') {
        escaped = true;
        continue;
      }

      if (inString) {
        if (char === stringChar) {
          inString = false;
        }
        continue;
      }

      if (char === '"' || char === "'" || char === '`') {
        inString = true;
        stringChar = char;
        continue;
      }

      if (char === '(') open++;
      if (char === ')') close++;
    }

    return open - close;
  }

  private normalizeIndentation(code: string, language: string): string {
    logger.info(`[PostProcessor] Normalizing indentation for ${language}`);

    const lines = code.split('\n');
    const hasTabs = lines.some((line) => line.includes('\t'));

    if (!hasTabs) {
      logger.info(`[PostProcessor] No tabs found, indentation already normalized`);
      return code;
    }

    logger.info(`[PostProcessor] Converting tabs to spaces`);

    const spacesPerTab = language.toLowerCase() === 'python' ? 4 : 2;

    return lines.map((line) => {
      const leadingTabs = line.match(/^\t+/)?.[0] ?? '';
      if (leadingTabs.length === 0) {
        return line;
      }

      const tabCount = leadingTabs.length;
      const replacement = ' '.repeat(tabCount * spacesPerTab);
      return line.replace(/^\t+/, replacement);
    }).join('\n');
  }

  private detectEmptyFunctions(code: string, language: string): string[] {
    logger.info(`[PostProcessor] Detecting empty functions in ${language}`);

    const emptyFunctions: string[] = [];

    if (language.toLowerCase() === 'python') {
      const pythonEmptyPatterns = [
        /^(\s*)def\s+(\w+)\s*\([^)]*\)\s*:\s*pass\s*$/gm,
        /^(\s*)def\s+(\w+)\s*\([^)]*\)\s*:\s*\.\.\.\s*$/gm,
      ];

      for (const pattern of pythonEmptyPatterns) {
        let match = pattern.exec(code);
        while (match !== null) {
          const funcName = match[2];
          emptyFunctions.push(funcName);
          match = pattern.exec(code);
        }
      }
    } else if (['typescript', 'javascript', 'java', 'c', 'cpp', 'csharp', 'go', 'rust', 'php', 'swift', 'kotlin'].includes(language.toLowerCase())) {
      const braceEmptyPatterns = [
        /function\s+(\w+)\s*\([^)]*\)\s*\{\s*\}/g,
        /(\w+)\s*\([^)]*\)\s*\{\s*\}/g,
        /const\s+(\w+)\s*=\s*\([^)]*\)\s*=>\s*\{\s*\}/g,
        /const\s+(\w+)\s*=\s*\([^)]*\)\s*=>\s*\(\s*\)/g,
      ];

      for (const pattern of braceEmptyPatterns) {
        let match = pattern.exec(code);
        while (match !== null) {
          const funcName = match[1];
          if (funcName && funcName !== 'if' && funcName !== 'for' && funcName !== 'while' && funcName !== 'switch') {
            emptyFunctions.push(funcName);
          }
          match = pattern.exec(code);
        }
      }
    }

    if (emptyFunctions.length > 0) {
      logger.warn(`[PostProcessor] Empty functions found: ${emptyFunctions.join(', ')}`);
    } else {
      logger.info(`[PostProcessor] No empty functions detected`);
    }

    return emptyFunctions;
  }

  private fixImports(code: string, _language: string): string {
    logger.info(`[PostProcessor] Checking imports`);

    const lines = code.split('\n');
    const imports: ImportInfo[] = [];

    lines.forEach((line, index) => {
      const trimmed = line.trim();
      if (trimmed.startsWith('import ') || trimmed.startsWith('from ') || trimmed.startsWith('require(')) {
        imports.push({
          line: trimmed,
          startIndex: 0,
          endIndex: index,
        });
      }
    });

    if (imports.length === 0) {
      logger.info(`[PostProcessor] No imports found`);
      return code;
    }

    const uniqueImports = new Set<string>();
    const duplicates: string[] = [];

    for (const imp of imports) {
      if (uniqueImports.has(imp.line)) {
        duplicates.push(imp.line);
      } else {
        uniqueImports.add(imp.line);
      }
    }

    if (duplicates.length > 0) {
      logger.info(`[PostProcessor] Removing ${duplicates.length} duplicate import(s)`);
      const importCounts: Record<string, number> = {};

      const deduplicatedLines = lines.filter((line) => {
        const trimmed = line.trim();
        if (trimmed.startsWith('import ') || trimmed.startsWith('from ') || trimmed.startsWith('require(')) {
          importCounts[trimmed] = (importCounts[trimmed] ?? 0) + 1;
          if (importCounts[trimmed] > 1) {
            return false;
          }
        }
        return true;
      });

      return deduplicatedLines.join('\n');
    }

    logger.info(`[PostProcessor] Imports are clean`);
    return code;
  }
}
