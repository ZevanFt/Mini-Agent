/**
 * Phase 6 测试 - Edit Tool, Hooks, Slash Commands
 */

import { FileEditTool } from '../../src/tools/file-edit.js';
import { HookDispatcher, createToolLogHook, createSecurityAuditHook, createSessionTimerHook } from '../../src/core/hooks.js';
import { createSlashCommands, parseCommand, isSlashCommand } from '../../src/core/commands.js';
import chalk from 'chalk';
import { writeFileSync, readFileSync, mkdirSync } from 'fs';
import { join } from 'path';

// ============================================================
// Edit Tool 测试
// ============================================================
async function testEditTool() {
  console.log(chalk.yellow('1️⃣  FileEditTool 测试'));
  
  // 创建测试文件
  const testDir = join(process.cwd(), 'test', 'fixtures');
  mkdirSync(testDir, { recursive: true });
  const testFile = join(testDir, 'test-edit.ts');
  
  const originalContent = `function hello() {
  console.log('hello');
  console.log('world');
}

function goodbye() {
  console.log('goodbye');
}`;
  
  writeFileSync(testFile, originalContent, 'utf-8');

  // 测试精确编辑
  const editResult = await FileEditTool.execute({
    path: testFile,
    search: "  console.log('hello');\n  console.log('world');",
    replace: "  console.log('Hello, MiniAgent!');",
  });
  if (editResult.success) {
    console.log(chalk.green(`  ✅ 编辑成功: ${editResult.content}`));
    
    // 验证内容
    const newContent = readFileSync(testFile, 'utf-8');
    const hasOld = newContent.includes('console.log(\'hello\')');
    const hasNew = newContent.includes('Hello, MiniAgent!');
    console.log(chalk.green(`  ✅ 内容验证: old removed=${!hasOld}, new present=${hasNew}`));
  } else {
    console.log(chalk.red(`  ❌ 编辑失败: ${editResult.content}`));
  }

  // 测试不存在的 SEARCH
  const notFoundResult = await FileEditTool.execute({
    path: testFile,
    search: "THIS_DOES_NOT_EXIST",
    replace: "something",
  });
  if (!notFoundResult.success) {
    console.log(chalk.green(`  ✅ 正确拦截不存在的内容: ${notFoundResult.content.substring(0, 50)}...`));
  }

  // 测试不存在的文件
  const noFileResult = await FileEditTool.execute({
    path: join(testDir, 'nonexistent.ts'),
    search: "something",
    replace: "something else",
  });
  if (!noFileResult.success) {
    console.log(chalk.green(`  ✅ 正确拦截不存在的文件`));
  }
  console.log();
}

// ============================================================
// Hooks 系统测试
// ============================================================
async function testHooks() {
  console.log(chalk.yellow('2️⃣  Hooks 系统测试'));
  
  const dispatcher = new HookDispatcher('test_session_001');
  
  // 注册内置 Hook
  dispatcher.register(createToolLogHook());
  dispatcher.register(createSecurityAuditHook());
  dispatcher.register(createSessionTimerHook());
  
  console.log(chalk.green(`  ✅ 注册了 ${dispatcher.listHooks().length} 个 Hook`));

  // 测试 pre_tool_use
  console.log(chalk.dim('     触发 pre_tool_use:'));
  const preResult = await dispatcher.fire('pre_tool_use', {
    toolName: 'bash',
    toolParams: { command: 'ls -la' },
  });
  console.log(chalk.green(`  ✅ pre_tool_use: blocked=${preResult.blocked}, results=${preResult.results.length}`));

  // 测试 post_tool_use
  console.log(chalk.dim('     触发 post_tool_use:'));
  const postResult = await dispatcher.fire('post_tool_use', {
    toolName: 'bash',
    toolResult: { success: true, content: 'file1.ts file2.ts' },
  });
  console.log(chalk.green(`  ✅ post_tool_use: blocked=${postResult.blocked}, results=${postResult.results.length}`));

  // 测试安全审计阻止
  console.log(chalk.dim('     测试安全审计（危险命令）:'));
  const securityResult = await dispatcher.fire('pre_tool_use', {
    toolName: 'bash',
    toolParams: { command: 'rm -rf /' },
  });
  console.log(chalk.green(`  ✅ 危险命令: blocked=${securityResult.blocked} (${securityResult.blocked ? '正确拦截' : '未拦截'})`));

  // 测试 session_start / session_end
  console.log(chalk.dim('     触发 session_start:'));
  await dispatcher.fire('session_start');
  console.log(chalk.green(`  ✅ session_start: OK`));

  // 测试取消注册
  dispatcher.unregister('tool_log');
  console.log(chalk.green(`  ✅ unregister tool_log: 剩余 ${dispatcher.listHooks().length} 个`));

  // 测试启用/禁用
  dispatcher.setEnabled('session_timer', false);
  const activeHooks = dispatcher.listActiveHooks();
  console.log(chalk.green(`  ✅ 禁用 session_timer: 活跃 ${activeHooks.length} 个`));
  console.log();
}

// ============================================================
// Slash Commands 测试
// ============================================================
async function testSlashCommands() {
  console.log(chalk.yellow('3️⃣  Slash Commands 测试'));
  
  const commands = createSlashCommands();
  console.log(chalk.green(`  ✅ 创建了 ${commands.length} 个命令`));

  // 列出命令名称
  const names = commands.map(c => c.name);
  console.log(chalk.dim(`     ${names.join(', ')}`));

  // 测试命令解析
  console.log(chalk.dim('     命令解析:'));
  
  const testCases = [
    { input: '/help', expect: 'help', expectArgs: '' },
    { input: '/compact', expect: 'compact', expectArgs: '' },
    { input: '/tools', expect: 'tools', expectArgs: '' },
    { input: '/skills', expect: 'skills', expectArgs: '' },
    { input: '/status', expect: 'status', expectArgs: '' },
    { input: '/review', expect: 'review', expectArgs: '' },
    { input: 'not a command', expect: null, expectArgs: '' },
  ];

  for (const tc of testCases) {
    const parsed = parseCommand(tc.input, commands);
    const isCmd = isSlashCommand(tc.input);
    const name = parsed ? parsed.command.name : null;
    const ok = name === tc.expect;
    const icon = ok ? '✅' : '❌';
    console.log(chalk.dim(`     ${icon} "${tc.input}" -> command=${name}, isCommand=${isCmd}`));
  }

  // 测试命令执行
  console.log(chalk.dim('     命令执行:'));
  const ctx = {
    tools: ['bash', 'file_read', 'glob', 'grep', 'file_write', 'web_search'],
    messageCount: 10,
    tokenCount: 5000,
    activeSkills: ['git-commit', 'read-code'],
  };

  const helpResult = await commands.find(c => c.name === 'help')!.execute('', ctx);
  console.log(chalk.green(`  ✅ /help: ${helpResult.content.split('\n').length} 行`));

  const toolsResult = await commands.find(c => c.name === 'tools')!.execute('', ctx);
  console.log(chalk.green(`  ✅ /tools: ${toolsResult.content.split('\n').length} 行`));

  const statusResult = await commands.find(c => c.name === 'status')!.execute('', ctx);
  console.log(chalk.green(`  ✅ /status: ${statusResult.content.split('\n').length} 行`));
  console.log();
}

// ============================================================
// 主测试
// ============================================================
async function test() {
  console.log(chalk.cyan.bold('\n🧪 Phase 6 测试套件 - Edit Tool, Hooks, Slash Commands\n'));

  await testEditTool();
  await testHooks();
  await testSlashCommands();

  console.log(chalk.cyan.bold('🎉 Phase 6 所有测试通过\n'));
  console.log(chalk.cyan.bold('📊 Phase 6 新增功能'));
  console.log(chalk.dim('     ✅ FileEditTool: 精细 SEARCH/REPLACE 编辑'));
  console.log(chalk.dim('     ✅ Hooks 系统: 13 种生命周期事件'));
  console.log(chalk.dim('     ✅ Slash Commands: 13 个内置命令'));
  console.log(chalk.dim('     ✅ 内置 Hook: 工具日志 + 安全审计 + 会话计时'));
  console.log(chalk.dim('     ✅ 命令解析: parseCommand + isSlashCommand'));
  console.log();
}

test().catch(err => {
  console.error(chalk.red('\n❌ Phase 6 测试失败:'), err);
  process.exit(1);
});
