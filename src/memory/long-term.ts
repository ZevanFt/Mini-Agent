/**
 * LongTermMemory - 长期记忆系统
 * 
 * 学习笔记：
 * MiniAgent 使用三层记忆架构：
 * 
 * 1. Working Memory (工作记忆)
 *    - 当前对话的最近消息
 *    - 容量有限 (~8K tokens)
 *    - 随对话结束而清空
 * 
 * 2. Session Memory (会话记忆)
 *    - 整个会话的完整对话历史
 *    - 用于跨轮次上下文
 *    - 会话结束时可以选择性持久化
 * 
 * 3. LongTerm Memory (长期记忆) ← 本模块
 *    - 跨会话的持久化记忆
 *    - 存储项目知识、用户偏好、重要上下文
 *    - 存储在 ~/.miniagent/memory/ 目录
 *    - 类似 "大脑" 可以记住过去的重要信息
 * 
 * Claude Code 使用 MEMORY.md 文件来存储项目级记忆，
 * 我们采用类似但更灵活的方式：JSON 文件存储结构化数据。
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'fs';
import { join } from 'path';

/**
 * 记忆条目
 */
export interface MemoryEntry {
  /** 唯一 ID */
  id: string;
  /** 记忆键（唯一标识） */
  key: string;
  /** 记忆内容 */
  value: string;
  /** 记忆类别 */
  category: MemoryCategory;
  /** 创建时间 */
  createdAt: Date;
  /** 最后更新时间 */
  updatedAt: Date;
  /** 访问次数 */
  accessCount: number;
  /** 重要性评分 (1-5) */
  importance: number;
}

/**
 * 记忆类别
 */
export type MemoryCategory =
  | 'project'       // 项目知识（架构、设计决策）
  | 'preference'    // 用户偏好（编码风格、工具选择）
  | 'context'       // 重要上下文（当前任务状态）
  | 'code_pattern'  // 代码模式（常用函数、最佳实践）
  | 'decision'      // 设计决策（为什么这么做）
  | 'error'         // 错误记录（遇到的错误和解决方案）
  | 'fact'          // 通用事实（API 文档、配置信息）
  | 'custom';       // 自定义类别

/**
 * 长期记忆管理器
 */
export class LongTermMemory {
  private dataDir: string;
  private memories: Map<string, MemoryEntry> = new Map();

  constructor(dataDir: string = '~/.miniagent/memory') {
    this.dataDir = dataDir.replace('~', process.env.HOME || '/tmp');
    this.ensureDataDir();
    this.loadMemories();
  }

  /**
   * 确保数据目录存在
   */
  private ensureDataDir(): void {
    if (!existsSync(this.dataDir)) {
      mkdirSync(this.dataDir, { recursive: true });
    }
  }

  /**
   * 存储记忆
   * 
   * @param key - 记忆键
   * @param value - 记忆内容
   * @param category - 记忆类别
   * @param importance - 重要性 (1-5，默认 3)
   */
  store(
    key: string,
    value: string,
    category: MemoryCategory = 'custom',
    importance: number = 3
  ): MemoryEntry {
    const existing = this.memories.get(key);
    const now = new Date();

    const entry: MemoryEntry = {
      id: existing?.id || `mem_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
      key,
      value,
      category,
      createdAt: existing?.createdAt || now,
      updatedAt: now,
      accessCount: (existing?.accessCount || 0) + 1,
      importance: Math.max(1, Math.min(5, importance)),
    };

    this.memories.set(key, entry);
    this.saveEntry(entry);
    return entry;
  }

  /**
   * 获取记忆
   * 
   * @param key - 记忆键
   * @returns 记忆条目，不存在返回 undefined
   */
  get(key: string): MemoryEntry | undefined {
    const entry = this.memories.get(key);
    if (entry) {
      entry.accessCount++;
      entry.updatedAt = new Date();
    }
    return entry ? { ...entry } : undefined;
  }

  /**
   * 搜索记忆
   * 
   * @param query - 搜索关键词
   * @param category - 按类别筛选（可选）
   * @param limit - 最大返回数量
   */
  search(
    query: string,
    category?: MemoryCategory,
    limit: number = 10
  ): MemoryEntry[] {
    const results: MemoryEntry[] = [];
    const queryLower = query.toLowerCase();

    for (const entry of this.memories.values()) {
      if (category && entry.category !== category) continue;

      const matches =
        entry.key.toLowerCase().includes(queryLower) ||
        entry.value.toLowerCase().includes(queryLower) ||
        entry.category.toLowerCase().includes(queryLower);

      if (matches) {
        results.push({ ...entry });
      }
    }

    // 按重要性和访问次数排序
    results.sort((a, b) => {
      const scoreA = a.importance * 10 + a.accessCount;
      const scoreB = b.importance * 10 + b.accessCount;
      return scoreB - scoreA;
    });

    return results.slice(0, limit);
  }

  /**
   * 列出所有记忆
   */
  list(category?: MemoryCategory): MemoryEntry[] {
    const entries = Array.from(this.memories.values()).map(e => ({ ...e }));
    
    if (category) {
      return entries.filter(e => e.category === category);
    }
    
    return entries;
  }

  /**
   * 删除记忆
   */
  forget(key: string): boolean {
    const removed = this.memories.delete(key);
    if (removed) {
      this.deleteEntryFile(key);
    }
    return removed;
  }

  /**
   * 按类别清除记忆
   */
  clearCategory(category: MemoryCategory): number {
    let count = 0;
    for (const [key, entry] of this.memories) {
      if (entry.category === category) {
        this.memories.delete(key);
        this.deleteEntryFile(key);
        count++;
      }
    }
    return count;
  }

  /**
   * 清除所有记忆
   */
  clearAll(): void {
    for (const key of this.memories.keys()) {
      this.deleteEntryFile(key);
    }
    this.memories.clear();
  }

  /**
   * 获取统计信息
   */
  getStats(): {
    total: number;
    byCategory: Record<string, number>;
    totalImportance: number;
  } {
    const byCategory: Record<string, number> = {};
    let totalImportance = 0;

    for (const entry of this.memories.values()) {
      byCategory[entry.category] = (byCategory[entry.category] || 0) + 1;
      totalImportance += entry.importance;
    }

    return {
      total: this.memories.size,
      byCategory,
      totalImportance,
    };
  }

  /**
   * 格式化记忆为文本（用于注入 System Prompt）
   */
  formatAsContext(query: string, maxEntries: number = 5): string {
    const memories = this.search(query, undefined, maxEntries);
    
    if (memories.length === 0) {
      return '';
    }

    const lines = memories.map(m => 
      `[${m.category}] ${m.key}: ${m.value.substring(0, 100)}${m.value.length > 100 ? '...' : ''}`
    );

    return `长期记忆:\n${lines.join('\n')}`;
  }

  /**
   * 加载所有记忆
   */
  private loadMemories(): void {
    try {
      const files = readdirSync(this.dataDir).filter(f => f.endsWith('.json'));
      
      for (const file of files) {
        try {
          const content = readFileSync(join(this.dataDir, file), 'utf-8');
          const entry: MemoryEntry = {
            ...JSON.parse(content),
            createdAt: new Date(JSON.parse(content).createdAt),
            updatedAt: new Date(JSON.parse(content).updatedAt),
          };
          this.memories.set(entry.key, entry);
        } catch {
          // 跳过损坏的文件
        }
      }
    } catch {
      // 目录不存在或无法读取
    }
  }

  /**
   * 保存单个记忆条目
   */
  private saveEntry(entry: MemoryEntry): void {
    const filename = `${this.sanitizeKey(entry.key)}.json`;
    const filepath = join(this.dataDir, filename);
    
    writeFileSync(filepath, JSON.stringify(entry, null, 2));
  }

  /**
   * 删除记忆文件
   */
  private deleteEntryFile(key: string): void {
    const filename = `${this.sanitizeKey(key)}.json`;
    const filepath = join(this.dataDir, filename);
    
    try {
      const { unlinkSync } = require('fs');
      unlinkSync(filepath);
    } catch {
      // 文件不存在或无法删除
    }
  }

  /**
   * 清理键名中的非法文件名字符
   */
  private sanitizeKey(key: string): string {
    return key.replace(/[^a-zA-Z0-9_-]/g, '_');
  }
}
