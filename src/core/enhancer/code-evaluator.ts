import { logger } from '@/utils/logger';
import type { LLMAdapter, ChatParams } from '@/llm/base.js';

// ------------------------------------------------------------------
// Public interfaces
// ------------------------------------------------------------------

export interface EvaluationCriteria {
  readability?: number;
  correctness?: number;
  robustness?: number;
  performance?: number;
  maintainability?: number;
  security?: number;
}

export interface EvaluationReport {
  codeAScore: number;
  codeBScore: number;
  winner: 'A' | 'B' | 'tie';
  breakdown: {
    criterion: string;
    scoreA: number;
    scoreB: number;
    winner: 'A' | 'B' | 'tie';
    explanation: string;
  }[];
  summary: string;
  strengths: { A: string[]; B: string[] };
  weaknesses: { A: string[]; B: string[] };
}

// ------------------------------------------------------------------
// Constants
// ------------------------------------------------------------------

const DEFAULT_CRITERIA: Required<EvaluationCriteria> = {
  readability: 1,
  correctness: 1,
  robustness: 1,
  performance: 1,
  maintainability: 1,
  security: 1,
};

const CRITERION_PROMPTS: Record<string, string> = {
  readability:
    'Evaluate the readability of the code. Consider: naming conventions, formatting, structure, clarity of intent, and how easy it is for a developer to understand on first read. Score 0-100.',
  correctness:
    'Evaluate the logical correctness of the code. Consider: does it do what it claims? Are there logic errors, off-by-one issues, incorrect algorithms, or misunderstood requirements? Score 0-100.',
  robustness:
    'Evaluate the robustness of the code. Consider: error handling, edge case coverage, null/undefined checks, input validation, graceful degradation, and defensive programming. Score 0-100.',
  performance:
    'Evaluate the performance of the code. Consider: algorithmic complexity (Big O), unnecessary computations, memory usage, I/O patterns, caching opportunities, and potential bottlenecks. Score 0-100.',
  maintainability:
    'Evaluate the maintainability of the code. Consider: modularity, separation of concerns, DRY principle, testability, ease of modification, extensibility, and code organization. Score 0-100.',
  security:
    'Evaluate the security of the code. Consider: input sanitization, hardcoded secrets, SQL injection risks, XSS vulnerabilities, authentication/authorization patterns, and secure defaults. Score 0-100.',
};

const SYNTAX_CHECKS: Record<string, Array<{ name: string; check: (code: string) => { pass: boolean; detail: string } }>> = {
  typescript: [
    { name: 'balanced_braces', check: (code) => checkBalanced(code, '{', '}') },
    { name: 'balanced_parens', check: (code) => checkBalanced(code, '(', ')') },
    { name: 'balanced_brackets', check: (code) => checkBalanced(code, '[', ']') },
    { name: 'no_undefined_vars', check: (code) => ({ pass: !/=\s*undefined\b/.test(code) || code.includes('typeof'), detail: 'No unsafe undefined assignments' }) },
    { name: 'no_console_prod', check: (code) => { const count = (code.match(/console\.log/g) || []).length; return { pass: count < 5, detail: `Found ${count} console.log statements` }; } },
  ],
  javascript: [
    { name: 'balanced_braces', check: (code) => checkBalanced(code, '{', '}') },
    { name: 'balanced_parens', check: (code) => checkBalanced(code, '(', ')') },
    { name: 'balanced_brackets', check: (code) => checkBalanced(code, '[', ']') },
    { name: 'no_console_prod', check: (code) => { const count = (code.match(/console\.log/g) || []).length; return { pass: count < 5, detail: `Found ${count} console.log statements` }; } },
  ],
  python: [
    { name: 'balanced_parens', check: (code) => checkBalanced(code, '(', ')') },
    { name: 'balanced_brackets', check: (code) => checkBalanced(code, '[', ']') },
    { name: 'no_bare_except', check: (code) => ({ pass: !/except\s*:/.test(code), detail: 'No bare except clauses' }) },
    { name: 'no_print_prod', check: (code) => { const count = (code.match(/print\s*\(/g) || []).length; return { pass: count < 5, detail: `Found ${count} print statements` }; } },
  ],
};

const SECURITY_PATTERNS: { name: string; pattern: RegExp; severity: 'error' | 'warn' }[] = [
  { name: 'hardcoded_password', pattern: /(?:password|passwd|pwd)\s*=\s*['"][^'"]+['"]/i, severity: 'error' },
  { name: 'hardcoded_api_key', pattern: /(?:api_key|apikey|secret_key|access_token)\s*=\s*['"][A-Za-z0-9]{10,}['"]/i, severity: 'error' },
  { name: 'eval_usage', pattern: /\beval\s*\(/, severity: 'error' },
  { name: 'exec_usage', pattern: /\bexec\s*\(/, severity: 'error' },
  { name: 'inner_html', pattern: /\.innerHTML\s*=/, severity: 'warn' },
  { name: 'sql_concatenation', pattern: /(?:query|execute)\s*\(\s*['"](?:SELECT|INSERT|UPDATE|DELETE).*['"]\s*\+/i, severity: 'error' },
  { name: 'shell_exec', pattern: /(?:child_process|subprocess|os\.system|execSync|exec)\s*\(/, severity: 'warn' },
];

// ------------------------------------------------------------------
// CodeEvaluator
// ------------------------------------------------------------------

export class CodeEvaluator {
  private llm: LLMAdapter;

  constructor(llm: LLMAdapter) {
    this.llm = llm;
  }

  public async evaluate(
    codeA: string,
    codeB: string,
    language: string,
    criteria?: EvaluationCriteria
  ): Promise<EvaluationReport> {
    logger.info(`[CodeEvaluator] Starting evaluation: language=${language}, codeA=${codeA.length} chars, codeB=${codeB.length} chars`);

    const weights = { ...DEFAULT_CRITERIA, ...criteria };
    const criterionNames = Object.keys(weights) as Array<keyof EvaluationCriteria>;

    const ruleScoresA = this.ruleBasedEvaluate(codeA, language);
    const ruleScoresB = this.ruleBasedEvaluate(codeB, language);

    const llmScores = await this.llmEvaluate(codeA, codeB, language, criterionNames);

    const breakdown: EvaluationReport['breakdown'] = [];
    let totalA = 0;
    let totalB = 0;
    let totalWeight = 0;

    for (const name of criterionNames) {
      const weight = weights[name];
      if (weight === 0) continue;

      const ruleA = ruleScoresA[name] ?? 50;
      const ruleB = ruleScoresB[name] ?? 50;
      const llm = llmScores[name];

      const scoreA = Math.round(ruleA * 0.35 + (llm?.scoreA ?? 50) * 0.65);
      const scoreB = Math.round(ruleB * 0.35 + (llm?.scoreB ?? 50) * 0.65);

      const winner = scoreA > scoreB ? 'A' : scoreB > scoreA ? 'B' : 'tie';
      const explanation = llm?.explanation || this.generateRuleExplanation(name, scoreA, scoreB, ruleScoresA, ruleScoresB);

      breakdown.push({
        criterion: name,
        scoreA,
        scoreB,
        winner,
        explanation,
      });

      totalA += scoreA * weight;
      totalB += scoreB * weight;
      totalWeight += weight;
    }

    const codeAScore = totalWeight > 0 ? Math.round(totalA / totalWeight) : 0;
    const codeBScore = totalWeight > 0 ? Math.round(totalB / totalWeight) : 0;
    const winner = codeAScore > codeBScore ? 'A' : codeBScore > codeAScore ? 'B' : 'tie';

    const strengths = this.extractStrengths(breakdown, codeA, codeB, language);
    const weaknesses = this.extractWeaknesses(breakdown, codeA, codeB, language);
    const summary = this.generateSummary(winner, codeAScore, codeBScore, breakdown);

    const report: EvaluationReport = {
      codeAScore,
      codeBScore,
      winner,
      breakdown,
      summary,
      strengths,
      weaknesses,
    };

    logger.info(`[CodeEvaluator] Evaluation complete. Winner: ${winner}. A=${codeAScore}, B=${codeBScore}`);

    return report;
  }

  // ------------------------------------------------------------------
  // Private helpers
  // ------------------------------------------------------------------

  private ruleBasedEvaluate(code: string, language: string): Record<string, number> {
    const scores: Record<string, number> = {};

    scores.readability = this.evaluateReadability(code);
    scores.correctness = this.evaluateCorrectness(code, language);
    scores.robustness = this.evaluateRobustness(code, language);
    scores.performance = this.evaluatePerformance(code, language);
    scores.maintainability = this.evaluateMaintainability(code, language);
    scores.security = this.evaluateSecurity(code);

    return scores;
  }

  private evaluateReadability(code: string): number {
    let score = 60;
    const lines = code.split('\n');
    const nonEmpty = lines.filter((l) => l.trim()).length;

    if (nonEmpty > 0 && nonEmpty <= 100) score += 10;
    else if (nonEmpty > 200) score -= 10;

    const hasDescriptiveNames = /(?:is[A-Z]|has[A-Z]|get[A-Z]|set[A-Z]|handle[A-Z]|format[A-Z]|parse[A-Z]|validate[A-Z])/.test(code);
    if (hasDescriptiveNames) score += 10;

    const hasComments = (code.match(/\/\/|\/\*|\*|#|"""/g) || []).length;
    if (hasComments >= 2) score += 10;
    else if (hasComments === 1) score += 5;

    const maxLineLength = Math.max(...lines.map((l) => l.length), 0);
    if (maxLineLength > 120) score -= 10;
    else if (maxLineLength <= 80) score += 5;

    return Math.max(0, Math.min(100, score));
  }

  private evaluateCorrectness(code: string, language: string): number {
    let score = 70;

    const syntaxChecks = SYNTAX_CHECKS[language] || [];
    let failCount = 0;
    for (const check of syntaxChecks) {
      const result = check.check(code);
      if (!result.pass) {
        failCount++;
        score -= 5;
      }
    }

    const hasReturnStatement = language === 'python' ? /\breturn\b/.test(code) : /\breturn\b/.test(code);
    const hasFunctionDef = language === 'python' ? /\bdef\b/.test(code) : /\bfunction\b|=>|\bclass\b/.test(code);
    if (hasFunctionDef && !hasReturnStatement && !/void|:\s*void/.test(code)) {
      score -= 5;
    }

    if (failCount === 0) score += 10;

    return Math.max(0, Math.min(100, score));
  }

  private evaluateRobustness(code: string, language: string): number {
    let score = 40;

    const errorHandlingPatterns = [
      /try\s*{/,
      /catch\s*\(/,
      /finally\s*{/,
      /throw\s+/,
      /\.catch\s*\(/,
      /if\s*\([^)]*null/,
      /if\s*\([^)]*undefined/,
      /if\s*\(\s*!/,
      /if\s*\([^)]*===\s*null/,
      /if\s*\([^)]*===\s*undefined/,
      /\?\?/,
      /\?\./,
    ];

    if (language === 'python') {
      errorHandlingPatterns.push(/except\b/, /raise\s+/, /if\s+.*\s+is\s+None/, /assert\s+/);
    }

    let foundCount = 0;
    for (const pattern of errorHandlingPatterns) {
      if (pattern.test(code)) foundCount++;
    }

    if (foundCount >= 3) score += 30;
    else if (foundCount >= 2) score += 20;
    else if (foundCount >= 1) score += 10;

    const hasInputValidation = /if\s*\([^)]*typeof|if\s*\([^)]*\.length|if\s*\([^)]*empty|validate|isValid|sanitize/.test(code);
    if (hasInputValidation) score += 15;

    const hasTypeAnnotations = language === 'python' ? /:\s*(str|int|float|bool|list|dict|Optional|Union)/.test(code) : /:\s*(string|number|boolean|void|string\[\]|Record|Map|Set)/.test(code);
    if (hasTypeAnnotations) score += 10;

    return Math.max(0, Math.min(100, score));
  }

  private evaluatePerformance(code: string, language: string): number {
    let score = 60;

    const nestedLoopDepth = this.countNestedLoops(code);
    if (nestedLoopDepth >= 3) score -= 20;
    else if (nestedLoopDepth >= 2) score -= 10;

    const hasCaching = /memo|cache|useMemo|lru_cache|functools\.cache|@cache|@lru_cache/.test(code);
    if (hasCaching) score += 10;

    const hasUnnecessaryIteration = /for\s*\([^)]+\)\s*\{[\s\S]*for\s*\([^)]+\)/.test(code);
    if (hasUnnecessaryIteration) score -= 5;

    const usesEfficientPatterns = /\.map\(|\.filter\(|\.reduce\(|\.find\(|\.some\(|\.every\(|Array\.from|Set\(|Map\(|comprehension|\{.*for.*in.*\}/.test(code);
    if (usesEfficientPatterns) score += 5;

    return Math.max(0, Math.min(100, score));
  }

  private evaluateMaintainability(code: string, language: string): number {
    let score = 55;

    const functionCount = (code.match(language === 'python' ? /\bdef\b/g : /\bfunction\b|=>/g) || []).length;
    const classCount = (code.match(/\bclass\b/g) || []).length;

    if (functionCount >= 2 && functionCount <= 10) score += 10;
    if (classCount >= 1 && classCount <= 3) score += 5;

    const hasConstants = language === 'python' ? /^[A-Z_]+\s*=/m.test(code) : /\bconst\s+[A-Z_]+\s*=/.test(code);
    if (hasConstants) score += 10;

    const hasSingleResponsibility = functionCount > 0 && code.length < 3000;
    if (hasSingleResponsibility) score += 5;

    const magicNumbers = (code.match(/(?<![.\w])(\d{2,})(?![.\w])/g) || []).length;
    if (magicNumbers <= 3) score += 10;
    else if (magicNumbers <= 6) score += 5;
    else score -= 5;

    const hasConsistentStyle = this.checkConsistentStyle(code);
    if (hasConsistentStyle) score += 5;

    return Math.max(0, Math.min(100, score));
  }

  private evaluateSecurity(code: string): number {
    let score = 80;
    const issues: string[] = [];

    for (const { name, pattern, severity } of SECURITY_PATTERNS) {
      if (pattern.test(code)) {
        if (severity === 'error') {
          score -= 20;
          issues.push(`Security issue: ${name}`);
        } else {
          score -= 10;
          issues.push(`Security warning: ${name}`);
        }
      }
    }

    if (issues.length === 0) score += 10;

    return Math.max(0, Math.min(100, score));
  }

  private async llmEvaluate(
    codeA: string,
    codeB: string,
    language: string,
    criteria: string[]
  ): Promise<Record<string, { scoreA: number; scoreB: number; explanation: string } | null>> {
    const results: Record<string, { scoreA: number; scoreB: number; explanation: string } | null> = {};

    const combinedPrompt = this.buildCombinedEvaluationPrompt(codeA, codeB, language, criteria);

    try {
      const params: ChatParams = {
        messages: [{ role: 'user', content: combinedPrompt }],
        temperature: 0.2,
        maxTokens: 2000,
      };

      const response = await this.llm.chatOnce(params);
      const parsed = this.parseCombinedLlmResponse(response.content, criteria);

      for (const name of criteria) {
        results[name] = parsed[name] || null;
      }

      logger.debug(`[CodeEvaluator] LLM evaluation completed for ${criteria.length} criteria`);
    } catch (error) {
      logger.error(`[CodeEvaluator] LLM evaluation failed:`, error);
      for (const name of criteria) {
        results[name] = null;
      }
    }

    return results;
  }

  private buildCombinedEvaluationPrompt(codeA: string, codeB: string, language: string, criteria: string[]): string {
    const criteriaDescriptions = criteria.map((c) => CRITERION_PROMPTS[c]).join('\n\n');

    return (
      `You are an expert code reviewer. Compare two code implementations and score them on multiple criteria.\n\n` +
      `Language: ${language}\n\n` +
      `Evaluate on these criteria:\n${criteriaDescriptions}\n\n` +
      `Code A:\n\`\`\`${language}\n${codeA}\n\`\`\`\n\n` +
      `Code B:\n\`\`\`${language}\n${codeB}\n\`\`\`\n\n` +
      `For EACH criterion, provide:\n` +
      `- scoreA: integer 0-100\n` +
      `- scoreB: integer 0-100\n` +
      `- explanation: brief reason (1-2 sentences)\n\n` +
      `Respond in this EXACT JSON format:\n` +
      `\`\`\`json\n` +
      `{\n` +
      criteria.map((c) => `  "${c}": { "scoreA": 0, "scoreB": 0, "explanation": "" }`).join(',\n') +
      `\n}\n` +
      `\`\`\`\n\n` +
      `Be precise. Do not add any text outside the JSON block.`
    );
  }

  private parseCombinedLlmResponse(content: string, criteria: string[]): Record<string, { scoreA: number; scoreB: number; explanation: string }> {
    const results: Record<string, { scoreA: number; scoreB: number; explanation: string }> = {};

    try {
      const jsonMatch = content.match(/```json\n?([\s\S]*?)```/);
      const jsonStr = jsonMatch ? jsonMatch[1] : content;
      const parsed = JSON.parse(jsonStr);

      for (const name of criteria) {
        if (parsed[name] && typeof parsed[name].scoreA === 'number' && typeof parsed[name].scoreB === 'number') {
          results[name] = {
            scoreA: Math.max(0, Math.min(100, parsed[name].scoreA)),
            scoreB: Math.max(0, Math.min(100, parsed[name].scoreB)),
            explanation: parsed[name].explanation || '',
          };
        }
      }
    } catch {
      logger.warn(`[CodeEvaluator] Failed to parse LLM response, falling back to defaults`);
    }

    for (const name of criteria) {
      if (!results[name]) {
        results[name] = { scoreA: 50, scoreB: 50, explanation: 'Unable to determine from analysis.' };
      }
    }

    return results;
  }

  private generateRuleExplanation(
    criterion: string,
    scoreA: number,
    scoreB: number,
    ruleA: Record<string, number>,
    ruleB: Record<string, number>
  ): string {
    const a = ruleA[criterion] ?? 50;
    const b = ruleB[criterion] ?? 50;

    const explanations: Record<string, (a: number, b: number) => string> = {
      readability: (a, b) =>
        a > b
          ? `Code A has better formatting and naming conventions than Code B.`
          : b > a
            ? `Code B has better formatting and naming conventions than Code A.`
            : `Both codes have similar readability.`,
      correctness: (a, b) =>
        a > b
          ? `Code A passed more syntax and logic checks than Code B.`
          : b > a
            ? `Code B passed more syntax and logic checks than Code A.`
            : `Both codes have similar correctness levels.`,
      robustness: (a, b) =>
        a > b
          ? `Code A has better error handling and edge case coverage than Code B.`
          : b > a
            ? `Code B has better error handling and edge case coverage than Code A.`
            : `Both codes have similar robustness levels.`,
      performance: (a, b) =>
        a > b
          ? `Code A has better algorithmic efficiency than Code B.`
          : b > a
            ? `Code B has better algorithmic efficiency than Code A.`
            : `Both codes have similar performance characteristics.`,
      maintainability: (a, b) =>
        a > b
          ? `Code A is better structured for future modifications than Code B.`
          : b > a
            ? `Code B is better structured for future modifications than Code A.`
            : `Both codes have similar maintainability levels.`,
      security: (a, b) =>
        a > b
          ? `Code A has fewer security risks than Code B.`
          : b > a
            ? `Code B has fewer security risks than Code A.`
            : `Both codes have similar security levels.`,
    };

    return (explanations[criterion] || ((a, b) => `Scores: A=${a}, B=${b}`))(a, b);
  }

  private extractStrengths(
    breakdown: EvaluationReport['breakdown'],
    codeA: string,
    codeB: string,
    language: string
  ): { A: string[]; B: string[] } {
    const strengthsA: string[] = [];
    const strengthsB: string[] = [];

    for (const item of breakdown) {
      if (item.winner === 'A' && item.scoreA >= 70) {
        strengthsA.push(this.strengthDescription(item.criterion, item.scoreA, codeA, language));
      }
      if (item.winner === 'B' && item.scoreB >= 70) {
        strengthsB.push(this.strengthDescription(item.criterion, item.scoreB, codeB, language));
      }
      if (item.scoreA >= 80 && item.winner !== 'A') {
        strengthsA.push(`Strong ${item.criterion} (score: ${item.scoreA})`);
      }
      if (item.scoreB >= 80 && item.winner !== 'B') {
        strengthsB.push(`Strong ${item.criterion} (score: ${item.scoreB})`);
      }
    }

    return { A: strengthsA, B: strengthsB };
  }

  private extractWeaknesses(
    breakdown: EvaluationReport['breakdown'],
    codeA: string,
    codeB: string,
    language: string
  ): { A: string[]; B: string[] } {
    const weaknessesA: string[] = [];
    const weaknessesB: string[] = [];

    for (const item of breakdown) {
      if (item.scoreA < 50) {
        weaknessesA.push(this.weaknessDescription(item.criterion, item.scoreA, codeA, language));
      }
      if (item.scoreB < 50) {
        weaknessesB.push(this.weaknessDescription(item.criterion, item.scoreB, codeB, language));
      }
    }

    return { A: weaknessesA, B: weaknessesB };
  }

  private strengthDescription(criterion: string, score: number, code: string, language: string): string {
    const descriptions: Record<string, string> = {
      readability: `Highly readable with clear naming and structure (score: ${score})`,
      correctness: `Logically sound with no obvious errors (score: ${score})`,
      robustness: `Well-protected against edge cases and errors (score: ${score})`,
      performance: `Algorithmically efficient (score: ${score})`,
      maintainability: `Well-organized and easy to modify (score: ${score})`,
      security: `Secure with no obvious vulnerabilities (score: ${score})`,
    };
    return descriptions[criterion] || `Strong ${criterion} (score: ${score})`;
  }

  private weaknessDescription(criterion: string, score: number, code: string, language: string): string {
    const descriptions: Record<string, string> = {
      readability: `Poor readability - consider better naming and formatting (score: ${score})`,
      correctness: `Potential logic errors detected (score: ${score})`,
      robustness: `Missing error handling or edge case coverage (score: ${score})`,
      performance: `Algorithmic inefficiency detected (score: ${score})`,
      maintainability: `Difficult to maintain - consider refactoring (score: ${score})`,
      security: `Security vulnerabilities found (score: ${score})`,
    };
    return descriptions[criterion] || `Weak ${criterion} (score: ${score})`;
  }

  private generateSummary(
    winner: string,
    scoreA: number,
    scoreB: number,
    breakdown: EvaluationReport['breakdown']
  ): string {
    const winnerLabel = winner === 'tie' ? 'Both implementations' : `Code ${winner}`;
    const diff = Math.abs(scoreA - scoreB);
    const magnitude = diff < 5 ? 'marginally' : diff < 15 ? 'moderately' : 'significantly';

    const strongCriteria: string[] = [];
    const weakCriteria: string[] = [];

    for (const item of breakdown) {
      const avgScore = (item.scoreA + item.scoreB) / 2;
      if (avgScore >= 75) strongCriteria.push(item.criterion);
      if (avgScore < 50) weakCriteria.push(item.criterion);
    }

    let summary = `${winnerLabel} ${winner === 'tie' ? 'perform equally' : `performs ${magnitude} better`} overall (A: ${scoreA}, B: ${scoreB}).`;

    if (strongCriteria.length > 0) {
      summary += ` Both implementations excel in: ${strongCriteria.join(', ')}.`;
    }

    if (weakCriteria.length > 0) {
      summary += ` Both need improvement in: ${weakCriteria.join(', ')}.`;
    }

    return summary;
  }

  private countNestedLoops(code: string): number {
    let maxDepth = 0;
    let currentDepth = 0;
    const loopPattern = /\bfor\s*\(|\bwhile\s*\(/g;
    let match: RegExpExecArray | null;

    while ((match = loopPattern.exec(code)) !== null) {
      currentDepth++;
      maxDepth = Math.max(maxDepth, currentDepth);
    }

    return maxDepth;
  }

  private checkConsistentStyle(code: string): boolean {
    const lines = code.split('\n').filter((l) => l.trim());
    if (lines.length < 2) return true;

    const indentSizes = lines
      .filter((l) => /^\s/.test(l))
      .map((l) => l.match(/^(\s+)/)?.[1].length || 0)
      .filter((n) => n > 0);

    if (indentSizes.length === 0) return true;

    const isSpaces = indentSizes.every((n) => n % 2 === 0 || n % 4 === 0);
    const isTabs = lines.filter((l) => l.startsWith('\t')).length > lines.length * 0.5;

    return isSpaces || isTabs;
  }
}

// ------------------------------------------------------------------
// Standalone helper
// ------------------------------------------------------------------

function checkBalanced(code: string, open: string, close: string): { pass: boolean; detail: string } {
  let count = 0;
  let inStr = false;
  let strChar = '';

  for (let i = 0; i < code.length; i++) {
    const ch = code[i];
    const prev = i > 0 ? code[i - 1] : '';

    if (inStr) {
      if (ch === strChar && prev !== '\\') inStr = false;
      continue;
    }

    if (ch === '"' || ch === "'" || ch === '`') {
      inStr = true;
      strChar = ch;
      continue;
    }

    if (ch === open) count++;
    if (ch === close) count--;
  }

  return { pass: count === 0, detail: count > 0 ? `${count} unclosed '${open}'` : `${Math.abs(count)} extra '${close}'` };
}
