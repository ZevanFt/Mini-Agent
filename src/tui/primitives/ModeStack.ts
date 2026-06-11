export type ModeType = 'base' | 'modal' | 'input' | 'visual' | 'autocomplete' | 'permission' | 'question' | 'diff';

export interface ModeEntry {
  id: symbol;
  mode: ModeType;
  data?: Record<string, unknown>;
}

export interface ModeStack {
  stack: ModeEntry[];
  nextId: number;
}

export function createModeStack(): ModeStack {
  return {
    stack: [{ id: Symbol('base'), mode: 'base' }],
    nextId: 1,
  };
}

export function currentMode(state: ModeStack): ModeType {
  return state.stack[state.stack.length - 1]?.mode ?? 'base';
}

export function currentModeData(state: ModeStack): Record<string, unknown> | undefined {
  return state.stack[state.stack.length - 1]?.data;
}

export function pushMode(state: ModeStack, mode: ModeType, data?: Record<string, unknown>): { state: ModeStack; pop: () => ModeStack } {
  const id = Symbol(`mode-${state.nextId}`);
  const newStack: ModeStack = {
    stack: [...state.stack, { id, mode, data }],
    nextId: state.nextId + 1,
  };
  return {
    state: newStack,
    pop: () => ({
      ...newStack,
      stack: newStack.stack.filter(e => e.id !== id),
    }),
  };
}

export function popMode(state: ModeStack): ModeStack {
  if (state.stack.length <= 1) return state;
  return {
    ...state,
    stack: state.stack.slice(0, -1),
  };
}

export function replaceMode(state: ModeStack, mode: ModeType, data?: Record<string, unknown>): ModeStack {
  if (state.stack.length === 0) {
    return { ...state, stack: [{ id: Symbol('base'), mode, data }], nextId: state.nextId + 1 };
  }
  return {
    ...state,
    stack: [...state.stack.slice(0, -1), { id: state.stack[state.stack.length - 1].id, mode, data }],
  };
}

export function isInMode(state: ModeStack, mode: ModeType): boolean {
  return state.stack.some(e => e.mode === mode);
}

export function modeDepth(state: ModeStack): number {
  return state.stack.length;
}

export function getModeHistory(state: ModeStack): ModeType[] {
  return state.stack.map(e => e.mode);
}
