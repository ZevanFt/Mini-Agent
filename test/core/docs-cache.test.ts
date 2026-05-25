import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { DocsCacheManager } from '../../src/core/docs-cache.js';
import path from 'path';
import fs from 'fs/promises';

describe('DocsCacheManager', () => {
  let cacheManager: DocsCacheManager;
  const testCacheDir = path.join(process.cwd(), '.test-docs-cache');

  beforeEach(async () => {
    await fs.mkdir(testCacheDir, { recursive: true });
    cacheManager = new DocsCacheManager({
      directory: '.test-docs-cache',
      enabled: true,
      ttl: {
        official: 60,
        quick_ref: 30,
        mirror: 120,
      },
    });
  });

  afterEach(async () => {
    try {
      await fs.rm(testCacheDir, { recursive: true, force: true });
    } catch {
    }
  });

  describe('Configuration', () => {
    it('should use default config when not provided', () => {
      const manager = new DocsCacheManager();
      expect(manager).toBeDefined();
    });

    it('should accept custom config', () => {
      const manager = new DocsCacheManager({
        enabled: false,
        max_size_mb: 50,
      });
      expect(manager).toBeDefined();
    });
  });

  describe('Cache operations', () => {
    it('should throw error when cache is disabled', async () => {
      const manager = new DocsCacheManager({ enabled: false });
      await expect(manager.getDoc('http://example.com')).rejects.toThrow(
        'Cache is disabled'
      );
    });

    it('should create cache directory on initialization', async () => {
      await cacheManager.initialize();
      const stat = await fs.stat(testCacheDir);
      expect(stat.isDirectory()).toBe(true);
    });

    it('should calculate checksum correctly', () => {
      const manager = new DocsCacheManager();
      const content = 'test content';
      const checksum = (manager as any).calculateChecksum(content);
      expect(checksum).toMatch(/^sha256:[a-f0-9]{64}$/);
    });

    it('should generate cache file paths correctly', () => {
      const manager = new DocsCacheManager({ directory: '.test-docs-cache' });
      const url = 'https://example.com/docs/page';
      const filePath = (manager as any).getCacheFilePath(url);
      expect(filePath).toContain('.test-docs-cache');
      expect(filePath).toContain('example_com');
      expect(filePath).toMatch(/\.cache$/);
    });
  });

  describe('Index management', () => {
    it('should load empty index when no file exists', async () => {
      await cacheManager.initialize();
      expect((cacheManager as any).index.entries.size).toBe(0);
    });

    it('should save and load index', async () => {
      await cacheManager.initialize();
      await (cacheManager as any).saveIndex();
      await (cacheManager as any).loadIndex();
      expect((cacheManager as any).index.version).toBe('1.0');
    });
  });

  describe('Cache stats', () => {
    it('should return stats for empty cache', async () => {
      await cacheManager.initialize();
      const stats = await cacheManager.getStats();
      expect(stats.total_entries).toBe(0);
      expect(stats.expired_entries).toBe(0);
      expect(stats.cache_size_bytes).toBe(0);
    });

    it('should return accurate stats with entries', async () => {
      await cacheManager.initialize();
      const entry = {
        url: 'https://example.com/docs',
        content: 'some content',
        cached_at: new Date(Date.now() - 100000),
        expires_at: new Date(Date.now() - 50000),
        checksum: 'sha256:abc123',
        source_type: 'official' as const,
      };
      (cacheManager as any).index.entries.set(entry.url, entry);

      const stats = await cacheManager.getStats();
      expect(stats.total_entries).toBe(1);
      expect(stats.expired_entries).toBe(1);
      expect(stats.cache_size_bytes).toBeGreaterThan(0);
    });
  });

  describe('Entry expiration', () => {
    it('should correctly identify expired entries', () => {
      const expiredEntry = {
        url: 'https://example.com',
        content: 'content',
        cached_at: new Date(Date.now() - 200000),
        expires_at: new Date(Date.now() - 100000),
        checksum: 'sha256:test',
      };

      const validEntry = {
        url: 'https://example.com/valid',
        content: 'content',
        cached_at: new Date(),
        expires_at: new Date(Date.now() + 100000),
        checksum: 'sha256:test',
      };

      expect((cacheManager as any).isExpired(expiredEntry)).toBe(true);
      expect((cacheManager as any).isExpired(validEntry)).toBe(false);
    });
  });

  describe('Cache invalidation', () => {
    it('should remove entry from index on invalidate', async () => {
      await cacheManager.initialize();
      const url = 'https://example.com/docs';
      const entry = {
        url,
        content: 'content',
        cached_at: new Date(),
        expires_at: new Date(Date.now() + 100000),
        checksum: 'sha256:test',
        source_type: 'official' as const,
      };
      (cacheManager as any).index.entries.set(url, entry);

      await cacheManager.invalidate(url);
      expect((cacheManager as any).index.entries.has(url)).toBe(false);
    });
  });

  describe('Cleanup', () => {
    it('should remove expired entries on cleanup', async () => {
      await cacheManager.initialize();
      const expiredUrl = 'https://example.com/expired';
      const validUrl = 'https://example.com/valid';

      const expiredEntry = {
        url: expiredUrl,
        content: 'content',
        cached_at: new Date(Date.now() - 200000),
        expires_at: new Date(Date.now() - 100000),
        checksum: 'sha256:test',
        source_type: 'official' as const,
      };

      const validEntry = {
        url: validUrl,
        content: 'content',
        cached_at: new Date(),
        expires_at: new Date(Date.now() + 100000),
        checksum: 'sha256:test',
        source_type: 'official' as const,
      };

      (cacheManager as any).index.entries.set(expiredUrl, expiredEntry);
      (cacheManager as any).index.entries.set(validUrl, validEntry);

      await cacheManager.cleanup();

      expect((cacheManager as any).index.entries.has(expiredUrl)).toBe(false);
      expect((cacheManager as any).index.entries.has(validUrl)).toBe(true);
    });
  });

  describe('Content extraction', () => {
    it('should strip HTML tags and scripts', () => {
      const html = `<html><head><script>alert('xss')</script></head><body><p>Hello World</p></body></html>`;
      const result = (cacheManager as any).extractContent(html);
      expect(result).not.toContain('<script>');
      expect(result).not.toContain('<p>');
      expect(result).toContain('Hello World');
    });

    it('should handle plain text input', () => {
      const text = 'This is plain text without HTML.';
      const result = (cacheManager as any).extractContent(text);
      expect(result).toBe(text);
    });
  });
});
