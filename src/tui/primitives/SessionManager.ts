import { mkdir, readFile, writeFile, readdir, unlink } from 'fs/promises';
import path from 'path';
import type { Message } from '../types.js';

export interface Session {
  id: string;
  title: string;
  messages: Message[];
  createdAt: number;
  updatedAt: number;
  model?: string;
  mode?: string;
  pinned?: boolean;
  directory?: string;
}

export interface SessionManagerState {
  sessions: Session[];
  currentSessionId: string | null;
  sessionDir: string;
}

function generateId(): string {
  return `s_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function createSessionManager(cwd: string): SessionManagerState {
  return {
    sessions: [],
    currentSessionId: null,
    sessionDir: path.join(cwd, '.miniagent', 'sessions'),
  };
}

export function createSession(state: SessionManagerState, title?: string, model?: string, mode?: string): { state: SessionManagerState; session: Session } {
  const session: Session = {
    id: generateId(),
    title: title || `Session ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}`,
    messages: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
    model,
    mode,
  };
  return {
    state: {
      ...state,
      sessions: [...state.sessions, session],
      currentSessionId: session.id,
    },
    session,
  };
}

export function switchSession(state: SessionManagerState, sessionId: string): SessionManagerState {
  return { ...state, currentSessionId: sessionId };
}

export function getCurrentSession(state: SessionManagerState): Session | undefined {
  return state.sessions.find(s => s.id === state.currentSessionId);
}

export function updateSessionMessages(state: SessionManagerState, sessionId: string, messages: Message[]): SessionManagerState {
  return {
    ...state,
    sessions: state.sessions.map(s =>
      s.id === sessionId ? { ...s, messages, updatedAt: Date.now() } : s
    ),
  };
}

export function renameSession(state: SessionManagerState, sessionId: string, title: string): SessionManagerState {
  return {
    ...state,
    sessions: state.sessions.map(s =>
      s.id === sessionId ? { ...s, title, updatedAt: Date.now() } : s
    ),
  };
}

export function deleteSession(state: SessionManagerState, sessionId: string): SessionManagerState {
  const sessions = state.sessions.filter(s => s.id !== sessionId);
  return {
    ...state,
    sessions,
    currentSessionId: state.currentSessionId === sessionId ? (sessions[0]?.id ?? null) : state.currentSessionId,
  };
}

export function pinSession(state: SessionManagerState, sessionId: string): SessionManagerState {
  return {
    ...state,
    sessions: state.sessions.map(s =>
      s.id === sessionId ? { ...s, pinned: !s.pinned } : s
    ),
  };
}

export function searchSessions(state: SessionManagerState, query: string): Session[] {
  if (!query.trim()) return state.sessions;
  const lower = query.toLowerCase();
  return state.sessions.filter(s =>
    s.title.toLowerCase().includes(lower) ||
    s.messages.some(m => m.content.toLowerCase().includes(lower))
  );
}

export function sortSessions(sessions: Session[]): Session[] {
  return [...sessions].sort((a, b) => {
    if (a.pinned && !b.pinned) return -1;
    if (!a.pinned && b.pinned) return 1;
    return b.updatedAt - a.updatedAt;
  });
}

export async function saveSession(session: Session, sessionDir: string): Promise<void> {
  await mkdir(sessionDir, { recursive: true });
  const filePath = path.join(sessionDir, `${session.id}.json`);
  await writeFile(filePath, JSON.stringify(session, null, 2), 'utf8');
}

export async function loadSessions(sessionDir: string): Promise<Session[]> {
  try {
    await mkdir(sessionDir, { recursive: true });
    const files = await readdir(sessionDir);
    const sessions: Session[] = [];
    for (const file of files) {
      if (!file.endsWith('.json')) continue;
      try {
        const raw = await readFile(path.join(sessionDir, file), 'utf8');
        const parsed = JSON.parse(raw) as unknown;
        if (parsed && typeof parsed === 'object' && 'id' in parsed && 'messages' in parsed) {
          sessions.push(parsed as Session);
        }
      } catch {
        // Skip corrupted files
      }
    }
    return sortSessions(sessions);
  } catch {
    return [];
  }
}

export async function deleteSessionFile(sessionId: string, sessionDir: string): Promise<void> {
  try {
    await unlink(path.join(sessionDir, `${sessionId}.json`));
  } catch {
    // Ignore if file doesn't exist
  }
}

export function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}
