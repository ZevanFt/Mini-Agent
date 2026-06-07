#!/usr/bin/env node
import { Command } from 'commander';
import chalk from 'chalk';
import path from 'path';
import { setupTuiLogging, disableTuiLogging } from './utils/logger.js';
import fs from 'fs';
import { Agent } from './core/agent.js';
import { ThinkingMode } from './core/thinking-mode.js';
import { HookDispatcher, createToolLogHook, createSecurityAuditHook, createSessionTimerHook } from './core/hooks.js';
import { OllamaAdapter } from './llm/ollama.js';
import { createAskUserTool } from './tools/ask-user.js';
import { createTaskTools } from './tools/tasks.js';
import { createPlanModeTools } from './tools/plan-mode.js';
import { TaskManager } from './tasks/index.js';
import { BashTool, FileReadTool, FileWriteTool, GlobTool, GrepTool, WebSearchTool, WebFetchTool, ConfigTool } from './tools/index.js';
import { TodoWriteTool } from './tools/todo.js';
import { FormatTool } from './tools/format.js';
import { createMemoryTool } from './tools/memory-tool.js';
import { LongTermMemory } from './memory/long-term.js';
import { SessionMemory } from './memory/index.js';
import { createSlashCommands, parseCommand } from './core/commands.js';
import { CheckpointManager } from './core/checkpoints.js';
import { ProjectConfigParser } from './core/project-config.js';
import { PromptHistory } from './core/prompt-history.js';
import { StatsTracker } from './core/stats.js';
import { AutoUpdateChecker } from './core/autoupdate.js';
import { PluginManager } from './core/plugins.js';
import { BackgroundTaskManager } from './core/background-tasks.js';
import { SkillRegistry } from './skills/skill-registry.js';
import { initTUI, destroyTUI } from './tui/index.js';
import { EnhancedPermissionSystem } from './core/permissions.js';
import { MiniAgentServer } from './web/server.js';
import { createMCPTools } from './tools/mcp.js';
import { MCPManager } from './mcp/manager.js';
import { PlanModeManager } from './core/plan-mode-manager.js';
import { LSPTool } from './tools/lsp.js';
import { NotebookTool } from './tools/notebook.js';
import { WorktreeTool } from './tools/worktree.js';
import { createShareTool } from './tools/share.js';
import { ApplyPatchTool } from './tools/apply-patch.js';
import { ReadImageTool } from './tools/read-image.js';
import { McpSseServer } from './mcp/sse-transport.js';
import { runDoctor } from './commands/doctor.js';
import { installOllama } from './commands/install.js';
import { pullModel, listModels, removeModel, showRecommendedModels } from './commands/models.js';

const VERSION = '0.2.0';
const MINIAGENT_DIR = path.join(process.cwd(), '.miniagent');
const SESSIONS_DIR = path.join(MINIAGENT_DIR, 'sessions');

function printBanner(): void {
  const banner = `
 ███╗   ███╗██╗███╗   ██╗██╗████████╗ ██████╗  █████╗ ███╗   ██╗
 ████╗ ████║██║████╗  ██║██║╚══██╔══╝██╔═══██╗██╔══██╗████╗  ██║
 ██╔████╔██║██║██╔██╗ ██║██║   ██║   ██║   ██║███████║██╔██╗ ██║
 ██║╚██╔╝██║██║██║╚██╗██║██║   ██║   ██║   ██║██╔══██║██║╚██╗██║
 ██║ ╚═╝ ██║██║██║ ╚████║██║   ██║   ╚██████╔╝██║  ██║██║ ╚████║
 ╚═╝     ╚═╝╚═╝╚═╝  ╚═══╝╚═╝   ╚═╝    ╚═════╝ ╚═╝  ╚═╝╚═╝  ╚═══╝`;

  console.log(chalk.cyan.bold(banner));
  console.log(chalk.dim('  ' + '═'.repeat(64)));
  console.log(chalk.gray('  A local AI Agent framework - Built by Zevan'));
  console.log(chalk.gray(`  Version ${VERSION} | ${new Date().toLocaleDateString('zh-CN')}`));
  console.log(chalk.dim('  ' + '═'.repeat(64)));
}

function printStatus(agent: Agent, model: string, session: string, hooks: number, skills: number, plugins: number): void {
  const state = agent.getState();
  const line = chalk.dim('  ─'.repeat(42));
  console.log(line);
  console.log(
    chalk.cyan('  ⚡ Model: ') + chalk.white(model) +
    chalk.dim('  |  ') +
    chalk.cyan('💬 Session: ') + chalk.white(session.substring(0, 20)) +
    chalk.dim('  |  ') +
    chalk.cyan('🔧 Tools: ') + chalk.white(state.tools.length.toString())
  );
  console.log(
    chalk.cyan('  🪝 Hooks: ') + chalk.white(hooks.toString()) +
    chalk.dim('  |  ') +
    chalk.cyan('🎯 Skills: ') + chalk.white(skills.toString()) +
    chalk.dim('  |  ') +
    chalk.cyan('🧩 Plugins: ') + chalk.white(plugins.toString())
  );
  console.log(line);
}

function printHelp(): void {
  console.log(chalk.cyan.bold('\n📖 Available Commands:\n'));
  const commands = [
    ['/help', 'Show this help message'],
    ['/compact', 'Compress conversation context'],
    ['/clear', 'Clear conversation history'],
    ['/plan', 'Enter planning mode'],
    ['/review', 'Review current changes'],
    ['/commit', 'Analyze changes and generate commit message'],
    ['/config', 'Show current configuration'],
    ['/tools', 'List available tools'],
    ['/skills', 'List available skills'],
    ['/hooks', 'Show hook status'],
    ['/memory', 'Show memory statistics'],
    ['/status', 'Show agent status'],
    ['/format', 'Format files using Prettier/ESLint/Stylelint'],
    ['/thinking [normal|verbose]', 'Toggle verbose thinking mode'],
    ['/model [name]', 'Show or switch model'],
    ['/session', 'Manage sessions (list/new/switch/delete)'],
    ['/checkpoints', 'List checkpoints'],
    ['/rewind <id>', 'Rewind to checkpoint'],
    ['/stats', 'Show usage statistics'],
    ['/plugins', 'List plugins'],
    ['/background', 'Manage background tasks'],
    ['/history', 'Search prompt history'],
    ['/update', 'Check for updates'],
    ['/quit', 'Exit MiniAgent'],
  ];
  for (const [cmd, desc] of commands) {
    console.log(chalk.green('  ' + cmd.padEnd(28)) + chalk.dim(desc));
  }
  console.log();
}

async function main(): Promise<void> {
  const program = new Command();

  program
    .name('miniagent')
    .description('MiniAgent - A local AI Agent framework')
    .version(VERSION);

  program
    .command('chat')
    .description('Start interactive chat')
    .option('-m, --model <name>', 'Model name', 'qwen2.5-coder:3b')
    .option('-u, --url <url>', 'Ollama server URL', 'http://localhost:11434')
    .option('-v, --verbose', 'Verbose output', false)
    .option('-s, --session <id>', 'Session ID')
    .option('--list-sessions', 'List all sessions')
    .option('--tui', 'Use terminal UI mode (TUI)', false)
    .option('--debug', 'Enable debug mode (connect to React DevTools)', false)
    .option('--no-tui', 'Disable banner and status')
    .option('--mcp-sse-port <number>', 'Start MCP SSE server on given port')
    .action(async (options) => {
      if (options.listSessions) {
        const sessions = SessionMemory.listSessions(SESSIONS_DIR);
        if (sessions.length === 0) {
          console.log(chalk.yellow('No saved sessions'));
        } else {
          console.log(chalk.cyan.bold('\n📂 Saved Sessions:\n'));
          for (const s of sessions) {
            const time = s.modified ? s.modified.toLocaleString() : '';
            console.log(chalk.green(`  ${s.sessionId}`));
            console.log(chalk.dim(`    Messages: ${s.size} | Last: ${time}\n`));
          }
        }
        return;
      }

      // Global error catchers — registered early so the user always sees
      // the real error instead of a silent crash + terminal clear.
      const crashLog = path.join(process.cwd(), '.miniagent', 'crash.log');
      const teeCrash = (label: string, err: unknown) => {
        try {
          const dir = path.dirname(crashLog);
          if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
          const ts = new Date().toISOString();
          const msg = err instanceof Error ? `${err.stack || err.message}` : String(err);
          fs.appendFileSync(crashLog, `[${ts}] ${label}: ${msg}\n\n`);
        } catch {}
      };

      process.on('uncaughtException', (err) => {
        teeCrash('UNCAUGHT_EXCEPTION', err);
        process.stderr.write('\n=== ❌ FATAL ERROR (see .miniagent/crash.log) ===\n');
        process.stderr.write((err.stack || err.message || String(err)) + '\n');
        process.stderr.write('===================================================\n');
        destroyTUI();
        process.exit(1);
      });

      process.on('unhandledRejection', (reason) => {
        teeCrash('UNHANDLED_REJECTION', reason);
        process.stderr.write('\n=== ❌ UNHANDLED REJECTION (see .miniagent/crash.log) ===\n');
        process.stderr.write((reason instanceof Error ? (reason.stack || reason.message) : String(reason)) + '\n');
        process.stderr.write('=========================================================\n');
        destroyTUI();
        process.exit(1);
      });

      // TUI 模式下初始化日志到文件
      if (options.tui) {
        setupTuiLogging(MINIAGENT_DIR);
      }

      // TUI 模式下不打印 banner 和初始化信息
      if (!options.tui) {
        printBanner();
        console.log();
      }

      const sessionId = options.session || `session_${Date.now()}`;
      const sessions = SessionMemory.listSessions(SESSIONS_DIR);

      if (sessions.length > 0 && !options.session && !options.tui) {
        const readline = await import('readline');
        const rl = readline.createInterface({
          input: process.stdin,
          output: process.stdout,
        });

        const lastSession = sessions.sort((a, b) => {
          const dateA = a.modified ? a.modified.getTime() : 0;
          const dateB = b.modified ? b.modified.getTime() : 0;
          return dateB - dateA;
        })[0];

        const answer = await new Promise<string>(resolve => {
          rl.question(chalk.yellow(`Found previous session: ${lastSession.sessionId} (${lastSession.size} messages). Restore? (y/N): `), resolve);
        });
        rl.close();

        if (answer.trim().toLowerCase() === 'y' || answer.trim().toLowerCase() === 'yes') {
          console.log(chalk.green(`Restored session: ${lastSession.sessionId}\n`));
        }
      }

      const agentsConfig = ProjectConfigParser.load(process.cwd());
      if (!options.tui && agentsConfig.filePath) {
        console.log(chalk.dim(`📄 Found ${path.basename(agentsConfig.filePath)}: ${agentsConfig.filePath}`));
      }

      const hookDispatcher = new HookDispatcher(sessionId);
      hookDispatcher.register(createToolLogHook());
      hookDispatcher.register(createSecurityAuditHook());
      hookDispatcher.register(createSessionTimerHook());

      void new EnhancedPermissionSystem({
        workingDirectory: process.cwd(),
      });

      const pluginManager = new PluginManager();
      await pluginManager.discover();

      let currentModel = options.model;
      if (agentsConfig.model) {
        currentModel = agentsConfig.model;
      }

      const llm = new OllamaAdapter({
        model: currentModel,
        baseUrl: options.url,
      });

      const agent = new Agent({
        llm,
        model: currentModel,
        cwd: process.cwd(),
        verbose: options.verbose,
        hookDispatcher,
      });

      const taskManager = new TaskManager(MINIAGENT_DIR);
      await taskManager.initialize();

      const askUserCallback = async (params: { question: string; options?: string[]; timeout?: number }): Promise<string> => {
        console.log(chalk.yellow('\n Agent asks: ') + params.question);
        if (params.options && params.options.length > 0) {
          console.log(chalk.dim('   Options: ' + params.options.join(' | ')));
        }

        const readline = await import('readline');
        const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
        const timeout = (params.timeout || 300) * 1000;

        return new Promise<string>((resolve) => {
          const timer = setTimeout(() => {
            rl.close();
            resolve('[timeout]');
          }, timeout);

          rl.question(chalk.green('   Your answer: '), (answer) => {
            clearTimeout(timer);
            rl.close();
            resolve(answer || '[no answer]');
          });
        });
      };

      agent.addTool(BashTool);
      agent.addTool(FileReadTool);
      agent.addTool(FileWriteTool);
      agent.addTool(GlobTool);
      agent.addTool(GrepTool);
      agent.addTool(WebSearchTool);
      agent.addTool(WebFetchTool);
      agent.addTool(ConfigTool);
      agent.addTool(createMemoryTool(new LongTermMemory()));
      agent.addTool(TodoWriteTool);
      agent.addTool(FormatTool);

      // 新增工具注册
      agent.addTool(createAskUserTool(askUserCallback));
      
      const taskTools = createTaskTools(taskManager);
      for (const tool of taskTools) {
        agent.addTool(tool);
      }

      const planModeManager = new PlanModeManager();
      const planModeTools = createPlanModeTools(planModeManager);
      for (const tool of planModeTools) {
        agent.addTool(tool);
      }

      agent.addTool(LSPTool);
      agent.addTool(NotebookTool);
      agent.addTool(WorktreeTool);
      agent.addTool(createShareTool(
        () => [],
        () => ({ id: sessionId, model: currentModel, startTime: Date.now() }),
      ));
      agent.addTool(ApplyPatchTool);
      agent.addTool(ReadImageTool);

      const skillRegistry = new SkillRegistry();
      skillRegistry.addDiscoveryDir(path.join(MINIAGENT_DIR, 'skills'));
      skillRegistry.discoverAndLoad();
      const prompts = skillRegistry.getActiveSystemPrompts();
      agent.setSkillPrompts(prompts ? [prompts] : []);

      const slashCommands = createSlashCommands();

      const checkpointManager = new CheckpointManager({
        workingDirectory: process.cwd(),
      });

      const promptHistory = new PromptHistory();

      const statsTracker = new StatsTracker();

      const bgTaskManager = new BackgroundTaskManager();

      const updateChecker = new AutoUpdateChecker(VERSION);

      const mcpManager = new MCPManager();

      if (options.mcpSsePort) {
        const ssePort = parseInt(options.mcpSsePort, 10);
        if (!options.tui) {
          console.log(chalk.cyan(`\n🔌 Starting MCP SSE server on port ${ssePort}...`));
        }
        await mcpManager.startSseServer(ssePort);
        if (!options.tui) {
          console.log(chalk.green(`✅ MCP SSE server running on port ${ssePort}`));
          console.log(chalk.dim('   External clients can connect via SSE\n'));
        }
      }

      for (const mcpTool of createMCPTools(mcpManager)) {
        agent.addTool(mcpTool);
      }

      if (!options.noTui && !options.tui) {
        printStatus(agent, currentModel, sessionId, hookDispatcher.listActiveHooks().length, skillRegistry.listActive().length, pluginManager.listActive().length);
        console.log();
      }

      if (!options.tui && agentsConfig.allowedTools.length > 0 && agentsConfig.filePath) {
        console.log(chalk.yellow(`⚠️  Tool restrictions from ${path.basename(agentsConfig.filePath)}: only ${agentsConfig.allowedTools.join(', ')} allowed`));
        console.log();
      }

      if (!options.tui) {
        const checkResult = await updateChecker.check();
        if (checkResult.updateAvailable) {
          console.log(chalk.yellow(` Update available: ${checkResult.current} → ${checkResult.latest}`));
          if (checkResult.releaseNotes) {
            console.log(chalk.dim(checkResult.releaseNotes));
          }
          console.log();
        }

        console.log(chalk.green('💬 Ready! Type /help for commands, or just start chatting\n'));
      }

      // ── TUI Mode ─
      if (options.tui) {
        if (!process.stdin.isTTY) {
          console.error(chalk.red('TUI mode requires a terminal (TTY). Use non-TUI mode instead.'));
          process.exit(1);
        }
        if (typeof process.stdin.setRawMode !== 'function') {
          console.error(chalk.red('TUI mode not supported in this runtime (setRawMode unavailable).'));
          process.exit(1);
        }

        try {
          const tui = await initTUI({ agent, model: currentModel, sessionId, cwd: process.cwd(), version: VERSION });
          tui.start();
          await tui.waitForExit();
        } catch (err) {
          destroyTUI();
          disableTuiLogging();
          teeCrash('TUI_INIT', err);
          process.stderr.write(`\n TUI failed to start: ${err instanceof Error ? err.message : String(err)}\n`);
          if (err instanceof Error && err.stack) {
            process.stderr.write(`${err.stack.split('\n').slice(1, 4).join('\n')}\n`);
          }
          process.exit(1);
        }
        return;
      }

      const readline = await import('readline');
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
      });

      const askQuestion = (query: string): Promise<string> => {
        return new Promise(resolve => {
          rl.question(query, resolve);
        });
      };

      while (true) {
        const input = await askQuestion(chalk.cyan.bold('You: '));
        const trimmedInput = input.trim();

        promptHistory.add(trimmedInput, sessionId);

        if (trimmedInput === '/quit' || trimmedInput === '/exit') {
          console.log(chalk.yellow('\n👋 Goodbye!'));
          statsTracker.endSession();
          bgTaskManager.cleanup();
          await hookDispatcher.fire('session_end', {});
          rl.close();
          break;
        }

        if (trimmedInput === '/help') {
          printHelp();
          continue;
        }

        if (trimmedInput.startsWith('/compact')) {
          const state = agent.getState();
          console.log(chalk.dim(`\nContext: ${state.conversationCount} messages`));
          console.log(chalk.green('Context compaction ready. Run this to compress conversation.\n'));
          continue;
        }

        if (trimmedInput === '/clear') {
          agent.reset();
          console.log(chalk.green('\n🗑️  Conversation cleared.\n'));
          continue;
        }

        if (trimmedInput === '/mcp') {
          const servers = mcpManager.listServers();
          console.log(chalk.cyan.bold(`\n🔌 MCP Servers (${servers.length}):\n`));
          if (servers.length === 0) {
            console.log(chalk.dim('  No MCP servers configured. Add them to agents.json.\n'));
          } else {
            for (const [name, server] of Object.entries(servers)) {
              const status = server.status === 'connected' ? chalk.green('🟢 Connected') : chalk.red('🔴 Disconnected');
              console.log(`${chalk.green(name)}: ${status}`);
            }
          }
          console.log();
          continue;
        }

        if (trimmedInput === '/agents') {
          const parsedConfig = ProjectConfigParser.load(process.cwd());
          console.log(chalk.cyan.bold('\n🤖 Agent Configuration:\n'));
          console.log(chalk.dim(`  Model: ${parsedConfig.model || currentModel || '(default)'}`));
          console.log(chalk.dim(`  Allowed Tools: ${parsedConfig.allowedTools.length > 0 ? parsedConfig.allowedTools.join(', ') : '(all)'}`));
          console.log(chalk.dim(`  Rules: ${parsedConfig.rules.length > 0 ? parsedConfig.rules.length + ' rules' : '(none)'}`));
          console.log();
          continue;
        }

        if (trimmedInput === '/health') {
          console.log(chalk.cyan.bold('\n🏥 Health Check:\n'));
          const checks: { name: string; status: string; detail: string }[] = [];
          checks.push({ name: 'Agent', status: '🟢', detail: 'Running' });
          checks.push({ name: 'Tools', status: '🟢', detail: `${agent.getTools().length} available` });
          checks.push({ name: 'Skills', status: '🟢', detail: `${skillRegistry.listActive().length} active` });
          checks.push({ name: 'Hooks', status: '🟢', detail: `${hookDispatcher.listActiveHooks().length} active` });
          checks.push({ name: 'Plugins', status: '🟢', detail: `${pluginManager.listActive().length} active` });
          try {
            const { execSync } = await import('child_process');
            execSync('git status', { stdio: 'ignore' });
            checks.push({ name: 'Git', status: '🟢', detail: 'Available' });
          } catch {
            checks.push({ name: 'Git', status: '🔴', detail: 'Not available' });
          }
          for (const check of checks) {
            console.log(`  ${check.status} ${check.name}: ${check.detail}`);
          }
          console.log();
          continue;
        }

        if (trimmedInput.startsWith('/plan')) {
          console.log(chalk.green('\n📋 Planning mode activated. Describe your task.\n'));
          continue;
        }

        if (trimmedInput === '/diff') {
          try {
            const { execSync } = await import('child_process');
            const status = execSync('git status --short', { encoding: 'utf-8' });
            const diff = execSync('git diff --stat', { encoding: 'utf-8' });
            console.log(chalk.cyan.bold('\n📝 Git Changes:\n'));
            if (status.trim()) {
              console.log(chalk.yellow('  Files:\n'));
              status.split('\n').filter(Boolean).forEach(line => console.log(chalk.dim(`    ${line}`)));
            }
            if (diff.trim()) {
              console.log(chalk.yellow('\n  Changes:\n'));
              diff.split('\n').filter(Boolean).forEach(line => console.log(chalk.dim(`    ${line}`)));
            }
            if (!status.trim() && !diff.trim()) {
              console.log(chalk.green('  No changes to commit.\n'));
            }
            console.log();
          } catch {
            console.log(chalk.yellow('  Not a git repository.\n'));
          }
          continue;
        }

        if (trimmedInput === '/review') {
          try {
            const { execSync } = await import('child_process');
            const status = execSync('git status --short', { encoding: 'utf-8' });
            const changedFiles = status.split('\n').filter(Boolean).map(line => line.trim().split(/\s+/).pop() || '').filter(Boolean);
            console.log(chalk.cyan.bold('\n🔍 Code Review:\n'));
            if (changedFiles.length === 0) {
              console.log(chalk.green('  No changes to review.\n'));
            } else {
              console.log(chalk.yellow(`  Reviewing ${changedFiles.length} files:\n`));
              for (const file of changedFiles.slice(0, 10)) {
                try {
                  const content = fs.readFileSync(file, 'utf-8');
                  const lines = content.split('\n').length;
                  const ext = file.split('.').pop() || '';
                  console.log(chalk.green(`  ${file}`));
                  console.log(chalk.dim(`    ${lines} lines | ${ext}\n`));
                } catch { /* skip */ }
              }
              if (changedFiles.length > 10) {
                console.log(chalk.dim(`  ... and ${changedFiles.length - 10} more files\n`));
              }
            }
            console.log();
          } catch {
            console.log(chalk.yellow('  Not a git repository.\n'));
          }
          continue;
        }

        if (trimmedInput === '/commit') {
          try {
            const { execSync } = await import('child_process');
            const diff = execSync('git diff --stat', { encoding: 'utf-8' });
            const staged = execSync('git diff --cached --stat', { encoding: 'utf-8' });
            console.log(chalk.cyan.bold('\n📝 Generate Commit Message:\n'));
            if (!diff.trim() && !staged.trim()) {
              console.log(chalk.yellow('  No changes to commit.\n'));
            } else {
              console.log(chalk.yellow('  Changes:\n'));
              if (staged.trim()) {
                staged.split('\n').filter(Boolean).forEach(line => console.log(chalk.dim(`    ${line}`)));
              }
              if (diff.trim()) {
                diff.split('\n').filter(Boolean).forEach(line => console.log(chalk.dim(`    ${line}`)));
              }
              console.log(chalk.green('\n  Tip: Use conventional commit format:\n'));
              console.log(chalk.dim('    feat: add feature\n    fix: resolve bug\n    refactor: restructure code\n'));
            }
            console.log();
          } catch {
            console.log(chalk.yellow('  Not a git repository.\n'));
          }
          continue;
        }

        if (trimmedInput === '/search') {
          const parts = trimmedInput.split(/\s+/);
          const query = parts.slice(1).join(' ');
          if (!query) {
            console.log(chalk.yellow('\nUsage: /search <pattern>\n'));
          } else {
            console.log(chalk.cyan.bold(`\n🔎 Searching for "${query}"...\n`));
            try {
              const { execSync } = await import('child_process');
              const result = execSync(`grep -rn --include="*.ts" --include="*.js" --include="*.tsx" --include="*.jsx" "${query.replace(/"/g, '\\"')}" . 2>/dev/null | head -20`, { encoding: 'utf-8' });
              if (result.trim()) {
                result.split('\n').filter(Boolean).forEach(line => console.log(chalk.dim(`  ${line}`)));
              } else {
                console.log(chalk.yellow('  No results found.\n'));
              }
            } catch {
              console.log(chalk.yellow('  Search failed or grep not available.\n'));
            }
            console.log();
          }
          continue;
        }

        if (trimmedInput === '/config') {
          console.log(chalk.cyan('\n⚙️  Configuration:\n'));
          console.log(chalk.dim(`  Model: ${currentModel}`));
          console.log(chalk.dim(`  Ollama URL: ${options.url}`));
          console.log(chalk.dim(`  Session: ${sessionId}`));
          console.log(chalk.dim(`  Working Dir: ${process.cwd()}`));
          if (agentsConfig.filePath) {
            console.log(chalk.dim(`  Config File: ${agentsConfig.filePath}`));
          }
          console.log();
          continue;
        }

        if (trimmedInput === '/tools') {
          const tools = agent.getTools();
          console.log(chalk.cyan.bold(`\n📦 Available Tools (${tools.length}):\n`));
          for (const tool of tools) {
            console.log(chalk.green(`  ${tool.name}`));
            console.log(chalk.dim(`    ${tool.description.split('\n')[0]}\n`));
          }
          continue;
        }

        if (trimmedInput === '/skills') {
          const all = skillRegistry.listSkills();
          const active = skillRegistry.listActive();
          const activeNames = active.map(s => s.name);
          console.log(chalk.cyan.bold(`\n🎯 Skills (${all.length} total, ${active.length} active):\n`));
          for (const s of all) {
            const status = activeNames.includes(s.name) ? chalk.green('🟢') : chalk.gray('⚪');
            console.log(`${status} ${chalk.green(s.name)}: ${chalk.dim(s.description.substring(0, 60))}`);
          }
          console.log();
          continue;
        }

        if (trimmedInput === '/hooks') {
          const hooks = hookDispatcher.listHooks();
          const active = hookDispatcher.listActiveHooks();
          console.log(chalk.cyan.bold(`\n🪝 Hooks (${hooks.length} total, ${active.length} active):\n`));
          for (const h of hooks) {
            const status = h.enabled ? chalk.green('🟢') : chalk.red('🔴');
            console.log(`${status} ${chalk.green(h.name)}: ${chalk.dim(h.events.join(', '))}`);
          }
          console.log();
          continue;
        }

        if (trimmedInput === '/memory') {
          const state = agent.getState();
          console.log(chalk.cyan.bold('\n🧠 Memory Statistics:\n'));
          console.log(chalk.dim(`  Session Messages: ${state.conversationCount}`));
          console.log();
          continue;
        }

        if (trimmedInput === '/status') {
          const state = agent.getState();
          console.log(chalk.cyan.bold('\n📊 Agent Status:\n'));
          console.log(chalk.dim(`  Tools: ${state.tools.length}`));
          console.log(chalk.dim(`  Messages: ${state.conversationCount}`));
          console.log(chalk.dim(`  Skills: ${skillRegistry.listActive().length}`));
          console.log(chalk.dim(`  Hooks: ${hookDispatcher.listActiveHooks().length}`));
          console.log(chalk.dim(`  Plugins: ${pluginManager.listActive().length}`));
          console.log(chalk.dim(`  Checkpoints: ${checkpointManager.list().length}`));
          console.log();
          continue;
        }

        if (trimmedInput.startsWith('/tasks')) {
          const allTasks = taskManager.list({ status: 'all' as any, limit: 50 });
          console.log(chalk.cyan.bold(`\n📋 Tasks (${allTasks.length}):\n`));
          if (allTasks.length === 0) {
            console.log(chalk.dim('  No tasks yet. Use /task create to create one.\n'));
          } else {
            for (const t of allTasks) {
              const statusIcon = t.status === 'completed' ? '✅' : t.status === 'in_progress' ? '🔄' : t.status === 'failed' ? '❌' : '⏳';
              console.log(`${statusIcon} ${chalk.green(t.title)} [${t.id}]`);
              console.log(chalk.dim(`   Status: ${t.status} | Priority: ${t.priority}`));
            }
            console.log();
          }
          continue;
        }

        if (trimmedInput.startsWith('/model')) {
          const parts = trimmedInput.split(/\s+/);
          if (parts.length < 2) {
            console.log(chalk.cyan(`\nCurrent model: ${currentModel}\n`));
          } else {
            currentModel = parts[1];
            console.log(chalk.green(`\n✅ Switched to: ${currentModel}\n`));
          }
          continue;
        }

        if (trimmedInput.startsWith('/session')) {
          const parts = trimmedInput.split(/\s+/);
          if (parts.length < 2) {
            const sessions = SessionMemory.listSessions(SESSIONS_DIR);
            console.log(chalk.cyan.bold(`\n📂 Sessions (${sessions.length}):\n`));
            for (const s of sessions) {
              console.log(chalk.green(`  ${s.sessionId}`));
              console.log(chalk.dim(`    Messages: ${s.size}\n`));
            }
          } else if (parts[1] === 'new') {
            console.log(chalk.green(`\n✨ New session created\n`));
            agent.reset();
          } else if (parts[1] === 'delete' && parts[2]) {
            const mem = new SessionMemory({ sessionId: parts[2], storageDir: SESSIONS_DIR });
            mem.deleteSession(parts[2]);
            console.log(chalk.green(`\n🗑️  Deleted session: ${parts[2]}\n`));
          } else {
            console.log(chalk.green(`\nSwitched to session: ${parts[1]}\n`));
            agent.reset();
          }
          continue;
        }

        if (trimmedInput.startsWith('/checkpoints')) {
          const checkpoints = checkpointManager.list();
          console.log(chalk.cyan.bold(`\n📸 Checkpoints (${checkpoints.length}):\n`));
          for (const cp of checkpoints.slice(-10)) {
            console.log(chalk.green(`  ${cp.id}`));
            console.log(chalk.dim(`    ${cp.timestamp.toLocaleString()} | ${cp.messageCount} messages${cp.description ? ' | ' + cp.description : ''}\n`));
          }
          continue;
        }

        if (trimmedInput.startsWith('/rewind')) {
          const parts = trimmedInput.split(/\s+/);
          if (parts.length < 2) {
            console.log(chalk.yellow('\nUsage: /rewind <checkpoint-id>\n'));
          } else {
            try {
              const result = await checkpointManager.rewind(parts[1]);
              console.log(chalk.green(`\n✅ Restored ${result.restored.length} files:\n`));
              for (const f of result.restored) {
                console.log(chalk.dim(`  ${f}`));
              }
              console.log();
            } catch (error) {
              console.log(chalk.red(`\n❌ ${error instanceof Error ? error.message : String(error)}\n`));
            }
          }
          continue;
        }

        if (trimmedInput === '/stats') {
          console.log(chalk.cyan.bold('\n📈 Usage Statistics:\n'));
          console.log(statsTracker.exportReport());
          console.log();
          continue;
        }

        if (trimmedInput === '/plugins') {
          const plugins = pluginManager.list();
          console.log(chalk.cyan.bold(`\n🧩 Plugins (${plugins.length}):\n`));
          for (const p of plugins) {
            const status = p.enabled ? chalk.green('🟢') : chalk.red('🔴');
            console.log(`${status} ${chalk.green(p.manifest.name)} v${p.manifest.version}: ${chalk.dim(p.manifest.description)}`);
          }
          console.log();
          continue;
        }

        if (trimmedInput.startsWith('/format')) {
          const parts = trimmedInput.split(/\s+/);
          const paths: string[] = [];
          let formatter: 'prettier' | 'eslint' | 'stylelint' | 'auto' = 'auto';
          let write = true;
          
          for (let i = 1; i < parts.length; i++) {
            const part = parts[i];
            if (part === '--prettier') formatter = 'prettier';
            else if (part === '--eslint') formatter = 'eslint';
            else if (part === '--stylelint') formatter = 'stylelint';
            else if (part === '--check') write = false;
            else paths.push(part);
          }
          
          console.log(chalk.cyan.bold(`\n🎨 Formatting files...\n`));
          try {
            const result = await agent.executeTool('format', { 
              paths: paths.length > 0 ? paths : undefined, 
              formatter, 
              write 
            });
            if (result.success) {
              console.log(chalk.green(result.content || 'Formatting complete!'));
            } else {
              console.log(chalk.red(result.error || 'Formatting failed!'));
            }
          } catch (error) {
            console.log(chalk.red(`\n❌ ${error instanceof Error ? error.message : String(error)}\n`));
          }
          console.log();
          continue;
        }

        if (trimmedInput.startsWith('/background')) {
          const tasks = bgTaskManager.list();
          console.log(chalk.cyan.bold(`\n⏳ Background Tasks (${tasks.length}):\n`));
          for (const t of tasks) {
            const status = t.status === 'running' ? chalk.green('▶') : t.status === 'stopped' ? chalk.yellow('⏹') : chalk.red('❌');
            console.log(`${status} ${chalk.green(t.name)} (PID: ${t.pid}) - ${chalk.dim(t.logs.length + ' lines')}`);
          }
          console.log();
          continue;
        }

        if (trimmedInput.startsWith('/history')) {
          const query = trimmedInput.substring('/history'.length).trim();
          const results = query ? promptHistory.search(query) : promptHistory.getRecent(10);
          console.log(chalk.cyan.bold(`\n📜 Prompt History${query ? ` (search: "${query}")` : ''}:\n`));
          for (const r of results) {
            console.log(chalk.dim(`  [${r.timestamp.toLocaleString()}] `) + chalk.green(r.prompt.substring(0, 80)));
          }
          console.log();
          continue;
        }

        if (trimmedInput === '/update') {
          const result = await updateChecker.check();
          console.log(chalk.cyan.bold('\n🔄 Update Check:\n'));
          if (result.updateAvailable) {
            console.log(chalk.yellow(`  Current: ${result.current}`));
            console.log(chalk.green(`  Latest:  ${result.latest}`));
            console.log(chalk.yellow('  Update available! Run npm update to upgrade.'));
          } else {
            console.log(chalk.green(`  You are on the latest version: ${result.current}`));
          }
          console.log();
          continue;
        }

        if (trimmedInput.startsWith('/thinking')) {
          const parts = trimmedInput.split(/\s+/);
          const modeArg = parts[1]?.toLowerCase();
          let newMode: ThinkingMode;
          if (modeArg === 'normal' || modeArg === 'verbose') {
            const mode = modeArg === 'normal' ? ThinkingMode.NORMAL : ThinkingMode.VERBOSE;
            agent.setThinkingMode(mode);
            newMode = mode;
          } else {
            newMode = agent.toggleThinkingMode();
          }
          console.log(chalk.green(`\n🧠 Thinking mode: ${newMode}\n`));
          continue;
        }

        if (trimmedInput.startsWith('/')) {
          const parsed = parseCommand(trimmedInput, slashCommands);
          if (parsed) {
            const result = await parsed.command.execute(parsed.args, {
              tools: agent.getTools().map(t => t.name),
              messageCount: agent.getState().conversationCount,
              activeSkills: skillRegistry.listActive().map(s => s.name),
              hooks: hookDispatcher,
              skillRegistry,
              agent,
            });
            console.log(result.content + '\n');
            continue;
          } else {
            console.log(chalk.yellow(`Unknown command: ${trimmedInput}. Type /help for available commands.\n`));
            continue;
          }
        }

        if (!trimmedInput) continue;

        console.log();

        try {
          for await (const chunk of agent.chat(trimmedInput)) {
            if (chunk.type === 'content' && chunk.content) {
              process.stdout.write(chunk.content);
            }
          }
          console.log();
          statsTracker.recordToolCall('chat', true);
        } catch (error) {
          console.error(chalk.red('\n❌ Error: '), error);
          statsTracker.recordToolCall('chat', false);
        }

        console.log();
      }
    });

  program
    .command('run')
    .description('Single execution')
    .argument('<message>', 'Message to send')
    .option('-m, --model <name>', 'Model name', 'qwen2.5-coder:3b')
    .option('-u, --url <url>', 'Ollama server URL', 'http://localhost:11434')
    .option('-v, --verbose', 'Verbose output', false)
    .action(async (message, options) => {
      const llm = new OllamaAdapter({
        model: options.model,
        baseUrl: options.url,
      });

      const agent = new Agent({
        llm,
        model: options.model,
        cwd: process.cwd(),
        verbose: options.verbose,
      });

      agent.addTool(BashTool);
      agent.addTool(FileReadTool);
      agent.addTool(FileWriteTool);
      agent.addTool(GlobTool);
      agent.addTool(GrepTool);

      await agent.run(message);
    });

  program
    .command('tools')
    .description('List available tools')
    .action(() => {
      const tools = [BashTool, FileReadTool, FileWriteTool, GlobTool, GrepTool, WebSearchTool, WebFetchTool];
      console.log(chalk.cyan.bold('\n📦 Available Tools:\n'));
      for (const tool of tools) {
        console.log(chalk.green(`  ${tool.name}`));
        console.log(chalk.dim(`    ${tool.description.split('\n')[0]}\n`));
      }
    });

  program
    .command('init')
    .description('Initialize .miniagent directory and default config')
    .action(async () => {
      const fs = await import('fs');
      if (!fs.existsSync(MINIAGENT_DIR)) {
        fs.mkdirSync(MINIAGENT_DIR, { recursive: true });
        fs.mkdirSync(path.join(MINIAGENT_DIR, 'skills'), { recursive: true });
        fs.mkdirSync(SESSIONS_DIR, { recursive: true });
        console.log(chalk.green('✨ Initialized .miniagent directory'));
      } else {
        console.log(chalk.yellow('.miniagent already exists'));
      }
    });

  program
    .command('doctor')
    .description('Check environment status (Ollama, models, config)')
    .action(async () => {
      await runDoctor();
    });

  program
    .command('install')
    .description('Install Ollama or models')
    .argument('<target>', 'What to install: "ollama" or "model <name>"')
    .action(async (target: string) => {
      if (target === 'ollama') {
        await installOllama();
      } else {
        console.log(chalk.yellow('Usage: miniagent install model <name>'));
        console.log(chalk.dim('  Example: miniagent install model qwen2.5-coder:3b\n'));
      }
    });

  program
    .command('models')
    .description('Manage Ollama models')
    .argument('<action>', 'Action: list, pull, rm, recommend')
    .argument('[name]', 'Model name (for pull/rm)')
    .action(async (action: string, name?: string) => {
      switch (action) {
        case 'list':
          listModels();
          break;
        case 'pull':
          if (!name) {
            console.log(chalk.yellow('Usage: miniagent models pull <name>'));
            console.log(chalk.dim('  Example: miniagent models pull qwen2.5-coder:3b\n'));
            return;
          }
          await pullModel(name);
          break;
        case 'rm':
          if (!name) {
            console.log(chalk.yellow('Usage: miniagent models rm <name>'));
            console.log(chalk.dim('  Example: miniagent models rm qwen2.5-coder:3b\n'));
            return;
          }
          removeModel(name);
          break;
        case 'recommend':
          showRecommendedModels();
          break;
        default:
          console.log(chalk.yellow(`Unknown action: ${action}`));
          console.log(chalk.dim('  Available: list, pull, rm, recommend\n'));
      }
    });

  program
    .command('serve')
    .description('Start MiniAgent web server')
    .option('--port <number>', 'Port to listen on', '3000')
    .option('--host <string>', 'Host to bind to', '127.0.0.1')
    .option('--model <model>', 'LLM model to use', 'qwen2.5-coder:3b')
    .option('--url <url>', 'Ollama server URL', 'http://localhost:11434')
    .option('--ui-password <string>', 'Password to protect web UI')
    .option('--verbose', 'Verbose output', false)
    .action(async (options) => {
      console.log(chalk.cyan.bold('\n🚀 Starting MiniAgent Web Server...'));

      const server = new MiniAgentServer({
        port: parseInt(options.port, 10),
        host: options.host,
        password: options.uiPassword,
        projectDir: process.cwd(),
      });

      const llm = new OllamaAdapter({
        model: options.model,
        baseUrl: options.url,
      });
      const agent = new Agent({ llm, model: options.model, cwd: process.cwd(), verbose: options.verbose });

      // Register MCP tools
      const mcpManager = new MCPManager();
      for (const tool of createMCPTools(mcpManager)) {
        agent.addTool(tool);
      }
      server.setAgent(agent);

      try {
        await server.start();
        console.log(chalk.green(`\n✅ Web UI available at: http://${options.host}:${options.port}`));
        console.log(chalk.green(`🤖 Agent model: ${options.model}`));
        if (options.uiPassword) {
          console.log(chalk.yellow('🔒 UI Password protected'));
        }
        console.log(chalk.dim('Press Ctrl+C to stop\n'));

        process.on('SIGINT', () => {
          console.log(chalk.yellow('\n\nShutting down server...'));
          server.stop();
          process.exit(0);
        });

        process.on('SIGTERM', () => {
          server.stop();
          process.exit(0);
        });

      } catch (error) {
        console.error(chalk.red('Failed to start server:'), error);
        process.exit(1);
      }
    });

  program
    .command('mcp-serve')
    .description('Start MCP SSE server for external clients')
    .option('--port <number>', 'Port to listen on', '8080')
    .option('--host <string>', 'Host to bind to', '127.0.0.1')
    .option('--model <model>', 'LLM model to use', 'qwen2.5-coder:3b')
    .option('--url <url>', 'Ollama server URL', 'http://localhost:11434')
    .option('-v, --verbose', 'Verbose output', false)
    .action(async (options) => {
      console.log(chalk.cyan.bold('\n🔌 Starting MCP SSE Server...'));

      const port = parseInt(options.port, 10);

      const sseServer = new McpSseServer({ port, host: options.host });

      const llm = new OllamaAdapter({
        model: options.model,
        baseUrl: options.url,
      });
      const agent = new Agent({ llm, model: options.model, cwd: process.cwd(), verbose: options.verbose });
      const mcpManager = new MCPManager();
      for (const tool of createMCPTools(mcpManager)) {
        agent.addTool(tool);
      }

      agent.addTool(BashTool);
      agent.addTool(FileReadTool);
      agent.addTool(FileWriteTool);
      agent.addTool(GlobTool);
      agent.addTool(GrepTool);

      sseServer.setMessageHandler(async (message, _sessionId, sendResponse) => {
        const msg = message as { method?: string; params?: Record<string, unknown>; id?: string | number };
        try {
          if (msg.method === 'tools/list') {
            const tools = agent.getTools().map(t => ({
              name: t.name,
              description: t.description,
              parameters: t.parameters || {},
            }));
            sendResponse({
              jsonrpc: '2.0',
              id: msg.id,
              result: { tools },
            });
            return;
          }

          if (msg.method === 'tools/call') {
            const toolName = msg.params?.name as string;
            const toolArgs = msg.params?.arguments as Record<string, unknown>;
            const tool = agent.getTools().find(t => t.name === toolName);
            if (!tool) {
              sendResponse({
                jsonrpc: '2.0',
                id: msg.id,
                error: { code: -32601, message: `Tool not found: ${toolName}` },
              });
              return;
            }
            const result = await tool.execute(toolArgs);
            sendResponse({
              jsonrpc: '2.0',
              id: msg.id,
              result,
            });
            return;
          }

          if (msg.method === 'chat/send') {
            const content = msg.params?.content as string;
            if (!content) {
              sendResponse({
                jsonrpc: '2.0',
                id: msg.id,
                error: { code: -32602, message: 'Missing content parameter' },
              });
              return;
            }
            let response = '';
            for await (const chunk of agent.chat(content)) {
              if (chunk.type === 'content' && chunk.content) {
                response += chunk.content;
              }
            }
            sendResponse({
              jsonrpc: '2.0',
              id: msg.id,
              result: { content: response },
            });
            return;
          }

          sendResponse({
            jsonrpc: '2.0',
            id: msg.id,
            error: { code: -32601, message: `Method not found: ${msg.method}` },
          });
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : String(err);
          sendResponse({
            jsonrpc: '2.0',
            id: msg.id,
            error: { code: -32603, message: `Internal error: ${message}` },
          });
        }
      });

      await sseServer.start();

      console.log(chalk.green(`\n✅ MCP SSE server running on ${options.host}:${port}`));
      console.log(chalk.green(`🤖 Agent model: ${options.model}`));
      console.log(chalk.dim('   Available methods:'));
      console.log(chalk.dim('   POST /message - { method: "tools/list" }'));
      console.log(chalk.dim('   POST /message - { method: "tools/call", params: { name, arguments } }'));
      console.log(chalk.dim('   POST /message - { method: "chat/send", params: { content } }'));
      console.log(chalk.dim('   GET /sse - SSE event stream'));
      console.log(chalk.dim('   GET /health - Health check\n'));
      console.log(chalk.dim('Press Ctrl+C to stop\n'));

      process.on('SIGINT', async () => {
        console.log(chalk.yellow('\n\nShutting down MCP SSE server...'));
        await sseServer.stop();
        process.exit(0);
      });

      process.on('SIGTERM', async () => {
        await sseServer.stop();
        process.exit(0);
      });
    });

  program.parse();

  const hasSubcommand = process.argv.some(arg => ['chat', 'run', 'tools', 'init', 'serve', 'help', 'mcp-serve', 'doctor', 'install', 'models'].includes(arg));

  if (!hasSubcommand) {
    program.commands.find(c => c.name() === 'chat')?.parse([], { from: 'user' });
  }
}

main();
