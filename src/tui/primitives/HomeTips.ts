export interface Tip {
  text: string;
  keys?: string;
}

export const HOME_TIPS: Tip[] = [
  { text: 'Press Ctrl+P to open the command palette', keys: 'Ctrl+P' },
  { text: 'Type / to see available slash commands', keys: '/' },
  { text: 'Press Tab to switch between Build and Plan mode', keys: 'Tab' },
  { text: 'Press Ctrl+T to view your conversation timeline', keys: 'Ctrl+T' },
  { text: 'Press Ctrl+E to export your session', keys: 'Ctrl+E' },
  { text: 'Press Ctrl+Shift+T to toggle timestamps', keys: 'Ctrl+Shift+T' },
  { text: 'Press Ctrl+Shift+H to toggle thinking display', keys: 'Ctrl+Shift+H' },
  { text: 'Press Ctrl+Z to undo, Ctrl+Shift+Z to redo', keys: 'Ctrl+Z' },
  { text: 'Press Ctrl+K to clear the input field', keys: 'Ctrl+K' },
  { text: 'Press Ctrl+L to clear the chat', keys: 'Ctrl+L' },
  { text: 'Press Ctrl+R to retry your last message', keys: 'Ctrl+R' },
  { text: 'Press Ctrl+U to stash your draft, Ctrl+Y to restore', keys: 'Ctrl+U' },
  { text: 'Press PageUp/PageDown to scroll through messages', keys: 'PageUp' },
  { text: 'Press Ctrl+Shift+C to copy the full transcript', keys: 'Ctrl+Shift+C' },
  { text: 'Press Ctrl+N to start a new session', keys: 'Ctrl+N' },
  { text: 'Press Ctrl+O to open the session list', keys: 'Ctrl+O' },
  { text: 'Press Ctrl+M to open the model selector', keys: 'Ctrl+M' },
  { text: 'Press Ctrl+Shift+A to open the agent selector', keys: 'Ctrl+Shift+A' },
  { text: 'Press Ctrl+Shift+X to cycle through themes', keys: 'Ctrl+Shift+X' },
  { text: 'Press F1 for a full list of keyboard shortcuts', keys: 'F1' },
];

export function getRandomTip(exclude?: string): Tip {
  const available = exclude ? HOME_TIPS.filter(t => t.text !== exclude) : HOME_TIPS;
  return available[Math.floor(Math.random() * available.length)] || HOME_TIPS[0];
}

export function getTipByIndex(index: number): Tip {
  return HOME_TIPS[index % HOME_TIPS.length];
}
