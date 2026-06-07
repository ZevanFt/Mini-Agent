import crypto from 'crypto';
import path from 'path';
import fs from 'fs/promises';
import { logger } from '../utils/logger.js';

export interface CacheConfig {
  enabled: boolean;
  directory: string;
  ttl: {
    official: number;
    quick_ref: number;
    mirror: number;
  };
  max_size_mb: number;
  offline_mode: boolean;
  auto_refresh: boolean;
  refresh_interval: number;
}

export interface CacheEntry {
  url: string;
  content: string;
  cached_at: Date;
  expires_at: Date;
  checksum: string;
  version?: string;
  source_type?: 'official' | 'mirror' | 'quick_ref';
}

export interface CacheIndex {
  version: string;
  last_updated: Date;
  entries: Map<string, CacheEntry>;
}

export class DocsCacheManager {
  private cacheDir: string;
  private indexPath: string;
  private index: CacheIndex;
  private config: CacheConfig;

  constructor(config: Partial<CacheConfig> = {}) {
    this.config = this.loadConfig(config);
    this.cacheDir = path.join(process.cwd(), this.config.directory);
    this.indexPath = path.join(this.cacheDir, 'index.json');
    this.index = {
      version: '1.0',
      last_updated: new Date(),
      entries: new Map(),
    };
  }

  private loadConfig(partial: Partial<CacheConfig>): CacheConfig {
    return {
      enabled: partial.enabled ?? true,
      directory: partial.directory ?? '.miniagent/docs/cache',
      ttl: {
        official: partial.ttl?.official ?? 604800,
        quick_ref: partial.ttl?.quick_ref ?? 259200,
        mirror: partial.ttl?.mirror ?? 1209600,
      },
      max_size_mb: partial.max_size_mb ?? 100,
      offline_mode: partial.offline_mode ?? false,
      auto_refresh: partial.auto_refresh ?? true,
      refresh_interval: partial.refresh_interval ?? 86400,
    };
  }

  async initialize(): Promise<void> {
    if (!this.config.enabled) return;

    await fs.mkdir(this.cacheDir, { recursive: true });
    await this.loadIndex();

    if (this.config.auto_refresh) {
      await this.cleanup();
    }
  }

  async getDoc(url: string, sourceType: 'official' | 'mirror' | 'quick_ref' = 'official'): Promise<string> {
    if (!this.config.enabled) {
      throw new Error('Cache is disabled');
    }

    const cached = this.index.entries.get(url);
    
    if (cached && !this.isExpired(cached)) {
      logger.debug(`Cache hit: ${url}`);
      return cached.content;
    }

    logger.info(`Cache miss, fetching online: ${url}`);
    const content = await this.fetchOnline(url);
    await this.cacheDoc(url, content, sourceType);
    
    return content;
  }

  private async fetchOnline(url: string): Promise<string> {
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'MiniAgent-DocsCache/1.0',
        },
        signal: AbortSignal.timeout(10000),
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch: ${response.status} ${response.statusText}`);
      }

      const html = await response.text();
      return this.extractContent(html);
    } catch (error) {
      logger.error(`Failed to fetch online: ${url}`, { error });
      throw error;
    }
  }

  private extractContent(html: string): string {
    const text = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();

    return text;
  }

  private async cacheDoc(url: string, content: string, sourceType: 'official' | 'mirror' | 'quick_ref' = 'official'): Promise<void> {
    const checksum = this.calculateChecksum(content);
    const filePath = this.getCacheFilePath(url);
    const ttl = this.config.ttl[sourceType] * 1000;

    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, content, 'utf-8');

    const entry: CacheEntry = {
      url,
      content,
      cached_at: new Date(),
      expires_at: new Date(Date.now() + ttl),
      checksum,
      source_type: sourceType,
    };

    this.index.entries.set(url, entry);
    await this.saveIndex();
    
    logger.info(`Cached: ${url}`);
  }

  private isExpired(entry: CacheEntry): boolean {
    return new Date() > entry.expires_at;
  }

  async refresh(url: string): Promise<string> {
    logger.info(`Refreshing cache: ${url}`);
    await this.invalidate(url);
    return this.getDoc(url);
  }

  async refreshAll(): Promise<void> {
    logger.info('Refreshing all expired caches');
    
    for (const [url] of this.index.entries) {
      if (this.isExpired(this.index.entries.get(url)!)) {
        try {
          await this.refresh(url);
        } catch (error) {
          logger.error(`Failed to refresh: ${url}`, { error });
        }
      }
    }
  }

  async invalidate(url: string): Promise<void> {
    this.index.entries.delete(url);
    const filePath = this.getCacheFilePath(url);
    
    try {
      await fs.unlink(filePath);
    } catch (error) {
      // 文件可能不存在
    }
    
    await this.saveIndex();
  }

  async cleanup(): Promise<void> {
    logger.info('Cleaning up expired cache');
    
    const urlsToRemove: string[] = [];
    
    for (const [_url, entry] of this.index.entries) {
      if (this.isExpired(entry)) {
        urlsToRemove.push(_url);
      }
    }

    for (const url of urlsToRemove) {
      await this.invalidate(url);
    }
  }

  async getStats(): Promise<{
    total_entries: number;
    expired_entries: number;
    cache_size_bytes: number;
    cache_size_mb: number;
  }> {
    let totalSize = 0;
    let expiredCount = 0;

    for (const [_url, entry] of this.index.entries) {
      totalSize += Buffer.byteLength(entry.content, 'utf-8');
      
      if (this.isExpired(entry)) {
        expiredCount++;
      }
    }

    return {
      total_entries: this.index.entries.size,
      expired_entries: expiredCount,
      cache_size_bytes: totalSize,
      cache_size_mb: Math.round(totalSize / 1024 / 1024 * 100) / 100,
    };
  }

  private calculateChecksum(content: string): string {
    const hash = crypto.createHash('sha256');
    hash.update(content);
    return `sha256:${hash.digest('hex')}`;
  }

  private getCacheFilePath(url: string): string {
    const hash = crypto.createHash('md5').update(url).digest('hex');
    const domain = new URL(url).hostname.replace(/[^a-z0-9]/gi, '_');
    return path.join(this.cacheDir, domain, `${hash}.cache`);
  }

  private async loadIndex(): Promise<void> {
    try {
      const data = await fs.readFile(this.indexPath, 'utf-8');
      const parsed = JSON.parse(data);
      
      this.index.version = parsed.version || '1.0';
      this.index.last_updated = new Date(parsed.last_updated || Date.now());
      this.index.entries = new Map(Object.entries(parsed.entries || {}));
    } catch (error) {
      // 索引文件不存在或损坏，使用空索引
      logger.debug('No index file found, creating new one');
    }
  }

  private async saveIndex(): Promise<void> {
    const data = {
      version: this.index.version,
      last_updated: this.index.last_updated.toISOString(),
      entries: Object.fromEntries(this.index.entries),
    };

    await fs.writeFile(this.indexPath, JSON.stringify(data, null, 2), 'utf-8');
  }
}
