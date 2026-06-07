import { logger } from '../../utils/logger.js';
import type { LLMAdapter } from '../../llm/base.js';

export interface SecurityHardeningResult {
  hardenedCode: string;
  issuesFixed: number;
  suggestions: string[];
}

export interface SecurityHardeningOptions {
  temperature?: number;
  maxTokens?: number;
  addInputValidation?: boolean;
  replaceDangerousFunctions?: boolean;
  detectSecrets?: boolean;
  addSanitization?: boolean;
  suggestRateLimiting?: boolean;
}

const DEFAULT_TEMPERATURE = 0.2;
const DEFAULT_MAX_TOKENS = 8192;

const DEFAULT_OPTIONS: Required<Omit<SecurityHardeningOptions, 'addInputValidation' | 'replaceDangerousFunctions' | 'detectSecrets' | 'addSanitization' | 'suggestRateLimiting'>> & Pick<SecurityHardeningOptions, 'addInputValidation' | 'replaceDangerousFunctions' | 'detectSecrets' | 'addSanitization' | 'suggestRateLimiting'> = {
  temperature: DEFAULT_TEMPERATURE,
  maxTokens: DEFAULT_MAX_TOKENS,
  addInputValidation: true,
  replaceDangerousFunctions: true,
  detectSecrets: true,
  addSanitization: true,
  suggestRateLimiting: true,
};

const SECRET_PATTERNS = [
  { pattern: /password\s*=\s*['"][^'"]+['"]/gi, name: 'hardcoded password' },
  { pattern: /API_KEY\s*=\s*['"][^'"]+['"]/gi, name: 'hardcoded API key' },
  { pattern: /SECRET\s*=\s*['"][^'"]+['"]/gi, name: 'hardcoded secret' },
  { pattern: /token\s*=\s*['"][^'"]+['"]/gi, name: 'hardcoded token' },
  { pattern: /AWS_SECRET_ACCESS_KEY\s*=\s*['"][^'"]+['"]/gi, name: 'AWS secret key' },
  { pattern: /PRIVATE_KEY\s*=\s*['"][^'"]+['"]/gi, name: 'hardcoded private key' },
];

const DANGEROUS_FUNCTIONS = [
  { pattern: /\beval\s*\(/g, replacement: 'eval() - use safe parsing alternatives', name: 'eval' },
  { pattern: /\bexec\s*\(/g, replacement: 'exec() - use subprocess with safe arguments', name: 'exec' },
  { pattern: /\bexecSync\s*\(/g, replacement: 'execSync() - use async subprocess', name: 'execSync' },
  { pattern: /\bFunction\s*\(/g, replacement: 'Function constructor - avoid dynamic code generation', name: 'Function constructor' },
  { pattern: /\bsetTimeout\s*\(\s*string/g, replacement: 'setTimeout with string - use function reference', name: 'setTimeout with string' },
];

export class SecurityHardener {
  private llm: LLMAdapter;

  constructor(llm: LLMAdapter) {
    this.llm = llm;
    logger.info('[SecurityHardener] initialized');
  }

  async harden(
    code: string,
    language: string,
    options?: SecurityHardeningOptions
  ): Promise<SecurityHardeningResult> {
    logger.info('[SecurityHardener] hardening code...', { language, codeLength: code.length });

    const opts = { ...DEFAULT_OPTIONS, ...options };
    const suggestions: string[] = [];
    let issuesFixed = 0;

    try {
      let hardenedCode = code;

      if (opts.replaceDangerousFunctions) {
        const result = this.replaceDangerousFunctions(hardenedCode, language);
        hardenedCode = result.code;
        issuesFixed += result.count;
        suggestions.push(...result.suggestions);
      }

      if (opts.detectSecrets) {
        const result = this.detectAndFlagSecrets(hardenedCode);
        hardenedCode = result.code;
        issuesFixed += result.count;
        suggestions.push(...result.suggestions);
      }

      if (opts.addInputValidation || opts.addSanitization) {
        const llmResult = await this.hardenWithLLM(hardenedCode, language, opts);
        hardenedCode = llmResult.code;
        issuesFixed += llmResult.count;
        suggestions.push(...llmResult.suggestions);
      }

      if (opts.suggestRateLimiting) {
        const rateLimitSuggestions = this.checkRateLimiting(hardenedCode, language);
        suggestions.push(...rateLimitSuggestions);
      }

      logger.info('[SecurityHardener] hardening complete', { issuesFixed, suggestionsCount: suggestions.length });

      return { hardenedCode, issuesFixed, suggestions };
    } catch (error) {
      logger.error('[SecurityHardener] hardening failed:', error);
      throw new Error(`Security hardening failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private replaceDangerousFunctions(code: string, language: string): { code: string; count: number; suggestions: string[] } {
    let modified = code;
    let count = 0;
    const suggestions: string[] = [];

    if (language === 'javascript' || language === 'typescript') {
      for (const func of DANGEROUS_FUNCTIONS) {
        const matches = modified.match(func.pattern);
        if (matches && matches.length > 0) {
          suggestions.push(`Replaced ${matches.length} occurrence(s) of ${func.name}`);
          count += matches.length;
        }
      }

      modified = modified.replace(/\beval\s*\(/g, 'JSON.parse(');
      modified = modified.replace(/\bFunction\s*\(/g, '// Function constructor replaced - use safe alternative: ');
    }

    if (language === 'python') {
      const evalMatches = modified.match(/\beval\s*\(/g);
      if (evalMatches) {
        suggestions.push(`Replaced ${evalMatches.length} occurrence(s) of eval() - use ast.literal_eval() for safe evaluation`);
        count += evalMatches.length;
        modified = modified.replace(/\beval\s*\(/g, 'ast.literal_eval(');
      }

      const execMatches = modified.match(/\bexec\s*\(/g);
      if (execMatches) {
        suggestions.push(`Replaced ${execMatches.length} occurrence(s) of exec() - use subprocess.run() with shell=False`);
        count += execMatches.length;
        modified = modified.replace(/\bexec\s*\(/g, '# exec() replaced - use subprocess.run() with shell=False: ');
      }
    }

    return { code: modified, count, suggestions };
  }

  private detectAndFlagSecrets(code: string): { code: string; count: number; suggestions: string[] } {
    let modified = code;
    let count = 0;
    const suggestions: string[] = [];

    for (const { pattern, name } of SECRET_PATTERNS) {
      const matches = modified.match(pattern);
      if (matches && matches.length > 0) {
        suggestions.push(`Found ${matches.length} occurrence(s) of ${name} - use environment variables or secret management`);
        count += matches.length;

        modified = modified.replace(pattern, (match) => {
          return `// SECURITY: ${name} detected - use environment variables instead\n// ${match}`;
        });
      }
    }

    return { code: modified, count, suggestions };
  }

  private async hardenWithLLM(
    code: string,
    language: string,
    options: Required<Omit<SecurityHardeningOptions, 'addInputValidation' | 'replaceDangerousFunctions' | 'detectSecrets' | 'addSanitization' | 'suggestRateLimiting'>> & Pick<SecurityHardeningOptions, 'addInputValidation' | 'replaceDangerousFunctions' | 'detectSecrets' | 'addSanitization' | 'suggestRateLimiting'>
  ): Promise<{ code: string; count: number; suggestions: string[] }> {
    const prompt = this.buildHardenPrompt(code, language, options);

    const result = await this.llm.chatOnce({
      messages: [{ role: 'user', content: prompt }],
      systemPrompt: this.buildHardeningSystemPrompt(language),
      temperature: options.temperature,
      maxTokens: options.maxTokens,
    });

    const hardenedCode = this.extractHardenedCode(result.content);
    const issuesFixed = this.countSecurityImprovements(hardenedCode, code);
    const suggestions = this.generateLLMSuggestions(hardenedCode, language);

    return { code: hardenedCode, count: issuesFixed, suggestions };
  }

  private buildHardenPrompt(
    code: string,
    language: string,
    options: Required<Omit<SecurityHardeningOptions, 'addInputValidation' | 'replaceDangerousFunctions' | 'detectSecrets' | 'addSanitization' | 'suggestRateLimiting'>> & Pick<SecurityHardeningOptions, 'addInputValidation' | 'replaceDangerousFunctions' | 'detectSecrets' | 'addSanitization' | 'suggestRateLimiting'>
  ): string {
    const sections: string[] = [];

    sections.push(`## Source Code

Harden the security of the following ${language} code:

\`\`\`${language}
${code}
\`\`\`
`);

    sections.push('## Security Requirements\n');

    if (options.addInputValidation) {
      sections.push('1. Input Validation: Add validation for all function parameters that come from external sources. Check types, ranges, and formats.');
    }
    if (options.addSanitization) {
      sections.push('2. Input Sanitization: Sanitize all user inputs before processing. Escape special characters, validate against injection patterns.');
    }

    sections.push(`
## Instructions

1. Identify all entry points where user input is accepted
2. Add appropriate validation and sanitization
3. Replace any remaining dangerous patterns with safe alternatives
4. Add error handling that doesn't leak sensitive information
5. Preserve all existing functionality
6. Output only the hardened code, no additional explanation`);

    return sections.join('\n');
  }

  private buildHardeningSystemPrompt(language: string): string {
    return `You are an expert security engineer specializing in ${language} application security.

Your task is to harden code security by adding input validation, sanitization, and safe patterns.

Rules:
- Add input validation for all external inputs
- Sanitize user inputs before processing
- Use parameterized queries for database operations
- Escape output to prevent XSS
- Handle errors without exposing sensitive information
- Use safe alternatives for dangerous functions
- Preserve all existing functionality
- Output only the hardened code, no markdown or explanations`;
  }

  private extractHardenedCode(content: string): string {
    const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;
    const match = codeBlockRegex.exec(content);

    if (match) {
      return match[2].trim();
    }

    return content.trim();
  }

  private countSecurityImprovements(original: string, hardened: string): number {
    let count = 0;

    const improvements = [
      /try\s*{/g,
      /catch\s*\(/g,
      /validate/gi,
      /sanitize/gi,
      /escape/gi,
      /isInvalid/gi,
      /isValid/gi,
      /parametrize/gi,
      /prepared\s*statement/gi,
    ];

    for (const pattern of improvements) {
      const originalMatches = (original.match(pattern) || []).length;
      const hardenedMatches = (hardened.match(pattern) || []).length;
      count += Math.max(0, hardenedMatches - originalMatches);
    }

    return count;
  }

  private generateLLMSuggestions(code: string, _language: string): string[] {
    const suggestions: string[] = [];

    const xssMatches = code.match(/innerHTML|outerHTML|dangerouslySetInnerHTML|document\.write/gi);
    if (xssMatches && xssMatches.length > 0) {
      suggestions.push('Consider using textContent or safe DOM manipulation instead of innerHTML');
    }

    const sqlMatches = code.match(/execute\s*\(|query\s*\(/g);
    if (sqlMatches && sqlMatches.length > 0 && !code.includes('parameterized')) {
      suggestions.push('Ensure database queries use parameterized statements');
    }

    if (!code.includes('rateLimit') && !code.includes('rate-limit') && !code.includes('throttle')) {
      if (code.includes('api') || code.includes('route') || code.includes('endpoint') || code.includes('handler')) {
        suggestions.push('Consider adding rate limiting to API endpoints');
      }
    }

    if (!code.includes('encryption') && !code.includes('encrypt') && !code.includes('hash')) {
      if (code.includes('password') || code.includes('secret') || code.includes('token')) {
        suggestions.push('Ensure sensitive data is encrypted or hashed before storage');
      }
    }

    return suggestions;
  }

  private checkRateLimiting(code: string, language: string): string[] {
    const suggestions: string[] = [];

    const hasApiEndpoints = /route|endpoint|handler|api|controller/gi.test(code);
    const hasRateLimiting = /rateLimit|rate-limit|throttle|limiter|express-rate-limit/gi.test(code);

    if (hasApiEndpoints && !hasRateLimiting) {
      if (language === 'javascript' || language === 'typescript') {
        suggestions.push('Add rate limiting using express-rate-limit or similar middleware');
      } else if (language === 'python') {
        suggestions.push('Add rate limiting using flask-limiter or slowapi');
      }
    }

    const hasAuthEndpoints = /login|auth|register|signup/gi.test(code);
    if (hasAuthEndpoints && !hasRateLimiting) {
      suggestions.push('Add stricter rate limiting to authentication endpoints to prevent brute force attacks');
    }

    return suggestions;
  }
}
