export type DialogSize = 'medium' | 'large' | 'xlarge';

export const DIALOG_WIDTHS: Record<DialogSize, number> = {
  medium: 60,
  large: 88,
  xlarge: 116,
};

export function getDialogWidth(size: DialogSize, termWidth: number): number {
  return Math.min(DIALOG_WIDTHS[size], termWidth - 8);
}

export function getContentWidth(size: DialogSize, termWidth: number): number {
  return Math.max(20, getDialogWidth(size, termWidth) - 6);
}

export interface DialogSizeState {
  size: DialogSize;
}

export function createDialogSizeState(): DialogSizeState {
  return { size: 'medium' };
}

export function setDialogSize(state: DialogSizeState, size: DialogSize): DialogSizeState {
  return { ...state, size };
}

export function cycleDialogSize(state: DialogSizeState): DialogSizeState {
  const sizes: DialogSize[] = ['medium', 'large', 'xlarge'];
  const idx = sizes.indexOf(state.size);
  return { ...state, size: sizes[(idx + 1) % sizes.length] };
}
