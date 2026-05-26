import { Command } from 'commander';
import chalk from 'chalk';
import path from 'path';
import fs from 'fs';
import { Agent } from './core/agent.js';
import { ThinkingMode } from './core/thinking-mode.js';
import { HookDispatcher, createToolLogHook, createSecurityAuditHook, createSessionTimerHook } from './core/hooks.js';
import { OllamaAdapter } from './llm/ollama.js';
import { BashTool } from './tools/bash.js';
import { FileReadTool } from './tools/file-read.js';
import { FileWriteTool } from './tools/file-write.js';
import { GlobTool } from './tools/glob.js';
import { GrepTool } from './tools/grep.js';
import { WebSearchTool } from './tools/web-search.js';
import { WebFetchTool } from './tools/web-fetch.js';
import { ConfigTool } from './tools/config.js';
import { createMemoryTool } from './tools/memory-tool.js';
import { TodoWriteTool } from './tools/todo.js';
import { LongTermMemory } from './memory/long-term.js';
import { SessionMemory } from './memory/index.js';
import { ContextCompactor } from './core/compact.js';
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
import { FormatTool } from './tools/format.js';

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
    .option('-m, --model <name>', 'Model name', 'qwen2:0.5b')
    .option('-u, --url <url>', 'Ollama server URL', 'http://localhost:11434')
    .option('-v, --verbose', 'Verbose output', false)
    .option('-s, --session <id>', 'Session ID')
    .option('--list-sessions', 'List all sessions')
    .option('--tui', 'Use terminal UI mode (TUI)', false)
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

      printBanner();
      console.log();

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
      if (agentsConfig.filePath) {
        console.log(chalk.dim(`📄 Found ${path.basename(agentsConfig.filePath)}: ${agentsConfig.filePath}`));
      }

      const hookDispatcher = new HookDispatcher(sessionId);
      hookDispatcher.register(createToolLogHook());
      hookDispatcher.register(createSecurityAuditHook());
      hookDispatcher.register(createSessionTimerHook());

      const permissionSystem = new EnhancedPermissionSystem({
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
        console.log(chalk.cyan(`\n🔌 Starting MCP SSE server on port ${ssePort}...`));
        await mcpManager.startSseServer(ssePort);
        console.log(chalk.green(`✅ MCP SSE server running on port ${ssePort}`));
        console.log(chalk.dim('   External clients can connect via SSE\n'));
      }

      for (const mcpTool of createMCPTools(mcpManager)) {
        agent.addTool(mcpTool);
      }

      if (!options.noTui) {
        printStatus(agent, currentModel, sessionId, hookDispatcher.listActiveHooks().length, skillRegistry.listActive().length, pluginManager.listActive().length);
        console.log();
      }

      if (agentsConfig.allowedTools.length > 0 && agentsConfig.filePath) {
        console.log(chalk.yellow(`⚠️  Tool restrictions from ${path.basename(agentsConfig.filePath)}: only ${agentsConfig.allowedTools.join(', ')} allowed`));
        console.log();
      }

      const checkResult = await updateChecker.check();
      if (checkResult.updateAvailable) {
        console.log(chalk.yellow(`🔄 Update available: ${checkResult.current} → ${checkResult.latest}`));
        if (checkResult.releaseNotes) {
          console.log(chalk.dim(checkResult.releaseNotes));
        }
        console.log();
      }

      console.log(chalk.green('💬 Ready! Type /help for commands, or just start chatting\n'));

      // ── TUI Mode ──
      if (options.tui) {
        if (!process.stdin.isTTY) {
          console.error(chalk.red('TUI mode requires a terminal (TTY). Use non-TUI mode instead.'));
          process.exit(1);
        }
        if (typeof process.stdin.setRawMode !== 'function') {
          console.error(chalk.red('TUI mode not supported in this runtime (setRawMode unavailable).'));
          process.exit(1);
        }

        // terminal-kit handles uncaughtException itself; the global catchers
        // above stay registered as a safety net.  No need for local handlers.

        console.log(chalk.cyan('🖥️  Starting Terminal UI...'));
        try {
          const tui = await initTUI({ agent, model: currentModel });
          tui.start();
          await tui.waitForExit();
        } catch (err) {
          teeCrash('TUI_INIT', err);
          console.error(chalk.red(`\n❌ TUI failed to start:`), err instanceof Error ? err.message : String(err));
          if (err instanceof Error && err.stack) {
            console.error(chalk.dim(err.stack.split('\n').slice(1, 4).join('\n')));
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
          const compactor = new ContextCompactor();
          const messages = agent.getState();
          console.log(chalk.dim(`\nContext: ${messages.conversationCount} messages`));
          console.log(chalk.green('Context compaction ready. Run this to compress conversation.\n'));
          continue;
        }

        if (trimmedInput === '/clear') {
          agent.reset();
          console.log(chalk.green('\n🗑️  Conversation cleared.\n'));
          continue;
        }

        if (trimmedInput.startsWith('/plan')) {
          console.log(chalk.green('\n📋 Planning mode activated. Describe your task.\n'));
          continue;
        }

        if (trimmedInput.startsWith('/review')) {
          console.log(chalk.green('\n🔍 Running code review. Checking git status and changes...\n'));
          continue;
        }

        if (trimmedInput.startsWith('/commit')) {
          console.log(chalk.green('\n📝 Analyzing git diff and generating commit message...\n'));
          continue;
        }

        if (trimmedInput.startsWith('/config')) {
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
    .option('-m, --model <name>', 'Model name', 'qwen2:0.5b')
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
    .command('serve')
    .description('Start MiniAgent web server')
    .option('--port <number>', 'Port to listen on', '3000')
    .option('--host <string>', 'Host to bind to', '127.0.0.1')
    .option('--ui-password <string>', 'Password to protect web UI')
    .action(async (options) => {
      console.log(chalk.cyan.bold('\n🚀 Starting MiniAgent Web Server...'));

      const server = new MiniAgentServer({
        port: parseInt(options.port, 10),
        host: options.host,
        password: options.uiPassword,
        projectDir: process.cwd(),
      });

      try {
        await server.start();
        console.log(chalk.green(`\n✅ Web UI available at: http://${options.host}:${options.port}`));
        if (options.uiPassword) {
          console.log(chalk.yellow('🔒 UI Password protected'));
        }
        console.log(chalk.dim('Press Ctrl+C to stop\n'));

        // Handle graceful shutdown
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
    .option('-v, --verbose', 'Verbose output', false)
    .action(async (options) => {
      console.log(chalk.cyan.bold('\n🔌 Starting MCP SSE Server...'));

      const mcpManager = new MCPManager();

      const port = parseInt(options.port, 10);
      console.log(chalk.green(`✅ MCP SSE server running on ${options.host}:${port}`));
      console.log(chalk.dim('   External clients can connect via SSE'));
      console.log(chalk.dim('   POST /message - Send messages'));
      console.log(chalk.dim('   GET /sse - SSE event stream'));
      console.log(chalk.dim('   GET /health - Health check\n'));

      await mcpManager.startSseServer(port, options.host);

      console.log(chalk.dim('Press Ctrl+C to stop\n'));

      process.on('SIGINT', async () => {
        console.log(chalk.yellow('\n\nShutting down MCP SSE server...'));
        await mcpManager.stopSseServer();
        process.exit(0);
      });

      process.on('SIGTERM', async () => {
        await mcpManager.stopSseServer();
        process.exit(0);
      });
    });

  program.parse();

  const hasSubcommand = process.argv.some(arg => ['chat', 'run', 'tools', 'init', 'serve', 'help', 'mcp-serve'].includes(arg));

  if (!hasSubcommand) {
    program.commands.find(c => c.name() === 'chat')?.parse([], { from: 'user' });
  }
}

main();
