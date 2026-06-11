export type KeyMode = 'base' | 'modal' | 'input' | 'visual';

export interface KeyEvent {
  input: string;
  key: {
    ctrl: boolean;
    meta: boolean;
    shift: boolean;
    return: boolean;
    escape: boolean;
    backspace: boolean;
    delete: boolean;
    tab: boolean;
    home: boolean;
    end: boolean;
    upArrow: boolean;
    downArrow: boolean;
    leftArrow: boolean;
    rightArrow: boolean;
  };
}

export type KeyHandler = (event: KeyEvent) => boolean | void;

export interface KeyBinding {
  match: (event: KeyEvent) => boolean;
  handler: KeyHandler;
  modes?: KeyMode[];
  priority?: number;
}

export interface KeymapState {
  modeStack: KeyMode[];
  bindings: KeyBinding[];
}

export function createKeymap(): KeymapState {
  return {
    modeStack: ['base'],
    bindings: [],
  };
}

export function currentMode(state: KeymapState): KeyMode {
  return state.modeStack[state.modeStack.length - 1] ?? 'base';
}

export function pushMode(state: KeymapState, mode: KeyMode): KeymapState {
  if (state.modeStack[state.modeStack.length - 1] === mode) return state;
  return { ...state, modeStack: [...state.modeStack, mode] };
}

export function popMode(state: KeymapState): KeymapState {
  if (state.modeStack.length <= 1) return state;
  return { ...state, modeStack: state.modeStack.slice(0, -1) };
}

export function replaceMode(state: KeymapState, mode: KeyMode): KeymapState {
  if (state.modeStack.length === 0) {
    return { ...state, modeStack: [mode] };
  }
  return {
    ...state,
    modeStack: [...state.modeStack.slice(0, -1), mode],
  };
}

export function registerBinding(
  state: KeymapState,
  match: (event: KeyEvent) => boolean,
  handler: KeyHandler,
  modes?: KeyMode[],
  priority = 0
): KeymapState {
  return {
    ...state,
    bindings: [...state.bindings, { match, handler, modes, priority }],
  };
}

export function dispatch(state: KeymapState, event: KeyEvent): boolean {
  const mode = currentMode(state);
  const sorted = [...state.bindings].sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
  for (const binding of sorted) {
    if (binding.modes && !binding.modes.includes(mode)) continue;
    if (binding.match(event)) {
      const result = binding.handler(event);
      if (result === true) return true;
    }
  }
  return false;
}

export function matchKey(event: KeyEvent, target: Partial<KeyEvent['key']>, inputChar?: string): boolean {
  if (inputChar !== undefined && event.input !== inputChar) return false;
  const k = event.key;
  for (const [key, value] of Object.entries(target)) {
    if (value === undefined) continue;
    if ((k as Record<string, unknown>)[key] !== value) return false;
  }
  return true;
}

export function matchCtrl(event: KeyEvent, char: string): boolean {
  return event.key.ctrl && event.input.toLowerCase() === char.toLowerCase();
}

export function matchPrintable(event: KeyEvent): boolean {
  return event.input.length >= 1 && event.input >= ' ' && event.input !== '\u007f' && !event.key.ctrl && !event.key.meta;
}

export function isNavigationKey(event: KeyEvent): boolean {
  return event.key.upArrow || event.key.downArrow || event.key.leftArrow || event.key.rightArrow || event.key.home || event.key.end;
}
