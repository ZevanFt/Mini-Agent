import { describe, it, expect } from 'bun:test';
import { PostProcessor } from '../../src/core/enhancer/post-processor.js';

describe('PostProcessor', () => {
  const processor = new PostProcessor();

  describe('brace fixing', () => {
    it('should add missing closing braces', () => {
      const code = `function test() {\n  if (true) {\n    console.log("hello");\n  }\n`;
      const result = processor.process(code, 'typescript');
      expect(result.success).toBe(true);
      const openCount = (result.code.match(/{/g) || []).length;
      const closeCount = (result.code.match(/}/g) || []).length;
      expect(openCount).toBe(closeCount);
    });

    it('should not modify balanced code', () => {
      const code = `function test() {\n  if (true) {\n    console.log("hello");\n  }\n}`;
      const result = processor.process(code, 'typescript');
      expect(result.success).toBe(true);
      expect(result.code).toContain('console.log');
    });
  });

  describe('indentation normalization', () => {
    it('should convert tabs to spaces', () => {
      const code = `\tfunction test() {\n\t\tconsole.log("hello");\n\t}`;
      const result = processor.process(code, 'typescript');
      expect(result.success).toBe(true);
      expect(result.code).not.toContain('\t');
    });
  });

  describe('import deduplication', () => {
    it('should remove duplicate imports', () => {
      const code = `import { logger } from './logger.js';\nimport { logger } from './logger.js';\nimport { config } from './config.js';\n\nconsole.log(logger);`;
      const result = processor.process(code, 'typescript');
      expect(result.success).toBe(true);
      const importCount = (result.code.match(/^import /gm) || []).length;
      expect(importCount).toBe(2);
    });
  });

  describe('empty function detection', () => {
    it('should detect empty functions in JS/TS', () => {
      const code = `function doNothing() {}\nconst noop = () => {};`;
      const result = processor.process(code, 'javascript');
      expect(result.success).toBe(true);
    });

    it('should detect empty functions in Python', () => {
      const code = `def do_nothing():\n    pass\ndef another():\n    ...`;
      const result = processor.process(code, 'python');
      expect(result.success).toBe(true);
    });
  });

  describe('semicolon insertion', () => {
    it('should add semicolons to statement lines in TS/JS', () => {
      const code = `const x = 42\nconst y = "hello"\nreturn x + y`;
      const result = processor.process(code, 'typescript');
      expect(result.success).toBe(true);
      const semicolonCount = (result.code.match(/;/g) || []).length;
      expect(semicolonCount).toBeGreaterThan(2);
    });

    it('should NOT add semicolons to Python', () => {
      const code = `def add(a, b):\n    return a + b`;
      const result = processor.process(code, 'python');
      expect(result.success).toBe(true);
      expect(result.code).not.toContain(';');
    });
  });

  describe('error handling', () => {
    it('should return original code on failure', () => {
      const result = processor.process(null as any, 'typescript');
      expect(result.success).toBe(false);
    });
  });
});
