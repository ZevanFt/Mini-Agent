/**
 * 项目级 AI Agent 配置文件解析器
 * 
 * 解析 AGENTS.md / CLAUDE.md 等项目配置文件，支持：
 * - YAML frontmatter 配置提取
 * - 向上递归搜索配置文件
 * - 工具限制、模型偏好、自定义规则解析
 */

import { readFileSync, existsSync } from 'fs';
import { join, dirname, resolve } from 'path';

export interface ProjectConfig {
  body: string;
  allowedTools: string[];
  disallowedTools: string[];
  model?: string;
  rules: string[];
  filePath: string | null;
}

function parseYamlArray(value: string): string[] {
  const trimmed = value.trim();
  if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
    const inner = trimmed.slice(1, -1);
    return inner
      .split(',')
      .map(item => item.trim().replace(/^["']|["']$/g, ''))
      .filter(Boolean);
  }
  return [];
}

function parseYamlFrontmatter(content: string): Record<string, string | string[]> {
  const result: Record<string, string | string[]> = {};
  const lines = content.split('\n');
  let currentKey: string | null = null;
  let currentArray: string[] = [];

  for (const line of lines) {
    const arrayMatch = line.match(/^\s+-\s+(.+)$/);
    if (arrayMatch && currentKey) {
      currentArray.push(arrayMatch[1].trim().replace(/^["']|["']$/g, ''));
      continue;
    }

    const kvMatch = line.match(/^([\w-]+)\s*:\s*(.*)$/);
    if (kvMatch) {
      if (currentKey && currentArray.length > 0) {
        result[currentKey] = currentArray;
        currentArray = [];
      }

      const key = kvMatch[1].trim();
      const value = kvMatch[2].trim();

      if (value === '') {
        currentKey = key;
        currentArray = [];
      } else if (value.startsWith('[')) {
        currentKey = null;
        result[key] = parseYamlArray(value);
      } else {
        currentKey = null;
        result[key] = value.replace(/^["']|["']$/g, '');
      }
    }
  }

  if (currentKey && currentArray.length > 0) {
    result[currentKey] = currentArray;
  }

  return result;
}

function parseFrontmatter(raw: string): Omit<ProjectConfig, 'body' | 'filePath'> {
  const fm = parseYamlFrontmatter(raw);

  const allowedToolsRaw = fm['allowed-tools'];
  const allowedTools = typeof allowedToolsRaw === 'string'
    ? parseYamlArray(allowedToolsRaw)
    : Array.isArray(allowedToolsRaw)
      ? allowedToolsRaw
      : [];

  const disallowedToolsRaw = fm['disallowed-tools'];
  const disallowedTools = typeof disallowedToolsRaw === 'string'
    ? parseYamlArray(disallowedToolsRaw)
    : Array.isArray(disallowedToolsRaw)
      ? disallowedToolsRaw
      : [];

  const model = typeof fm['model'] === 'string' ? fm['model'] : undefined;

  const rulesRaw = fm['rules'];
  const rules = typeof rulesRaw === 'string'
    ? parseYamlArray(rulesRaw)
    : Array.isArray(rulesRaw)
      ? rulesRaw
      : [];

  return { allowedTools, disallowedTools, model, rules };
}

export class ProjectConfigParser {
  static parse(content: string): ProjectConfig {
    const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
    if (!frontmatterMatch) {
      return {
        body: content.trim(),
        allowedTools: [],
        disallowedTools: [],
        rules: [],
        filePath: null,
      };
    }

    const frontmatterRaw = frontmatterMatch[1];
    const body = frontmatterMatch[2].trim();
    const parsed = parseFrontmatter(frontmatterRaw);

    return {
      body,
      ...parsed,
      filePath: null,
    };
  }

  static searchDirectory(dir: string): string | null {
    const candidates = ['AGENTS.md', 'CLAUDE.md'];
    for (const name of candidates) {
      const filePath = join(dir, name);
      if (existsSync(filePath)) {
        return filePath;
      }
    }

    const resolved = resolve(dir);
    const homeDir = process.env.HOME || process.env.USERPROFILE;
    if (homeDir && resolved === resolve(homeDir)) {
      return null;
    }

    const parent = dirname(resolved);
    if (parent === resolved) {
      return null;
    }

    return this.searchDirectory(parent);
  }

  static load(dir: string): ProjectConfig {
    const filePath = this.searchDirectory(dir);
    if (!filePath) {
      return {
        body: '',
        allowedTools: [],
        disallowedTools: [],
        rules: [],
        filePath: null,
      };
    }

    const content = readFileSync(filePath, 'utf-8');
    const config = this.parse(content);
    config.filePath = filePath;
    return config;
  }
}
