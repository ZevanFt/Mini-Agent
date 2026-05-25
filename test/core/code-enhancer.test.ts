import { describe, it, expect } from 'vitest';
import { CodeEnhancer } from '../../src/core/code-enhancer.js';
import type { CodeBlock, ValidationResult } from '../../src/core/code-enhancer.js';

describe('CodeEnhancer', () => {
  const enhancer = new CodeEnhancer();

  describe('generateProgressively', () => {
    it('should generate code step by step', async () => {
      const steps = ['create interface', 'implement function', 'add tests'];
      const mockGenerate = async (stepPrompt: string): Promise<CodeBlock> => ({
        language: 'typescript',
        code: `// ${stepPrompt}`,
      });

      const results = await enhancer.generateProgressively(
        'Build a user service',
        mockGenerate,
        steps
      );

      expect(results).toHaveLength(3);
      expect(results[0].code).toContain('create interface');
      expect(results[1].code).toContain('implement function');
      expect(results[2].code).toContain('add tests');
    });

    it('should include previous steps in context', async () => {
      const steps = ['step1', 'step2'];
      const mockGenerate = async (stepPrompt: string): Promise<CodeBlock> => ({
        language: 'typescript',
        code: stepPrompt,
      });

      const results = await enhancer.generateProgressively(
        'Task',
        mockGenerate,
        steps
      );

      expect(results[1].code).toContain('step1');
      expect(results[1].code).toContain('step2');
    });

    it('should retry on failure', async () => {
      const steps = ['step1'];
      let attempts = 0;
      const mockGenerate = async (): Promise<CodeBlock> => {
        attempts++;
        if (attempts < 2) throw new Error('Temporary failure');
        return { language: 'typescript', code: 'success' };
      };

      const enhancerWithRetry = new CodeEnhancer({
        maxAttempts: 3,
        delayMs: 10,
        backoffMultiplier: 1,
      });

      const results = await enhancerWithRetry.generateProgressively(
        'Task',
        mockGenerate,
        steps
      );

      expect(results).toHaveLength(1);
      expect(results[0].code).toBe('success');
      expect(attempts).toBe(2);
    });
  });

  describe('reviewAndFix', () => {
    it('should pass validation immediately if code is valid', async () => {
      const reviewFn = async (): Promise<ValidationResult> => ({
        valid: true,
        errors: [],
        warnings: [],
        suggestions: [],
      });
      const fixFn = async (code: string): Promise<string> => code;

      const result = await enhancer.reviewAndFix(
        'valid code',
        'typescript',
        reviewFn,
        fixFn
      );

      expect(result.code).toBe('valid code');
      expect(result.cycles).toBe(0);
      expect(result.finalValidation.valid).toBe(true);
    });

    it('should fix errors through review cycles', async () => {
      let cycleCount = 0;
      const reviewFn = async (code: string): Promise<ValidationResult> => {
        cycleCount++;
        if (code.includes('fixed')) {
          return { valid: true, errors: [], warnings: [], suggestions: [] };
        }
        return {
          valid: false,
          errors: ['missing semicolon'],
          warnings: [],
          suggestions: [],
        };
      };
      const fixFn = async (code: string): Promise<string> => code + ' fixed';

      const result = await enhancer.reviewAndFix(
        'broken code',
        'typescript',
        reviewFn,
        fixFn
      );

      expect(result.code).toBe('broken code fixed');
      expect(result.cycles).toBe(1);
      expect(result.finalValidation.valid).toBe(true);
    });

    it('should respect maxCycles limit', async () => {
      const reviewFn = async (): Promise<ValidationResult> => ({
        valid: false,
        errors: ['always invalid'],
        warnings: [],
        suggestions: [],
      });
      const fixFn = async (code: string): Promise<string> => code + ' attempt';

      const result = await enhancer.reviewAndFix(
        'code',
        'typescript',
        reviewFn,
        fixFn,
        2
      );

      expect(result.cycles).toBe(2);
      expect(result.code).toContain('attempt');
      expect(result.finalValidation.valid).toBe(false);
    });
  });

  describe('splitCodeIntoChunks', () => {
    it('should split large code into chunks', () => {
      const code = Array(100).fill('// line').join('\n');
      const chunks = enhancer.splitCodeIntoChunks(code, 200);

      expect(chunks.length).toBeGreaterThan(1);
      expect(chunks.join('\n')).toContain('// line');
    });

    it('should handle small code without splitting', () => {
      const code = 'const x = 1;';
      const chunks = enhancer.splitCodeIntoChunks(code, 1000);

      expect(chunks).toHaveLength(1);
      expect(chunks[0]).toBe(code);
    });

    it('should handle empty code', () => {
      const chunks = enhancer.splitCodeIntoChunks('', 100);
      expect(chunks).toHaveLength(1);
      expect(chunks[0]).toBe('');
    });
  });
});
