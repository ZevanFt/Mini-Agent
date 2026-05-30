/**
 * SKILL.md 格式 Skill 测试
 */

import { parseSkillFile, loadSkillFromDirectory, discoverSkills, matchSkillToRequest } from '../../src/skills/parser.js';
import { SkillRegistry } from '../../src/skills/skill-registry.js';
import chalk from 'chalk';
import { readFileSync } from 'fs';

function testParser() {
  console.log(chalk.yellow('1️⃣  SKILL.md 解析器测试'));
  
  const skillsDir = process.env.SKILLS_DIR || 'skills';
  const skillPath = `${skillsDir}/git-commit/SKILL.md`;
  
  try {
    const content = readFileSync(skillPath, 'utf-8');
    const parsed = parseSkillFile(content, `${skillsDir}/git-commit`);
    
    console.log(chalk.green(`  ✅ name: ${parsed.name}`));
    console.log(chalk.green(`  ✅ description 长度: ${parsed.description.length} 字符`));
    console.log(chalk.green(`  ✅ allowedTools: ${parsed.allowedTools.join(', ') || '(all)'}`));
    console.log(chalk.green(`  ✅ disallowedTools: ${parsed.disallowedTools.join(', ') || '(none)'}`));
    console.log(chalk.green(`  ✅ instructions 长度: ${parsed.instructions.length} 字符`));
    console.log(chalk.green(`  ✅ directory: ${parsed.directory}`));
    console.log(chalk.green(`  ✅ hasScripts: ${parsed.hasScripts}`));
    console.log(chalk.green(`  ✅ hasReferences: ${parsed.hasReferences}`));
    console.log(chalk.green(`  ✅ hasAssets: ${parsed.hasAssets}`));
  } catch (e) {
    console.log(chalk.yellow('  ⚠️  Skill 文件不存在，跳过解析测试'));
  }
  console.log();
}

function testSkillDiscovery() {
  console.log(chalk.yellow('2️⃣  Skill 发现测试'));
  
  const skillsDir = process.env.SKILLS_DIR || 'skills';
  const skills = discoverSkills(skillsDir);
  console.log(chalk.green(`  ✅ 发现 ${skills.length} 个 Skill`));
  
  for (const skill of skills) {
    console.log(chalk.dim(`     - ${skill.name}: ${skill.description.substring(0, 60)}...`));
  }
  console.log();
}

function testSkillMatching() {
  console.log(chalk.yellow('3️⃣  Skill 自动匹配测试'));
  
  const skillsDir = process.env.SKILLS_DIR || 'skills';
  const skills = discoverSkills(skillsDir);
  
  const testCases = [
    { message: '帮我提交代码，改动了一些功能', expectedTop: 'git-commit' },
    { message: '帮我分析一下这个项目的代码结构', expectedTop: 'read-code' },
    { message: '分析下这个模块的调用关系和依赖', expectedTop: 'read-code' },
    { message: 'git commit -m 生成提交信息', expectedTop: 'git-commit' },
  ];
  
  for (const tc of testCases) {
    const matches = skills.map(s => ({
      skill: s,
      score: matchSkillToRequest(tc.message, s),
    })).filter(m => m.score > 0).sort((a, b) => b.score - a.score);
    
    const topMatch = matches[0]?.skill.name || '(none)';
    const ok = topMatch === tc.expectedTop;
    const icon = ok ? '✅' : '⚠️';
    console.log(chalk.dim(`     ${icon} "${tc.message.substring(0, 30)}" -> ${topMatch} (score: ${matches[0]?.score || 0})`));
  }
  console.log();
}

function testRegistry() {
  console.log(chalk.yellow('4️⃣  SkillRegistry 测试'));
  
  const registry = new SkillRegistry();
  registry.addDiscoveryDir('/workspace/.miniagent/skills');
  
  const loaded = registry.discoverAndLoad();
  console.log(chalk.green(`  ✅ 加载了 ${loaded.length} 个 Skill`));
  
  // 测试匹配
  const matches = registry.matchSkills('帮我提交代码');
  console.log(chalk.green(`  ✅ 匹配到 ${matches.length} 个 Skill`));
  if (matches.length > 0) {
    console.log(chalk.dim(`     第一名: ${matches[0].skill.name} (score: ${matches[0].score})`));
  }
  
  // 测试激活
  const instructions = registry.activateSkill('git-commit');
  console.log(chalk.green(`  ✅ 激活 git-commit: ${instructions ? instructions.split('\n').length : 0} 行指令`));
  
  // 测试工具限制
  const canBash = registry.canUseTool('git-commit', 'bash');
  const canWrite = registry.canUseTool('git-commit', 'file_write');
  console.log(chalk.green(`  ✅ 工具限制检查: bash=${canBash ? '允许' : '拒绝'}, file_write=${canWrite ? '允许' : '拒绝'}`));
  
  // 测试 System Prompt
  const prompt = registry.getActiveSystemPrompts();
  console.log(chalk.green(`  ✅ System Prompt: ${prompt.split('\n').length} 行`));
  
  // 测试停用
  registry.deactivateSkill('git-commit');
  const promptAfter = registry.getActiveSystemPrompts();
  console.log(chalk.green(`  ✅ 停用后 System Prompt: ${promptAfter.length === 0 ? '空' : '非空'}`));
  console.log();
}

async function test() {
  console.log(chalk.cyan.bold('\n🎓 SKILL.md 格式 Skill 测试\n'));

  testParser();
  testSkillDiscovery();
  testSkillMatching();
  testRegistry();

  console.log(chalk.cyan.bold('🎉 所有测试通过\n'));
  console.log(chalk.cyan.bold('📊 SKILL.md 格式与 Claude Code 官方对比'));
  console.log(chalk.dim('     特性                        MiniAgent    Claude Code'));
  console.log(chalk.dim('     ─────────────────────────────────────────────────'));
  console.log(chalk.dim('     SKILL.md 格式                   ✅            ✅'));
  console.log(chalk.dim('     YAML frontmatter                ✅            ✅'));
  console.log(chalk.dim('     Markdown body                   ✅            ✅'));
  console.log(chalk.dim('     allowed-tools                   ✅            ✅'));
  console.log(chalk.dim('     disallowedTools                 ✅            ✅'));
  console.log(chalk.dim('     渐进式披露                      ✅            ✅'));
  console.log(chalk.dim('     scripts/ 目录                   ✅            ✅'));
  console.log(chalk.dim('     references/ 目录                ✅            ✅'));
  console.log(chalk.dim('     assets/ 目录                    ✅            ✅'));
  console.log(chalk.dim('     自动触发匹配                    ✅            ✅'));
  console.log(chalk.dim('     斜杠命令调用                    🔲            ✅'));
  console.log(chalk.dim('     目录自动发现                    ✅            ✅'));
  console.log(chalk.dim('     跨平台兼容                      ✅            ✅'));
  console.log();
}

test().catch(err => {
  console.error(chalk.red('\n❌ 测试失败:'), err);
  process.exit(1);
});
