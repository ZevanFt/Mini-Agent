/**
 * SKILL.md 格式 Skill 注册表
 * 
 * 支持：
 * 1. 从文件系统加载 SKILL.md
 * 2. 渐进式披露（三层加载）
 * 3. 工具限制（allowed-tools / disallowedTools）
 * 4. 自动触发匹配（基于 description）
 * 5. 斜杠命令手动调用（/skill-name）
 */

import type { Tool } from '../tools/types.js';
import { discoverSkills, loadSkillFromDirectory, matchSkillToRequest, type ParsedSkill } from './parser.js';
import { existsSync, statSync } from 'fs';
import { join } from 'path';

/**
 * 加载的文件内容
 */
interface LoadedFile {
  path: string;
  content: string;
}

/**
 * Skill 运行时状态
 */
interface SkillState {
  /** 是否已激活 */
  isActive: boolean;
  /** 已加载的文件 */
  loadedFiles: Map<string, LoadedFile>;
  /** 工具限制已应用 */
  toolRestrictionsApplied: boolean;
}

export class SkillRegistry {
  private skills: Map<string, ParsedSkill> = new Map();
  private states: Map<string, SkillState> = new Map();
  private availableTools: Map<string, Tool> = new Map();
  private rootDirs: string[] = [];

  /**
   * 添加 Skill 发现根目录
   * 
   * 支持的目录：
   * - 项目级: .claude/skills/
   * - 用户级: ~/.claude/skills/
   * - 内置: skills/
   */
  addDiscoveryDir(dir: string): void {
    if (!this.rootDirs.includes(dir)) {
      this.rootDirs.push(dir);
    }
  }

  /**
   * 注册可用工具（用于工具限制检查）
   */
  registerTool(tool: Tool): void {
    this.availableTools.set(tool.name, tool);
  }

  /**
   * 发现并加载所有 Skill
   * 
   * 扫描所有注册的目录
   */
  discoverAndLoad(): ParsedSkill[] {
    const allSkills: ParsedSkill[] = [];

    for (const dir of this.rootDirs) {
      if (existsSync(dir)) {
        const skills = discoverSkills(dir);
        for (const skill of skills) {
          this.skills.set(skill.name, skill);
          this.states.set(skill.name, {
            isActive: false,
            loadedFiles: new Map(),
            toolRestrictionsApplied: false,
          });
          allSkills.push(skill);
        }
      }
    }

    return allSkills;
  }

  /**
   * 手动加载单个 Skill
   */
  loadSkill(directory: string): ParsedSkill {
    const skill = loadSkillFromDirectory(directory);
    this.skills.set(skill.name, skill);
    this.states.set(skill.name, {
      isActive: false,
      loadedFiles: new Map(),
      toolRestrictionsApplied: false,
    });
    return skill;
  }

  /**
   * 获取 Skill 信息
   */
  getSkill(name: string): ParsedSkill | undefined {
    return this.skills.get(name);
  }

  /**
   * 列出所有 Skill
   */
  listSkills(): ParsedSkill[] {
    return Array.from(this.skills.values());
  }

  /**
   * 列出已激活的 Skill
   */
  listActive(): ParsedSkill[] {
    return Array.from(this.skills.values()).filter(s => {
      const state = this.states.get(s.name);
      return state?.isActive;
    });
  }

  /**
   * 自动匹配 Skill
   * 
   * 根据用户消息，匹配最相关的 Skill
   * 
   * @param userMessage - 用户消息
   * @param minScore - 最小匹配分数（默认 1）
   * @returns 匹配的 Skill 列表（按分数降序）
   */
  matchSkills(userMessage: string, minScore: number = 1): Array<{ skill: ParsedSkill; score: number }> {
    const matches: Array<{ skill: ParsedSkill; score: number }> = [];

    for (const skill of this.skills.values()) {
      const score = matchSkillToRequest(userMessage, skill);
      if (score >= minScore) {
        matches.push({ skill, score });
      }
    }

    // 按分数降序
    matches.sort((a, b) => b.score - a.score);
    return matches;
  }

  /**
   * 激活 Skill（渐进式披露）
   * 
   * 第一层：YAML frontmatter（已加载）
   * 第二层：SKILL.md body（调用此方法加载）
   * 第三层：Linked files（按需加载）
   */
  activateSkill(name: string): string | undefined {
    const skill = this.skills.get(name);
    const state = this.states.get(name);
    if (!skill || !state) {
      return undefined;
    }

    // 如果已激活，直接返回 instructions
    if (state.isActive) {
      return skill.instructions;
    }

    // 渐进式披露 - 第二层：加载 SKILL.md body
    state.isActive = true;

    return this.getSkillInstructions(skill);
  }

  /**
   * 获取 Skill 指令（包含渐进式披露）
   */
  getSkillInstructions(skill: ParsedSkill): string {
    let instructions = skill.instructions;

    // 附加资源提示
    if (skill.hasReferences && skill.references.length > 0) {
      instructions += `\n\n---\n\n📚 Available reference files:\n${skill.references.map(r => `- ${r}`).join('\n')}\n\nUse \`readFile\` to load specific references when needed.`;
    }

    if (skill.hasScripts && skill.scripts.length > 0) {
      instructions += `\n\n---\n\n🛠️ Available scripts:\n${skill.scripts.map(s => `- ${s}`).join('\n')}\n\nUse \`bash\` to run scripts when needed.`;
    }

    return instructions;
  }

  /**
   * 获取 Skill 的工具限制
   * 
   * 返回该 Skill 允许和禁止使用的工具
   */
  getToolRestrictions(name: string): { allowed: string[]; disallowed: string[] } {
    const skill = this.skills.get(name);
    if (!skill) {
      return { allowed: [], disallowed: [] };
    }

    return {
      allowed: skill.allowedTools,
      disallowed: skill.disallowedTools,
    };
  }

  /**
   * 检查工具是否可以在当前 Skill 中使用
   */
  canUseTool(skillName: string, toolName: string): boolean {
    const skill = this.skills.get(skillName);
    if (!skill) {
      return true; // 不在 Skill 上下文中，默认允许
    }

    // 检查 disallowedTools
    if (skill.disallowedTools.includes(toolName.toLowerCase())) {
      return false;
    }

    // 检查 allowedTools（如果不为空，则只允许列出的工具）
    if (skill.allowedTools.length > 0 && !skill.allowedTools.includes(toolName.toLowerCase())) {
      return false;
    }

    return true;
  }

  /**
   * 获取所有激活 Skill 的 System Prompt
   * 
   * 将所有激活的 Skill 指令合并为 System Prompt 注入
   */
  getActiveSystemPrompts(): string {
    const activeSkills = this.listActive();
    if (activeSkills.length === 0) {
      return '';
    }

    const sections: string[] = [];

    for (const skill of activeSkills) {
      sections.push(`## Active Skill: ${skill.name}\n\n${this.getSkillInstructions(skill)}`);
    }

    return sections.join('\n\n---\n\n');
  }

  /**
   * 获取活跃的工具过滤列表
   * 
   * 当多个 Skill 激活时，需要合并它们的工具限制
   */
  getActiveToolFilter(): { allowed: string[]; disallowed: string[] } {
    const activeSkills = this.listActive();
    if (activeSkills.length === 0) {
      return { allowed: [], disallowed: [] };
    }

    const allAllowed: Set<string> = new Set();
    const allDisallowed: Set<string> = new Set();

    for (const skill of activeSkills) {
      // allowedTools 为空表示允许所有
      if (skill.allowedTools.length === 0) {
        allAllowed.clear(); // 清除限制
      } else {
        skill.allowedTools.forEach(t => allAllowed.add(t.toLowerCase()));
      }

      skill.disallowedTools.forEach(t => allDisallowed.add(t.toLowerCase()));
    }

    return {
      allowed: Array.from(allAllowed),
      disallowed: Array.from(allDisallowed),
    };
  }

  /**
   * 停用 Skill
   */
  deactivateSkill(name: string): void {
    const state = this.states.get(name);
    if (state) {
      state.isActive = false;
      state.loadedFiles.clear();
      state.toolRestrictionsApplied = false;
    }
  }

  /**
   * 停用所有 Skill
   */
  deactivateAll(): void {
    for (const state of this.states.values()) {
      state.isActive = false;
      state.loadedFiles.clear();
      state.toolRestrictionsApplied = false;
    }
  }

  /**
   * 清除所有 Skill
   */
  clear(): void {
    this.skills.clear();
    this.states.clear();
  }

  /**
   * 重新加载所有 Skill（从文件系统重新扫描）
   */
  reloadSkills(): void {
    const oldSkills = new Map(this.skills);
    this.skills.clear();
    this.states.clear();
    this.discoverAndLoad();
  }
}
