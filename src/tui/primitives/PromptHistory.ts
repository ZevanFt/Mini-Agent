import { readFile, writeFile, mkdir } from 'fs/promises';
import path from 'path';

export interface PromptHistoryState {
  entries: string[];
  index: number | null;
  stash: string | null;
  maxEntries: number;
}

export function createPromptHistoryState(maxEntries = 100): PromptHistoryState {
  return { entries: [], index: null, stash: null, maxEntries };
}

export function pushEntry(state: PromptHistoryState, text: string): PromptHistoryState {
  if (!text.trim()) return state;
  const last = state.entries[state.entries.length - 1];
  if (last === text) return state;
  const entries = [...state.entries, text].slice(-state.maxEntries);
  return { ...state, entries, index: null };
}

export function navigateUp(state: PromptHistoryState): PromptHistoryState {
  if (state.entries.length === 0) return state;
  const nextIndex = state.index === null
    ? state.entries.length - 1
    : Math.max(0, state.index - 1);
  return { ...state, index: nextIndex };
}

export function navigateDown(state: PromptHistoryState): PromptHistoryState {
  if (state.index === null) return state;
  const nextIndex = state.index + 1;
  if (nextIndex >= state.entries.length) {
    return { ...state, index: null };
  }
  return { ...state, index: nextIndex };
}

export function currentEntry(state: PromptHistoryState): string | null {
  if (state.index === null) return null;
  return state.entries[state.index] ?? null;
}

export function stashText(state: PromptHistoryState, text: string): PromptHistoryState {
  if (!text.trim()) return state;
  return { ...state, stash: text };
}

export function popStash(state: PromptHistoryState): { state: PromptHistoryState; text: string | null } {
  return {
    state: { ...state, stash: null },
    text: state.stash,
  };
}

export function clearInput(): { inputLines: string[]; cursorRow: number; cursorCol: number } {
  return { inputLines: [''], cursorRow: 0, cursorCol: 0 };
}

export interface PromptHistoryPersistence {
  historyPath: string;
  stashPath: string;
}

export function getPaths(cwd: string): PromptHistoryPersistence {
  const dir = path.join(cwd, '.miniagent', 'history');
  return {
    historyPath: path.join(dir, 'tui-prompts.json'),
    stashPath: path.join(dir, 'tui-draft.txt'),
  };
}

export async function loadHistory(cwd: string): Promise<PromptHistoryState> {
  const paths = getPaths(cwd);
  let entries: string[] = [];
  let stash: string | null = null;

  try {
    const raw = await readFile(paths.historyPath, 'utf8');
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      entries = parsed.filter((item: unknown): item is string => typeof item === 'string').slice(-100);
    }
  } catch {
    // Missing history is fine
  }

  try {
    const raw = await readFile(paths.stashPath, 'utf8');
    if (raw.trim()) stash = raw;
  } catch {
    // Missing stash is fine
  }

  return { entries, index: null, stash, maxEntries: 100 };
}

export async function saveHistory(cwd: string, state: PromptHistoryState): Promise<void> {
  const paths = getPaths(cwd);
  await mkdir(path.dirname(paths.historyPath), { recursive: true });
  await writeFile(paths.historyPath, JSON.stringify(state.entries.slice(-100), null, 2), 'utf8');
}

export async function saveStash(cwd: string, stash: string | null): Promise<void> {
  const paths = getPaths(cwd);
  await mkdir(path.dirname(paths.stashPath), { recursive: true });
  await writeFile(paths.stashPath, stash || '', 'utf8');
}
