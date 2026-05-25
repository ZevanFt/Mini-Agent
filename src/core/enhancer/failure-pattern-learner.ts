import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { dirname, resolve } from 'path';
import type { FailurePattern, GenerationConstraints } from './types.js';
import { logger } from '@/utils/logger.js';

/**
 * 失败模式学习系统
 *
 * 记录、分析代码生成过程中的失败案例，
 * 从中学习修复策略，预防未来类似的失败。
 */
export class FailurePatternLearner {
  private failurePath: string;
  private patterns: Map<string, FailurePattern>;

  constructor(projectRoot: string = process.cwd()) {
    this.failurePath = resolve(projectRoot, '.miniagent', 'failures.json');
    this.patterns = new Map();
  }

  /**
   * 从 .miniagent/failures.json 加载历史失败模式
   *
   * @returns 加载的失败模式数组
   */
  public loadPatterns(): FailurePattern[] {
    logger.info(`Loading failure patterns from ${this.failurePath}`);

    if (!existsSync(this.failurePath)) {
      logger.debug('No failure patterns file found, starting with empty set');
      this.patterns = new Map();
      return [];
    }

    try {
      const raw = readFileSync(this.failurePath, 'utf-8');
      const data: FailurePattern[] = JSON.parse(raw);

      this.patterns = new Map();
      for (const pattern of data) {
        this.patterns.set(pattern.id, pattern);
      }

      logger.info(`Loaded ${this.patterns.size} failure patterns`);
      return data;
    } catch (err) {
      logger.error('Failed to load failure patterns:', err);
      this.patterns = new Map();
      return [];
    }
  }

  /**
   * 保存失败模式到 .miniagent/failures.json
   */
  public savePatterns(): boolean {
    logger.info(`Saving ${this.patterns.size} failure patterns to ${this.failurePath}`);

    try {
      const dir = dirname(this.failurePath);
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
        logger.debug(`Created directory: ${dir}`);
      }

      const data = Array.from(this.patterns.values());
      writeFileSync(this.failurePath, JSON.stringify(data, null, 2), 'utf-8');
      logger.info('Failure patterns saved successfully');
      return true;
    } catch (err) {
      logger.error('Failed to save failure patterns:', err);
      return false;
    }
  }

  /**
   * 记录新的失败案例
   *
   * @param failure 失败模式对象
   */
  public recordFailure(failure: Omit<FailurePattern, 'id' | 'timestamp' | 'occurrenceCount'>): string {
    const id = this.generateId(failure);
    const pattern: FailurePattern = {
      ...failure,
      id,
      timestamp: new Date().toISOString(),
      occurrenceCount: 1,
    };

    const existing = this.patterns.get(id);
    if (existing) {
      existing.occurrenceCount += 1;
      existing.fixStrategy = failure.fixStrategy;
      existing.fixCode = failure.fixCode;
      existing.failureReason = failure.failureReason;
      existing.generatedCode = failure.generatedCode;
      logger.info(`Updated existing failure pattern: ${id} (occurrences: ${existing.occurrenceCount})`);
    } else {
      this.patterns.set(id, pattern);
      logger.info(`Recorded new failure pattern: ${id}`);
    }

    return id;
  }

  /**
   * 查找相似的失败案例
   *
   * @param request 当前请求描述，用于匹配相似的失败场景
   * @param failureType 可选的失败类型过滤
   * @param maxResults 最大返回数量
   * @returns 按相似度排序的相似失败案例
   */
  public findSimilarFailures(
    request: string,
    failureType?: FailurePattern['failureType'],
    maxResults: number = 5,
  ): FailurePattern[] {
    const candidates = Array.from(this.patterns.values()).filter(
      (p) => !failureType || p.failureType === failureType,
    );

    const scored = candidates.map((pattern) => ({
      pattern,
      score: this.calculateSimilarity(request, pattern.request),
    }));

    const similar = scored
      .filter((s) => s.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, maxResults)
      .map((s) => s.pattern);

    logger.debug(`Found ${similar.length} similar failure patterns for request`);
    return similar;
  }

  /**
   * 获取预防建议
   *
   * @param failureType 可选的失败类型，如果不提供则返回所有类型的建议
   * @returns 按失败类型分组的预防建议
   */
  public getPreventionTips(failureType?: FailurePattern['failureType']): Array<{
    type: FailurePattern['failureType'];
    pattern: string;
    prevention: string;
    occurrenceCount: number;
  }> {
    const patterns = failureType
      ? Array.from(this.patterns.values()).filter((p) => p.failureType === failureType)
      : Array.from(this.patterns.values());

    const tips = patterns.map((pattern) => ({
      type: pattern.failureType,
      pattern: pattern.failureReason,
      prevention: pattern.fixStrategy,
      occurrenceCount: pattern.occurrenceCount,
    }));

    tips.sort((a, b) => b.occurrenceCount - a.occurrenceCount);

    logger.debug(`Generated ${tips.length} prevention tips`);
    return tips;
  }

  /**
   * 将学习到的经验应用到生成过程
   *
   * 基于历史失败模式，生成约束条件以避免重蹈覆辙。
   *
   * @param request 当前请求描述
   * @returns 基于失败经验推导出的约束条件
   */
  public applyLearning(request: string): GenerationConstraints {
    const similarFailures = this.findSimilarFailures(request);

    if (similarFailures.length === 0) {
      logger.debug('No similar failures found, no constraints to apply');
      return {};
    }

    const mustNotUse = new Set<string>();
    const mustFollow = new Set<string>();
    const mustHandle = new Set<string>();

    for (const failure of similarFailures) {
      const reason = failure.failureReason.toLowerCase();

      switch (failure.failureType) {
        case 'syntax':
          mustFollow.add(`Avoid syntax errors: ${failure.failureReason}`);
          break;
        case 'logic':
          mustHandle.add(`Verify logic: ${failure.failureReason}`);
          break;
        case 'security':
          mustNotUse.add(failure.failureReason);
          mustFollow.add(`Apply security fix: ${failure.fixStrategy}`);
          break;
        case 'performance':
          mustFollow.add(`Optimize for: ${failure.failureReason}`);
          mustHandle.add(`Check performance: ${failure.fixStrategy}`);
          break;
        case 'context':
          mustFollow.add(`Maintain context accuracy: ${failure.failureReason}`);
          mustHandle.add(`Verify context: ${failure.fixStrategy}`);
          break;
      }
    }

    const constraints: GenerationConstraints = {};

    if (mustNotUse.size > 0) {
      constraints.mustNotUse = Array.from(mustNotUse);
    }
    if (mustFollow.size > 0) {
      constraints.mustFollow = Array.from(mustFollow);
    }
    if (mustHandle.size > 0) {
      constraints.mustHandle = Array.from(mustHandle);
    }

    logger.info(
      `Applied learning: ${similarFailures.length} similar failures informed ${JSON.stringify(constraints)}`,
    );

    return constraints;
  }

  /**
   * 按失败类型分类获取所有失败模式
   *
   * @returns 以失败类型为键的分组对象
   */
  public getPatternsByType(): Record<string, FailurePattern[]> {
    const result: Record<string, FailurePattern[]> = {};

    for (const pattern of this.patterns.values()) {
      if (!result[pattern.failureType]) {
        result[pattern.failureType] = [];
      }
      result[pattern.failureType].push(pattern);
    }

    return result;
  }

  /**
   * 获取所有已记录的失败模式
   */
  public getAllPatterns(): FailurePattern[] {
    return Array.from(this.patterns.values());
  }

  /**
   * 根据 ID 获取单个失败模式
   */
  public getPatternById(id: string): FailurePattern | undefined {
    return this.patterns.get(id);
  }

  /**
   * 清除所有失败模式记录
   */
  public clearPatterns(): void {
    this.patterns.clear();
    logger.info('All failure patterns cleared');
  }

  /**
   * 生成失败模式的唯一 ID
   *
   * 基于请求内容和失败原因生成哈希 ID，
   * 相同问题的重复发生会被归为同一模式。
   */
  private generateId(failure: Omit<FailurePattern, 'id' | 'timestamp' | 'occurrenceCount'>): string {
    const hashInput = `${failure.failureType}:${failure.failureReason}:${failure.request.substring(0, 50)}`;
    let hash = 0;
    for (let i = 0; i < hashInput.length; i++) {
      const char = hashInput.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash |= 0;
    }
    return `fp_${Math.abs(hash).toString(36)}`;
  }

  /**
   * 计算两个字符串的相似度 (基于词袋模型)
   *
   * @returns 相似度得分 0-1
   */
  private calculateSimilarity(str1: string, str2: string): number {
    const words1 = this.tokenize(str1);
    const words2 = this.tokenize(str2);

    if (words1.length === 0 || words2.length === 0) {
      return 0;
    }

    const set1 = new Set(words1);
    const set2 = new Set(words2);

    let intersection = 0;
    for (const word of set1) {
      if (set2.has(word)) {
        intersection += 1;
      }
    }

    const union = new Set([...set1, ...set2]).size;
    return intersection / union;
  }

  /**
   * 将字符串分词，过滤掉常见停用词
   */
  private tokenize(text: string): string[] {
    const stopWords = new Set([
      'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been',
      'to', 'of', 'and', 'in', 'that', 'have', 'it', 'for',
      'not', 'on', 'with', 'he', 'as', 'you', 'do', 'at',
      'this', 'but', 'his', 'by', 'from', 'the', 'to',
    ]);

    return text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((word) => word.length > 2 && !stopWords.has(word));
  }
}
