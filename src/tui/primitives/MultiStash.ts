import { readFile, writeFile, mkdir } from 'fs/promises';
import path from 'path';

export interface MultiStashEntry {
  id: string;
  text: string;
  createdAt: number;
  label?: string;
}

export interface MultiStashState {
  entries: MultiStashEntry[];
  maxEntries: number;
}

export function createMultiStashState(maxEntries = 10): MultiStashState {
  return { entries: [], maxEntries };
}

let stashCounter = 0;
export function stashText(state: MultiStashState, text: string, label?: string): MultiStashState {
  if (!text.trim()) return state;
  const entry: MultiStashEntry = {
    id: `stash-${++stashCounter}-${Date.now()}`,
    text,
    createdAt: Date.now(),
    label,
  };
  const entries = [...state.entries, entry].slice(-state.maxEntries);
  return { ...state, entries };
}

export function popStash(state: MultiStashState, id?: string): { state: MultiStashState; text: string | null } {
  if (state.entries.length === 0) return { state, text: null };
  const targetId = id ?? state.entries[state.entries.length - 1].id;
  const entry = state.entries.find(e => e.id === targetId);
  if (!entry) return { state, text: null };
  return {
    state: { ...state, entries: state.entries.filter(e => e.id !== targetId) },
    text: entry.text,
  };
}

export function peekStash(state: MultiStashState, id?: string): MultiStashEntry | undefined {
  if (id) return state.entries.find(e => e.id === id);
  return state.entries[state.entries.length - 1];
}

export function listStash(state: MultiStashState): MultiStashEntry[] {
  return [...state.entries];
}

export function clearStash(state: MultiStashState): MultiStashState {
  return { ...state, entries: [] };
}

export async function saveMultiStash(cwd: string, state: MultiStashState): Promise<void> {
  const dir = path.join(cwd, '.miniagent', 'history');
  const filePath = path.join(dir, 'tui-stash.json');
  await mkdir(dir, { recursive: true });
  await writeFile(filePath, JSON.stringify(state.entries.slice(-state.maxEntries), null, 2), 'utf8');
}

export async function loadMultiStash(cwd: string): Promise<MultiStashState> {
  const filePath = path.join(cwd, '.miniagent', 'history', 'tui-stash.json');
  try {
    const raw = await readFile(filePath, 'utf8');
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return {
        entries: parsed.filter((e: unknown): e is MultiStashEntry =>
          typeof e === 'object' && e !== null && 'id' in e && 'text' in e
        ).slice(-10),
        maxEntries: 10,
      };
    }
  } catch {
    // Missing is fine
  }
  return createMultiStashState();
}
