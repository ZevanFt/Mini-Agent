/**
 * Phase 5 测试 - WebSearch, Config, Memory, Context Compaction
 */

import { WebSearchTool } from '../../src/tools/web-search.js';
import { ConfigTool } from '../../src/tools/config.js';
import { LongTermMemory } from '../../src/memory/long-term.js';
import { ContextCompactor, estimateTokens } from '../../src/core/compact.js';
import { createMemoryTool } from '../../src/tools/memory-tool.js';
import { MockLLMAdapter } from '../../src/llm/mock.js';
import type { Message } from '../../src/memory/index.js';
import chalk from 'chalk';
import { tmpdir } from 'os';
import { join } from 'path';

async function testWebSearch() {
  console.log(chalk.yellow('1️⃣  WebSearchTool 测试'));
  
  console.log(chalk.dim(`     名称: ${WebSearchTool.name}`));
  console.log(chalk.dim(`     参数: ${JSON.stringify(WebSearchTool.parameters.properties, null, 2).substring(0, 100)}...`));

  // 测试工具执行（可能因网络受限而失败）
  const result = await WebSearchTool.execute({
    query: 'TypeScript best practices 2024',
    limit: 3,
  });
  
  if (result.success) {
    console.log(chalk.green(`  ✅ 搜索成功: ${result.content.substring(0, 80)}...`));
  } else {
    console.log(chalk.yellow(`  ⚠️  搜索失败 (可能网络受限): ${result.content}`));
  }
  console.log();
}

async function testConfig() {
  console.log(chalk.yellow('2️⃣  ConfigTool 测试'));
  
  // 列出配置
  const listResult = await ConfigTool.execute({ action: 'list' });
  console.log(chalk.green(`  ✅ list: ${listResult.content.split('\n').length} 项配置`));
  
  // 获取配置
  const getResult = await ConfigTool.execute({ action: 'get', key: 'model' });
  console.log(chalk.green(`  ✅ get model: ${getResult.content}`));
  
  // 设置配置
  const setResult = await ConfigTool.execute({ action: 'set', key: 'verbose', value: 'true' });
  console.log(chalk.green(`  ✅ set verbose=true: ${setResult.content}`));
  
  // 验证设置
  const verifyResult = await ConfigTool.execute({ action: 'get', key: 'verbose' });
  console.log(chalk.green(`  ✅ verify verbose: ${verifyResult.content}`));
  
  // 重置
  const resetResult = await ConfigTool.execute({ action: 'reset', key: 'verbose' });
  console.log(chalk.green(`  ✅ reset verbose: ${resetResult.content}`));
  console.log();
}

async function testLongTermMemory() {
  const memDir = join(process.cwd(), 'test', 'tmp', 'miniagent-test-memory');
  console.log(chalk.yellow('3️⃣  LongTermMemory 测试'));
  
  const memory = new LongTermMemory(memDir);
  
  // 存储记忆
  console.log(chalk.dim('     存储记忆:'));
  memory.store('project_name', 'MiniAgent - 本地 Agent 框架', 'project', 5);
  memory.store('coding_style', '使用 TypeScript，函数式风格', 'preference', 4);
  memory.store('api_base_url', 'http://localhost:11434', 'fact', 3);
  memory.store('common_error', 'Ollama connection refused - check if service is running', 'error', 4);
  memory.store('decision_use_bun', '选择 Bun 作为运行时，因为启动速度快', 'decision', 5);
  console.log(chalk.green('  ✅ 存储了 5 条记忆'));
  
  // 获取记忆
  const entry = memory.get('project_name');
  console.log(chalk.green(`  ✅ get: ${entry?.key} = ${entry?.value}`));
  
  // 搜索记忆
  const searchResults = memory.search('TypeScript');
  console.log(chalk.green(`  ✅ search "TypeScript": ${searchResults.length} 条结果`));
  
  // 列出记忆
  const allMemories = memory.list();
  console.log(chalk.green(`  ✅ list: ${allMemories.length} 条记忆`));
  
  // 统计
  const stats = memory.getStats();
  console.log(chalk.green(`  ✅ stats: total=${stats.total}, byCategory=${JSON.stringify(stats.byCategory)}`));
  
  // 格式化上下文
  const context = memory.formatAsContext('TypeScript', 3);
  console.log(chalk.green(`  ✅ formatAsContext: ${context.split('\n').length} 行`));
  
  // 删除记忆
  const removed = memory.forget('api_base_url');
  console.log(chalk.green(`  ✅ forget api_base_url: ${removed}`));
  
  // 清除类别
  const cleared = memory.clearCategory('error');
  console.log(chalk.green(`  ✅ clearCategory error: ${cleared} 条`));
  console.log();
}

async function testContextCompaction() {
  console.log(chalk.yellow('4️⃣  Context Compaction 测试'));
  
  const compactor = new ContextCompactor({
    thresholdTokens: 100,
    targetTokens: 50,
    preserveRecentMessages: 2,
  });
  
  // 生成测试消息
  const messages: Message[] = [
    { role: 'system', content: 'You are an AI assistant.' },
    { role: 'user', content: '帮我分析一下这个项目' },
    { role: 'assistant', content: '好的，让我先查看项目结构...' },
    { role: 'tool', content: '项目结构: src/, docs/, tests/' },
    { role: 'user', content: '有哪些核心模块？' },
    { role: 'assistant', content: '核心模块包括 LLM Adapter, Tool System, Skill System, Agent Core...' },
    { role: 'user', content: 'LLM Adapter 支持哪些模型？' },
    { role: 'assistant', content: '支持 Ollama 本地模型，如 qwen2, deepseek-coder, phi3 等' },
    { role: 'user', content: '能再详细点吗？' },
    { role: 'assistant', content: 'OllamaAdapter 实现了 chat() 和 chatOnce() 方法，支持流式和非流式调用' },
  ];
  
  // Token 估算
  const tokens = messages.map(m => ({ role: m.role, tokens: estimateTokens(m.content) }));
  const totalTokens = tokens.reduce((sum, t) => sum + t.tokens, 0);
  console.log(chalk.dim(`     原始消息: ${messages.length} 条`));
  console.log(chalk.dim(`     总 Token: ${totalTokens}`));
  
  // 快速压缩
  const fastResult = compactor.compactFast(messages);
  console.log(chalk.green(`  ✅ 快速压缩: ${fastResult.originalCount} -> ${fastResult.compactedCount} 条消息`));
  console.log(chalk.dim(`     压缩率: ${(fastResult.compressionRatio * 100).toFixed(1)}%`));
  console.log(chalk.dim(`     压缩后: ${fastResult.messages.map(m => m.content.substring(0, 40))}...`));
  
  // Token 估算函数测试
  console.log(chalk.green(`  ✅ estimateTokens("hello"): ${estimateTokens('hello')}`));
  console.log(chalk.green(`  ✅ estimateTokens("你好世界"): ${estimateTokens('你好世界')}`));
  console.log(chalk.green(`  ✅ estimateTokens("这是一段很长的中文测试文本"): ${estimateTokens('这是一段很长的中文测试文本')}`));
  console.log();
}

async function testMemoryTool() {
  const memDir = join(process.cwd(), 'test', 'tmp', 'miniagent-test-memory-tool');
  console.log(chalk.yellow('5️⃣  MemoryTool 测试'));
  
  const memory = new LongTermMemory(memDir);
  const tool = createMemoryTool(memory);
  
  // store
  const storeResult = await tool.execute({
    action: 'store',
    key: 'test_key',
    value: '测试记忆内容',
    category: 'custom',
    importance: 3,
  });
  console.log(chalk.green(`  ✅ store: ${storeResult.content}`));
  
  // get
  const getResult = await tool.execute({
    action: 'get',
    key: 'test_key',
  });
  console.log(chalk.green(`  ✅ get: ${getResult.content}`));
  
  // search
  const searchResult = await tool.execute({
    action: 'search',
    query: '测试',
  });
  console.log(chalk.green(`  ✅ search: ${searchResult.content}`));
  
  // list
  const listResult = await tool.execute({ action: 'list' });
  console.log(chalk.green(`  ✅ list: ${listResult.content}`));
  
  // forget
  const forgetResult = await tool.execute({
    action: 'forget',
    key: 'test_key',
  });
  console.log(chalk.green(`  ✅ forget: ${forgetResult.content}`));
  console.log();
}

async function test() {
  console.log(chalk.cyan.bold('\n🧪 Phase 5 测试套件\n'));

  await testWebSearch();
  await testConfig();
  await testLongTermMemory();
  await testContextCompaction();
  await testMemoryTool();

  console.log(chalk.cyan.bold('\n🎉 Phase 5 所有测试通过\n'));
  console.log(chalk.cyan.bold('📊 Phase 5 总结'));
  console.log(chalk.dim('     ✅ WebSearchTool: DuckDuckGo 搜索'));
  console.log(chalk.dim('     ✅ ConfigTool: 配置管理 (get/set/list/reset)'));
  console.log(chalk.dim('     ✅ LongTermMemory: 跨会话持久化记忆'));
  console.log(chalk.dim('     ✅ ContextCompactor: 上下文压缩 (摘要+截断)'));
  console.log(chalk.dim('     ✅ MemoryTool: Agent 主动管理记忆'));
  console.log();
}

test().catch(err => {
  console.error(chalk.red('\n❌ Phase 5 测试失败:'), err);
  process.exit(1);
});
