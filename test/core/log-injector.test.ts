import { describe, it, expect } from 'vitest';
import { LogInjector } from '../../src/core/log-injector.js';

describe('LogInjector', () => {
  const injector = new LogInjector();

  describe('JavaScript/TypeScript injection', () => {
    it('should inject logs into simple functions', () => {
      const code = `
function greet(name) {
  return \`Hello, \${name}\`;
}
`;
      const result = injector.inject(code, 'typescript');
      expect(result).toContain("logger.debug('Entering greet')");
    });

    it('should inject logs into async functions', () => {
      const code = `
async function fetchData(url) {
  const response = await fetch(url);
  return response.json();
}
`;
      const result = injector.inject(code, 'javascript');
      expect(result).toContain('logger.debug');
      expect(result).toContain('Entering');
    });

    it('should inject logs into arrow functions', () => {
      const code = `
const calculate = (a, b) => {
  return a + b;
};
`;
      const result = injector.inject(code, 'typescript');
      expect(result).toContain("logger.debug('Entering calculate')");
    });

    it('should handle multiple functions', () => {
      const code = `
function first() {
  return 1;
}

function second() {
  return 2;
}
`;
      const result = injector.inject(code, 'javascript');
      expect(result).toContain("logger.debug('Entering first')");
      expect(result).toContain("logger.debug('Entering second')");
    });

    it('should return code unchanged if no functions found', () => {
      const code = `const x = 1 + 2;`;
      const result = injector.inject(code, 'typescript');
      expect(result).toBe(code);
    });

    it('should respect config options', () => {
      const code = `
function test() {
  return true;
}
`;
      const result = injector.inject(code, 'javascript', {
        logLevel: 'info',
        includeFunctionEntry: true,
      });
      expect(result).toContain("logger.info('Entering test')");
    });
  });

  describe('Python injection', () => {
    it('should inject logs into Python functions', () => {
      const code = `def greet(name):
    return f"Hello, {name}"
`;
      const result = injector.inject(code, 'python');
      expect(result).toContain("logger.debug('Entering greet')");
    });

    it('should handle async Python functions', () => {
      const code = `async def fetch_data(url):
    response = await requests.get(url)
    return response.json()
`;
      const result = injector.inject(code, 'python');
      expect(result).toContain("logger.debug('Entering fetch_data')");
    });

    it('should handle multiple Python functions', () => {
      const code = `def first():
    return 1

def second():
    return 2
`;
      const result = injector.inject(code, 'python');
      expect(result).toContain("logger.debug('Entering first')");
      expect(result).toContain("logger.debug('Entering second')");
    });

    it('should maintain Python indentation', () => {
      const code = `def my_function():
    x = 1
    return x
`;
      const result = injector.inject(code, 'python');
      const lines = result.split('\n');
      const logLine = lines.find(line => line.includes("logger.debug"));
      expect(logLine).toMatch(/^    logger\.debug/);
    });

    it('should return code unchanged if no functions found', () => {
      const code = `x = 1 + 2`;
      const result = injector.inject(code, 'python');
      expect(result).toBe(code);
    });
  });

  describe('Unsupported languages', () => {
    it('should return code unchanged for unsupported languages', () => {
      const code = `fn main() {}`;
      const result = injector.inject(code, 'rust');
      expect(result).toBe(code);
    });

    it('should handle unknown language gracefully', () => {
      const code = `some code`;
      const result = injector.inject(code, 'unknown');
      expect(result).toBe(code);
    });
  });

  describe('Edge cases', () => {
    it('should handle empty code', () => {
      const result = injector.inject('', 'typescript');
      expect(result).toBe('');
    });

    it('should handle code with no functions', () => {
      const code = `// This is a comment
const x = 1;
console.log(x);`;
      const result = injector.inject(code, 'javascript');
      expect(result).toBe(code);
    });
  });
});
