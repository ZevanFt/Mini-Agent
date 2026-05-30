import { describe, it, expect } from 'bun:test';
import { CodeEvaluator } from '../../src/core/enhancer/code-evaluator.js';

describe('CodeEvaluator', () => {
  describe('evaluate', () => {
    it('should compare two code samples and return a report', async () => {
      const codeA = `function add(a, b) { return a + b; }`;
      const codeB = `
/**
 * Add two numbers with validation.
 */
function add(a, b) {
  if (typeof a !== 'number' || typeof b !== 'number') {
    throw new TypeError('Arguments must be numbers');
  }
  return a + b;
}
`;
      const evaluator = new CodeEvaluator({} as any);
      const report = await evaluator.evaluate(codeA, codeB, 'javascript');
      
      expect(report.codeAScore).toBeGreaterThan(0);
      expect(report.codeBScore).toBeGreaterThan(0);
      expect(report.breakdown.length).toBe(6);
      expect(['A', 'B', 'tie']).toContain(report.winner);
    });

    it('should identify codeB as better when it has more features', async () => {
      const codeA = `function divide(a, b) { return a / b; }`;
      const codeB = `
/**
 * Safely divide two numbers.
 * @returns {number|null} Result or null on error
 */
function divide(a, b) {
  if (typeof a !== 'number' || typeof b !== 'number') return null;
  if (b === 0) return null;
  return a / b;
}
`;
      const evaluator = new CodeEvaluator({} as any);
      const report = await evaluator.evaluate(codeA, codeB, 'javascript');
      expect(report.codeBScore).toBeGreaterThan(report.codeAScore);
    });

    it('should detect security issues in both codes', async () => {
      const codeA = `function run(input) { return eval(input); }`;
      const codeB = `function run(input) { return new Function('return ' + input)(); }`;
      const evaluator = new CodeEvaluator({} as any);
      const report = await evaluator.evaluate(codeA, codeB, 'javascript');
      expect(report.breakdown.some(b => b.criterion === 'security')).toBe(true);
    });

    it('should return tie for equivalent code', async () => {
      const codeA = `function sum(a, b) { return a + b; }`;
      const codeB = `function sum(a, b) { return a + b; }`;
      const evaluator = new CodeEvaluator({} as any);
      const report = await evaluator.evaluate(codeA, codeB, 'javascript');
      expect(report.winner).toBe('tie');
    });

    it('should score error handling positively', async () => {
      const goodCode = `
function process(data) {
  try {
    if (!data) throw new Error('No data');
    return data.map(x => x * 2);
  } catch (err) {
    console.error('Process failed:', err);
    return [];
  }
}
`;
      const badCode = `function process(data) { return data.map(x => x * 2); }`;
      const evaluator = new CodeEvaluator({} as any);
      const report = await evaluator.evaluate(badCode, goodCode, 'javascript');
      expect(report.breakdown.some(b => b.criterion === 'robustness')).toBe(true);
    });

    it('should evaluate Python code correctly', async () => {
      const codeA = `def divide(a, b):\n    return a / b`;
      const codeB = `def divide(a, b):\n    """Safely divide two numbers."""\n    if b == 0: return None\n    return a / b`;
      const evaluator = new CodeEvaluator({} as any);
      const report = await evaluator.evaluate(codeA, codeB, 'python');
      expect(report.breakdown.length).toBe(6);
      expect(report.codeBScore).toBeGreaterThanOrEqual(report.codeAScore);
    });
  });
});
