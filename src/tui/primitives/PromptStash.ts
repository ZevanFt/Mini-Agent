// Prompt stash: save/restore drafts for later use
import { readFile, writeFile, mkdir } from 'fs/promises';
import path from 'path';

export interface StashEntry {
  id: string;
  text: string;
  timestamp: number;
  lineCount: number;
}

export interface PromptStashState {
  entries: StashEntry[];
}

export function createPromptStashState(): PromptStashState {
  return { entries: [] };
}

export function addStash(state: PromptStashState, text: string): PromptStashState {
  if (!text.trim()) return state;
  const entry: StashEntry = {
    id: `stash-${Date.now()}`,
    text,
    timestamp: Date.now(),
    lineCount: text.split('\n').length,
  };
  return { ...state, entries: [...state.entries, entry] };
}

export function removeStash(state: PromptStashState, id: string): PromptStashState {
  return { ...state, entries: state.entries.filter(e => e.id !== id) };
}

export function getStash(state: PromptStashState, id: string): StashEntry | null {
  return state.entries.find(e => e.id === id) || null;
}

export function formatStashTime(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

// Persistence
export async function loadPromptStash(stashPath: string): Promise<PromptStashState> {
  try {
    const data = await readFile(stashPath, 'utf8');
    return JSON.parse(data);
  } catch {
    return createPromptStashState();
  }
}

export async function savePromptStash(stashPath: string, state: PromptStashState): Promise<void> {
  await mkdir(path.dirname(stashPath), { recursive: true });
  await writeFile(stashPath, JSON.stringify(state, null, 2), 'utf8');
}
