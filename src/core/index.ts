export { PlanModeState, formatPlan, planToSystemPrompt } from './plan-mode.js';
export type {
  Plan,
  PlanStep,
  PlanStepStatus,
  PlanResult,
  StepResult,
  GeneratePlanParams,
} from './plan-mode.js';

export { PlanModeManager } from './plan-mode-manager.js';
export { EnhancedPermissionSystem, createPermissionSystem, PROTECTED_FILES, READONLY_COMMANDS } from './permissions.js';
export type {
  PermissionAction,
  PermissionRule,
  PermissionConfig,
  PermissionResult,
  PermissionMode,
} from './permissions.js';

export { HookDispatcher, createToolLogHook, createSecurityAuditHook, createSessionTimerHook } from './hooks.js';
export type {
  HookEvent,
  HookHandler,
  HookResult,
  HookPayload,
  HookDefinition,
} from './hooks.js';

export { buildSystemPrompt } from './system-prompt.js';
export { ContextCompactor, estimateTokens, DEFAULT_COMPACTION_CONFIG } from './compact.js';
export type { CompactionConfig, CompactionResult } from './compact.js';

export { createSlashCommands, parseCommand, isSlashCommand } from './commands.js';
export type { SlashCommand, CommandContext } from './commands.js';

export { Agent } from './agent.js';

export { ThinkingModeManager, ThinkingMode } from './thinking-mode.js';
export type { ThinkingStep } from './thinking-mode.js';

// Phase 8: Small Model Enhancements
export { DocsCacheManager } from './docs-cache.js';
export type { CacheConfig, CacheEntry, CacheIndex } from './docs-cache.js';

export { CompletenessChecker } from './completeness-checker.js';
export type { CheckResult, CompletenessReport } from './completeness-checker.js';

export { AutoRunner } from './auto-runner.js';
export type { RunStrategy, RunConfig, RunResult } from './auto-runner.js';

export { LogInjector } from './log-injector.js';
export type { InjectionConfig } from './log-injector.js';
