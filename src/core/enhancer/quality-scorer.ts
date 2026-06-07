import { logger } from '../../utils/logger.js';

export interface CategoryBreakdown {
  category: string;
  weight: number;
  score: number;
  issues: string[];
}

export interface QualityScoreResult {
  score: number;
  tier: 'rescue' | 'elevate' | 'production';
  errors: string[];
  warnings: string[];
  suggestions: string[];
  breakdown: CategoryBreakdown[];
}

export class QualityScorer {
  private readonly weights = {
    syntax: 0.25,
    logic: 0.25,
    safety: 0.15,
    maintainability: 0.15,
    documentation: 0.10,
    performance: 0.10,
  };

  score(code: string, language: string): QualityScoreResult {
    logger.info(`[QualityScorer] Scoring code, language=${language}, length=${code.length}`);

    const syntaxScore = this.checkSyntax(code, language);
    const logicScore = this.checkLogic(code, language);
    const safetyScore = this.checkSafety(code, language);
    const maintainabilityScore = this.checkMaintainability(code, language);
    const documentationScore = this.checkDocumentation(code, language);
    const performanceScore = this.checkPerformance(code, language);

    const breakdown: CategoryBreakdown[] = [
      { category: 'Syntax/Structure', weight: this.weights.syntax, ...syntaxScore },
      { category: 'Logic/Correctness', weight: this.weights.logic, ...logicScore },
      { category: 'Safety', weight: this.weights.safety, ...safetyScore },
      { category: 'Maintainability', weight: this.weights.maintainability, ...maintainabilityScore },
      { category: 'Documentation', weight: this.weights.documentation, ...documentationScore },
      { category: 'Performance', weight: this.weights.performance, ...performanceScore },
    ];

    const score = Math.round(
      breakdown.reduce((sum, b) => sum + b.score * b.weight, 0)
    );

    const errors = [
      ...syntaxScore.issues,
      ...logicScore.issues.filter(i => i.startsWith('ERROR')),
      ...safetyScore.issues.filter(i => i.startsWith('ERROR')),
    ];
    const warnings = [
      ...logicScore.issues.filter(i => i.startsWith('WARN')),
      ...safetyScore.issues.filter(i => i.startsWith('WARN')),
      ...maintainabilityScore.issues,
      ...performanceScore.issues,
    ];
    const suggestions = documentationScore.issues;

    const tier = this.determineTier(score);

    logger.info(`[QualityScorer] Final score=${score}, tier=${tier}`);

    return { score, tier, errors, warnings, suggestions, breakdown };
  }

  private checkSyntax(code: string, language: string): { score: number; issues: string[] } {
    const issues: string[] = [];
    let score = 100;

    if (language === 'typescript' || language === 'javascript') {
      const openBraces = (code.match(/{/g) || []).length;
      const closeBraces = (code.match(/}/g) || []).length;
      const openParens = (code.match(/\(/g) || []).length;
      const closeParens = (code.match(/\)/g) || []).length;

      if (openBraces !== closeBraces) {
        score -= 40;
        issues.push('Brace mismatch detected');
      }
      if (openParens !== closeParens) {
        score -= 40;
        issues.push('Parenthesis mismatch detected');
      }

      const lines = code.split('\n');
      const inconsistentIndent = lines.some((line, _i) => {
        if (line.trim() === '' || line.trim().startsWith('//')) return false;
        const spaces = line.match(/^(\s*)/)?.[1].length ?? 0;
        return spaces % 2 !== 0;
      });
      if (inconsistentIndent) {
        score -= 20;
        issues.push('Inconsistent indentation detected');
      }
    }

    if (language === 'python') {
      const lines = code.split('\n');
      const badIndent = lines.some(line => {
        if (line.trim() === '' || line.trim().startsWith('#')) return false;
        const indent = line.search(/\S/);
        return indent >= 0 && indent % 4 !== 0;
      });
      if (badIndent) {
        score -= 40;
        issues.push('Inconsistent indentation detected');
      }

      const defCount = (code.match(/^def /gm) || []).length;
      const classCount = (code.match(/^class /gm) || []).length;
      if (defCount + classCount > 0) {
        const colonLines = code.match(/^[\s]*[\w\s]+\s*:/gm) || [];
        if (colonLines.length < defCount + classCount) {
          score -= 20;
          issues.push('Missing colons after function/class definitions');
        }
      }
    }

    return { score: Math.max(0, score), issues };
  }

  private checkLogic(code: string, _language: string): { score: number; issues: string[] } {
    const issues: string[] = [];
    let score = 100;

    const emptyFuncPatterns = [
      /function\s+\w+\s*\([^)]*\)\s*[^{]*\{\s*\}/g,
      /const\s+\w+\s*=\s*\([^)]*\)\s*=>\s*\{\s*\}/g,
      /def\s+\w+\s*\([^)]*\)\s*:\s*pass\s*\n?/g,
      /def\s+\w+\s*\([^)]*\)\s*:\s*\n\s+pass\s*\n?/g,
      /def\s+\w+\s*\([^)]*\)\s*:\s*\n\s*\.\.\.\s*\n?/g,
    ];
    const emptyFuncs: string[] = [];
    for (const pattern of emptyFuncPatterns) {
      const matches = code.match(pattern);
      if (matches) emptyFuncs.push(...matches);
    }
    if (emptyFuncs.length > 0) {
      score -= 30 * emptyFuncs.length;
      issues.push(`ERROR: ${emptyFuncs.length} empty function(s) detected`);
    }

    const todoMatches = code.match(/TODO[:\s].*/gi) || [];
    const fixmeMatches = code.match(/FIXME[:\s].*/gi) || [];
    if (todoMatches.length > 0) {
      score -= 10 * todoMatches.length;
      issues.push(`WARN: ${todoMatches.length} TODO(s) found`);
    }
    if (fixmeMatches.length > 0) {
      score -= 20 * fixmeMatches.length;
      issues.push(`ERROR: ${fixmeMatches.length} FIXME(s) found`);
    }

    const catchBlocks = code.match(/catch\s*\([^)]*\)\s*\{\s*\}/g) ||
                       code.match(/except\s*:\s*pass/g) ||
                       code.match(/except:\s*\n\s*pass/g) || [];
    if (catchBlocks.length > 0) {
      score -= 15 * catchBlocks.length;
      issues.push(`ERROR: ${catchBlocks.length} empty catch/except block(s) detected`);
    }

    return { score: Math.max(0, score), issues };
  }

  private checkSafety(code: string, _language: string): { score: number; issues: string[] } {
    const issues: string[] = [];
    let score = 100;

    const secretPatterns = [
      /password\s*=\s*['"][^'"]+['"]/gi,
      /API_KEY\s*=\s*['"][^'"]+['"]/gi,
      /SECRET\s*=\s*['"][^'"]+['"]/gi,
      /token\s*=\s*['"][^'"]+['"]/gi,
    ];
    for (const pattern of secretPatterns) {
      if (pattern.test(code)) {
        score -= 40;
        issues.push('ERROR: Potential hardcoded secret detected');
        break;
      }
    }

    if (code.includes('eval(')) {
      score -= 30;
      issues.push('ERROR: eval() usage detected');
    }
    if (code.includes('exec(')) {
      score -= 25;
      issues.push('ERROR: exec() usage detected');
    }

    if (code.includes('innerHTML') || code.includes('outerHTML')) {
      score -= 20;
      issues.push('WARN: innerHTML/outerHTML usage may cause XSS vulnerability');
    }

    if (code.includes('dangerouslySetInnerHTML')) {
      score -= 20;
      issues.push('WARN: dangerouslySetInnerHTML usage detected');
    }

    return { score: Math.max(0, score), issues };
  }

  private checkMaintainability(code: string, _language: string): { score: number; issues: string[] } {
    const issues: string[] = [];
    let score = 100;

    const lines = code.split('\n');
    const funcRegex = /^(async\s+)?(function\s+\w+|const\s+\w+\s*=\s*(async\s+)?\([^)]*\)\s*=>|def\s+\w+)\s*/;
    const funcStarts: number[] = [];

    lines.forEach((line, i) => {
      if (funcRegex.test(line)) funcStarts.push(i);
    });

    for (const start of funcStarts) {
      const nextStart = funcStarts[funcStarts.indexOf(start) + 1] ?? lines.length;
      const funcLength = nextStart - start;
      if (funcLength > 50) {
        score -= 10;
        issues.push(`WARN: Function at line ${start + 1} is ${funcLength} lines (>50)`);
      }
    }

    const duplicatedLines = this.findDuplicateBlocks(lines);
    if (duplicatedLines > 0) {
      score -= 5 * duplicatedLines;
      issues.push(`WARN: ${duplicatedLines} duplicate line(s) detected`);
    }

    const magicNumbers = code.match(/(?<![a-zA-Z_$])\d{4,}(?![a-zA-Z_$])/g) || [];
    if (magicNumbers.length > 0) {
      score -= 5;
      issues.push('WARN: Magic numbers detected, consider using constants');
    }

    return { score: Math.max(0, score), issues };
  }

  private checkDocumentation(code: string, _language: string): { score: number; issues: string[] } {
    const issues: string[] = [];
    let score = 100;

    const hasComments = code.includes('//') || code.includes('/*') || code.includes('#');
    if (!hasComments) {
      score -= 40;
      issues.push('No comments found, add documentation for public APIs');
    }

    const hasDocstrings = code.includes('/**') || code.includes('"""') || code.includes("'''");
    if (!hasDocstrings) {
      score -= 30;
      issues.push('No docstrings found for functions/classes');
    }

    const funcCount = (code.match(/^(function\s+|const\s+\w+\s*=|def\s+)\w+/gm) || []).length;
    const documentedFuncs = (code.match(/\/\*\*[\s\S]*?\*\//g) || []).length +
                           (code.match(/"""[\s\S]*?"""/g) || []).length;

    if (funcCount > 0 && documentedFuncs < funcCount) {
      const undocumented = funcCount - documentedFuncs;
      score -= 10 * undocumented;
      issues.push(`${undocumented} function(s) lack documentation`);
    }

    return { score: Math.max(0, score), issues };
  }

  private checkPerformance(code: string, language: string): { score: number; issues: string[] } {
    const issues: string[] = [];
    let score = 100;

    const nestedLoops = code.match(/for\s*\([^)]*\)[\s\S]*?for\s*\(/g) ||
                       code.match(/for\s+\w+\s+in\s+\S+:[\s\S]*?for\s+\w+\s+in\s+\S+/g) ||
                       code.match(/\.forEach[\s\S]*?\.forEach/g) || [];
    if (nestedLoops.length > 0) {
      score -= 15 * nestedLoops.length;
      issues.push(`WARN: ${nestedLoops.length} nested loop(s) detected, consider optimization`);
    }

    if (language === 'python') {
      if (code.includes('import time') && code.includes('time.sleep(')) {
        score -= 10;
        issues.push('WARN: time.sleep() blocks execution, consider async alternatives');
      }
    }

    if ((language === 'typescript' || language === 'javascript') && code.includes('sync ')) {
      const syncKeywords = ['XMLHttpRequest', 'readFileSync', 'writeFileSync', 'execSync'];
      for (const keyword of syncKeywords) {
        if (code.includes(keyword)) {
          score -= 15;
          issues.push(`WARN: ${keyword} blocks the event loop, use async version`);
          break;
        }
      }
    }

    const largeArrays = code.match(/new\s+Array\(\d{4,}\)/g) || [];
    if (largeArrays.length > 0) {
      score -= 10;
      issues.push('WARN: Large array allocation detected');
    }

    return { score: Math.max(0, score), issues };
  }

  private findDuplicateBlocks(lines: string[]): number {
    const normalized = lines
      .map(l => l.trim())
      .filter(l => l !== '' && !l.startsWith('//') && !l.startsWith('#'));

    let duplicates = 0;
    const seen = new Set<string>();

    for (const line of normalized) {
      if (line.length < 20) continue;
      if (seen.has(line)) {
        duplicates++;
      } else {
        seen.add(line);
      }
    }

    return duplicates;
  }

  private determineTier(score: number): 'rescue' | 'elevate' | 'production' {
    if (score < 40) return 'rescue';
    if (score <= 70) return 'elevate';
    return 'production';
  }
}
