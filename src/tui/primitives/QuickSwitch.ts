import type { Session } from './SessionManager.js';

export interface QuickSlot {
  index: number;
  sessionId: string | null;
}

export interface QuickSwitchState {
  slots: (string | null)[];
  maxSlots: number;
}

export function createQuickSwitchState(maxSlots = 9): QuickSwitchState {
  return { slots: Array(maxSlots).fill(null), maxSlots };
}

export function assignSlot(state: QuickSwitchState, sessionId: string, slot?: number): QuickSwitchState {
  const idx = slot ?? state.slots.findIndex(s => s === null);
  if (idx === -1 || idx >= state.maxSlots) return state;
  const slots = [...state.slots];
  // Remove from other slot if already assigned
  const existingIdx = slots.indexOf(sessionId);
  if (existingIdx !== -1) slots[existingIdx] = null;
  slots[idx] = sessionId;
  return { ...state, slots };
}

export function removeSlot(state: QuickSwitchState, sessionId: string): QuickSwitchState {
  return { ...state, slots: state.slots.map(s => s === sessionId ? null : s) };
}

export function getSlotSessionId(state: QuickSwitchState, slot: number): string | null {
  return state.slots[slot] ?? null;
}

export function getSlotSessions(state: QuickSwitchState, sessions: Session[]): { slot: number; session: Session | null }[] {
  return state.slots.map((sessionId, i) => ({
    slot: i + 1,
    session: sessionId ? sessions.find(s => s.id === sessionId) ?? null : null,
  }));
}

export function autoAssignSlots(state: QuickSwitchState, sessions: Session[]): QuickSwitchState {
  const sorted = [...sessions].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, state.maxSlots);
  return {
    ...state,
    slots: state.slots.map((_, i) => sorted[i]?.id ?? null),
  };
}
