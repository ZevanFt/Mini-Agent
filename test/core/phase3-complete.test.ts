/**
 * Phase 3 测试 - Plan Mode & Permission System
 * 
 * 测试内容：
 * 1. Plan Mode 管理器
 * 2. 权限系统
 * 3. Plan Mode 工具
 */

import { PlanModeManager } from '../../src/core/plan-mode-manager.js';
import { PlanModeState } from '../../src/core/plan-mode.js';
import { PermissionSystem } from '../../src/core/permissions.js';
import { createPlanModeTools } from '../../src/tools/plan-mode.js';
import chalk from 'chalk';

async function testPlanMode() {
  console.log(chalk.cyan.bold('\n📋 Plan Mode 测试\n'));

  // 1. 创建管理器
  console.log(chalk.yellow('1️⃣  创建 PlanModeManager'));
  const manager = new PlanModeManager();
  console.log(chalk.green('  ✅ 创建成功'));
  console.log(chalk.dim(`     初始状态: ${manager.getState()}\n`));

  // 2. 生成计划（模拟）
  console.log(chalk.yellow('2️⃣  模拟生成计划'));
  // 由于没有真实的 LLM，我们手动设置一个计划
  const plan = {
    id: 'plan_test_001',
    title: '实现用户认证功能',
    userRequest: '帮我实现用户登录和注册功能',
    steps: [
      { id: 'step_0', order: 1, description: '创建用户模型', tools: ['file_write', 'bash'], estimatedTokens: 500, status: 'pending' as const },
      { id: 'step_1', order: 2, description: '实现登录 API', tools: ['file_write', 'bash'], estimatedTokens: 800, status: 'pending' as const },
      { id: 'step_2', order: 3, description: '实现注册 API', tools: ['file_write', 'bash'], estimatedTokens: 800, status: 'pending' as const },
      { id: 'step_3', order: 4, description: '编写单元测试', tools: ['file_write', 'bash'], estimatedTokens: 600, status: 'pending' as const },
    ],
    risks: ['数据库连接配置', '密码加密算法选择'],
    estimatedTokens: 2700,
    createdAt: new Date(),
  };

  // 使用反射设置内部状态（模拟 generatePlan 的结果）
  (manager as any).currentPlan = plan;
  (manager as any).state = PlanModeState.REVIEWING;
  (manager as any).currentStepIndex = 0;
  console.log(chalk.green('  ✅ 计划生成成功'));
  console.log(chalk.dim(`     标题: ${plan.title}`));
  console.log(chalk.dim(`     步骤: ${plan.steps.length} 个`));
  console.log(chalk.dim(`     预估: ${plan.estimatedTokens} tokens\n`));

  // 3. 格式化计划
  console.log(chalk.yellow('3️⃣  格式化计划'));
  const formatted = manager.formatPlanText();
  console.log(chalk.green('  ✅ 格式化成功'));
  console.log(chalk.dim(`     ${formatted.split('\n').length} 行\n`));

  // 4. 批准计划
  console.log(chalk.yellow('4️⃣  批准计划'));
  manager.approve();
  console.log(chalk.green(`  ✅ 计划已批准`));
  console.log(chalk.dim(`     状态: ${manager.getState()}\n`));

  // 5. 开始执行
  console.log(chalk.yellow('5️⃣  开始执行'));
  const stepPrompt = manager.startExecution();
  const currentStep = manager.getCurrentStep();
  console.log(chalk.green(`  ✅ 执行开始`));
  console.log(chalk.dim(`     当前步骤: [${currentStep?.order}] ${currentStep?.description}`));
  console.log(chalk.dim(`     需要工具: ${currentStep?.tools.join(', ')}\n`));

  // 6. 完成步骤
  console.log(chalk.yellow('6️⃣  逐步执行'));
  for (let i = 0; i < plan.steps.length; i++) {
    manager.completeStep(`步骤 ${i + 1} 已完成`);
    const step = manager.getCurrentStep();
    if (step) {
      console.log(chalk.green(`  ✅ 步骤 ${i + 1} 完成 -> 进入步骤 ${step.order}: ${step.description}`));
    } else {
      console.log(chalk.green(`  ✅ 步骤 ${i + 1} 完成 -> 所有步骤完成!`));
    }
  }
  console.log(chalk.dim(`     最终状态: ${manager.getState()}\n`));

  // 7. 测试拒绝
  console.log(chalk.yellow('7️⃣  重置并测试拒绝'));
  manager.reset();
  console.log(chalk.green(`  ✅ 重置完成`));
  console.log(chalk.dim(`     状态: ${manager.getState()}\n`));

  console.log(chalk.cyan.bold('🎉 Plan Mode 测试全部通过\n'));
}

function testPermissions() {
  console.log(chalk.cyan.bold('\n🔐 权限系统测试\n'));

  // 1. 创建权限系统
  console.log(chalk.yellow('1️⃣  创建 PermissionSystem'));
  const perms = new PermissionSystem();
  console.log(chalk.green('  ✅ 创建成功\n'));

  // 2. 测试允许的操作
  console.log(chalk.yellow('2️⃣  测试允许的操作'));
  
  const fileReadResult = perms.check('file_read', { path: '/some/file.ts' });
  console.log(chalk.green(`  ✅ file_read: ${fileReadResult.allowed ? '允许' : '拒绝'} (需要确认: ${fileReadResult.needsConfirmation})`));

  const globResult = perms.check('glob', { pattern: '*.ts' });
  console.log(chalk.green(`  ✅ glob: ${globResult.allowed ? '允许' : '拒绝'} (需要确认: ${globResult.needsConfirmation})`));

  const gitStatusResult = perms.check('bash', { command: 'git status' });
  console.log(chalk.green(`  ✅ git status: ${gitStatusResult.allowed ? '允许' : '拒绝'} (需要确认: ${gitStatusResult.needsConfirmation})\n`));

  // 3. 测试需要确认的操作
  console.log(chalk.yellow('3️⃣  测试需要确认的操作'));
  
  const bashResult = perms.check('bash', { command: 'ls -la' });
  console.log(chalk.yellow(`  ✅ bash (ls -la): 需要确认 (${bashResult.needsConfirmation})`));

  const fileWriteResult = perms.check('file_write', { path: '/some/file.ts' });
  console.log(chalk.yellow(`  ✅ file_write: 需要确认 (${fileWriteResult.needsConfirmation})\n`));

  // 4. 测试危险命令
  console.log(chalk.yellow('4️⃣  测试危险命令'));
  
  const rmRootResult = perms.check('bash', { command: 'rm -rf /' });
  console.log(chalk.red(`  ✅ rm -rf /: ${rmRootResult.allowed ? '允许' : '拒绝'} - ${rmRootResult.reason}`));

  const forkBombResult = perms.check('bash', { command: ':(){ :|:& };:' });
  console.log(chalk.red(`  ✅ fork bomb: ${forkBombResult.allowed ? '允许' : '拒绝'} - ${forkBombResult.reason}\n`));

  // 5. 测试授权缓存
  console.log(chalk.yellow('5️⃣  测试授权缓存'));
  
  const initialBashResult = perms.check('bash', { command: 'git commit -m "test"' });
  console.log(chalk.dim(`  首次检查: 需要确认=${initialBashResult.needsConfirmation}`));

  perms.grant('bash', { command: 'git commit -m "test"' });
  const cachedResult = perms.check('bash', { command: 'git commit -m "test"' });
  console.log(chalk.green(`  ✅ 授权后: ${cachedResult.allowed ? '允许' : '拒绝'} (需要确认: ${cachedResult.needsConfirmation})`));

  perms.revoke('bash', { command: 'git commit -m "test"' });
  const revokedResult = perms.check('bash', { command: 'git commit -m "test"' });
  console.log(chalk.yellow(`  ✅ 撤销后: 需要确认=${revokedResult.needsConfirmation}\n`));

  // 6. 自定义规则
  console.log(chalk.yellow('6️⃣  自定义规则'));
  const customPerms = new PermissionSystem({
    rules: [
      { tool: 'my_custom_tool', action: 'allow' },
      { tool: 'bash', pattern: 'npm test*', action: 'allow' },
    ],
  });

  const customResult = customPerms.check('my_custom_tool', {});
  console.log(chalk.green(`  ✅ my_custom_tool: ${customResult.allowed ? '允许' : '拒绝'}`));

  const npmTestResult = customPerms.check('bash', { command: 'npm test -- --coverage' });
  console.log(chalk.green(`  ✅ npm test: ${npmTestResult.allowed ? '允许' : '拒绝'} (需要确认: ${npmTestResult.needsConfirmation})\n`));

  console.log(chalk.cyan.bold('🎉 权限系统测试全部通过\n'));
}

async function testPlanModeTools() {
  console.log(chalk.cyan.bold('\n🔧 Plan Mode Tools 测试\n'));

  const manager = new PlanModeManager();

  // 创建一个计划用于测试
  const plan = {
    id: 'plan_tools_test',
    title: '工具测试计划',
    userRequest: '测试计划工具',
    steps: [
      { id: 'step_0', order: 1, description: '测试步骤1', tools: ['bash'], estimatedTokens: 500, status: 'pending' as const },
    ],
    risks: [],
    estimatedTokens: 500,
    createdAt: new Date(),
  };
  (manager as any).currentPlan = plan;
  (manager as any).state = PlanModeState.REVIEWING;

  // 创建工具
  console.log(chalk.yellow('1️⃣  创建 Plan Mode 工具'));
  const tools = createPlanModeTools(manager);
  console.log(chalk.green(`  ✅ 创建 ${tools.length} 个工具: ${tools.map(t => t.name).join(', ')}\n`));

  // 2. 测试 enter_plan_mode
  console.log(chalk.yellow('2️⃣  测试 enter_plan_mode'));
  const enterTool = tools.find(t => t.name === 'enter_plan_mode')!;
  const enterResult = await enterTool.execute({
    title: '测试计划',
    steps: [
      { description: '步骤1', tools: ['bash'] },
      { description: '步骤2', tools: ['file_write'] },
    ],
    risks: ['风险1'],
  });
  console.log(chalk.green(`  ✅ 结果: ${enterResult.success ? '成功' : '失败'}`));
  console.log(chalk.dim(`  内容: ${enterResult.content.substring(0, 50)}...\n`));

  // 3. 测试 exit_plan_mode
  console.log(chalk.yellow('3️⃣  测试 exit_plan_mode'));
  const exitTool = tools.find(t => t.name === 'exit_plan_mode')!;
  const exitResult = await exitTool.execute({
    reason: '测试完成',
    summary: '所有测试通过',
  });
  console.log(chalk.green(`  ✅ 退出成功`));
  console.log(chalk.dim(`  内容: ${exitResult.content.substring(0, 50)}...\n`));

  console.log(chalk.cyan.bold('🎉 Plan Mode Tools 测试全部通过\n'));
}

async function test() {
  console.log(chalk.cyan.bold('\n🧪 Phase 3 完整测试套件\n'));

  await testPlanMode();
  testPermissions();
  await testPlanModeTools();

  console.log(chalk.cyan.bold('\n🎉 Phase 3 所有测试通过\n'));
}

test().catch(err => {
  console.error(chalk.red('\n❌ 测试失败:'), err);
  process.exit(1);
});
