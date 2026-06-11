// Configurable keybinding system
// Maps action names to key combinations

export interface KeyBindingConfig {
  [action: string]: string | string[] | false;
}

export const DEFAULT_KEYBINDS: KeyBindingConfig = {
  // Application
  'app.exit': ['ctrl+c', 'ctrl+d'],
  'app.debug': false,
  'app.console': false,

  // Command palette
  'command.palette.show': 'ctrl+p',

  // Session
  'session.new': 'ctrl+n',
  'session.list': 'ctrl+o',
  'session.timeline': 'ctrl+shift+g',
  'session.rename': 'ctrl+r',
  'session.delete': 'ctrl+d',
  'session.interrupt': 'escape',
  'session.compact': 'ctrl+shift+c',
  'session.export': 'ctrl+e',
  'session.copy': 'ctrl+shift+c',
  'session.toggle_timestamps': 'ctrl+shift+t',
  'session.toggle_thinking': 'ctrl+shift+h',
  'session.toggle_tool_output': 'ctrl+shift+d',
  'session.toggle_sidebar': 'ctrl+shift+s',
  'session.toggle_scrollbar': 'ctrl+shift+b',
  'session.toggle_code_conceal': false,

  // Quick switch
  'session.quick_switch.1': 'ctrl+1',
  'session.quick_switch.2': 'ctrl+2',
  'session.quick_switch.3': 'ctrl+3',
  'session.quick_switch.4': 'ctrl+4',
  'session.quick_switch.5': 'ctrl+5',
  'session.quick_switch.6': 'ctrl+6',
  'session.quick_switch.7': 'ctrl+7',
  'session.quick_switch.8': 'ctrl+8',
  'session.quick_switch.9': 'ctrl+9',

  // Model & Agent
  'model.list': 'ctrl+m',
  'model.cycle_recent': 'f2',
  'model.cycle_recent_reverse': 'shift+f2',
  'agent.list': 'ctrl+shift+a',
  'agent.cycle': 'tab',
  'agent.cycle.reverse': 'shift+tab',
  'variant.cycle': 'ctrl+t',

  // Messages
  'messages.page_up': 'pageup',
  'messages.page_down': 'pagedown',
  'messages.line_up': 'ctrl+up',
  'messages.line_down': 'ctrl+down',
  'messages.half_page_up': false,
  'messages.half_page_down': false,
  'messages.first': 'home',
  'messages.last': 'end',

  // Display
  'theme.list': 'ctrl+shift+x',
  'sidebar_toggle': 'ctrl+shift+s',
  'which_key_toggle': 'f1',

  // Input
  'input.clear': 'ctrl+c',
  'input.submit': 'return',
  'input.newline': 'shift+return',
  'input.move_left': 'left',
  'input.move_right': 'right',
  'input.move_up': 'up',
  'input.move_down': 'down',
  'input.line_home': 'ctrl+a',
  'input.line_end': 'ctrl+e',
  'input.delete_line': 'ctrl+shift+d',
  'input.delete_to_line_end': 'ctrl+k',
  'input.delete_to_line_start': 'ctrl+u',
  'input.undo': 'ctrl+z',
  'input.redo': 'ctrl+shift+z',
  'input.word_forward': 'ctrl+right',
  'input.word_backward': 'ctrl+left',
  'input_delete_word_forward': 'alt+d',
  'input_delete_word_backward': 'ctrl+w',

  // Dialog
  'dialog.select.prev': 'up',
  'dialog.select.next': 'down',
  'dialog.select.submit': 'return',

  // Autocomplete
  'prompt.autocomplete.prev': 'up',
  'prompt.autocomplete.next': 'down',
  'prompt.autocomplete.hide': 'escape',
  'prompt.autocomplete.select': 'return',
  'prompt.autocomplete.complete': 'tab',

  // Which-key
  'which_key_group_previous': 'ctrl+alt+left',
  'which_key_group_next': 'ctrl+alt+right',
  'which_key_scroll_up': 'ctrl+alt+up',
  'which_key_scroll_down': 'ctrl+alt+down',

  // Editor
  'editor_open': 'ctrl+shift+j',
};

export function loadKeybinds(overrides?: Partial<KeyBindingConfig>): KeyBindingConfig {
  return { ...DEFAULT_KEYBINDS, ...overrides } as KeyBindingConfig;
}

export function getKeyForAction(config: KeyBindingConfig, action: string): string | string[] | false {
  return config[action] ?? false;
}

export function parseKeyString(keyStr: string): { key: string; ctrl: boolean; shift: boolean; alt: boolean; meta: boolean } {
  const parts = keyStr.toLowerCase().split('+');
  const modifiers = { ctrl: false, shift: false, alt: false, meta: false };
  let key = '';

  for (const part of parts) {
    if (part === 'ctrl' || part === 'c') modifiers.ctrl = true;
    else if (part === 'shift' || part === 's') modifiers.shift = true;
    else if (part === 'alt' || part === 'a') modifiers.alt = true;
    else if (part === 'meta' || part === 'm' || part === 'super') modifiers.meta = true;
    else key = part;
  }

  return { key, ...modifiers };
}
