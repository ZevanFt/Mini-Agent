import { Agent } from './core/agent.js';
import { MockLLMAdapter } from './llm/mock.js';
import { BashTool } from './tools/bash.js';
import { FileReadTool } from './tools/file-read.js';
import { GlobTool } from './tools/glob.js';
import { GrepTool } from './tools/grep.js';
import chalk from 'chalk';

async function test() {
  console.log(chalk.cyan.bold('\n🧪 MiniAgent Test Suite\n'));

  console.log(chalk.yellow('1️⃣  创建 Agent 实例'));
  const llm = new MockLLMAdapter({ delay: 50 });
  const agent = new Agent({
    llm,
    cwd: process.cwd(),
    verbose: true,
  });

  console.log(chalk.green('  ✅ Agent 创建成功\n'));

  console.log(chalk.yellow('2️⃣  注册工具'));
  agent.addTool(BashTool);
  agent.addTool(FileReadTool);
  agent.addTool(GlobTool);
  agent.addTool(GrepTool);

  const tools = agent.getTools();
  console.log(chalk.green(`  ✅ 已注册 ${tools.length} 个工具:`), tools.map(t => t.name).join(', '), '\n');

  console.log(chalk.yellow('3️⃣  测试聊天功能'));
  let response = '';
  console.log(chalk.dim('   用户: 你好，MiniAgent！'));
  console.log(chalk.dim('   助手: '));
  for await (const chunk of agent.chat('你好，MiniAgent！')) {
    if (chunk.type === 'content' && chunk.content) {
      response += chunk.content;
      process.stdout.write(chunk.content);
    }
    if (chunk.type === 'done') {
      console.log('\n');
    }
  }
  console.log(chalk.green('  ✅ 聊天测试通过\n'));

  console.log(chalk.yellow('4️⃣  测试 BashTool'));
  const bashResult = await BashTool.execute({ command: 'echo "Hello from MiniAgent!"' });
  if (bashResult.success) {
    console.log(chalk.green('  ✅ BashTool 测试通过'));
    console.log(chalk.dim(`     输出: ${bashResult.content}\n`));
  } else {
    console.log(chalk.red('  ❌ BashTool 测试失败'), bashResult.error);
  }

  console.log(chalk.yellow('5️⃣  测试 FileReadTool'));
  const readResult = await FileReadTool.execute({ path: 'package.json' });
  if (readResult.success) {
    console.log(chalk.green('  ✅ FileReadTool 测试通过'));
    console.log(chalk.dim(`     读取: package.json (前100字符)\n`));
  } else {
    console.log(chalk.red('  ❌ FileReadTool 测试失败'), readResult.error);
  }

  console.log(chalk.yellow('6️⃣  测试 GlobTool'));
  const globResult = await GlobTool.execute({ pattern: '**/*.ts' });
  if (globResult.success) {
    const count = globResult.metadata?.count || 0;
    console.log(chalk.green(`  ✅ GlobTool 测试通过 (找到 ${count} 个 .ts 文件)`));
    console.log(chalk.dim('     文件列表:'));
    if (Array.isArray(globResult.metadata?.files)) {
      const files = globResult.metadata.files as string[];
      files.slice(0, 5).forEach(f => console.log(chalk.dim(`       - ${f}`)));
      if (files.length > 5) console.log(chalk.dim(`       ... 还有 ${files.length - 5} 个文件`));
    }
    console.log();
  } else {
    console.log(chalk.red('  ❌ GlobTool 测试失败'), globResult.error);
  }

  console.log(chalk.yellow('7️⃣  测试 Agent State'));
  const state = agent.getState();
  console.log(chalk.green('  ✅ Agent State 获取成功'));
  console.log(chalk.dim(`     工具: ${state.tools.join(', ')}`));
  console.log(chalk.dim(`     对话数: ${state.conversationCount}\n`));

  console.log(chalk.yellow('8️⃣  测试 reset'));
  agent.reset();
  console.log(chalk.green('  ✅ Agent 重置成功\n'));

  console.log(chalk.cyan.bold('\n🎉 所有测试通过！MiniAgent 核心框架工作正常\n'));
}

test().catch(err => {
  console.error(chalk.red('\n❌ 测试失败:'), err);
  process.exit(1);
});
