// Shell mode: ! prefix switches to shell command mode

export interface ShellModeState {
  isActive: boolean;
  command: string;
}

export function createShellModeState(): ShellModeState {
  return { isActive: false, command: '' };
}

export function enterShellMode(state: ShellModeState): ShellModeState {
  return { ...state, isActive: true, command: '' };
}

export function exitShellMode(state: ShellModeState): ShellModeState {
  return { ...state, isActive: false, command: '' };
}

export function shellModeType(state: ShellModeState, char: string): ShellModeState {
  return { ...state, command: state.command + char };
}

export function shellModeBackspace(state: ShellModeState): ShellModeState {
  if (state.command.length === 0) return exitShellMode(state);
  return { ...state, command: state.command.slice(0, -1) };
}

export function getShellCommand(state: ShellModeState): string | null {
  return state.isActive && state.command.trim() ? state.command : null;
}

// Detect if input starts with ! (shell mode trigger)
export function isShellModeTrigger(input: string): boolean {
  return input === '!' || input.startsWith('! ');
}
