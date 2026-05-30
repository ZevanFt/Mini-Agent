import { describe, it, expect } from 'bun:test';
import { SnippetExtractor } from '../../src/core/enhancer/snippet-extractor.js';

describe('SnippetExtractor', () => {
  describe('TypeScript extraction', () => {
    it('should extract function definitions', async () => {
      const code = `
import { logger } from './logger.js';

export function add(a: number, b: number): number {
  return a + b;
}

export function subtract(a: number, b: number): number {
  return a - b;
}
`;
      const extractor = new SnippetExtractor({} as any);
      const snippets = await extractor.extractSnippets(code, 'typescript');
      expect(snippets.length).toBeGreaterThanOrEqual(2);
      const names = snippets.map(s => s.name);
      expect(names).toContain('add');
      expect(names).toContain('subtract');
    });

    it('should extract class definitions', async () => {
      const code = `
export class Calculator {
  add(a: number, b: number): number {
    return a + b;
  }
}
export interface CalculatorOptions {
  precision: number;
}
`;
      const extractor = new SnippetExtractor({} as any);
      const snippets = await extractor.extractSnippets(code, 'typescript');
      expect(snippets.length).toBeGreaterThanOrEqual(1);
      const types = snippets.map(s => s.type);
      expect(types).toContain('class');
    });

    it('should extract arrow functions', async () => {
      const code = `export const formatName = (first: string, last: string): string => {
  return \`\${first} \${last}\`;
};`;
      const extractor = new SnippetExtractor({} as any);
      const snippets = await extractor.extractSnippets(code, 'typescript');
      expect(snippets.length).toBeGreaterThanOrEqual(1);
      expect(snippets[0].name).toBe('formatName');
    });

    it('should extract hooks', async () => {
      const code = `export const useCounter = (initial: number) => {
  const [count, setCount] = useState(initial);
  return { count, increment: () => setCount(c => c + 1) };
};`;
      const extractor = new SnippetExtractor({} as any);
      const snippets = await extractor.extractSnippets(code, 'typescript');
      expect(snippets.length).toBeGreaterThanOrEqual(1);
      expect(snippets.some(s => s.type === 'hook')).toBe(true);
    });
  });

  describe('Python extraction', () => {
    it('should extract function definitions', async () => {
      const code = `
import logging
def add(a, b):
    return a + b
def subtract(a, b):
    return a - b
`;
      const extractor = new SnippetExtractor({} as any);
      const snippets = await extractor.extractSnippets(code, 'python');
      expect(snippets.length).toBeGreaterThanOrEqual(2);
      const names = snippets.map(s => s.name);
      expect(names).toContain('add');
      expect(names).toContain('subtract');
    });

    it('should extract class definitions', async () => {
      const code = `
class Calculator:
    def __init__(self):
        self.history = []
    def add(self, a, b):
        return a + b
`;
      const extractor = new SnippetExtractor({} as any);
      const snippets = await extractor.extractSnippets(code, 'python');
      expect(snippets.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('dependency extraction', () => {
    it('should extract TypeScript/JS dependencies from code with imports', async () => {
      const code = `import React from 'react';
import axios from 'axios';

export function fetchData() { return axios.get('/api/data'); }

export function postData(url, data) { return axios.post(url, data); }
`;
      const extractor = new SnippetExtractor({} as any);
      const snippets = await extractor.extractSnippets(code, 'typescript');
      expect(snippets.length).toBeGreaterThanOrEqual(1);
      // Dependencies should be extracted from the file, not just function scope
      const allDeps = snippets.flatMap(s => s.dependencies);
      expect(allDeps.length).toBeGreaterThan(0);
    });

    it('should extract Python dependencies', async () => {
      const code = `import os
import sys
from pathlib import Path

def list_files():
    return os.listdir('.')

def get_env(name):
    return os.environ.get(name)
`;
      const extractor = new SnippetExtractor({} as any);
      const snippets = await extractor.extractSnippets(code, 'python');
      expect(snippets.length).toBeGreaterThanOrEqual(2);
      // Dependencies should be extracted from the file, not just function scope
      const allDeps = snippets.flatMap(s => s.dependencies);
      expect(allDeps.length).toBeGreaterThan(0);
    });
  });

  describe('categorization', () => {
    it('should categorize React components as frontend', async () => {
      const code = `
import React, { useState } from 'react';
export const Button = ({ label, onClick }) => {
  const [clicked, setClicked] = useState(false);
  return <button onClick={() => { setClicked(true); onClick(); }}>{label}</button>;
};
`;
      const extractor = new SnippetExtractor({} as any);
      const snippets = await extractor.extractSnippets(code, 'typescript');
      if (snippets.length > 0) {
        const categorized = await extractor.categorizeSnippet(snippets[0]);
        expect(categorized.category).toBe('frontend');
        expect(categorized.tags).toContain('react');
      }
    });

    it('should categorize Express routes as backend', async () => {
      const code = `
import express from 'express';
const router = express.Router();
router.get('/api/users', async (req, res) => {
  const users = await db.findAll();
  res.json(users);
});
export default router;
`;
      const extractor = new SnippetExtractor({} as any);
      const snippets = await extractor.extractSnippets(code, 'typescript');
      if (snippets.length > 0) {
        const categorized = await extractor.categorizeSnippet(snippets[0]);
        expect(categorized.category).toBe('backend');
      }
    });

    it('should categorize auth middleware', async () => {
      const code = `
import jwt from 'jsonwebtoken';
export function authenticateToken(req, res, next) {
  const token = req.headers['authorization']?.split(' ')[1];
  if (!token) return res.sendStatus(401);
  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
}
`;
      const extractor = new SnippetExtractor({} as any);
      const snippets = await extractor.extractSnippets(code, 'typescript');
      if (snippets.length > 0) {
        const categorized = await extractor.categorizeSnippet(snippets[0]);
        expect(categorized.category).toBe('middleware');
        expect(categorized.tags).toContain('auth');
      }
    });
  });

  describe('snippet scoring', () => {
    it('should score well-structured code high', async () => {
      const code = `
/**
 * Calculate the sum of two numbers.
 */
export function add(a: number, b: number): number {
  if (typeof a !== 'number' || typeof b !== 'number') {
    throw new TypeError('Arguments must be numbers');
  }
  return a + b;
}
`;
      const extractor = new SnippetExtractor({} as any);
      const snippets = await extractor.extractSnippets(code, 'typescript');
      if (snippets.length > 0) {
        const score = extractor.scoreSnippet(snippets[0]);
        expect(score).toBeGreaterThan(60);
      }
    });

    it('should score minimal code low', async () => {
      const code = `export function noop() { return; }`;
      const extractor = new SnippetExtractor({} as any);
      const snippets = await extractor.extractSnippets(code, 'typescript');
      if (snippets.length > 0) {
        const score = extractor.scoreSnippet(snippets[0]);
        expect(score).toBeLessThan(60);
      }
    });
  });
});
