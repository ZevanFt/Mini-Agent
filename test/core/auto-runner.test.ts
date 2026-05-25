import { describe, it, expect } from 'vitest';
import { AutoRunner } from '../../src/core/auto-runner.js';

describe('AutoRunner', () => {
  const runner = new AutoRunner();

  describe('detectLanguage', () => {
    it('should detect JavaScript from .js extension', () => {
      const config = (runner as any).getRunConfig('test.js', 'javascript');
      expect(config.command).toBe('node');
    });

    it('should detect TypeScript from .ts extension', () => {
      const config = (runner as any).getRunConfig('test.ts', 'typescript');
      expect(config.command).toBe('npx');
    });

    it('should detect Python from .py extension', () => {
      const config = (runner as any).getRunConfig('test.py', 'python');
      expect(config.command).toBe('python');
    });
  });

  describe('runFile', () => {
    it('should return error for unsupported language', async () => {
      const result = await runner.runFile('test.haskell', 'haskell');
      expect(result.success).toBe(false);
      expect(result.error).toContain('No runner available');
    });
  });
});
