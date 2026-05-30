/**
 * Phase 4 测试 - MCP 支持
 */

import { MCPManager } from '../../src/mcp/manager.js';
import { createMCPTools } from '../../src/tools/mcp.js';
import chalk from 'chalk';

async function test() {
  console.log(chalk.cyan.bold('\n🧪 Phase 4 MCP 测试\n'));

  // 1. 创建 MCP Manager
  console.log(chalk.yellow('1️⃣  创建 MCPManager'));
  const manager = new MCPManager();
  console.log(chalk.green('  ✅ Manager 创建成功\n'));

  // 2. 列出服务器（空）
  console.log(chalk.yellow('2️⃣  列出服务器（初始为空）'));
  const servers = manager.listServers();
  console.log(chalk.green(`  ✅ 服务器数量: ${servers.length}\n`));

  // 3. 创建 MCP 工具
  console.log(chalk.yellow('3️⃣  创建 MCP 工具'));
  const tools = createMCPTools(manager);
  console.log(chalk.green(`  ✅ 创建 ${tools.length} 个工具:`));
  for (const tool of tools) {
    console.log(chalk.dim(`     - ${tool.name}: ${tool.description.substring(0, 50)}...`));
  }
  console.log();

  // 4. 测试 mcp_list_servers（无服务器）
  console.log(chalk.yellow('4️⃣  测试 mcp_list_servers（无服务器）'));
  const listTool = tools.find(t => t.name === 'mcp_list_servers')!;
  const listResult = await listTool.execute({});
  console.log(chalk.green(`  ✅ ${listResult.content}\n`));

  // 5. 测试 mcp_call（无服务器）
  console.log(chalk.yellow('5️⃣  测试 mcp_call（服务器不存在）'));
  const callTool = tools.find(t => t.name === 'mcp_call')!;
  const callResult = await callTool.execute({
    server: 'nonexistent',
    tool: 'some_tool',
  });
  console.log(chalk.yellow(`  ✅ ${callResult.success ? '成功' : '失败'}: ${callResult.content}\n`));

  // 6. 测试资源列表（空）
  console.log(chalk.yellow('6️⃣  测试 mcp_list_resources（无资源）'));
  const resTool = tools.find(t => t.name === 'mcp_list_resources')!;
  const resResult = await resTool.execute({});
  console.log(chalk.green(`  ✅ ${resResult.content}\n`));

  console.log(chalk.cyan.bold('🎉 Phase 4 MCP 测试全部通过\n'));
}

test().catch(err => {
  console.error(chalk.red('\n❌ 测试失败:'), err);
  process.exit(1);
});
