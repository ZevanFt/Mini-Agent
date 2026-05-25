/**
 * Context Compaction - 上下文压缩
 * 
 * 学习笔记：
 * 当对话历史过长时，会超出模型的上下文窗口限制。
 * 上下文压缩是解决这个问题的关键技术。
 * 
 * Claude Code 使用两种压缩策略：
 * 
 * 1. 摘要压缩 (Summarization)
 *    - 调用 LLM 对历史消息生成摘要
 *    - 保留关键信息，删除冗余
 *    - 适合需要保留语义理解的场景
 * 
 * 2. 截断压缩 (Truncation)
 *    - 直接保留最近 N 条消息
 *    - 丢弃早期消息
 *    - 快速但不保留历史信息
 * 
 * 3. 分层压缩 (Tiered Compaction)
 *    - 最近的消息保留原样
 *    - 稍早的消息进行摘要
 *    - 更早的消息只保留要点
 * 
 * 工作流程：
 * 1. 检查总 Token 数是否超过阈值
 * 2. 如果超过，触发压缩
 * 3. 对历史消息分组并生成摘要
 * 4. 保留关键信息到 Memory 系统
 * 5. 替换原始消息为摘要
 */

import type { Message } from '../memory/index.js';
import type { LLMAdapter } from '../llm/base.js';

/**
 * 上下文压缩配置
 */
export interface CompactionConfig {
  /** 是否启用压缩 */
  enabled: boolean;
  /** 触发压缩的 Token 阈值 */
  thresholdTokens: number;
  /** 压缩后目标 Token 数 */
  targetTokens: number;
  /** 保留最近的 N 条消息不压缩 */
  preserveRecentMessages: number;
  /** 是否保留系统提示 */
  preserveSystemPrompt: boolean;
}

/**
 * 默认配置
 */
export const DEFAULT_COMPACTION_CONFIG: CompactionConfig = {
  enabled: true,
  thresholdTokens: 3000,  // 降低阈值便于测试
  targetTokens: 2000,
  preserveRecentMessages: 4,
  preserveSystemPrompt: true,
};

/**
 * 压缩结果
 */
export interface CompactionResult {
  /** 压缩后的消息 */
  messages: Message[];
  /** 原始消息数 */
  originalCount: number;
  /** 压缩后消息数 */
  compactedCount: number;
  /** 原始 Token 数（估算） */
  originalTokens: number;
  /** 压缩后 Token 数（估算） */
  compactedTokens: number;
  /** 压缩率 */
  compressionRatio: number;
  /** 是否执行了压缩 */
  wasCompacted: boolean;
}

/**
 * 估算 Token 数量
 * 
 * 简单估算：英文 1 token ≈ 4 chars, 中文 1 token ≈ 1.5 chars
 * 这是一个粗略估计，用于判断是否需要压缩
 */
export function estimateTokens(text: string): number {
  const chineseChars = (text.match(/[\u4e00-\u9fff]/g) || []).length;
  const otherChars = text.length - chineseChars;
  
  return Math.ceil(chineseChars / 1.5 + otherChars / 4);
}

/**
 * 上下文压缩器
 */
export class ContextCompactor {
  private config: CompactionConfig;
  private llm: LLMAdapter | null = null;

  constructor(config: Partial<CompactionConfig> = {}) {
    this.config = { ...DEFAULT_COMPACTION_CONFIG, ...config };
  }

  /**
   * 设置 LLM 适配器
   */
  setLLM(llm: LLMAdapter): void {
    this.llm = llm;
  }

  /**
   * 检查是否需要压缩
   */
  shouldCompact(messages: Message[]): boolean {
    if (!this.config.enabled) return false;

    const totalTokens = this.estimateTotalTokens(messages);
    return totalTokens > this.config.thresholdTokens;
  }

  /**
   * 执行上下文压缩
   */
  async compact(messages: Message[]): Promise<CompactionResult> {
    const originalCount = messages.length;
    const originalTokens = this.estimateTotalTokens(messages);

    // 如果不需要压缩，直接返回
    if (!this.shouldCompact(messages)) {
      return {
        messages,
        originalCount,
        compactedCount: messages.length,
        originalTokens,
        compactedTokens: originalTokens,
        compressionRatio: 1.0,
        wasCompacted: false,
      };
    }

    // 分层压缩策略
    const recentMessages = messages.slice(-this.config.preserveRecentMessages);
    const olderMessages = messages.slice(0, -this.config.preserveRecentMessages);

    let compactedMessages: Message[];

    if (olderMessages.length <= 2) {
      // 消息太少，不值得压缩，直接截断
      compactedMessages = recentMessages;
    } else if (this.llm) {
      // 有 LLM，使用摘要压缩
      const summary = await this.summarizeMessages(olderMessages);
      compactedMessages = [
        {
          role: 'system' as const,
          content: `[对话摘要] ${summary}`,
        },
        ...recentMessages,
      ];
    } else {
      // 没有 LLM，只保留最近消息
      compactedMessages = recentMessages;
    }

    const compactedTokens = this.estimateTotalTokens(compactedMessages);

    return {
      messages: compactedMessages,
      originalCount,
      compactedCount: compactedMessages.length,
      originalTokens,
      compactedTokens,
      compressionRatio: originalTokens > 0 ? compactedTokens / originalTokens : 1.0,
      wasCompacted: true,
    };
  }

  /**
   * 快速压缩（不调用 LLM，只保留最近消息）
   */
  compactFast(messages: Message[]): CompactionResult {
    const originalCount = messages.length;
    const originalTokens = this.estimateTotalTokens(messages);

    const recentMessages = messages.slice(-this.config.preserveRecentMessages);
    const compactedTokens = this.estimateTotalTokens(recentMessages);

    return {
      messages: recentMessages,
      originalCount,
      compactedCount: recentMessages.length,
      originalTokens,
      compactedTokens,
      compressionRatio: originalTokens > 0 ? compactedTokens / originalTokens : 1.0,
      wasCompacted: true,
    };
  }

  /**
   * 使用 LLM 对消息进行摘要
   */
  private async summarizeMessages(messages: Message[]): Promise<string> {
    if (!this.llm) {
      return '[历史记录已压缩]';
    }

    const conversationText = messages.map(m => 
      `${m.role}: ${m.content.substring(0, 200)}`
    ).join('\n\n');

    const prompt = `请简要总结以下对话的关键信息。保留重要的事实、决策和结论。用简洁的语言，不超过 100 字。

对话历史:
${conversationText}`;

    try {
      const response = await this.llm.chatOnce({
        messages: [{ role: 'user', content: prompt }],
        systemPrompt: '你是一个简洁的摘要助手。',
      });
      return response.content.substring(0, 500);
    } catch {
      return '[历史记录已压缩 - 摘要生成失败]';
    }
  }

  /**
   * 估算总 Token 数
   */
  private estimateTotalTokens(messages: Message[]): number {
    let total = 0;
    for (const msg of messages) {
      total += estimateTokens(msg.content);
      // tool calls 额外 token
      if (msg.toolCalls) {
        total += 50;
      }
    }
    return total;
  }
}
