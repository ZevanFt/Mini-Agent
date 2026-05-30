import type { LLMAdapter, ChatChunk, Message, ChatParams } from '../llm/base.js';
import { ToolRegistry } from '../tools/registry.js';
import { ToolExecutor } from '../tools/executor.js';
import type { Tool, ToolResult, ToolCall } from '../tools/types.js';
import { SessionMemory } from '../memory/index.js';
import { buildSystemPrompt } from './system-prompt.js';
import type { HookDispatcher } from './hooks.js';
import { ThinkingModeManager, ThinkingMode } from './thinking-mode.js';
import { DocsCacheManager } from './docs-cache.js';
import { CodeEnhancer as LegacyCodeEnhancer } from './code-enhancer.js';
import { CompletenessChecker } from './completeness-checker.js';
import { AutoRunner } from './auto-runner.js';
import { LogInjector } from './log-injector.js';
import type { CodeBlock } from './code-enhancer.js';
import type { RunConfig } from './auto-runner.js';
import { DualPipelineEnhancer as CodeEnhancer } from './enhancer/index.js';
import type { DualPipelineConfig as EnhancerConfig, ProcessResult as EnhancementResult } from './enhancer/index.js';
import { logger } from '../utils/logger.js';

/**
 * Auto-detect whether this model needs Phase 8 enhancements.
 * Small models (≤1.3B) benefit from post-processor, progressive gen, etc.
 * Models ≥3B (e.g. qwen2.5-coder:3b) produce quality code natively and
 * enhancements only add latency and noise.
 */
function autoDetectStrategy(modelName: string): {
  enablePhase8: boolean;
  enableAdvancedEnhancer: boolean;
} {
  const lower = modelName.toLowerCase();
  const sizeMatch = lower.match(/(\d+)b/);
  const paramSize = sizeMatch ? parseInt(sizeMatch[1], 10) : 999;
  const isSmallModel = paramSize <= 7;
  const isKnownStrong = [
    'qwen-plus', 'qwen-max', 'deepseek', 'codestral',
    'claude', 'gpt-4', 'gpt-3.5',
  ].some(p => lower.includes(p));

  const needsHelp = isSmallModel || !isKnownStrong;
  return {
    enablePhase8: needsHelp,
    enableAdvancedEnhancer: needsHelp,
  };
}

export interface AgentOptions {
  llm: LLMAdapter;
  cwd?: string;
  model?: string;
  maxIterations?: number;
  verbose?: boolean;
  hookDispatcher?: HookDispatcher;
  enablePhase8?: boolean;
  docsCachePath?: string;
  snippetDir?: string;
  enableAdvancedEnhancer?: boolean;
}

export interface AgentState {
  tools: string[];
  skills: string[];
  conversationCount: number;
}

export class Agent {
  private llm: LLMAdapter;
  private cwd: string;
  private maxIterations: number;
  private verbose: boolean;
  private toolRegistry: ToolRegistry;
  private toolExecutor: ToolExecutor;
  private sessionMemory: SessionMemory;
  private activeSkillPrompts: string[] = [];
  private hookDispatcher?: HookDispatcher;
  private thinkingModeManager: ThinkingModeManager;
  
  // Phase 8: Small Model Enhancements
  private enablePhase8: boolean;
  private legacyCodeEnhancer: LegacyCodeEnhancer;
  private advancedEnhancer?: CodeEnhancer;
  private completenessChecker: CompletenessChecker;
  private autoRunner: AutoRunner;
  private logInjector: LogInjector;
  private docsCacheManager?: DocsCacheManager;
  private generatedFiles: Map<string, string> = new Map();

  constructor(options: AgentOptions) {
    this.llm = options.llm;
    this.cwd = options.cwd || process.cwd();
    this.maxIterations = options.maxIterations || 20;
    this.verbose = options.verbose || false;
    this.hookDispatcher = options.hookDispatcher;

    this.toolRegistry = new ToolRegistry();
    this.toolExecutor = new ToolExecutor();
    this.sessionMemory = new SessionMemory();
    this.thinkingModeManager = new ThinkingModeManager();
    
    // Phase 8: Small Model Enhancements — auto-detect strategy from model name
    const modelName = options.model || 'unknown';
    const strategy = options.enablePhase8 !== undefined
      ? { enablePhase8: options.enablePhase8, enableAdvancedEnhancer: options.enableAdvancedEnhancer ?? options.enablePhase8 }
      : autoDetectStrategy(modelName);

    this.enablePhase8 = strategy.enablePhase8;
    this.legacyCodeEnhancer = new LegacyCodeEnhancer({ llm: this.llm });
    this.completenessChecker = new CompletenessChecker();
    this.autoRunner = new AutoRunner();
    this.logInjector = new LogInjector();
    
    // 高级增强器（仅对小模型启用）
    if (strategy.enableAdvancedEnhancer) {
      this.advancedEnhancer = new CodeEnhancer({
        llm: this.llm,
        snippetDir: options.snippetDir ?? '.miniagent/snippets',
        projectDir: this.cwd,
      });
    }
    
    if (options.docsCachePath) {
      this.docsCacheManager = new DocsCacheManager({ directory: options.docsCachePath });
    }
  }

  addTool(tool: Tool): void {
    this.toolRegistry.register(tool);
  }

  removeTool(name: string): void {
    this.toolRegistry.unregister(name);
  }

  getTools(): Tool[] {
    return this.toolRegistry.list();
  }

  setSkillPrompts(prompts: string[]): void {
    this.activeSkillPrompts = prompts;
  }

  async *chat(message: string): AsyncGenerator<ChatChunk> {
    await this.hookDispatcher?.fire('session_start', {});

    this.sessionMemory.addMessage({ role: 'user', content: message });

    let iteration = 0;

    while (iteration < this.maxIterations) {
      iteration++;

      const toolDescriptions = this.toolRegistry.list()
        .map(t => `## ${t.name}\n${t.description}`)
        .join('\n\n');

      const systemPrompt = buildSystemPrompt(
        this.cwd,
        toolDescriptions,
        this.activeSkillPrompts.join('\n\n---\n\n')
      );

      const tools = this.toolRegistry.toLLMFormat() as unknown as ChatParams['tools'];

      if (this.verbose) {
        console.error(`[Iteration ${iteration}] [Messages: ${this.sessionMemory.size()}]`);
      }

      let hasToolCalls = false;
      let assistantContent = '';
      const toolCallsInThisTurn: Array<{ name: string; args: Record<string, unknown>; result: ToolResult }> = [];

      await this.hookDispatcher?.fire('user_prompt_submit', { userPrompt: message });

      for await (const chunk of this.llm.chat({
        messages: this.sessionMemory.getMessages(),
        tools,
        systemPrompt,
      })) {
        if (chunk.type === 'content' && chunk.content) {
          assistantContent += chunk.content;
          yield chunk;
        }

        if (chunk.type === 'tool_call' && chunk.toolCall) {
          const hookResult = await this.hookDispatcher?.fire('pre_tool_use', { toolName: chunk.toolCall.name, toolParams: chunk.toolCall.arguments });
          if (hookResult?.blocked) {
            yield { type: 'content', content: `\n\n[Tool blocked by hook: ${hookResult.results.find(r => r.blocked)?.reason || 'unknown'}]` };
            continue;
          }

          hasToolCalls = true;

          const tool = this.toolRegistry.get(chunk.toolCall.name);
          if (!tool) {
            const errorMsg = `Unknown tool: ${chunk.toolCall.name}`;
            yield { type: 'content', content: `\n\n[Tool not found: ${chunk.toolCall.name}]` };
            this.sessionMemory.addMessage({
              role: 'tool',
              content: errorMsg,
              toolCallId: chunk.toolCall.name,
            });
            continue;
          }

          if (this.verbose) {
            console.error(`[Calling tool: ${chunk.toolCall.name}]`);
          }

          const result = await this.toolExecutor.execute(tool, chunk.toolCall.arguments);

          // Phase 8: Post-generation processing for file-writing tools
          if (this.enablePhase8 && this.isCodeGenerationTool(chunk.toolCall.name)) {
            const enhancedResult = await this.enhanceGeneratedCode(chunk.toolCall.name, chunk.toolCall.arguments, result);
            Object.assign(result, enhancedResult);
          }

          await this.hookDispatcher?.fire('post_tool_use', { toolName: chunk.toolCall.name, toolResult: { success: result.success, content: result.content, error: result.error } });

          toolCallsInThisTurn.push({ name: chunk.toolCall.name, args: chunk.toolCall.arguments, result });

          this.sessionMemory.addMessage({
            role: 'tool',
            content: result.content || '',
            toolCallId: chunk.toolCall.name,
          });

          yield {
            type: 'content',
            content: `\n\n[Tool ${chunk.toolCall.name}: ${result.success ? 'success' : 'failed'}]`,
          };
        }
      }

      if (assistantContent) {
        this.sessionMemory.addMessage({ role: 'assistant', content: assistantContent });
      }

      if (!hasToolCalls) {
        break;
      }
    }

    await this.hookDispatcher?.fire('task_completed', {});

    yield { type: 'done' };
  }

  async run(message: string): Promise<string> {
    let result = '';
    for await (const chunk of this.chat(message)) {
      if (chunk.type === 'content' && chunk.content) {
        result += chunk.content;
        process.stdout.write(chunk.content);
      }
    }
    return result;
  }

  reset(): void {
    this.sessionMemory.clear();
    this.activeSkillPrompts = [];
  }

  getState(): AgentState {
    return {
      tools: this.getTools().map(t => t.name),
      skills: [],
      conversationCount: this.sessionMemory.size(),
    };
  }

  toggleThinkingMode(): ThinkingMode {
    return this.thinkingModeManager.toggle();
  }

  setThinkingMode(mode: ThinkingMode): void {
    this.thinkingModeManager.setMode(mode);
  }

  getThinkingMode(): ThinkingMode {
    return this.thinkingModeManager.getMode();
  }

  isVerboseThinking(): boolean {
    return this.thinkingModeManager.isVerbose();
  }

  setThinkingStepCallback(callback: (step: any) => void): void {
    this.thinkingModeManager.setOnStepCallback(callback);
  }

  async executeTool(name: string, args: Record<string, unknown>): Promise<ToolResult> {
    const tool = this.toolRegistry.get(name);
    if (!tool) {
      return {
        success: false,
        error: `Unknown tool: ${name}`
      };
    }

    const hookResult = await this.hookDispatcher?.fire('pre_tool_use', { toolName: name, toolParams: args });
    if (hookResult?.blocked) {
      return {
        success: false,
        error: `Tool blocked by hook: ${hookResult.results.find(r => r.blocked)?.reason || 'unknown'}`
      };
    }

    const result = await this.toolExecutor.execute(tool, args);

    // Phase 8: Post-generation processing for file-writing tools
    if (this.enablePhase8 && this.isCodeGenerationTool(name)) {
      const enhancedResult = await this.enhanceGeneratedCode(name, args, result);
      Object.assign(result, enhancedResult);
    }

    await this.hookDispatcher?.fire('post_tool_use', { toolName: name, toolResult: { success: result.success, content: result.content, error: result.error } });

    return result;
  }

  // Phase 8: Helper methods

  private isCodeGenerationTool(toolName: string): boolean {
    return ['file_write', 'multi_edit', 'file_edit'].includes(toolName);
  }

  private async enhanceGeneratedCode(
    toolName: string,
    args: Record<string, unknown>,
    result: ToolResult
  ): Promise<ToolResult> {
    if (!result.success || !result.content) {
      return result;
    }

    const filePath = (args.filePath || args.path) as string | undefined;
    const code = (args.content || args.code) as string | undefined;
    if (!code || !filePath) {
      return result;
    }

    const language = this.detectLanguageFromPath(filePath);
    
    // 优先使用高级增强器
    if (this.advancedEnhancer) {
      try {
        const enhancerResult = await this.advancedEnhancer.process(code, language, {
          userRequest: `Generate ${language} code for: ${code.substring(0, 200)}`,
          projectPath: this.cwd,
        });
        
        result.content = `\n[DualPipeline Applied: ${enhancerResult.route}, quality ${enhancerResult.qualityBefore} -> ${enhancerResult.qualityAfter}]\n${enhancerResult.finalCode}`;
        this.generatedFiles.set(filePath, enhancerResult.finalCode);
        return result;
      } catch (error) {
        logger.warn('Advanced enhancer failed, falling back to legacy:', error);
      }
    }
    
    // 回退到旧版增强器
    // Step 1: Completeness check
    const checkReport = await this.completenessChecker.checkCode(code, language);
    if (!checkReport.overall) {
      const errors = checkReport.results
        .filter(r => !r.passed)
        .map(r => r.message)
        .join('; ');
      
      result.content = `\n[Completeness Check Warnings: ${errors}]\n${result.content}`;
      this.generatedFiles.set(filePath, code);
    }

    // Step 2: Inject logs if enabled
    const loggedCode = this.logInjector.inject(code, language);
    if (loggedCode !== code) {
      result.content += `\n[Logs injected for debugging]`;
      this.generatedFiles.set(filePath, loggedCode);
    }

    // Step 3: Auto-run for immediate-execution languages
    if (['javascript', 'python'].includes(language)) {
      try {
        const runResult = await this.autoRunner.runFile(filePath, language);
        if (runResult.success) {
          result.content += `\n\n[Auto-run succeeded]\n${runResult.output || ''}`;
        } else {
          result.content += `\n\n[Auto-run failed: ${runResult.error || 'unknown'}]`;
        }
      } catch (error) {
        result.content += `\n\n[Auto-run error: ${error instanceof Error ? error.message : String(error)}]`;
      }
    }

    return result;
  }

  private detectLanguageFromPath(filePath: string): string {
    const ext = filePath.split('.').pop()?.toLowerCase();
    const map: Record<string, string> = {
      js: 'javascript',
      mjs: 'javascript',
      cjs: 'javascript',
      ts: 'typescript',
      tsx: 'typescript',
      py: 'python',
    };
    return map[ext || ''] || 'unknown';
  }

  // Phase 8: Public API for external access

  getDocsCacheManager(): DocsCacheManager | undefined {
    return this.docsCacheManager;
  }

  getLegacyCodeEnhancer(): LegacyCodeEnhancer {
    return this.legacyCodeEnhancer;
  }

  getLLM(): LLMAdapter {
    return this.llm;
  }

  getAdvancedEnhancer(): CodeEnhancer | undefined {
    return this.advancedEnhancer;
  }

  getCompletenessChecker(): CompletenessChecker {
    return this.completenessChecker;
  }

  getAutoRunner(): AutoRunner {
    return this.autoRunner;
  }

  getLogInjector(): LogInjector {
    return this.logInjector;
  }

  isPhase8Enabled(): boolean {
    return this.enablePhase8;
  }

  setPhase8Enabled(enabled: boolean): void {
    this.enablePhase8 = enabled;
  }
}
