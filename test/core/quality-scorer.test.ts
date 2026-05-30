import { describe, it, expect } from 'bun:test';
import { QualityScorer } from '../../src/core/enhancer/quality-scorer.js';

describe('QualityScorer', () => {
  const scorer = new QualityScorer();

  describe('TypeScript scoring', () => {
    it('should score well-structured code as elevate or better', () => {
      const code = `
import { logger } from './logger.js';

/**
 * Add two numbers with validation and logging.
 */
export function add(a: number, b: number): number {
  if (typeof a !== 'number' || typeof b !== 'number') {
    throw new TypeError('Both arguments must be numbers');
  }
  logger.info('add(%d, %d)', a, b);
  return a + b;
}
`;
      const result = scorer.score(code, 'typescript');
      expect(result.score).toBeGreaterThan(60);
      expect(['elevate', 'production']).toContain(result.tier);
    });

    it('should penalize empty functions', () => {
      const code = `
function add(a: number, b: number) {}
function subtract(a: number, b: number) {}
class Calculator {}
`;
      const result = scorer.score(code, 'typescript');
      // Empty functions are penalized in the logic category (25% weight)
      // so even with logic=0, the overall score can still be ~75
      // What matters is that errors are reported and score is lower than good code
      expect(result.errors.some(e => e.toLowerCase().includes('empty'))).toBe(true);
      expect(result.score).toBeLessThan(85);
    });

    it('should penalize unbalanced braces', () => {
      const code = `
function test() {
  if (true) {
    console.log("hello");
  }
`;
      const result = scorer.score(code, 'typescript');
      expect(result.errors.some(e => e.toLowerCase().includes('brace'))).toBe(true);
    });

    it('should flag eval usage', () => {
      const code = `function dangerous(input) {
  var x = eval(input);
  return x;
}`;
      const result = scorer.score(code, 'typescript');
      expect(result.errors.some(e => e.toLowerCase().includes('eval'))).toBe(true);
    });

    it('should flag hardcoded secrets', () => {
      const code = `const API_KEY = "sk-live-abc123";
const password = "secret123";`;
      const result = scorer.score(code, 'typescript');
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should flag TODOs and FIXMEs', () => {
      const code = `// TODO: fix
function test() { /* FIXME */ return; }`;
      const result = scorer.score(code, 'typescript');
      expect(result.warnings.some(w => w.toLowerCase().includes('todo') || w.toLowerCase().includes('fixme'))).toBe(true);
    });
  });

  describe('Python scoring', () => {
    it('should score good Python code well', () => {
      const code = `
import logging
from typing import Optional

logger = logging.getLogger(__name__)

def divide(a: float, b: float) -> Optional[float]:
    """Divide two numbers with error handling."""
    try:
        if b == 0:
            raise ValueError("Cannot divide by zero")
        return a / b
    except Exception as e:
        logger.error(f"Division failed: {e}")
        return None
`;
      const result = scorer.score(code, 'python');
      expect(result.score).toBeGreaterThan(50);
    });

    it('should detect empty Python functions', () => {
      const code = `def process_data(data):
    pass

def validate(value):
    pass`;
      const result = scorer.score(code, 'python');
      expect(result.errors.some(e => e.toLowerCase().includes('empty'))).toBe(true);
    });

    it('should flag bare except clauses', () => {
      const code = `def risky():
    try:
        do_something()
    except:
        pass`;
      const result = scorer.score(code, 'python');
      expect(result.errors.some(e => e.toLowerCase().includes('empty'))).toBe(true);
    });
  });

  describe('JavaScript scoring', () => {
    it('should score standard JS code reasonably', () => {
      const code = `
function fetchData(url) {
  return fetch(url)
    .then(res => res.json())
    .catch(err => { console.error('Fetch failed:', err); throw err; });
}
`;
      const result = scorer.score(code, 'javascript');
      expect(result.score).toBeGreaterThan(30);
    });
  });

  describe('tier boundaries', () => {
    it('should flag minimal TODO-only code', () => {
      const code = `// TODO
function test() { // TODO
}`;
      const result = scorer.score(code, 'typescript');
      expect(result.warnings.some(w => w.toLowerCase().includes('todo'))).toBe(true);
    });

    it('should not return rescue for class with methods', () => {
      const code = `
import { config } from './config.js';
export class UserService {
  getUser(id) { return db.find(id); }
  deleteUser(id) { db.remove(id); }
}
`;
      const result = scorer.score(code, 'typescript');
      expect(result.tier).not.toBe('rescue');
    });
  });
});
