import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { SQLiteStore } from '../../src/core/sqlite-store.js';

describe('SQLiteStore', () => {
  const testDir = path.join(process.cwd(), 'test', 'fixtures', 'test-sqlite');
  let store: SQLiteStore;

  beforeEach(async () => {
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }
    store = new SQLiteStore(testDir);
    await store.initialize();
  });

  afterEach(async () => {
    await store.close();
    const dbPath = path.join(testDir, '.miniagent', 'miniagent.db');
    if (fs.existsSync(dbPath)) {
      fs.unlinkSync(dbPath);
    }
  });

  describe('Session management', () => {
    it('should create a session', async () => {
      const session = await store.createSession({
        name: 'Test Session',
        message_count: 0,
        tool_calls: 0,
      });
      expect(session.id).toBeDefined();
      expect(session.name).toBe('Test Session');
    });

    it('should get a session by id', async () => {
      const created = await store.createSession({
        name: 'Test Session',
        message_count: 0,
        tool_calls: 0,
      });
      const retrieved = await store.getSession(created.id);
      expect(retrieved).not.toBeNull();
      expect(retrieved?.name).toBe('Test Session');
    });

    it('should list sessions', async () => {
      await store.createSession({ name: 'Session 1', message_count: 0, tool_calls: 0 });
      await store.createSession({ name: 'Session 2', message_count: 0, tool_calls: 0 });
      const sessions = await store.listSessions();
      expect(sessions.length).toBe(2);
    });

    it('should delete a session', async () => {
      const created = await store.createSession({
        name: 'To Delete',
        message_count: 0,
        tool_calls: 0,
      });
      const deleted = await store.deleteSession(created.id);
      expect(deleted).toBe(true);
      const retrieved = await store.getSession(created.id);
      expect(retrieved).toBeNull();
    });
  });

  describe('Memory management', () => {
    it('should store and retrieve memory', async () => {
      await store.storeMemory('project', 'name', 'MiniAgent');
      const value = await store.getMemory('project', 'name');
      expect(value).toBe('MiniAgent');
    });

    it('should update existing memory', async () => {
      await store.storeMemory('project', 'name', 'Old Name');
      await store.storeMemory('project', 'name', 'New Name');
      const value = await store.getMemory('project', 'name');
      expect(value).toBe('New Name');
    });

    it('should forget memory', async () => {
      await store.storeMemory('project', 'name', 'MiniAgent');
      const forgotten = await store.forgetMemory('project', 'name');
      expect(forgotten).toBe(true);
      const value = await store.getMemory('project', 'name');
      expect(value).toBeNull();
    });

    it('should search memories', async () => {
      await store.storeMemory('project', 'name', 'MiniAgent');
      await store.storeMemory('config', 'theme', 'dark');
      const results = await store.searchMemories('mini');
      expect(results.length).toBe(1);
    });
  });

  describe('Usage stats', () => {
    it('should record usage', async () => {
      await store.recordUsage('session-1', 'bash', 100, true);
      await store.recordUsage('session-1', 'file_read', 50, true);
      await store.recordUsage('session-1', 'bash', 200, false, 'error');
      const stats = await store.getUsageStats(7);
      expect(stats.length).toBe(2);
    });
  });
});
