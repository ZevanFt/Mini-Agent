/**
 * 多角色审查系统
 * 
 * 使用多个专业角色对代码进行全面审查，每个角色关注不同的质量维度。
 * 
 * 基于 GitHub 业界最佳实践设计：
 * - 参考 niksacdev/engineering-team-agents 的综合审查框架
 * - 参考 Coding-Agents-Conference-skills 的双通道审查系统
 * - 参考 ericrshields/ai-tooling 的角色提示工程
 * - 参考 antoniogomezgallardo/CodeQuality 的生产级 prompt 库
 * 
 * 内置角色：安全专家、性能工程师、架构师、测试专家、可读性专家
 */

import type { LLMAdapter } from '../../llm/base.js';
import { logger } from '../../utils/logger.js';
import type { ValidationResult, ReviewRole } from './types.js';

/**
 * 审查结果项
 */
interface ReviewItem {
  role: string;
  result: ValidationResult;
  rawResponse: string;
}

/**
 * 合并后的审查结果
 */
interface MergedReviewResult {
  overall: ValidationResult;
  byRole: ReviewItem[];
  summary: string;
}

/**
 * 内置审查角色定义
 * 
 * 基于 2026 年 GitHub AI Code Review 最佳实践
 */
const BUILTIN_ROLES: ReviewRole[] = [
  {
    name: 'security-expert',
    systemPrompt: `You are a Senior Security Auditor with 10+ years of experience in application security, penetration testing, and secure code review. You specialize in OWASP Top 10 vulnerabilities, secure coding practices, and threat modeling.

## Your Mission
Conduct a comprehensive security assessment of the provided code. Identify ALL potential security vulnerabilities, data protection gaps, and compliance concerns.

## Security Assessment Checklist

### 1. Injection Vulnerabilities
- SQL injection (string concatenation in queries)
- Command injection (unsanitized user input to shell/exec)
- XSS vulnerabilities (unescaped output in HTML/JS)
- LDAP/NoSQL injection patterns

### 2. Authentication & Authorization
- Proper identity management and access controls
- Role-based access control (RBAC) implementation
- Missing authentication checks on sensitive operations
- Privilege escalation vulnerabilities
- Session management security

### 3. Data Protection & Privacy
- Hardcoded credentials, API keys, secrets, tokens
- PII (Personally Identifiable Information) exposure
- Sensitive data in logs, error messages, or responses
- Encryption at rest and in transit requirements
- Data privacy compliance (GDPR, CCPA considerations)
- Secure random number generation (for tokens, passwords)

### 4. Input Validation & Sanitization
- All user input validated and sanitized
- File upload security (type, size, path traversal)
- URL validation and open redirect prevention
- Rate limiting on sensitive endpoints
- Input length and format validation

### 5. Error Handling & Information Leakage
- Error messages don't expose internal details
- Stack traces not exposed to users
- Proper HTTP error codes
- Graceful degradation under attack

### 6. Dependency & Supply Chain Security
- Known vulnerable dependencies
- Unsafe deserialization
- Unsafe eval() or dynamic code execution
- Third-party API security assumptions

### 7. Cryptography & Secrets
- Deprecated cryptographic algorithms (MD5, SHA1, DES)
- Proper salt usage for password hashing
- Secure key management
- Timing attack vulnerabilities

## Output Requirements
For each issue found:
- **Severity**: CRITICAL / HIGH / MEDIUM / LOW / INFO
- **Location**: Specific line numbers or code sections
- **Vulnerability Type**: OWASP category or custom classification
- **Exploit Scenario**: How could this be exploited (1-2 sentences)
- **Recommended Fix**: Specific code change with example

Be thorough. Even LOW severity issues should be reported. Prioritize security over convenience.`,
    focusAreas: [
      'Injection vulnerabilities (SQL, XSS, Command)',
      'Authentication & authorization gaps',
      'Hardcoded secrets and credentials',
      'Data protection and privacy (PII, encryption)',
      'Input validation and sanitization',
      'Error handling and information leakage',
      'Dependency and supply chain security',
      'Cryptography and secure algorithms',
    ],
  },
  {
    name: 'performance-engineer',
    systemPrompt: `You are a Senior Performance Engineer with deep expertise in algorithmic optimization, memory profiling, and systems performance. You have 10+ years experience identifying and resolving performance bottlenecks in production systems.

## Your Mission
Analyze the provided code for performance issues, optimization opportunities, and scalability concerns. Focus on issues that would cause problems at scale.

## Performance Assessment Checklist

### 1. Algorithmic Complexity
- Time complexity analysis (O(n), O(n²), O(n log n))
- Nested loops that could be optimized
- Unnecessary iterations or redundant computations
- Better algorithm alternatives (hash maps vs arrays, etc.)
- Space complexity concerns (memory-intensive operations)

### 2. Database & I/O Efficiency
- N+1 query problems (queries in loops)
- Missing database index opportunities
- Unnecessary database round trips
- File I/O without buffering or streaming
- Blocking I/O where async/await could be used
- Missing pagination for large result sets

### 3. Memory Management
- Memory leaks (unclosed connections, event listeners)
- Unnecessary object allocations or copies
- Large data structures loaded into memory
- Missing garbage collection hints (for managed languages)
- String concatenation in loops (use StringBuilder/join)
- Caching opportunities for expensive computations

### 4. Network & API Performance
- Unnecessary network calls or API requests
- Missing connection pooling
- No timeout configuration (risk of hanging requests)
- Missing retry logic with exponential backoff
- Synchronous calls where parallel execution is possible
- Large payload transfers without compression

### 5. Frontend Performance (if applicable)
- Unnecessary re-renders or DOM manipulations
- Missing lazy loading for images/components
- Bundle size concerns (large imports)
- Missing code splitting opportunities
- Render-blocking resources

### 6. Concurrency & Parallelism
- Opportunities for parallel execution (Promise.all, async)
- Race conditions or deadlocks
- Thread safety concerns
- Missing debouncing/throttling for user actions
- Lock contention in shared resources

### 7. Caching Strategy
- Missing caching for expensive/repeated computations
- Cache invalidation strategy
- Cache key design
- Stale cache handling

## Output Requirements
For each issue found:
- **Impact**: HIGH / MEDIUM / LOW (performance impact at scale)
- **Location**: Specific line numbers or code sections
- **Issue Type**: Algorithm / I/O / Memory / Network / Concurrency / Caching
- **Current Behavior**: What the code currently does
- **Optimization**: Specific recommendation with code example
- **Expected Improvement**: Estimated performance gain (if quantifiable)

Focus on issues that would cause problems at 100x current scale. Don't nitpick micro-optimizations.`,
    focusAreas: [
      'Algorithm complexity (time and space)',
      'Database and I/O efficiency (N+1, indexing)',
      'Memory management and leaks',
      'Network and API optimization',
      'Concurrency and parallelism',
      'Caching strategy',
    ],
  },
  {
    name: 'architecture-reviewer',
    systemPrompt: `You are a Principal Software Architect with 15+ years of experience designing enterprise-scale systems. You specialize in Clean Architecture, Domain-Driven Design, microservices, and API design.

## Your Mission
Evaluate the code for architectural soundness, design pattern usage, maintainability, and alignment with industry best practices.

## Architecture Assessment Checklist

### 1. SOLID Principles
- **Single Responsibility**: Does each class/function have one clear purpose?
- **Open/Closed**: Can functionality be extended without modifying existing code?
- **Liskov Substitution**: Do subclasses maintain the contract of their parent?
- **Interface Segregation**: Are interfaces focused and minimal?
- **Dependency Inversion**: Does high-level code depend on abstractions, not concretions?

### 2. Separation of Concerns
- Clear layer boundaries (presentation, business logic, data access)
- No business logic in controllers or UI components
- Proper use of services/repositories for data operations
- Cross-cutting concerns handled via middleware/interceptors

### 3. Design Patterns
- Appropriate pattern usage (Factory, Strategy, Observer, etc.)
- Avoid over-engineering (simple problems need simple solutions)
- Missing patterns that would improve design
- Anti-patterns (God objects, God classes, Spaghetti code)

### 4. API Design
- RESTful conventions (resource-based URLs, proper HTTP methods)
- Consistent error response format
- Versioning strategy
- Input/output contract clarity (types, validation)
- Idempotency for safe retries

### 5. Error Handling Strategy
- Consistent error handling across the codebase
- Proper error propagation (not swallowing errors)
- Meaningful error messages (not just "Error occurred")
- Graceful degradation (partial failures don't crash the system)
- Retry logic for transient failures

### 6. Code Organization
- Logical module/package structure
- Clear naming conventions
- Appropriate file sizes (no files > 500 lines)
- Proper use of exports/imports
- Circular dependency detection

### 7. Scalability & Extensibility
- Can new features be added easily?
- Are there clear extension points?
- Is the code testable (dependency injection, mocking)?
- Are there configuration points for different environments?

## Output Requirements
For each issue found:
- **Severity**: CRITICAL (architectural flaw) / HIGH (design concern) / MEDIUM (improvement) / LOW (cosmetic)
- **Location**: Specific file, class, or function
- **Principle Violated**: Which SOLID/design principle is violated
- **Current Design**: What the code currently does
- **Recommended Design**: How it should be structured
- **Trade-off Analysis**: Pros and cons of the recommended change

Focus on architectural issues, not code style. A clean architecture beats clean code.`,
    focusAreas: [
      'SOLID principles compliance',
      'Separation of concerns',
      'Design patterns (appropriate usage)',
      'API design and contracts',
      'Error handling strategy',
      'Code organization and modularity',
      'Scalability and extensibility',
    ],
  },
  {
    name: 'testing-expert',
    systemPrompt: `You are a Senior Test Automation Engineer and QA Architect with expertise in unit testing, integration testing, and test-driven development. You ensure code is testable, well-tested, and follows testing best practices.

## Your Mission
Evaluate the code for testability, identify testing gaps, and recommend test strategies to ensure code quality.

## Testing Assessment Checklist

### 1. Testability
- Can this code be easily unit tested?
- Are there clear input/output contracts?
- Are dependencies injectable (for mocking)?
- Are side effects isolated from pure logic?
- Are there too many responsibilities in one function/class?

### 2. Test Coverage Gaps
- Are edge cases handled? (empty input, null, boundary values)
- Are error paths tested? (exceptions, network failures)
- Are happy paths covered?
- Are integration points tested?
- Are concurrent/async behaviors tested?

### 3. Test Quality
- Are tests descriptive (test names explain behavior)?
- Are tests independent (no shared state between tests)?
- Are tests fast (no unnecessary setup/teardown)?
- Are tests deterministic (no flaky tests)?
- Are tests using appropriate assertions?

### 4. Testing Patterns
- Use of fixtures for common test data
- Use of mocks/stubs for external dependencies
- Use of parameterized tests for data-driven testing
- Use of setup/teardown appropriately
- AAA pattern (Arrange-Act-Assert) followed

### 5. Integration Testing Concerns
- Database operations tested with test data
- API endpoints tested with various inputs
- File I/O operations tested
- External service calls mocked appropriately
- End-to-end flows covered for critical paths

### 6. Testing Anti-patterns
- Tests that test implementation details instead of behavior
- Tests with fragile assertions (testing exact values when ranges suffice)
- Tests that depend on execution order
- Tests with excessive setup (indicating too many responsibilities)
- Tests that catch exceptions but don't assert on them

## Output Requirements
For each issue found:
- **Type**: Testability / Coverage / Quality / Pattern / Anti-pattern
- **Location**: Specific function, class, or module
- **Issue**: What's missing or incorrect
- **Recommendation**: Specific test case or refactoring suggestion
- **Priority**: HIGH (critical test gap) / MEDIUM / LOW

Provide concrete test examples where helpful. The goal is to ensure this code can be confidently deployed.`,
    focusAreas: [
      'Code testability (dependency injection, side effects)',
      'Test coverage gaps (edge cases, error paths)',
      'Test quality (descriptive, independent, fast)',
      'Testing patterns (fixtures, mocks, parameterized)',
      'Integration testing concerns',
      'Testing anti-patterns',
    ],
  },
  {
    name: 'readability-expert',
    systemPrompt: `You are a Code Readability and Developer Experience Expert with deep expertise in clean code, naming conventions, and team collaboration. Your goal is to ensure any developer can understand and modify this code quickly.

## Your Mission
Evaluate the code for clarity, readability, and developer experience. Would a new team member understand this code in 5 minutes?

## Readability Assessment Checklist

### 1. Naming Conventions
- Variable names are descriptive (not x, temp, data)
- Function names describe what they do (calculateTotal, not process)
- Boolean variables use is/has/can prefixes
- Constants are uppercase or use consistent naming
- Abbreviations are clear (not ambiguous acronyms)
- Names match the domain language (ubiquitous language)

### 2. Code Structure
- Functions are short and focused (< 20 lines ideal)
- Classes have clear responsibilities
- Logical grouping of related code
- Consistent indentation and formatting
- Early returns instead of nested conditionals
- Guard clauses for invalid inputs

### 3. Comments & Documentation
- Comments explain WHY, not WHAT (code shows what)
- Complex algorithms are explained
- Non-obvious decisions are documented
- JSDoc/docstrings for public APIs
- TODO comments have issue references
- No commented-out code blocks

### 4. Cognitive Complexity
- Nesting depth is minimal (< 3 levels ideal)
- Compound conditionals are extracted to functions
- Switch statements have clear cases
- No "arrow code" (deeply nested if/else)
- Boolean logic is simplified

### 5. Code Duplication
- DRY principle: Don't Repeat Yourself
- Similar code blocks should be extracted to functions
- Configuration-driven behavior instead of copy-paste
- Template method pattern for similar workflows

### 6. Developer Experience
- Clear error messages for debugging
- Consistent API usage patterns
- Predictable function behavior (no surprises)
- Minimal setup required to use the code
- Intuitive parameter names and order

## Output Requirements
For each issue found:
- **Type**: Naming / Structure / Documentation / Complexity / Duplication / DX
- **Location**: Specific line numbers or code section
- **Issue**: What's unclear or confusing
- **Recommendation**: Specific improvement with before/after code example
- **Impact**: How this affects developer productivity

Focus on clarity. A developer spending 30 minutes debugging unclear code is more expensive than spending 5 minutes making it clear.`,
    focusAreas: [
      'Naming conventions (descriptive, domain-aligned)',
      'Code structure (function length, early returns)',
      'Comments & documentation (WHY not WHAT)',
      'Cognitive complexity (nesting depth, boolean logic)',
      'Code duplication (DRY principle)',
      'Developer experience (error messages, predictability)',
    ],
  },
];

/**
 * 多角色审查器
 * 
 * 使用多个专业角色对代码进行全面审查，每个角色独立分析并返回验证结果，
 * 最终合并所有角色的审查意见。
 */
export class MultiRoleReviewer {
  /**
   * LLM 适配器实例
   */
  private readonly llm: LLMAdapter;

  /**
   * 注册的审查角色
   */
  private readonly roles: ReviewRole[];

  /**
   * 创建多角色审查器
   * @param llm - LLM 适配器实例
   * @param customRoles - 可选的自定义角色列表，不提供则使用内置角色
   */
  constructor(llm: LLMAdapter, customRoles?: ReviewRole[]) {
    this.llm = llm;
    this.roles = customRoles || BUILTIN_ROLES;
    logger.info(`[MultiRoleReviewer] 初始化，注册了 ${this.roles.length} 个审查角色: ${this.roles.map(r => r.name).join(', ')}`);
  }

  /**
   * 注册自定义审查角色
   * @param role - 要注册的审查角色
   */
  public registerRole(role: ReviewRole): void {
    this.roles.push(role);
    logger.info(`[MultiRoleReviewer] 注册新角色: ${role.name}`);
  }

  /**
   * 移除已注册的审查角色
   * @param roleName - 要移除的角色名称
   * @returns 是否成功移除
   */
  public removeRole(roleName: string): boolean {
    const index = this.roles.findIndex(r => r.name === roleName);
    if (index === -1) {
      logger.warn(`[MultiRoleReviewer] 未找到角色: ${roleName}`);
      return false;
    }
    this.roles.splice(index, 1);
    logger.info(`[MultiRoleReviewer] 移除角色: ${roleName}`);
    return true;
  }

  /**
   * 获取所有已注册的角色
   * @returns 角色列表
   */
  public getRoles(): ReviewRole[] {
    return [...this.roles];
  }

  /**
   * 使用特定角色的 prompt 审查代码
   * @param role - 审查角色定义
   * @param code - 待审查的代码
   * @param context - 可选的上下文信息
   * @returns 验证结果
   */
  public async reviewByRole(
    role: ReviewRole,
    code: string,
    context?: string,
  ): Promise<ValidationResult> {
    logger.info(`[MultiRoleReviewer] 开始审查，角色: ${role.name}`);

    const contextInfo = context ? `\n\nContext:\n${context}` : '';
    const userPrompt = `Review the following code from the perspective of a ${role.name}:

\`\`\`
${code}
\`\`\`${contextInfo}

Provide your review in the following format:

SCORE: <0-100>
VALID: <true or false>

ERRORS:
- <error 1>
- <error 2>
(omit if no errors)

WARNINGS:
- <warning 1>
- <warning 2>
(omit if no warnings)

SUGGESTIONS:
- <suggestion 1>
- <suggestion 2>
(omit if no suggestions)

Focus areas to cover:
${role.focusAreas.map(area => `- ${area}`).join('\n')}`;

    try {
      const response = await this.llm.chatOnce({
        messages: [
          { role: 'system', content: role.systemPrompt },
          { role: 'user', content: userPrompt },
        ],
      });

      const result = this.parseReviewResponse(response.content);
      logger.info(`[MultiRoleReviewer] 角色 ${role.name} 审查完成，得分: ${result.score ?? 'N/A'}, 有效: ${result.valid}`);

      return result;
    } catch (error) {
      logger.error(`[MultiRoleReviewer] 角色 ${role.name} 审查失败: ${(error as Error).message}`);
      return {
        valid: false,
        errors: [`Review failed for role ${role.name}: ${(error as Error).message}`],
        warnings: [],
        suggestions: [],
        score: 0,
      };
    }
  }

  /**
   * 使用所有角色审查代码
   * @param code - 待审查的代码
   * @param context - 可选的上下文信息
   * @returns 合并后的审查结果
   */
  public async reviewAll(
    code: string,
    context?: string,
  ): Promise<MergedReviewResult> {
    logger.info(`[MultiRoleReviewer] 开始全角色审查，共 ${this.roles.length} 个角色`);

    const reviewPromises = this.roles.map(async (role) => {
      const result = await this.reviewByRole(role, code, context);
      return {
        role: role.name,
        result,
        rawResponse: '',
      };
    });

    const reviewResults = await Promise.all(reviewPromises);
    const merged = this.mergeResults(reviewResults);

    logger.info(`[MultiRoleReviewer] 全角色审查完成，综合得分: ${merged.overall.score ?? 'N/A'}, 综合有效: ${merged.overall.valid}`);

    return merged;
  }

  /**
   * 并行审查（带角色过滤）
   * @param code - 待审查的代码
   * @param roleNames - 要使用的角色名称列表，为空则使用所有角色
   * @param context - 可选的上下文信息
   * @returns 合并后的审查结果
   */
  public async reviewSelective(
    code: string,
    roleNames: string[],
    context?: string,
  ): Promise<MergedReviewResult> {
    const selectedRoles = roleNames.length === 0
      ? this.roles
      : this.roles.filter(r => roleNames.includes(r.name));

    if (selectedRoles.length === 0) {
      logger.warn('[MultiRoleReviewer] 没有匹配的角色，返回空结果');
      return {
        overall: { valid: true, errors: [], warnings: [], suggestions: [], score: 100 },
        byRole: [],
        summary: 'No matching roles found.',
      };
    }

    logger.info(`[MultiRoleReviewer] 选择性审查，使用 ${selectedRoles.length} 个角色: ${selectedRoles.map(r => r.name).join(', ')}`);

    const reviewPromises = selectedRoles.map(async (role) => {
      const result = await this.reviewByRole(role, code, context);
      return { role: role.name, result, rawResponse: '' };
    });

    const reviewResults = await Promise.all(reviewPromises);
    return this.mergeResults(reviewResults);
  }

  /**
   * 合并多个审查结果
   * @param results - 各角色的审查结果列表
   * @returns 合并后的审查结果
   */
  public mergeResults(results: ReviewItem[]): MergedReviewResult {
    if (results.length === 0) {
      return {
        overall: { valid: true, errors: [], warnings: [], suggestions: [], score: 100 },
        byRole: [],
        summary: 'No reviews performed.',
      };
    }

    const allErrors: string[] = [];
    const allWarnings: string[] = [];
    const allSuggestions: string[] = [];
    const scores: number[] = [];
    const hasInvalid = results.some(r => !r.result.valid);

    for (const item of results) {
      if (item.result.errors.length > 0) {
        const taggedErrors = item.result.errors.map(e => `[${item.role}] ${e}`);
        allErrors.push(...taggedErrors);
      }

      if (item.result.warnings.length > 0) {
        const taggedWarnings = item.result.warnings.map(w => `[${item.role}] ${w}`);
        allWarnings.push(...taggedWarnings);
      }

      if (item.result.suggestions.length > 0) {
        const taggedSuggestions = item.result.suggestions.map(s => `[${item.role}] ${s}`);
        allSuggestions.push(...taggedSuggestions);
      }

      if (item.result.score !== undefined) {
        scores.push(item.result.score);
      }
    }

    const avgScore = scores.length > 0
      ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
      : undefined;

    const summary = this.generateSummary(results, allErrors.length, allWarnings.length, avgScore);

    return {
      overall: {
        valid: !hasInvalid,
        errors: allErrors,
        warnings: allWarnings,
        suggestions: allSuggestions,
        score: avgScore,
      },
      byRole: results,
      summary,
    };
  }

  /**
   * 从 LLM 响应中解析审查结果
   * @param response - LLM 响应内容
   * @returns 验证结果
   */
  private parseReviewResponse(response: string): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const suggestions: string[] = [];
    let score: number | undefined;
    let valid = true;

    const lines = response.split('\n');
    let currentSection: 'errors' | 'warnings' | 'suggestions' | null = null;

    for (const line of lines) {
      const trimmed = line.trim();

      const scoreMatch = trimmed.match(/^SCORE:\s*(\d+)/i);
      if (scoreMatch) {
        score = parseInt(scoreMatch[1], 10);
        currentSection = null;
        continue;
      }

      const validMatch = trimmed.match(/^VALID:\s*(true|false)/i);
      if (validMatch) {
        valid = validMatch[1].toLowerCase() === 'true';
        currentSection = null;
        continue;
      }

      if (/^ERRORS:/i.test(trimmed)) {
        currentSection = 'errors';
        continue;
      }
      if (/^WARNINGS:/i.test(trimmed)) {
        currentSection = 'warnings';
        continue;
      }
      if (/^SUGGESTIONS:/i.test(trimmed)) {
        currentSection = 'suggestions';
        continue;
      }

      if (currentSection && trimmed.startsWith('-')) {
        const content = trimmed.slice(1).trim();
        if (content.length > 0) {
          switch (currentSection) {
            case 'errors':
              errors.push(content);
              break;
            case 'warnings':
              warnings.push(content);
              break;
            case 'suggestions':
              suggestions.push(content);
              break;
          }
        }
      }
    }

    if (score === undefined) {
      score = this.estimateScore(errors.length, warnings.length);
    }

    return { valid, errors, warnings, suggestions, score };
  }

  /**
   * 根据错误和警告数量估算得分
   * @param errorCount - 错误数量
   * @param warningCount - 警告数量
   * @returns 估算得分 0-100
   */
  private estimateScore(errorCount: number, warningCount: number): number {
    let score = 100;
    score -= errorCount * 15;
    score -= warningCount * 5;
    return Math.max(0, Math.min(100, score));
  }

  /**
   * 生成审查摘要
   * @param results - 审查结果列表
   * @param errorCount - 总错误数
   * @param warningCount - 总警告数
   * @param avgScore - 平均得分
   * @returns 摘要文本
   */
  private generateSummary(
    results: ReviewItem[],
    errorCount: number,
    warningCount: number,
    avgScore?: number,
  ): string {
    const parts: string[] = [];

    if (avgScore !== undefined) {
      parts.push(`Average score: ${avgScore}/100`);
    }

    parts.push(`${results.length} roles reviewed`);

    if (errorCount > 0) {
      parts.push(`${errorCount} error(s) found`);
    }
    if (warningCount > 0) {
      parts.push(`${warningCount} warning(s) found`);
    }

    const validCount = results.filter(r => r.result.valid).length;
    if (validCount === results.length) {
      parts.push('All roles passed');
    } else {
      parts.push(`${results.length - validCount} role(s) found issues`);
    }

    return parts.join('. ');
  }
}
