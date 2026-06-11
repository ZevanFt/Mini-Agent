import { readFile, writeFile, mkdir } from 'fs/promises';
import path from 'path';

export interface FrecencyEntry {
  id: string;
  path: string;
  frequency: number;
  lastUsed: number;
}

export interface FrecencyState {
  entries: Map<string, FrecencyEntry>;
  maxEntries: number;
}

export function createFrecencyState(maxEntries = 1000): FrecencyState {
  return { entries: new Map(), maxEntries };
}

export function recordUse(state: FrecencyState, id: string, filePath: string): FrecencyState {
  const existing = state.entries.get(id);
  const entry: FrecencyEntry = {
    id,
    path: filePath,
    frequency: (existing?.frequency ?? 0) + 1,
    lastUsed: Date.now(),
  };
  const entries = new Map(state.entries);
  entries.set(id, entry);

  // Evict oldest if over limit
  if (entries.size > state.maxEntries) {
    const sorted = [...entries.values()].sort((a, b) => a.lastUsed - b.lastUsed);
    for (let i = 0; i < sorted.length - state.maxEntries; i++) {
      entries.delete(sorted[i].id);
    }
  }

  return { ...state, entries };
}

export function scoreFrecency(entry: FrecencyEntry): number {
  const daysSinceLastUse = (Date.now() - entry.lastUsed) / (1000 * 60 * 60 * 24);
  return entry.frequency / (1 + daysSinceLastUse);
}

export function rankByFrecency(state: FrecencyState, ids: string[]): string[] {
  const scored = ids.map(id => {
    const entry = state.entries.get(id);
    return { id, score: entry ? scoreFrecency(entry) : 0 };
  });
  return scored.sort((a, b) => b.score - a.score).map(s => s.id);
}

export async function saveFrecency(state: FrecencyState, storePath: string): Promise<void> {
  const entries = [...state.entries.values()];
  await mkdir(path.dirname(storePath), { recursive: true });
  await writeFile(storePath, JSON.stringify(entries, null, 2), 'utf8');
}

export async function loadFrecency(storePath: string, maxEntries = 1000): Promise<FrecencyState> {
  try {
    const raw = await readFile(storePath, 'utf8');
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return createFrecencyState(maxEntries);
    const entries = new Map<string, FrecencyEntry>();
    for (const item of parsed) {
      if (item && typeof item === 'object' && 'id' in item && 'path' in item) {
        entries.set((item as FrecencyEntry).id, item as FrecencyEntry);
      }
    }
    return { entries, maxEntries };
  } catch {
    return createFrecencyState(maxEntries);
  }
}
