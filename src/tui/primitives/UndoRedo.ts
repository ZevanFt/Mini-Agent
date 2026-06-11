import type { Message } from '../types.js';

export interface UndoRedoState {
  undoStack: Message[][];
  redoStack: Message[][];
  current: Message[];
}

export function createUndoRedoState(): UndoRedoState {
  return { undoStack: [], redoStack: [], current: [] };
}

export function pushSnapshot(state: UndoRedoState, messages: Message[]): UndoRedoState {
  return {
    ...state,
    undoStack: [...state.undoStack, messages].slice(-50),
    redoStack: [],
    current: messages,
  };
}

export function undo(state: UndoRedoState): { state: UndoRedoState; messages: Message[] | null } {
  if (state.undoStack.length === 0) return { state, messages: null };
  const prev = state.undoStack[state.undoStack.length - 1];
  return {
    state: {
      undoStack: state.undoStack.slice(0, -1),
      redoStack: [...state.redoStack, state.current],
      current: prev,
    },
    messages: prev,
  };
}

export function redo(state: UndoRedoState): { state: UndoRedoState; messages: Message[] | null } {
  if (state.redoStack.length === 0) return { state, messages: null };
  const next = state.redoStack[state.redoStack.length - 1];
  return {
    state: {
      undoStack: [...state.undoStack, state.current],
      redoStack: state.redoStack.slice(0, -1),
      current: next,
    },
    messages: next,
  };
}

export function canUndo(state: UndoRedoState): boolean {
  return state.undoStack.length > 0;
}

export function canRedo(state: UndoRedoState): boolean {
  return state.redoStack.length > 0;
}

export function clearUndoRedo(): UndoRedoState {
  return { undoStack: [], redoStack: [], current: [] };
}
