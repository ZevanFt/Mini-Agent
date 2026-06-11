export interface PlaceholderSet {
  normal: string[];
  shell: string[];
}

export const DEFAULT_PLACEHOLDERS: PlaceholderSet = {
  normal: [
    'Fix a TODO in the codebase',
    'What is the tech stack of this project?',
    'Fix broken tests',
    'Explain how this code works',
    'Refactor this function to be more readable',
    'Add error handling to this module',
    'Write unit tests for this component',
    'Optimize this algorithm for better performance',
  ],
  shell: [
    'ls -la',
    'git status',
    'pwd',
    'find . -name "*.ts"',
    'cat package.json',
    'git log --oneline -10',
  ],
};

export function getPlaceholder(mode: 'normal' | 'shell' = 'normal', exclude?: string): string {
  const pool = DEFAULT_PLACEHOLDERS[mode] || DEFAULT_PLACEHOLDERS.normal;
  const available = exclude ? pool.filter(p => p !== exclude) : pool;
  return available[Math.floor(Math.random() * available.length)] || pool[0];
}

export function getPlaceholderByIndex(mode: 'normal' | 'shell', index: number): string {
  const pool = DEFAULT_PLACEHOLDERS[mode] || DEFAULT_PLACEHOLDERS.normal;
  return pool[index % pool.length];
}
