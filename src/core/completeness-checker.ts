export interface CheckResult {
  passed: boolean;
  message: string;
  suggestions?: string[];
  severity: 'error' | 'warning' | 'info';
}

export interface CompletenessReport {
  overall: boolean;
  results: CheckResult[];
  summary: {
    total: number;
    passed: number;
    failed: number;
    warnings: number;
  };
}

export class CompletenessChecker {
  async checkCode(code: string, language: string): Promise<CompletenessReport> {
    const results: CheckResult[] = [];

    results.push(...this.checkSyntax(code, language));
    results.push(...this.checkImports(code, language));
    results.push(...this.checkStructure(code, language));
    results.push(...this.checkSecurity(code, language));
    results.push(...this.checkCompleteness(code, language));

    const passed = results.filter(r => r.passed && r.severity === 'info').length;
    const failed = results.filter(r => !r.passed).length;
    const warnings = results.filter(r => r.passed && r.severity === 'warning').length;

    return {
      overall: failed === 0,
      results,
      summary: {
        total: results.length,
        passed,
        failed,
        warnings,
      },
    };
  }

  private checkSyntax(code: string, language: string): CheckResult[] {
    const results: CheckResult[] = [];

    if (language === 'typescript' || language === 'javascript') {
      const openBraces = (code.match(/{/g) || []).length;
      const closeBraces = (code.match(/}/g) || []).length;
      const openParens = (code.match(/\(/g) || []).length;
      const closeParens = (code.match(/\)/g) || []).length;

      if (openBraces !== closeBraces) {
        results.push({
          passed: false,
          message: 'Brace mismatch detected',
          suggestions: ['Check for missing or extra braces {}'],
          severity: 'error',
        });
      } else {
        results.push({
          passed: true,
          message: 'Braces balanced',
          severity: 'info',
        });
      }

      if (openParens !== closeParens) {
        results.push({
          passed: false,
          message: 'Parenthesis mismatch detected',
          suggestions: ['Check for missing or extra parentheses ()'],
          severity: 'error',
        });
      } else {
        results.push({
          passed: true,
          message: 'Parentheses balanced',
          severity: 'info',
        });
      }
    }

    if (language === 'python') {
      const hasConsistentIndent = this.checkPythonIndent(code);
      if (!hasConsistentIndent) {
        results.push({
          passed: false,
          message: 'Inconsistent indentation detected',
          suggestions: ['Ensure consistent 4-space indentation'],
          severity: 'error',
        });
      } else {
        results.push({
          passed: true,
          message: 'Indentation consistent',
          severity: 'info',
        });
      }
    }

    return results;
  }

  private checkImports(code: string, language: string): CheckResult[] {
    const results: CheckResult[] = [];

    if (language === 'typescript' || language === 'javascript') {
      const importLines = code.match(/^import\s+.*?from\s+['"][^'"]+['"]\s*;?$/gm) || [];
      if (importLines.length === 0 && (code.includes('import') || code.includes('require'))) {
        results.push({
          passed: false,
          message: 'Import statements found but not properly formatted',
          suggestions: ['Use standard ES6 import syntax'],
          severity: 'warning',
        });
      } else {
        results.push({
          passed: true,
          message: `${importLines.length} import statements found`,
          severity: 'info',
        });
      }
    }

    if (language === 'python') {
      const importLines = code.match(/^(import|from)\s+\S+/gm) || [];
      if (importLines.length === 0 && code.includes('import')) {
        results.push({
          passed: false,
          message: 'Import statements found but not at module level',
          suggestions: ['Move imports to the top of the file'],
          severity: 'warning',
        });
      } else {
        results.push({
          passed: true,
          message: `${importLines.length} import statements found`,
          severity: 'info',
        });
      }
    }

    return results;
  }

  private checkStructure(code: string, language: string): CheckResult[] {
    const results: CheckResult[] = [];

    if (language === 'typescript' || language === 'javascript') {
      const hasExport = code.includes('export ') || code.includes('module.exports');
      if (!hasExport) {
        results.push({
          passed: false,
          message: 'No export statement found',
          suggestions: ['Add export statement to make module usable'],
          severity: 'warning',
        });
      } else {
        results.push({
          passed: true,
          message: 'Module has exports',
          severity: 'info',
        });
      }
    }

    if (language === 'python') {
      const hasMain = code.includes("if __name__ == '__main__':") ||
                      code.includes('if __name__ == "__main__":');
      if (!hasMain && code.includes('def main')) {
        results.push({
          passed: false,
          message: 'Main function defined but not called',
          suggestions: ["Add 'if __name__ == \"__main__\": main()' block"],
          severity: 'warning',
        });
      } else {
        results.push({
          passed: true,
          message: 'Entry point properly defined',
          severity: 'info',
        });
      }
    }

    return results;
  }

  private checkSecurity(code: string, language: string): CheckResult[] {
    const results: CheckResult[] = [];

    const hardcodedPasswords = [
      /password\s*=\s*['"][^'"]+['"]/gi,
      /API_KEY\s*=\s*['"][^'"]+['"]/gi,
      /SECRET\s*=\s*['"][^'"]+['"]/gi,
    ];

    for (const pattern of hardcodedPasswords) {
      if (pattern.test(code)) {
        results.push({
          passed: false,
          message: 'Potential hardcoded secret detected',
          suggestions: ['Use environment variables or config files for secrets'],
          severity: 'error',
        });
        break;
      }
    }

    if (results.length === 0 || results[results.length - 1].passed) {
      results.push({
        passed: true,
        message: 'No hardcoded secrets detected',
        severity: 'info',
      });
    }

    if (language === 'javascript' || language === 'typescript') {
      if (code.includes('eval(')) {
        results.push({
          passed: false,
          message: 'eval() usage detected',
          suggestions: ['Avoid eval() for security reasons'],
          severity: 'error',
        });
      } else {
        results.push({
          passed: true,
          message: 'No eval() usage',
          severity: 'info',
        });
      }
    }

    return results;
  }

  private checkCompleteness(code: string, _language: string): CheckResult[] {
    const results: CheckResult[] = [];

    const todoMatches = code.match(/TODO[:\s].*/gi) || [];
    const fixmeMatches = code.match(/FIXME[:\s].*/gi) || [];
    const hackMatches = code.match(/HACK[:\s].*/gi) || [];

    if (todoMatches.length > 0) {
      results.push({
        passed: false,
        message: `${todoMatches.length} TODO(s) found`,
        suggestions: todoMatches.slice(0, 3).map(m => m.trim()),
        severity: 'warning',
      });
    } else {
      results.push({
        passed: true,
        message: 'No TODOs found',
        severity: 'info',
      });
    }

    if (fixmeMatches.length > 0 || hackMatches.length > 0) {
      results.push({
        passed: false,
        message: `${fixmeMatches.length + hackMatches.length} FIXME/HACK(s) found`,
        suggestions: ['Review and address these issues'],
        severity: 'error',
      });
    }

    return results;
  }

  private checkPythonIndent(code: string): boolean {
    const lines = code.split('\n');

    for (const line of lines) {
      if (line.trim() === '' || line.trim().startsWith('#')) continue;

      const indent = line.search(/\S/);
      if (indent % 4 !== 0) {
        return false;
      }
    }

    return true;
  }
}
