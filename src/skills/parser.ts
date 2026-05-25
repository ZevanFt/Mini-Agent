/**
 * SKILL.md 解析器
 * 
 * 学习笔记：
 * Claude Code 的 Skill 使用 SKILL.md 文件，格式为：
 * 
 * ```
 * ---
 * name: skill-name
 * description: When to use this skill
 * allowed-tools: Read, Grep, Glob
 * disallowedTools:
 *   - Write
 *   - Edit
 * ---
 * 
 * # Skill Instructions
 * ...
 * ```
 * 
 * 解析器需要：
 * 1. 提取 YAML frontmatter
 * 2. 解析 Markdown body
 * 3. 支持渐进式披露（三层加载）
 */

import { readFileSync, existsSync, statSync } from 'fs';
import { join } from 'path';

/**
 * SKILL.md 解析后的数据结构
 */
export interface ParsedSkill {
  /** Skill 名称（必须匹配目录名） */
  name: string;
  /** 描述（用于自动触发匹配） */
  description: string;
  /** 允许使用的工具列表 */
  allowedTools: string[];
  /** 禁止使用的工具列表 */
  disallowedTools: string[];
  /** 触发词列表（可选，用于中文等多语言支持） */
  triggers: string[];
  /** 指令内容（Markdown body） */
  instructions: string;
  /** Skill 所在目录 */
  directory: string;
  /** 是否有脚本 */
  hasScripts: boolean;
  /** 是否有参考文件 */
  hasReferences: boolean;
  /** 是否有资源文件 */
  hasAssets: boolean;
  /** 脚本文件路径 */
  scripts: string[];
  /** 参考文件路径 */
  references: string[];
  /** 资源文件路径 */
  assets: string[];
}

/**
 * 解析 YAML frontmatter
 */
function parseYamlFrontmatter(content: string): Record<string, string | string[]> {
  const result: Record<string, string | string[]> = {};
  
  // 简单 YAML 解析（处理 name, description, allowed-tools, disallowedTools）
  const lines = content.split('\n');
  let currentKey: string | null = null;
  let currentArray: string[] = [];
  
  for (const line of lines) {
    // 检查是否是数组项
    const arrayMatch = line.match(/^\s+-\s+(.+)$/);
    if (arrayMatch && currentKey) {
      currentArray.push(arrayMatch[1].trim());
      continue;
    }
    
    // 检查是否是键值对
    const kvMatch = line.match(/^(\w[\w-]*)\s*:\s*(.*)$/);
    if (kvMatch) {
      // 保存之前的数组
      if (currentKey && currentArray.length > 0) {
        result[currentKey] = currentArray;
        currentArray = [];
      }
      
      const key = kvMatch[1].trim();
      const value = kvMatch[2].trim();
      
      if (value === '') {
        // 可能是数组开始
        currentKey = key;
        currentArray = [];
      } else {
        // 简单字符串值
        currentKey = null;
        result[key] = value;
      }
    }
  }
  
  // 保存最后的数组
  if (currentKey && currentArray.length > 0) {
    result[currentKey] = currentArray;
  }
  
  return result;
}

/**
 * 从文件内容中解析 SKILL.md
 */
export function parseSkillFile(content: string, directory: string): ParsedSkill {
  // 提取 frontmatter（--- 之间的内容）
  const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!frontmatterMatch) {
    throw new Error(`Invalid SKILL.md format: missing YAML frontmatter in ${directory}`);
  }
  
  const frontmatterRaw = frontmatterMatch[1];
  const body = frontmatterMatch[2].trim();
  
  // 解析 frontmatter
  const frontmatter = parseYamlFrontmatter(frontmatterRaw);
  
  const name = typeof frontmatter.name === 'string' ? frontmatter.name : '';
  const description = typeof frontmatter.description === 'string' ? frontmatter.description : '';
  const allowedToolsRaw = typeof frontmatter['allowed-tools'] === 'string' ? frontmatter['allowed-tools'] : '';
  const disallowedToolsRaw = Array.isArray(frontmatter.disallowedTools) ? frontmatter.disallowedTools : [];
  const triggersRaw = Array.isArray(frontmatter.triggers) ? frontmatter.triggers : [];
  
  // 解析 allowed-tools（逗号分隔）
  const allowedTools = allowedToolsRaw
    ? allowedToolsRaw.split(',').map(t => t.trim().toLowerCase()).filter(Boolean)
    : []; // 空表示允许所有工具
  
  // 检查目录结构
  const scriptsDir = join(directory, 'scripts');
  const referencesDir = join(directory, 'references');
  const assetsDir = join(directory, 'assets');
  
  const hasScripts = existsSync(scriptsDir) && statSync(scriptsDir).isDirectory();
  const hasReferences = existsSync(referencesDir) && statSync(referencesDir).isDirectory();
  const hasAssets = existsSync(assetsDir) && statSync(assetsDir).isDirectory();
  
  // 收集脚本
  const scripts: string[] = [];
  if (hasScripts) {
    const { readdirSync } = require('fs');
    try {
      const files = readdirSync(scriptsDir);
      scripts.push(...files.map((f: string) => join(scriptsDir, f)));
    } catch { /* 忽略 */ }
  }
  
  // 收集参考文件
  const references: string[] = [];
  if (hasReferences) {
    const { readdirSync } = require('fs');
    try {
      const files = readdirSync(referencesDir);
      references.push(...files.filter((f: string) => f.endsWith('.md') || f.endsWith('.txt')).map((f: string) => join(referencesDir, f)));
    } catch { /* 忽略 */ }
  }
  
  // 收集资源文件
  const assets: string[] = [];
  if (hasAssets) {
    const { readdirSync } = require('fs');
    try {
      const files = readdirSync(assetsDir);
      assets.push(...files.map((f: string) => join(assetsDir, f)));
    } catch { /* 忽略 */ }
  }
  
  return {
    name,
    description,
    allowedTools,
    disallowedTools: disallowedToolsRaw.map(t => t.toLowerCase()),
    triggers: triggersRaw,
    instructions: body,
    directory,
    hasScripts,
    hasReferences,
    hasAssets,
    scripts,
    references,
    assets,
  };
}

/**
 * 从目录加载并解析 SKILL.md
 */
export function loadSkillFromDirectory(directory: string): ParsedSkill {
  const skillPath = join(directory, 'SKILL.md');
  
  if (!existsSync(skillPath)) {
    throw new Error(`SKILL.md not found in ${directory}`);
  }
  
  const content = readFileSync(skillPath, 'utf-8');
  return parseSkillFile(content, directory);
}

/**
 * 发现并加载所有 Skill
 * 
 * 扫描指定目录下的所有子目录，查找包含 SKILL.md 的目录
 */
export function discoverSkills(rootDir: string): ParsedSkill[] {
  const skills: ParsedSkill[] = [];
  
  if (!existsSync(rootDir)) {
    return skills;
  }
  
  const { readdirSync, statSync } = require('fs');
  
  try {
    const entries = readdirSync(rootDir);
    for (const entry of entries) {
      const entryPath = join(rootDir, entry);
      try {
        if (statSync(entryPath).isDirectory()) {
          const skillPath = join(entryPath, 'SKILL.md');
          if (existsSync(skillPath)) {
            skills.push(loadSkillFromDirectory(entryPath));
          }
        }
      } catch { /* 忽略无法访问的目录 */ }
    }
  } catch { /* 忽略 */ }
  
  return skills;
}

/**
 * 计算文本相似度（用于触发匹配）
 * 
 * 简单的关键词匹配，用于判断用户请求是否匹配 Skill 的 description
 */
export function matchSkillToRequest(userMessage: string, skill: ParsedSkill): number {
  const message = userMessage.toLowerCase();
  const description = skill.description.toLowerCase();
  const name = skill.name.toLowerCase();
  
  // 策略 0：triggers 直接匹配（最高优先级，用于中文等多语言支持）
  for (const trigger of skill.triggers) {
    if (message.includes(trigger.toLowerCase())) {
      return 15;
    }
  }
  
  // 策略 1：name 直接匹配（如 message 包含 "git commit" 或 "commit"）
  const nameParts = name.split('-');
  for (const part of nameParts) {
    if (message.includes(part.toLowerCase())) {
      return 10; // 直接命中 name 给高分
    }
  }
  
  // 策略 2：从 description 中提取关键动作短语
  // Claude Code description 格式: "Use when the user wants to X, Y, or Z"
  const actionPhrases = description
    .replace(/^use when /i, '')
    .replace(/the user (wants to|needs to|is trying to|would like to|wants)\s*/gi, '')
    .split(/\s+(?:or|and)\s+|\s*[,\.]\s*/)
    .map(p => p.trim())
    .filter(p => p.length > 2);
  
  let matchScore = 0;
  for (const phrase of actionPhrases) {
    // 模糊匹配：检查 message 中是否包含 phrase 的关键词
    const phraseWords = phrase.split(/\s+/);
    let phraseMatchCount = 0;
    for (const word of phraseWords) {
      if (word.length > 2 && message.includes(word.toLowerCase())) {
        phraseMatchCount++;
      }
    }
    // 如果 phrase 中大部分词都匹配了，加分
    if (phraseMatchCount >= Math.ceil(phraseWords.length / 2)) {
      matchScore += 2;
    }
  }
  
  // 策略 3：description 中的长词匹配（长度 >= 4 的词）
  const longWords = description.match(/\b[a-z]{4,}\b/gi) || [];
  const uniqueLongWords = [...new Set(longWords)];
  for (const word of uniqueLongWords) {
    if (message.includes(word.toLowerCase())) {
      matchScore += 0.5;
    }
  }
  
  // 策略 4：常见触发词匹配（git, commit, code, analyze 等）
  const commonTriggers = ['git', 'commit', 'code', 'analyze', 'read', 'review', 'diff', 'status'];
  for (const trigger of commonTriggers) {
    if (message.includes(trigger) && description.includes(trigger)) {
      matchScore += 1;
    }
  }
  
  return matchScore;
}
