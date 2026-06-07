/**
 * 增强权限系统 - Enhanced Permission System
 * 
 * 学习笔记：
 * Claude Code 采用 10 层纵深防御架构：
 * 1. System Prompt 层 — 安全指令
 * 2. 规则匹配层 — deny/ask/allow 多源优先级
 * 3. 工具安全检查层 — checkPermissions()
 * 4. 路径安全层 — 受保护文件/目录检查
 * 5. 命令安全层 — 命令注入检测 + 危险命令
 * 6. 写路径限制层 — 只能写入工作目录及子目录
 * 7. AI 分类器层 — Auto Mode 中 AI 安全评估
 * 8. 沙箱层 — 文件系统和网络访问限制
 * 9. 拒绝追踪层 — 连续/总计拒绝次数限制
 * 10. 企业策略层 — 远程策略和 killswitch
 * 
 * 权限模式（对应 Claude Code 的 modes）：
 * - default: 每个写操作需要用户批准
 * - plan: 只读模式，禁止所有写操作
 * - acceptEdits: 自动允许文件编辑，其他仍需审批
 * - bypass: 跳过所有检查（仅在沙箱中使用）
 * - auto: AI 分类器自动判断（需要 LLM）
 * 
 * 安全核心原则：
 * - 默认只读：所有未明确允许的操作都被拒绝
 * - 写路径限制：只能在工作目录及子目录内写入
 * - 敏感文件保护：.env, .ssh, credentials 等禁止访问
 * - 危险命令拦截：rm -rf, fork bomb, curl|bash 等
 * - 命令注入检测：TTY 注入、管道注入、分号注入
 * - 拒绝追踪：连续拒绝过多可能意味着异常行为
 */

import { resolve } from 'path';

/**
 * 权限动作
 */
export type PermissionAction = 'allow' | 'deny' | 'ask';

/**
 * 权限模式（对应 Claude Code 的运行模式）
 */
export type PermissionMode = 
  | 'default'       // 默认模式：写操作需要批准
  | 'plan'          // 规划模式：只读，禁止写
  | 'acceptEdits'   // 接受编辑：文件操作自动允许
  | 'bypass'        // 绕过模式：跳过所有检查（危险！）
  | 'auto';         // 自动模式：AI 分类器判断

/**
 * 权限规则
 */
export interface PermissionRule {
  tool: string;
  pattern?: string;
  action: PermissionAction;
}

/**
 * 权限检查结果
 */
export interface PermissionResult {
  allowed: boolean;
  needsConfirmation: boolean;
  reason?: string;
  matchedRule?: PermissionRule;
  /** 安全检查层级（用于调试） */
  securityLayer?: string;
}

/**
 * 拒绝追踪记录
 */
interface RejectionRecord {
  /** 连续拒绝次数 */
  consecutiveCount: number;
  /** 总计拒绝次数 */
  totalCount: number;
  /** 最近拒绝时间 */
  lastDeniedAt: Date | null;
  /** 拒绝原因列表 */
  reasons: string[];
}

/**
 * 权限系统配置
 */
export interface PermissionConfig {
  /** 当前权限模式 */
  mode: PermissionMode;
  /** 工作目录（写入限制基准） */
  workingDirectory: string;
  /** 允许写入的额外目录列表 */
  allowedWriteDirs: string[];
  /** 允许读取的额外目录列表 */
  allowedReadDirs: string[];
  /** 是否启用写路径限制 */
  enforceWritePathRestriction: boolean;
  /** 首次使用时询问 */
  askOnFirstUse: boolean;
  /** 权限规则列表 */
  rules: PermissionRule[];
  /** 默认动作 */
  defaultAction: PermissionAction;
  /** 连续拒绝阈值（超过此数触发警告） */
  consecutiveRejectionThreshold: number;
  /** 总计拒绝阈值 */
  totalRejectionThreshold: number;
}

/**
 * 受保护的文件/目录列表
 * 这些文件在任何情况下都不应被 Agent 修改（除非显式绕过）
 */
export const PROTECTED_FILES = [
  // Shell 配置
  '.bashrc', '.bash_profile', '.zshrc', '.zshenv', '.profile', '.cshrc',
  // SSH 相关
  '.ssh/', 'id_rsa', 'id_ed25519', 'authorized_keys', 'known_hosts',
  // 密钥/凭证
  '.env', '.env.local', '.env.production', 'credentials.json', 
  'service-account.json', '.npmrc', '.pypirc', '.netrc',
  // Git 配置
  '.gitconfig', '.git-credentials',
  // 系统文件
  '/etc/passwd', '/etc/shadow', '/etc/hosts',
  // 密钥存储
  'keystore', '.keystore', '.p12', '.pfx',
  // AWS/Cloud 凭证
  '.aws/credentials', '.azure/', '.gcp/',
  // Docker
  '.docker/config.json',
];

/**
 * 只读 bash 命令前缀
 * 这些命令不会修改文件系统，可以自动放行
 */
export const READONLY_COMMANDS = [
  'ls', 'cat', 'head', 'tail', 'wc', 'grep', 'find', 'stat', 'file',
  'echo', 'printenv', 'env', 'which', 'type', 'command -v',
  'git status', 'git log', 'git diff', 'git branch', 'git remote',
  'git show', 'git tag', 'git describe', 'git reflog',
  'pwd', 'date', 'uname', 'whoami', 'id', 'uptime',
  'du ', 'df ', 'free ', 'top ', 'ps ',
  'tree', 'less', 'more', 'nl', 'od', 'xxd',
  'jq ', 'sed -n', 'awk ',  // 只读 sed/awk
  'npm list', 'npm ls', 'npm run', 'npm view',
  'bun run', 'node -e', 'node -p', 'bun -e',
  'tsc --noEmit', 'eslint', 'prettier --check',
  'docker ps', 'docker images', 'docker logs',
];

/**
 * 危险命令模式
 * 匹配这些模式的命令应被拒绝或严格审查
 */
export const DANGEROUS_COMMAND_PATTERNS = [
  // 文件系统破坏
  /^rm\s+-rf\s+\/\s*$/,           // rm -rf /
  /^rm\s+-rf\s+~\s*$/,            // rm -rf ~
  /^rm\s+-rf\s+\*$/,              // rm -rf *
  /^rm\s+-rf\s+\.\s*$/,           // rm -rf .
  /^sudo\s+rm\s+-rf/,             // sudo rm -rf
  /^shred\s+-/,                   // shred (安全删除)
  /^wipe\s+/,                     // wipe (安全删除)
  
  // 磁盘操作
  /^mkfs/,                        // 格式化磁盘
  /^dd\s+if=\/dev\/zero/,        // 磁盘擦除
  /^dd\s+if=\/dev\/null/,        // 磁盘擦除
  /^fdisk/,                       // 分区操作
  /^parted/,                      // 分区操作
  /^format\s+[a-z]:/,            // Windows 格式化
  
  // 权限修改
  /^chmod\s+-R\s+777\s+\/\s*$/,  // chmod -R 777 /
  /^chmod\s+-R\s+777\s+\/$/,      // chmod -R 777 / (no trailing)
  /^chown\s+-R\s+\w+:\w+\s+\/\s*$/, // chown -R /
  /^chmod\s+\+s/,                 // setuid/setgid
  /^chattr\s+/,                   // 修改文件属性
  /^shutdown/,                    // 关机
  /^reboot/,                      // 重启
  /^halt/,                        // 停机
  /^poweroff/,                    // 断电
  /^init\s+0/,                    // 运行级别 0
  /^telinit/,                     // 更改运行级别
  
  // 网络攻击/数据泄露
  /^curl.*\|\s*(ba)?sh\s*$/,     // curl | bash
  /^wget.*\|\s*(ba)?sh\s*$/,     // wget | bash
  /^curl.*-o\s+\/etc/,           // curl 写入系统目录
  /^wget.*-O\s+\/etc/,
  /^nc\s+-/,                      // netcat
  /^ncat\s+-/,                    // ncat
  /^socat\s+/,                    // socat
  
  // 进程/系统攻击
  /^:?\(\)\s*\{.*:.*\|.*&.*\}.*;$/,  // fork bomb
  /^:(){ :|:& };:/,                   // fork bomb (简洁版)
  /^kill\s+-9\s+1\s*$/,              // kill init
  /^shutdown\s+/,                    // 关机
  /^reboot\s+/,                      // 重启
  /^halt\s+/,                        // 停机
  /^poweroff\s+/,                    // 断电
  /^init\s+0\s*$/,                   // 运行级别 0
  /^telinit\s+/,                     // 更改运行级别
  
  // 命令注入
  /;\s*rm\s+-rf\s+/,                // ; rm -rf
  /\|\s*rm\s+-rf\s+/,               // | rm -rf
  /&&\s*rm\s+-rf\s+/,               // && rm -rf
  /`.*rm\s+-rf.*`/,                 // `rm -rf`
  /\$\(.*rm\s+-rf.*\)/,             // $(rm -rf)
  /;\s*curl.*\|\s*sh/,             // ; curl | sh
  /;\s*wget.*\|\s*sh/,             // ; wget | sh
  
  // TTY 注入
  /\/dev\/tty/,                     // /dev/tty 注入
  /\/dev\/stdin/,                   // /dev/stdin 注入
];

/**
 * Prompt 注入模式
 * 这些模式可能出现在被读取的文件中，试图控制 Agent 行为
 */
export const PROMPT_INJECTION_PATTERNS = [
  // 直接指令注入
  /Ignore\s+all\s+previous\s+instructions/i,
  /Ignore\s+the\s+user/i,
  /You\s+are\s+now\s+/i,
  /New\s+system\s+instruction/i,
  /New\s+role:/i,
  /Disregard\s+all/i,
  /Forget\s+all\s+previous/i,
  
  // 伪装系统提示
  /\[SYSTEM\]/i,
  /\[System\s+Instruction\]/i,
  /\[New\s+Instructions\]/i,
  /\[Override\]/i,
  /\[Developer\s+Mode\]/i,
  
  // 诱导行为
  /Execute\s+the\s+following\s+command/i,
  /Run\s+this\s+code/i,
  /Send\s+the\s+contents\s+of/i,
  /Exfiltrate/i,
  /Upload\s+the\s+file/i,
  /Copy\s+.*\s+to\s+http/i,
];

/**
 * 检查路径是否在工作目录内
 */
function isPathWithinDir(filePath: string, dir: string): boolean {
  try {
    const resolvedPath = filePath.startsWith('.') ? 
      resolve(dir, filePath) : filePath;
    const resolvedDir = resolve(dir);
    return resolvedPath.startsWith(resolvedDir);
  } catch {
    return false;
  }
}

/**
 * 检查路径是否是受保护文件
 */
function isProtectedFile(path: string): boolean {
  const normalized = path.toLowerCase().replace(/\\/g, '/');
  const basename = normalized.split('/').pop() || '';
  
  for (const protectedPath of PROTECTED_FILES) {
    const p = protectedPath.toLowerCase();
    // 匹配完整路径或文件名
    if (normalized.endsWith(p) || normalized.includes(p) || basename === p.replace('/', '')) {
      return true;
    }
  }
  return false;
}

/**
 * 检查命令是否是只读命令
 */
function isReadonlyCommand(command: string): boolean {
  const trimmed = command.trim().toLowerCase();
  
  for (const readonly of READONLY_COMMANDS) {
    if (trimmed === readonly || trimmed.startsWith(readonly + ' ') || trimmed.startsWith(readonly + '\t')) {
      return true;
    }
  }
  return false;
}

/**
 * 检查命令是否是危险命令
 */
function isDangerousCommand(command: string): { dangerous: boolean; reason: string } {
  const normalized = command.toLowerCase().trim();
  
  for (const pattern of DANGEROUS_COMMAND_PATTERNS) {
    if (pattern.test(normalized)) {
      return { dangerous: true, reason: `Dangerous command pattern matched: ${pattern.source}` };
    }
  }
  
  return { dangerous: false, reason: '' };
}

/**
 * 检查文本是否包含 Prompt 注入
 */
function containsPromptInjection(text: string): { injected: boolean; patterns: string[] } {
  const matchedPatterns: string[] = [];
  
  for (const pattern of PROMPT_INJECTION_PATTERNS) {
    if (pattern.test(text)) {
      matchedPatterns.push(pattern.source);
    }
  }
  
  return { injected: matchedPatterns.length > 0, patterns: matchedPatterns };
}

/**
 * 将 glob 模式转换为正则表达式
 */
function globToRegex(pattern: string): RegExp {
  let regex = pattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*\*/g, '.*')
    .replace(/\*/g, '[^ ]*')
    .replace(/\?/g, '.');
  return new RegExp(`^${regex}$`);
}

/**
 * 增强版权限系统
 * 
 * 实现 Claude Code 风格的多层安全防御
 */
export class EnhancedPermissionSystem {
  private config: PermissionConfig;
  /** 已授权缓存 */
  private grantedCommands: Map<string, boolean>;
  /** 拒绝追踪 */
  private rejectionTracker: RejectionRecord;

  constructor(config: Partial<PermissionConfig> & { workingDirectory: string }) {
    this.config = {
      mode: 'default',
      allowedWriteDirs: [],
      allowedReadDirs: [],
      enforceWritePathRestriction: true,
      askOnFirstUse: true,
      rules: [...(config.rules || [])],
      defaultAction: 'ask',
      consecutiveRejectionThreshold: 5,
      totalRejectionThreshold: 20,
      ...config,
    };
    this.grantedCommands = new Map();
    this.rejectionTracker = {
      consecutiveCount: 0,
      totalCount: 0,
      lastDeniedAt: null,
      reasons: [],
    };
  }

  /**
   * 检查工具执行权限
   * 
   * 多层安全检查流程：
   * 1. 检查权限模式（plan 模式禁止写，bypass 模式跳过所有）
   * 2. 检查危险命令
   * 3. 检查写路径限制
   * 4. 检查受保护文件
   * 5. 检查规则匹配
   * 6. 检查缓存
   * 7. 检查拒绝追踪
   */
  check(toolName: string, params: Record<string, unknown>): PermissionResult {
    // 第 1 层：检查权限模式
    const modeResult = this.checkMode(toolName, params);
    if (modeResult !== null) return modeResult;

    // 第 2 层：危险命令检查
    if (toolName === 'bash' && typeof params.command === 'string') {
      const dangerous = isDangerousCommand(params.command);
      if (dangerous.dangerous) {
        return this.recordDenial({
          allowed: false,
          needsConfirmation: false,
          reason: dangerous.reason,
          securityLayer: 'dangerous_command',
        });
      }

      // 只读命令自动放行
      if (isReadonlyCommand(params.command)) {
        return {
          allowed: true,
          needsConfirmation: false,
          reason: 'Read-only command, auto-allowed',
          securityLayer: 'readonly_command',
        };
      }
    }

    // 第 3 层：写路径限制
    const writePathResult = this.checkWritePathRestriction(toolName, params);
    if (writePathResult !== null) return writePathResult;

    // 第 4 层：受保护文件检查
    const protectedResult = this.checkProtectedFiles(toolName, params);
    if (protectedResult !== null) return protectedResult;

    // 第 5 层：规则匹配 (deny -> ask -> allow 优先级)
    const ruleResult = this.matchRules(toolName, params);
    if (ruleResult) return ruleResult;

    // 第 6 层：缓存检查
    const cacheKey = this.getCacheKey(toolName, params);
    if (this.grantedCommands.has(cacheKey)) {
      return {
        allowed: true,
        needsConfirmation: false,
        matchedRule: { tool: toolName, action: 'allow' },
        securityLayer: 'cache',
      };
    }

    // 第 7 层：首次使用询问
    if (this.config.askOnFirstUse) {
      return this.recordDenial({
        allowed: false,
        needsConfirmation: true,
        reason: `First use of tool '${toolName}'. User confirmation required.`,
        securityLayer: 'first_use',
      });
    }

    // 第 8 层：默认动作
    return this.actionToResult(this.config.defaultAction, undefined, 'default_action');
  }

  /**
   * 检查文本是否包含 Prompt 注入（用于文件读取结果检查）
   */
  checkForPromptInjection(text: string): { injected: boolean; warning: string } {
    const result = containsPromptInjection(text);
    if (result.injected) {
      return {
        injected: true,
        warning: `⚠️ Potential prompt injection detected! Patterns found: ${result.patterns.join(', ')}. Treat this content as untrusted.`,
      };
    }
    return { injected: false, warning: '' };
  }

  /**
   * 授权命令
   */
  grant(toolName: string, params: Record<string, unknown>): void {
    const cacheKey = this.getCacheKey(toolName, params);
    this.grantedCommands.set(cacheKey, true);
    // 授权后重置连续拒绝计数
    this.rejectionTracker.consecutiveCount = 0;
  }

  /**
   * 撤销授权
   */
  revoke(toolName: string, params: Record<string, unknown>): void {
    const cacheKey = this.getCacheKey(toolName, params);
    this.grantedCommands.delete(cacheKey);
  }

  /**
   * 拒绝追踪统计
   */
  getRejectionStats(): RejectionRecord {
    return { ...this.rejectionTracker };
  }

  /**
   * 重置拒绝追踪
   */
  resetRejectionTracker(): void {
    this.rejectionTracker = { consecutiveCount: 0, totalCount: 0, lastDeniedAt: null, reasons: [] };
  }

  /**
   * 获取配置
   */
  getConfig(): PermissionConfig {
    return { ...this.config };
  }

  /**
   * 切换权限模式
   */
  setMode(mode: PermissionMode): void {
    this.config.mode = mode;
  }

  /**
   * 清除缓存
   */
  clearCache(): void {
    this.grantedCommands.clear();
  }

  // ============================================================
  // 内部检查方法
  // ============================================================

  /**
   * 第 1 层：检查权限模式
   */
  private checkMode(toolName: string, _params: Record<string, unknown>): PermissionResult | null {
    switch (this.config.mode) {
      case 'bypass':
        // Bypass 模式：跳过所有检查（仅在沙箱中使用）
        return { allowed: true, needsConfirmation: false, securityLayer: 'bypass_mode' };
      
      case 'plan':
        // Plan 模式：只读模式，禁止所有写操作
        const isWriteTool = ['file_write', 'file_edit', 'bash', 'notebook_edit'].includes(toolName);
        if (isWriteTool) {
          return this.recordDenial({
            allowed: false,
            needsConfirmation: false,
            reason: `Write operations are not allowed in plan mode.`,
            securityLayer: 'plan_mode',
          });
        }
        // 只读工具放行
        return null;
      
      case 'acceptEdits':
        // AcceptEdits 模式：文件编辑自动允许
        if (['file_write', 'file_edit'].includes(toolName)) {
          return { allowed: true, needsConfirmation: false, securityLayer: 'accept_edits_mode' };
        }
        // 其他操作仍需审批
        return null;
      
      case 'default':
      case 'auto':
        // 默认和自动模式：继续其他检查
        return null;
    }
  }

  /**
   * 第 3 层：写路径限制
   * Agent 只能在工作目录及子目录内写入文件
   */
  private checkWritePathRestriction(toolName: string, params: Record<string, unknown>): PermissionResult | null {
    if (!this.config.enforceWritePathRestriction) return null;

    const writeTools = ['file_write', 'file_edit', 'notebook_edit'];
    if (!writeTools.includes(toolName)) return null;

    const path = typeof params.path === 'string' ? params.path : null;
    if (!path) return null;

    // 检查是否在工作目录内
    const isWithinWorkingDir = isPathWithinDir(path, this.config.workingDirectory);
    if (isWithinWorkingDir) return null;

    // 检查是否在允许的写入目录内
    for (const dir of this.config.allowedWriteDirs) {
      if (isPathWithinDir(path, dir)) return null;
    }

    // 不允许的路径
    return this.recordDenial({
      allowed: false,
      needsConfirmation: false,
      reason: `Write path restriction: can only write within working directory (${this.config.workingDirectory}) and allowed dirs. Attempted path: ${path}`,
      securityLayer: 'write_path_restriction',
    });
  }

  /**
   * 第 4 层：受保护文件检查
   */
  private checkProtectedFiles(toolName: string, params: Record<string, unknown>): PermissionResult | null {
    // 写入受保护文件：总是拒绝
    const writeTools = ['file_write', 'file_edit'];
    if (writeTools.includes(toolName) && typeof params.path === 'string') {
      if (isProtectedFile(params.path)) {
        return this.recordDenial({
          allowed: false,
          needsConfirmation: false,
          reason: `Protected file cannot be modified: ${params.path}`,
          securityLayer: 'protected_file_write',
        });
      }
    }

    // 读取敏感文件：需要确认（即使是读取操作）
    const readTools = ['file_read', 'grep'];
    if (readTools.includes(toolName) && typeof params.path === 'string') {
      if (isProtectedFile(params.path)) {
        return this.recordDenial({
          allowed: false,
          needsConfirmation: true,
          reason: `Reading sensitive file requires explicit confirmation: ${params.path}`,
          securityLayer: 'protected_file_read',
        });
      }
    }

    // bash 命令访问敏感路径
    if (toolName === 'bash' && typeof params.command === 'string') {
      const cmd = params.command;
      for (const pf of PROTECTED_FILES) {
        if (cmd.includes(pf) && !['ls', 'cat', 'head', 'grep', 'find'].some(c => cmd.startsWith(c))) {
          return this.recordDenial({
            allowed: false,
            needsConfirmation: true,
            reason: `Accessing sensitive path requires confirmation: ${pf}`,
            securityLayer: 'protected_file_bash',
          });
        }
      }
    }

    return null;
  }

  /**
   * 第 5 层：规则匹配
   * 优先级：deny > ask > allow
   */
  private matchRules(toolName: string, params: Record<string, unknown>): PermissionResult | null {
    // 先检查 deny 规则
    for (const rule of this.config.rules) {
      if (rule.tool !== toolName || rule.action !== 'deny') continue;
      if (!rule.pattern) return this.recordDenial(this.ruleToResult(rule));
      const commandStr = this.extractCommand(params);
      if (commandStr && this.matchesPattern(commandStr, rule.pattern)) {
        return this.recordDenial(this.ruleToResult(rule));
      }
    }

    // 再检查 ask 规则
    for (const rule of this.config.rules) {
      if (rule.tool !== toolName || rule.action !== 'ask') continue;
      if (!rule.pattern) return this.actionToResult('ask', rule, 'rule_ask');
      const commandStr = this.extractCommand(params);
      if (commandStr && this.matchesPattern(commandStr, rule.pattern)) {
        return this.actionToResult('ask', rule, 'rule_ask');
      }
    }

    // 最后检查 allow 规则
    for (const rule of this.config.rules) {
      if (rule.tool !== toolName || rule.action !== 'allow') continue;
      if (!rule.pattern) return this.actionToResult('allow', rule, 'rule_allow');
      const commandStr = this.extractCommand(params);
      if (commandStr && this.matchesPattern(commandStr, rule.pattern)) {
        return this.actionToResult('allow', rule, 'rule_allow');
      }
    }

    return null;
  }

  /**
   * 记录拒绝
   */
  private recordDenial(result: PermissionResult): PermissionResult {
    this.rejectionTracker.consecutiveCount++;
    this.rejectionTracker.totalCount++;
    this.rejectionTracker.lastDeniedAt = new Date();
    if (result.reason) {
      this.rejectionTracker.reasons.push(result.reason);
      if (this.rejectionTracker.reasons.length > 20) {
        this.rejectionTracker.reasons.shift();
      }
    }

    // 检查是否超过阈值
    if (this.rejectionTracker.consecutiveCount >= this.config.consecutiveRejectionThreshold) {
      return {
        ...result,
        reason: `${result.reason}\n\n⚠️ Warning: ${this.rejectionTracker.consecutiveCount} consecutive denials. This may indicate abnormal agent behavior.`,
      };
    }

    if (this.rejectionTracker.totalCount >= this.config.totalRejectionThreshold) {
      return {
        ...result,
        reason: `${result.reason}\n\n⚠️ Warning: ${this.rejectionTracker.totalCount} total denials. Consider reviewing agent behavior.`,
      };
    }

    return result;
  }

  /**
   * 提取命令字符串
   */
  private extractCommand(params: Record<string, unknown>): string | null {
    if (typeof params.command === 'string') return params.command;
    if (typeof params.path === 'string') return params.path;
    if (typeof params.content === 'string') return params.content;
    return null;
  }

  /**
   * 模式匹配
   */
  private matchesPattern(str: string, pattern: string): boolean {
    const regex = globToRegex(pattern);
    return regex.test(str);
  }

  /**
   * 规则转结果
   */
  private ruleToResult(rule: PermissionRule): PermissionResult {
    return this.actionToResult(rule.action, rule, `rule_${rule.action}`);
  }

  /**
   * 动作转结果
   */
  private actionToResult(action: PermissionAction, rule?: PermissionRule, layer?: string): PermissionResult {
    switch (action) {
      case 'allow':
        return { allowed: true, needsConfirmation: false, matchedRule: rule, securityLayer: layer };
      case 'deny':
        return { allowed: false, needsConfirmation: false, reason: `Denied by rule: ${rule?.tool}${rule?.pattern ? ` (${rule.pattern})` : ''}`, matchedRule: rule, securityLayer: layer };
      case 'ask':
        return { allowed: false, needsConfirmation: true, reason: `Confirmation required: ${rule?.tool}${rule?.pattern ? ` (${rule.pattern})` : ''}`, matchedRule: rule, securityLayer: layer };
    }
  }

  /**
   * 缓存键
   */
  private getCacheKey(toolName: string, params: Record<string, unknown>): string {
    const commandStr = this.extractCommand(params) || '';
    return `${toolName}:${commandStr}`;
  }
}

// 导出便捷函数（这些已在上面定义过，不需要重新导出）
export function createPermissionSystem(workingDirectory: string, config: Partial<PermissionConfig> = {}): EnhancedPermissionSystem {
  return new EnhancedPermissionSystem({ workingDirectory, ...config });
}
