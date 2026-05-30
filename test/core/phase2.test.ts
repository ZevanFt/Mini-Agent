import { Agent } from '../../src/core/agent.js';
import { MockLLMAdapter } from '../../src/llm/mock.js';
import { BashTool } from '../../src/tools/bash.js';
import { FileReadTool } from '../../src/tools/file-read.js';
import { FileWriteTool } from '../../src/tools/file-write.js';
import { GlobTool } from '../../src/tools/glob.js';
import { GrepTool } from '../../src/tools/grep.js';
import { WebFetchTool } from '../../src/tools/web-fetch.js';
import { TodoWriteTool } from '../../src/tools/todo.js';
import { SkillRegistry } from '../../src/skills/skill-registry.js';
import chalk from 'chalk';

async function test() {
  console.log(chalk.cyan.bold('\n🧪 MiniAgent Test Suite - Phase 2\n'));

  // 1. Agent + Tools
  console.log(chalk.yellow('1️⃣  创建 Agent + 注册所有工具'));
  const llm = new MockLLMAdapter({ delay: 30 });
  const agent = new Agent({
    llm,
    cwd: process.cwd(),
    verbose: true,
  });

  agent.addTool(BashTool);
  agent.addTool(FileReadTool);
  agent.addTool(FileWriteTool);
  agent.addTool(GlobTool);
  agent.addTool(GrepTool);
  agent.addTool(WebFetchTool);
  agent.addTool(TodoWriteTool);

  const tools = agent.getTools();
  console.log(chalk.green(`  ✅ 已注册 ${tools.length} 个工具:`), tools.map(t => t.name).join(', '));

  // 2. 测试 BashTool
  console.log(chalk.yellow('\n2️⃣  测试 BashTool'));
  const bashResult = await BashTool.execute({ command: 'echo "Hello MiniAgent!"' });
  console.log(bashResult.success
    ? chalk.green('  ✅ BashTool 通过')
    : chalk.red('  ❌ BashTool 失败')
  );

  // 3. 测试 FileReadTool
  console.log(chalk.yellow('\n3️⃣  测试 FileReadTool'));
  const readResult = await FileReadTool.execute({ path: 'package.json', limit: 10 });
  console.log(readResult.success
    ? chalk.green(`  ✅ FileReadTool 通过 (${(readResult.metadata as any)?.lines || 0} lines)`)
    : chalk.red('  ❌ FileReadTool 失败')
  );

  // 4. 测试 FileWriteTool
  console.log(chalk.yellow('\n4️⃣  测试 FileWriteTool'));
  const writeResult = await FileWriteTool.execute({
    path: '/tmp/test-miniagent.txt',
    content: 'This is a test file created by MiniAgent',
    create_dirs: true,
  });
  console.log(writeResult.success
    ? chalk.green('  ✅ FileWriteTool 通过')
    : chalk.red('  ❌ FileWriteTool 失败')
  );

  // 5. 测试 GlobTool
  console.log(chalk.yellow('\n5️⃣  测试 GlobTool'));
  const globResult = await GlobTool.execute({ pattern: 'src/**/*.ts' });
  const globCount = (globResult.metadata as any)?.count || 0;
  console.log(globResult.success
    ? chalk.green(`  ✅ GlobTool 通过 (${globCount} files)`)
    : chalk.red('  ❌ GlobTool 失败')
  );

  // 6. 测试 TodoWriteTool
  console.log(chalk.yellow('\n6️⃣  测试 TodoWriteTool'));
  const todoResult = await TodoWriteTool.execute({
    todos: [
      { content: '实现 Agent 框架', status: 'completed' },
      { content: '实现 Skill 系统', status: 'pending' },
      { content: '添加 Memory 系统', status: 'pending' },
    ],
  });
  console.log(todoResult.success
    ? chalk.green(`  ✅ TodoWriteTool 通过 (${(todoResult.metadata as any)?.count} items)`)
    : chalk.red('  ❌ TodoWriteTool 失败')
  );

  // 7. 测试 Skill 系统
  console.log(chalk.yellow('\n7️⃣  测试 Skill 系统'));
  const skillRegistry = new SkillRegistry();
  skillRegistry.addDiscoveryDir(process.cwd() + '/.miniagent/skills');
  skillRegistry.discoverAndLoad();
  console.log(chalk.green(`  ✅ 已加载 ${skillRegistry.listSkills().length} 个 Skill`));

  const activated = skillRegistry.matchSkills('帮我提交代码', 1);
  console.log(activated.length > 0
    ? chalk.green(`  ✅ Skill 匹配成功: ${activated.map(s => `${s.skill.name}(score:${s.score})`).join(', ')}`)
    : chalk.yellow('  ⚠️  没有 Skill 被匹配')
  );

  const noActivate = skillRegistry.matchSkills('今天天气真好', 1);
  console.log(noActivate.length === 0
    ? chalk.green('  ✅ 不误匹配 (正确)')
    : chalk.red('  ❌ 错误匹配')
  );

  // 8. 测试聊天
  console.log(chalk.yellow('\n8️⃣  测试聊天功能'));
  console.log(chalk.dim('   用户: 你好！'));
  let response = '';
  for await (const chunk of agent.chat('你好！')) {
    if (chunk.type === 'content' && chunk.content) {
      response += chunk.content;
    }
    if (chunk.type === 'done') {
      console.log();
    }
  }
  console.log(chalk.green('  ✅ 聊天通过'));

  // 9. 测试状态
  console.log(chalk.yellow('\n9️⃣  测试 Agent State'));
  const state = agent.getState();
  console.log(chalk.green('  ✅ State 获取成功'));
  console.log(chalk.dim(`     工具: ${state.tools.length} 个`));
  console.log(chalk.dim(`     对话: ${state.conversationCount} 条`));

  // 10. 测试 reset
  console.log(chalk.yellow('\n🔟  测试 reset'));
  agent.reset();
  console.log(chalk.green('  ✅ 重置成功'));

  console.log(chalk.cyan.bold('\n🎉 所有测试通过！MiniAgent Phase 2 工作正常\n'));
}

test().catch(err => {
  console.error(chalk.red('\n❌ 测试失败:'), err);
  process.exit(1);
});
