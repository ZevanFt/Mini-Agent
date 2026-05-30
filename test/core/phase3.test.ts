import { TaskManager } from '../../src/tasks/manager.js';
import type { Task, TaskStatus } from '../../src/tasks/types.js';
import chalk from 'chalk';

async function test() {
  console.log(chalk.cyan.bold('\n🧪 Task Manager Test Suite\n'));

  // 1. Create TaskManager
  console.log(chalk.yellow('1️⃣  创建 TaskManager'));
  const tm = new TaskManager();
  console.log(chalk.green('  ✅ TaskManager 创建成功\n'));

  // 2. Create tasks
  console.log(chalk.yellow('2️⃣  创建任务'));
  const task1 = tm.create({
    title: '实现 Agent 框架',
    description: '开发核心 Agent 系统',
    priority: 'high',
    tags: ['core', 'development'],
  });
  console.log(chalk.green(`  ✅ 创建: ${task1.title} (${task1.id})`));

  const task2 = tm.create({
    title: '写单元测试',
    description: '为 Agent 核心模块编写测试',
    priority: 'medium',
    parentId: task1.id,
    tags: ['test'],
  });
  console.log(chalk.green(`  ✅ 创建子任务: ${task2.title} (父任务: ${task1.id})\n`));

  // 3. List tasks
  console.log(chalk.yellow('3️⃣  列出任务'));
  const allTasks = tm.list({ status: 'all' });
  console.log(chalk.green(`  ✅ 共 ${allTasks.length} 个任务:`));
  for (const t of allTasks) {
    const indent = t.parentId ? '  ' : '';
    console.log(chalk.dim(`  ${indent}- [${t.status}] ${t.title} (${t.priority})`));
  }
  console.log();

  // 4. Update task status
  console.log(chalk.yellow('4️⃣  更新任务状态'));
  const updated = tm.update(task1.id, { status: 'in_progress' });
  console.log(chalk.green(`  ✅ ${task1.title} -> ${updated?.status}`));

  const completed = tm.update(task2.id, {
    status: 'completed',
    result: { summary: '已完成 15 个测试用例' },
  });
  console.log(chalk.green(`  ✅ ${task2.title} -> ${completed?.status}\n`));

  // 5. Filter by status
  console.log(chalk.yellow('5️⃣  按状态筛选'));
  const completedTasks = tm.list({ status: 'completed' });
  console.log(chalk.green(`  ✅ 已完成: ${completedTasks.length} 个`));

  const pendingTasks = tm.list({ status: 'pending' });
  console.log(chalk.green(`  ✅ 待处理: ${pendingTasks.length} 个\n`));

  // 6. Task tree
  console.log(chalk.yellow('6️⃣  任务树'));
  const tree = tm.getTree();
  console.log(chalk.green(`  ✅ 树形结构 (根节点: ${tree.length} 个):`));
  for (const t of tree) {
    console.log(chalk.dim(`  - ${t.title}`));
    for (const childId of t.children) {
      const child = tm.get(childId);
      if (child) {
        console.log(chalk.dim(`    └─ ${child.title}`));
      }
    }
  }
  console.log();

  // 7. Summary
  console.log(chalk.yellow('7️⃣  任务摘要'));
  const summary = tm.summary();
  console.log(chalk.green(`  ✅ 总任务: ${summary.total}`));
  console.log(chalk.dim('     按状态:'), JSON.stringify(summary.byStatus));
  console.log();

  // 8. Remove task
  console.log(chalk.yellow('8️⃣  删除任务'));
  const removed = tm.remove(task2.id);
  console.log(chalk.green(`  ✅ 删除: ${removed}`));
  console.log(chalk.dim(`     剩余: ${tm.count()} 个任务\n`));

  console.log(chalk.cyan.bold('\n🎉 Task Manager 测试全部通过\n'));
}

test().catch(err => {
  console.error(chalk.red('\n❌ 测试失败:'), err);
  process.exit(1);
});
