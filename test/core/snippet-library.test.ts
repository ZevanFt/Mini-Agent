import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { SnippetLibrary } from '../../src/core/enhancer/snippet-library.js';
import type { CodeSnippet } from '../../src/core/enhancer/types.js';

describe('SnippetLibrary', () => {
  let library: SnippetLibrary;
  let tempDir: string;

  const mockSnippet: CodeSnippet = {
    id: 'test-func-ts',
    name: 'TypeScript Function Template',
    description: 'A basic TypeScript function with type annotations',
    language: 'typescript',
    category: 'utility',
    code: 'export function {{functionName}}({{params}}): {{returnType}} {\n  {{body}}\n}',
    tags: ['typescript', 'function', 'template'],
    variables: ['functionName', 'params', 'returnType', 'body'],
    usage: 'Use for creating typed TypeScript functions',
    lastModified: '2024-01-01T00:00:00.000Z',
  };

  const mockSnippet2: CodeSnippet = {
    id: 'react-component',
    name: 'React Functional Component',
    description: 'A React functional component with props',
    language: 'typescript',
    category: 'component',
    code: 'import React from "react";\n\ninterface {{componentName}}Props {\n  {{props}}\n}\n\nexport const {{componentName}}: React.FC<{{componentName}}Props> = (props) => {\n  return <div>{{content}}</div>;\n};',
    tags: ['react', 'component', 'functional', 'typescript'],
    variables: ['componentName', 'props', 'content'],
    usage: 'Use for creating React functional components with typed props',
    lastModified: '2024-01-02T00:00:00.000Z',
  };

  const mockSnippet3: CodeSnippet = {
    id: 'python-class',
    name: 'Python Class Template',
    description: 'A basic Python class with init method',
    language: 'python',
    category: 'class',
    code: 'class {{className}}:\n    def __init__(self, {{params}}):\n        {{init_body}}\n    \n    def {{method_name}}(self) -> {{return_type}}:\n        {{method_body}}',
    tags: ['python', 'class', 'oop'],
    variables: ['className', 'params', 'init_body', 'method_name', 'return_type', 'method_body'],
    usage: 'Use for creating Python classes with type hints',
    lastModified: '2024-01-03T00:00:00.000Z',
  };

  beforeEach(() => {
    tempDir = path.join(__dirname, '..', '..', 'temp-snippets-test');
    fs.mkdirSync(tempDir, { recursive: true });
    library = new SnippetLibrary(tempDir);
  });

  afterEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe('CRUD Operations', () => {
    it('should add a new snippet', () => {
      library.addSnippet(mockSnippet);
      const retrieved = library.getSnippet(mockSnippet.id);
      expect(retrieved?.id).toBe(mockSnippet.id);
      expect(retrieved?.name).toBe(mockSnippet.name);
      expect(retrieved?.description).toBe(mockSnippet.description);
      expect(retrieved?.language).toBe(mockSnippet.language);
      expect(retrieved?.category).toBe(mockSnippet.category);
      expect(retrieved?.code).toBe(mockSnippet.code);
      expect(retrieved?.tags).toEqual(mockSnippet.tags);
      expect(retrieved?.variables).toEqual(mockSnippet.variables);
    });

    it('should update an existing snippet', () => {
      library.addSnippet(mockSnippet);
      library.updateSnippet(mockSnippet.id, {
        name: 'Updated Name',
        description: 'Updated description',
      });
      const updated = library.getSnippet(mockSnippet.id);
      expect(updated?.name).toBe('Updated Name');
      expect(updated?.description).toBe('Updated description');
    });

    it('should return false when updating non-existent snippet', () => {
      const result = library.updateSnippet('non-existent', { name: 'Test' });
      expect(result).toBe(false);
    });

    it('should delete a snippet', () => {
      library.addSnippet(mockSnippet);
      expect(library.deleteSnippet(mockSnippet.id)).toBe(true);
      expect(library.getSnippet(mockSnippet.id)).toBeUndefined();
    });

    it('should return false when deleting non-existent snippet', () => {
      expect(library.deleteSnippet('non-existent')).toBe(false);
    });

    it('should get all snippets', () => {
      library.addSnippet(mockSnippet);
      library.addSnippet(mockSnippet2);
      library.addSnippet(mockSnippet3);
      expect(library.getAllSnippets()).toHaveLength(3);
    });

    it('should warn when adding duplicate snippet', () => {
      library.addSnippet(mockSnippet);
      library.addSnippet(mockSnippet);
      expect(library.getAllSnippets()).toHaveLength(1);
    });

    it('should update lastModified on add and update', async () => {
      const snippetToAdd = { ...mockSnippet };
      library.addSnippet(snippetToAdd);
      const added = library.getSnippet(mockSnippet.id);
      expect(added?.lastModified).not.toBe(snippetToAdd.lastModified);

      await new Promise((r) => setTimeout(r, 10));
      library.updateSnippet(mockSnippet.id, { name: 'New Name' });
      const updated = library.getSnippet(mockSnippet.id);
      expect(updated?.lastModified).not.toBe(added?.lastModified);
    });
  });

  describe('Search and Filter', () => {
    beforeEach(() => {
      library.addSnippet(mockSnippet);
      library.addSnippet(mockSnippet2);
      library.addSnippet(mockSnippet3);
    });

    it('should filter by language', () => {
      const typescriptSnippets = library.searchSnippets({ language: 'typescript' });
      expect(typescriptSnippets).toHaveLength(2);
      expect(typescriptSnippets.every((s) => s.language === 'typescript')).toBe(true);
    });

    it('should filter by language case-insensitively', () => {
      const results = library.searchSnippets({ language: 'Python' });
      expect(results).toHaveLength(1);
      expect(results[0].id).toBe('python-class');
    });

    it('should filter by category', () => {
      const utilitySnippets = library.searchSnippets({ category: 'utility' });
      expect(utilitySnippets).toHaveLength(1);
      expect(utilitySnippets[0].id).toBe('test-func-ts');
    });

    it('should filter by tags', () => {
      const reactSnippets = library.searchSnippets({ tags: ['react'] });
      expect(reactSnippets).toHaveLength(1);
      expect(reactSnippets[0].id).toBe('react-component');
    });

    it('should filter by multiple tags (OR logic)', () => {
      const results = library.searchSnippets({ tags: ['react', 'python'] });
      expect(results.length).toBeGreaterThanOrEqual(2);
    });

    it('should filter by text query', () => {
      const results = library.searchSnippets({ query: 'function' });
      expect(results.length).toBeGreaterThanOrEqual(1);
      expect(results.some((s) => s.id === 'test-func-ts')).toBe(true);
    });

    it('should combine multiple filters', () => {
      const results = library.searchSnippets({
        language: 'typescript',
        category: 'component',
      });
      expect(results).toHaveLength(1);
      expect(results[0].id).toBe('react-component');
    });

    it('should return empty array when no matches', () => {
      const results = library.searchSnippets({ language: 'rust' });
      expect(results).toHaveLength(0);
    });

    it('should return all snippets when no filters provided', () => {
      const results = library.searchSnippets({});
      expect(results).toHaveLength(3);
    });
  });

  describe('Intelligent Matching (findBestMatches)', () => {
    beforeEach(() => {
      library.addSnippet(mockSnippet);
      library.addSnippet(mockSnippet2);
      library.addSnippet(mockSnippet3);
    });

    it('should match snippets by name', () => {
      const matches = library.findBestMatches('I need a TypeScript function');
      expect(matches.length).toBeGreaterThan(0);
      expect(matches[0].snippet.id).toBe('test-func-ts');
      expect(matches[0].matchReasons).toContain('name match');
    });

    it('should match snippets by tags', () => {
      const matches = library.findBestMatches('react component');
      expect(matches.length).toBeGreaterThan(0);
      expect(matches[0].snippet.id).toBe('react-component');
    });

    it('should match snippets by category', () => {
      const matches = library.findBestMatches('python class');
      expect(matches.length).toBeGreaterThan(0);
      expect(matches[0].snippet.id).toBe('python-class');
    });

    it('should return scored results sorted by score', () => {
      const matches = library.findBestMatches('typescript function utility');
      for (let i = 1; i < matches.length; i++) {
        expect(matches[i - 1].score).toBeGreaterThanOrEqual(matches[i].score);
      }
    });

    it('should respect the limit parameter', () => {
      const matches = library.findBestMatches('code', 1);
      expect(matches.length).toBeLessThanOrEqual(1);
    });

    it('should return empty array for non-matching request', () => {
      const matches = library.findBestMatches('xyznonexistent');
      expect(matches).toHaveLength(0);
    });

    it('should include language match bonus', () => {
      const matches = library.findBestMatches('I need typescript code');
      const tsMatches = matches.filter((m) => m.snippet.language === 'typescript');
      expect(tsMatches.length).toBeGreaterThan(0);
    });

    it('should provide match reasons', () => {
      const matches = library.findBestMatches('typescript function');
      expect(matches[0].matchReasons.length).toBeGreaterThan(0);
    });
  });

  describe('Variable Substitution (renderSnippet)', () => {
    beforeEach(() => {
      library.addSnippet(mockSnippet);
    });

    it('should replace all template variables', () => {
      const rendered = library.renderSnippet(mockSnippet.id, {
        functionName: 'getUser',
        params: 'id: number',
        returnType: 'User',
        body: '  return fetchUser(id);',
      });

      expect(rendered).toBeDefined();
      expect(rendered).toContain('export function getUser(id: number): User');
      expect(rendered).toContain('  return fetchUser(id);');
    });

    it('should return undefined for non-existent snippet', () => {
      const rendered = library.renderSnippet('non-existent', {});
      expect(rendered).toBeUndefined();
    });

    it('should handle partial variable replacement', () => {
      const rendered = library.renderSnippet(mockSnippet.id, {
        functionName: 'partialFunc',
      });

      expect(rendered).toBeDefined();
      expect(rendered).toContain('partialFunc');
      expect(rendered).toContain('{{params}}');
    });

    it('should handle empty variables object', () => {
      const rendered = library.renderSnippet(mockSnippet.id, {});
      expect(rendered).toBe(mockSnippet.code);
    });

    it('should preserve code structure after replacement', () => {
      const rendered = library.renderSnippet(mockSnippet.id, {
        functionName: 'testFunc',
        params: 'a: string, b: number',
        returnType: 'boolean',
        body: '  return a.length === b;',
      });

      expect(rendered).toMatch(/export function testFunc\(a: string, b: number\): boolean/);
      expect(rendered).toContain('return a.length === b;');
    });

    it('should warn about unmatched variables', () => {
      const rendered = library.renderSnippet(mockSnippet.id, {
        functionName: 'test',
      });
      expect(rendered).toContain('{{params}}');
      expect(rendered).toContain('{{returnType}}');
    });
  });

  describe('Import/Export', () => {
    let exportPath: string;

    beforeEach(() => {
      exportPath = path.join(tempDir, 'exports', 'test-library.json');
      library.addSnippet(mockSnippet);
      library.addSnippet(mockSnippet2);
    });

    it('should export library to JSON file', () => {
      const result = library.exportLibrary(exportPath);
      expect(result).toBe(true);
      expect(fs.existsSync(exportPath)).toBe(true);

      const content = JSON.parse(fs.readFileSync(exportPath, 'utf-8'));
      expect(content.version).toBe('1.0.0');
      expect(content.snippets).toHaveLength(2);
      expect(content.exportedAt).toBeDefined();
    });

    it('should create directory if it does not exist during export', () => {
      const nestedPath = path.join(tempDir, 'deep', 'nested', 'dir', 'export.json');
      const result = library.exportLibrary(nestedPath);
      expect(result).toBe(true);
      expect(fs.existsSync(nestedPath)).toBe(true);
    });

    it('should import snippets from exported file', () => {
      library.exportLibrary(exportPath);

      const newLibrary = new SnippetLibrary(path.join(tempDir, 'new-dir'));
      const imported = newLibrary.importLibrary(exportPath);
      expect(imported).toBe(2);
      expect(newLibrary.getAllSnippets()).toHaveLength(2);
    });

    it('should not overwrite existing snippets by default', () => {
      library.exportLibrary(exportPath);

      const newLibrary = new SnippetLibrary(path.join(tempDir, 'new-dir'));
      newLibrary.addSnippet(mockSnippet);
      const imported = newLibrary.importLibrary(exportPath);
      expect(imported).toBe(1);
      expect(newLibrary.getAllSnippets()).toHaveLength(2);
    });

    it('should overwrite existing snippets when overwrite=true', () => {
      library.exportLibrary(exportPath);

      const newLibrary = new SnippetLibrary(path.join(tempDir, 'new-dir'));
      const modifiedSnippet = { ...mockSnippet, name: 'Original Modified' };
      newLibrary.addSnippet(modifiedSnippet);
      const imported = newLibrary.importLibrary(exportPath, true);
      expect(imported).toBe(2);
      expect(newLibrary.getSnippet(mockSnippet.id)?.name).toBe(mockSnippet.name);
    });

    it('should return 0 for invalid JSON file', () => {
      const invalidPath = path.join(tempDir, 'invalid.json');
      fs.writeFileSync(invalidPath, 'not valid json', 'utf-8');
      const imported = library.importLibrary(invalidPath);
      expect(imported).toBe(0);
    });

    it('should return 0 for non-existent file', () => {
      const imported = library.importLibrary('/non-existent/path.json');
      expect(imported).toBe(0);
    });

    it('should return 0 for invalid library format', () => {
      const invalidPath = path.join(tempDir, 'invalid-format.json');
      fs.writeFileSync(invalidPath, '{"not": "snippets"}', 'utf-8');
      const imported = library.importLibrary(invalidPath);
      expect(imported).toBe(0);
    });

    it('should skip invalid snippets during import', () => {
      const partialExportPath = path.join(tempDir, 'partial.json');
      const partialData = {
        version: '1.0.0',
        exportedAt: new Date().toISOString(),
        snippets: [
          { id: 'valid', name: 'Valid', description: 'desc', language: 'ts', category: 'util', code: 'code', tags: [], variables: [], usage: '' },
          { name: 'Missing ID', description: 'desc' },
        ],
      };
      fs.writeFileSync(partialExportPath, JSON.stringify(partialData, null, 2), 'utf-8');

      const imported = library.importLibrary(partialExportPath);
      expect(imported).toBe(1);
    });
  });

  describe('Directory Loading', () => {
    it('should load snippets from JSON files', async () => {
      const jsonSnippet = {
        ...mockSnippet,
        id: 'json-test',
      };
      fs.writeFileSync(
        path.join(tempDir, 'json-test.snippet.json'),
        JSON.stringify(jsonSnippet, null, 2),
        'utf-8'
      );

      const loaded = await library.loadFromDirectory();
      expect(loaded).toBe(1);
      expect(library.getSnippet('json-test')).toBeDefined();
    });

    it('should load snippets from Markdown files', async () => {
      const mdContent = `---
id: md-test
name: Markdown Test
description: A markdown snippet
language: python
category: utility
tags: python, test
variables: name, value
usage: Use this for testing
---
def hello_{{name}}():
    print("Hello, {{name}}!")
    return {{value}}
`;
      fs.writeFileSync(path.join(tempDir, 'md-test.snippet.md'), mdContent, 'utf-8');

      const loaded = await library.loadFromDirectory();
      expect(loaded).toBe(1);
      const loadedSnippet = library.getSnippet('md-test');
      expect(loadedSnippet).toBeDefined();
      expect(loadedSnippet?.name).toBe('Markdown Test');
      expect(loadedSnippet?.language).toBe('python');
      expect(loadedSnippet?.variables).toContain('name');
    });

    it('should create directory if it does not exist', async () => {
      const newDir = path.join(tempDir, 'new-subdir');
      const newLibrary = new SnippetLibrary(newDir);
      const loaded = await newLibrary.loadFromDirectory();
      expect(loaded).toBe(0);
      expect(fs.existsSync(newDir)).toBe(true);
    });

    it('should recursively search subdirectories', async () => {
      const subDir = path.join(tempDir, 'subdir');
      fs.mkdirSync(subDir, { recursive: true });

      const jsonSnippet = {
        ...mockSnippet,
        id: 'subdir-test',
      };
      fs.writeFileSync(
        path.join(subDir, 'subdir-test.snippet.json'),
        JSON.stringify(jsonSnippet, null, 2),
        'utf-8'
      );

      const loaded = await library.loadFromDirectory();
      expect(loaded).toBe(1);
      expect(library.getSnippet('subdir-test')).toBeDefined();
    });

    it('should ignore files without correct extension', async () => {
      fs.writeFileSync(
        path.join(tempDir, 'invalid.txt'),
        JSON.stringify(mockSnippet, null, 2),
        'utf-8'
      );
      fs.writeFileSync(
        path.join(tempDir, 'invalid.json'),
        JSON.stringify(mockSnippet, null, 2),
        'utf-8'
      );

      const loaded = await library.loadFromDirectory();
      expect(loaded).toBe(0);
    });

    it('should skip invalid JSON files gracefully', async () => {
      fs.writeFileSync(path.join(tempDir, 'invalid.snippet.json'), 'not valid json', 'utf-8');
      const loaded = await library.loadFromDirectory();
      expect(loaded).toBe(0);
    });

    it('should auto-detect variables from code if not specified in markdown', async () => {
      const mdContent = `---
id: auto-var-test
name: Auto Variable Detection
description: Tests auto variable extraction
language: javascript
category: utility
---
function greet({{userName}}, {{greeting}}) {
  console.log(\`\${{{greeting}}}, {{{userName}}}!\`);
}
`;
      fs.writeFileSync(path.join(tempDir, 'auto-var-test.snippet.md'), mdContent, 'utf-8');

      await library.loadFromDirectory();
      const snippet = library.getSnippet('auto-var-test');
      expect(snippet?.variables).toContain('userName');
      expect(snippet?.variables).toContain('greeting');
    });
  });

  describe('Statistics', () => {
    beforeEach(() => {
      library.addSnippet(mockSnippet);
      library.addSnippet(mockSnippet2);
      library.addSnippet(mockSnippet3);
    });

    it('should return correct total count', () => {
      const stats = library.getStats();
      expect(stats.total).toBe(3);
    });

    it('should group snippets by language', () => {
      const stats = library.getStats();
      expect(stats.byLanguage['typescript']).toBe(2);
      expect(stats.byLanguage['python']).toBe(1);
    });

    it('should group snippets by category', () => {
      const stats = library.getStats();
      expect(stats.byCategory['utility']).toBe(1);
      expect(stats.byCategory['component']).toBe(1);
      expect(stats.byCategory['class']).toBe(1);
    });

    it('should count tag usage', () => {
      const stats = library.getStats();
      expect(stats.topTags['typescript']).toBe(2);
      expect(stats.topTags['react']).toBe(1);
      expect(stats.topTags['python']).toBe(1);
    });

    it('should handle empty library', () => {
      const emptyLibrary = new SnippetLibrary(path.join(tempDir, 'empty'));
      const stats = emptyLibrary.getStats();
      expect(stats.total).toBe(0);
      expect(stats.byLanguage).toEqual({});
      expect(stats.byCategory).toEqual({});
      expect(stats.topTags).toEqual({});
    });
  });

  describe('Edge Cases', () => {
    it('should handle snippets with special characters in variables', () => {
      const specialSnippet: CodeSnippet = {
        id: 'special-chars',
        name: 'Special Characters Test',
        description: 'Tests special characters in variable names',
        language: 'javascript',
        category: 'utility',
        code: 'const {{myVar_123}} = "{{escaped\\"quote}}";',
        tags: ['special'],
        variables: ['myVar_123'],
        usage: 'Edge case test',
        lastModified: '2024-01-01T00:00:00.000Z',
      };
      library.addSnippet(specialSnippet);

      const rendered = library.renderSnippet('special-chars', {
        myVar_123: 'hello',
      });
      expect(rendered).toContain("const hello =");
    });

    it('should handle findBestMatches with empty library', () => {
      const emptyLibrary = new SnippetLibrary(path.join(tempDir, 'empty'));
      const matches = emptyLibrary.findBestMatches('anything');
      expect(matches).toHaveLength(0);
    });

    it('should handle search with empty query string', () => {
      library.addSnippet(mockSnippet);
      const results = library.searchSnippets({ query: '' });
      expect(results).toHaveLength(1);
    });

    it('should handle renderSnippet with special regex characters in variable names', () => {
      const regexSnippet: CodeSnippet = {
        id: 'regex-test',
        name: 'Regex Test',
        description: 'Tests regex character escaping',
        language: 'javascript',
        category: 'utility',
        code: 'const x = "{{value}}";',
        tags: ['test'],
        variables: ['value'],
        usage: 'Test',
        lastModified: '2024-01-01T00:00:00.000Z',
      };
      library.addSnippet(regexSnippet);

      const rendered = library.renderSnippet('regex-test', {
        value: 'test.*value+with?regex[chars]',
      });
      expect(rendered).toContain('test.*value+with?regex[chars]');
    });
  });
});
