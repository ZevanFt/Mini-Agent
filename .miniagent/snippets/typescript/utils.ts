// TypeScript 工具类模板
import { logger } from '@/utils/logger';

// 配置类型
interface Config {
  maxRetries?: number;
  timeout?: number;
}

// 工具类
export class Utils {
  private config: Required<Config>;
  private static instance: Utils;

  // 单例模式
  public static getInstance(): Utils {
    if (!Utils.instance) {
      Utils.instance = new Utils();
    }
    return Utils.instance;
  }

  // 构造函数
  private constructor(config: Config = {}) {
    this.config = {
      maxRetries: config.maxRetries ?? 3,
      timeout: config.timeout ?? 5000,
    };
    logger.debug('Utils initialized', { config: this.config });
  }

  // 字符串工具
  public isEmpty(str: string | null | undefined): str is null | undefined | '' {
    return str === null || str === undefined || str.trim() === '';
  }

  public truncate(str: string, maxLength: number, suffix: string = '...'): string {
    if (str.length <= maxLength) return str;
    return str.slice(0, maxLength - suffix.length) + suffix;
  }

  public capitalize(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  // 数字工具
  public clamp(value: number, min: number, max: number): number {
    return Math.min(Math.max(value, min), max);
  }

  public random(min: number, max: number): number {
    return Math.random() * (max - min) + min;
  }

  public randomInt(min: number, max: number): number {
    return Math.floor(this.random(min, max + 1));
  }

  // 数组工具
  public unique<T>(arr: T[]): T[] {
    return [...new Set(arr)];
  }

  public groupBy<T, K extends string | number | symbol>(
    arr: T[],
    key: (item: T) => K
  ): Record<K, T[]> {
    const result = {} as Record<K, T[]>;
    for (const item of arr) {
      const k = key(item);
      if (!result[k]) {
        result[k] = [];
      }
      result[k].push(item);
    }
    return result;
  }

  // 异步工具
  public async delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  public async retry<T>(
    fn: () => Promise<T>,
    retries?: number,
    delayMs?: number
  ): Promise<T> {
    const attemptRetries = retries ?? this.config.maxRetries;
    const attemptDelay = delayMs ?? this.config.timeout / 2;

    for (let attempt = 0; attempt < attemptRetries; attempt++) {
      try {
        logger.debug('Attempting operation', { attempt, maxRetries: attemptRetries });
        return await fn();
      } catch (error) {
        if (attempt === attemptRetries - 1) {
          logger.error('All retries failed', { error, attempts: attemptRetries });
          throw error;
        }
        logger.warn('Retrying operation', {
          attempt,
          error: error instanceof Error ? error.message : String(error),
          nextDelay: attemptDelay * (attempt + 1),
        });
        await this.delay(attemptDelay * (attempt + 1));
      }
    }

    throw new Error('Should not reach here');
  }

  // 时间工具
  public formatDate(date: Date | string | number): string {
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  public formatDateTime(date: Date | string | number): string {
    const d = new Date(date);
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const seconds = String(d.getSeconds()).padStart(2, '0');
    return `${this.formatDate(d)} ${hours}:${minutes}:${seconds}`;
  }

  public timeAgo(date: Date | string | number): string {
    const d = new Date(date);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    const weeks = Math.floor(days / 7);
    const months = Math.floor(days / 30);
    const years = Math.floor(days / 365);

    if (years > 0) return `${years}年前`;
    if (months > 0) return `${months}个月前`;
    if (weeks > 0) return `${weeks}周前`;
    if (days > 0) return `${days}天前`;
    if (hours > 0) return `${hours}小时前`;
    if (minutes > 0) return `${minutes}分钟前`;
    if (seconds > 0) return `${seconds}秒前`;
    return '刚刚';
  }

  // 验证工具
  public isValidEmail(email: string): boolean {
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return regex.test(email);
  }

  public isValidUrl(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }
}

// 单例实例导出
export const utils = Utils.getInstance();
