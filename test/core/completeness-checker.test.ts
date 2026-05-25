import { describe, it, expect } from 'vitest';
import { CompletenessChecker } from '../../src/core/completeness-checker.js';

describe('CompletenessChecker', () => {
  const checker = new CompletenessChecker();

  describe('checkCode - TypeScript/JavaScript', () => {
    it('should pass for well-formed code', async () => {
      const code = `
        export function add(a: number, b: number): number {
          return a + b;
        }
      `;
      const result = await checker.checkCode(code, 'typescript');
      expect(result.summary.failed).toBe(0);
    });

    it('should detect bracket mismatch', async () => {
      const code = `
        export function test() {
          console.log("hello";
        }
      `;
      const result = await checker.checkCode(code, 'typescript');
      const failed = result.results.filter(r => !r.passed && r.severity === 'error');
      expect(failed.length).toBeGreaterThan(0);
    });

    it('should detect eval usage', async () => {
      const code = `
        export function test() {
          eval("alert(1)");
        }
      `;
      const result = await checker.checkCode(code, 'typescript');
      const failed = result.results.filter(r => !r.passed && r.severity === 'error');
      expect(failed.length).toBeGreaterThan(0);
    });

    it('should detect hardcoded secrets', async () => {
      const code = `
        const password = "super_secret_123";
      `;
      const result = await checker.checkCode(code, 'javascript');
      const failed = result.results.filter(r => !r.passed && r.severity === 'error');
      expect(failed.length).toBeGreaterThan(0);
    });

    it('should detect TODOs as warnings', async () => {
      const code = `
        // TODO: fix this later
        export function test() {}
      `;
      const result = await checker.checkCode(code, 'typescript');
      const warnings = result.results.filter(r => r.severity === 'warning');
      expect(warnings.length).toBeGreaterThan(0);
    });
  });

  describe('checkCode - Python', () => {
    it('should pass for well-formed Python code', async () => {
      const code = `
def add(a, b):
    return a + b

if __name__ == '__main__':
    print(add(1, 2))
`;
      const result = await checker.checkCode(code, 'python');
      expect(result.summary.failed).toBe(0);
    });

    it('should detect inconsistent indentation', async () => {
      const code = `
def test():
    print("hello")
   print("world")
`;
      const result = await checker.checkCode(code, 'python');
      const failed = result.results.filter(r => !r.passed && r.severity === 'error');
      expect(failed.length).toBeGreaterThan(0);
    });

    it('should detect main function not called', async () => {
      const code = `
def main():
    print("hello")
`;
      const result = await checker.checkCode(code, 'python');
      const warnings = result.results.filter(r => r.severity === 'warning');
      expect(warnings.length).toBeGreaterThan(0);
    });
  });
});
