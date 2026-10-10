const DEFAULT_HOTKEYS = [
  // Chrome reserves Ctrl+Shift+T (reopen closed tab), and Alt+Shift is Windows' keyboard-language switch.
  { group: "Text styles", action: "title", label: "Title", alt: true, code: "KeyT" },
  { group: "Text styles", action: "heading", label: "Heading", mod: true, shift: true, code: "KeyH" },
  { group: "Text styles", action: "subheading", label: "Subheading", mod: true, shift: true, code: "KeyJ" },
  { group: "Text styles", action: "body", label: "Body", mod: true, shift: true, code: "KeyB" },
  // Notes uses Shift+Cmd+M, but Ctrl+Shift+M is Chrome's profile menu.
  { group: "Text styles", action: "monostyled", label: "Monostyled", mod: true, shift: true, code: "KeyK" },
  { group: "Text styles", action: "formatMenu", label: "Text styles menu", alt: true, code: "KeyA" },
  { group: "Formatting", action: "bold", label: "Bold", mod: true, code: "KeyB", native: true },
  { group: "Formatting", action: "italic", label: "Italic", mod: true, code: "KeyI", native: true },
  { group: "Formatting", action: "underline", label: "Underline", mod: true, code: "KeyU", native: true },
  { group: "Formatting", action: "strikethrough", label: "Strikethrough", mod: true, shift: true, code: "KeyX" },
  { group: "Lists", action: "bulleted", label: "Bulleted list", mod: true, shift: true, code: "Digit7" },
  { group: "Lists", action: "dashed", label: "Dashed list", mod: true, shift: true, code: "Digit8" },
  { group: "Lists", action: "numbered", label: "Numbered list", mod: true, shift: true, code: "Digit9" },
  { group: "Lists", action: "checklist", label: "Checklist", mod: true, shift: true, code: "KeyL" },
  { group: "Lists", action: "toggleCheck", label: "Tick / untick checklist item", mod: true, shift: true, code: "KeyU" },
  { group: "Editing", action: "undo", label: "Undo", mod: true, code: "KeyZ" },
  { group: "Editing", action: "redo", label: "Redo", mod: true, shift: true, code: "KeyZ" },
  { group: "Editing", action: "redo", label: "Redo", mod: true, code: "KeyY" },
  { group: "Editing", action: "pastePlain", label: "Paste as plain text", mod: true, shift: true, code: "KeyV", native: true },
  // Chrome reserves Ctrl+N (new window).
  { group: "Notes", action: "newNote", label: "New note", alt: true, code: "KeyN" },
  { group: "Notes", action: "noteMenu", label: "Note menu", alt: true, code: "KeyO" },
  { group: "Notes", action: "pin", label: "Pin / unpin note", alt: true, code: "KeyP" },
  // Ctrl+Shift+Delete is Chrome's clear browsing data.
  { group: "Notes", action: "deleteNote", label: "Delete note", mod: true, shift: true, code: "Backspace" },
  { group: "Notes", action: "recover", label: "Recover deleted note", alt: true, code: "KeyU" },
  { group: "Navigate", action: "focusList", label: "Go to notes list", alt: true, code: "Digit1" },
  { group: "Navigate", action: "search", label: "Search notes", mod: true, code: "KeyF" },
  { group: "Navigate", action: "search", label: "Search notes", alt: true, code: "Digit2" },
  { group: "Navigate", action: "focusEditor", label: "Go to note", alt: true, code: "Digit3" },
  { group: "Navigate", action: "toggleSidebar", label: "Show / hide notes list", alt: true, code: "Digit0" },
  { group: "Navigate", action: "deletedView", label: "Recently Deleted / back to notes", alt: true, code: "KeyR" },
  { group: "Sprints", action: "newSprint", label: "Open Sprints", alt: true, code: "KeyS" },
  { group: "Sprints", action: "trackerSettings", label: "Sprint settings", mod: true, code: "Comma" },
  { group: "App", action: "listMenu", label: "Notes list menu", alt: true, code: "KeyM" },
  { group: "App", action: "theme", label: "Theme: System, Light, Dark", alt: true, code: "KeyL" },
  // Alt+E opens Chrome's menu on Windows.
  { group: "App", action: "export", label: "Export backup", alt: true, code: "KeyX" },
  { group: "App", action: "import", label: "Import backup", alt: true, code: "KeyI" },
  { group: "App", action: "openFullPage", label: "Open full page (popup)", alt: true, code: "Enter" },
  { group: "App", action: "help", label: "Show or hide this list", mod: true, code: "Slash" },
];

// Each shortcut has a stable id: its action, with 2 added for an action's second key.
export const HOTKEYS = DEFAULT_HOTKEYS.map((hotkey, index) => {
  const earlier = DEFAULT_HOTKEYS.slice(0, index).filter((other) => other.action === hotkey.action).length;
  return Object.freeze({ ...hotkey, id: earlier === 0 ? hotkey.action : `${hotkey.action}${earlier + 1}` });
});

const NO_MODIFIERS = { mod: false, alt: false, shift: false };

// The user's keys from settings: { [hotkey id]: { mod, alt, shift, code } }, or null for no key.
// ponytail: module-level state, so every caller sees the same keys without passing them around.
let customKeys = {};

export const setCustomKeys = (keys) => {
  customKeys = keys ?? {};
};

export const isEditable = (hotkey) => !hotkey.native;

export const defaultHotkey = (id) => HOTKEYS.find((hotkey) => hotkey.id === id);

export function activeHotkeys() {
  return HOTKEYS.map((hotkey) => {
    if (!Object.hasOwn(customKeys, hotkey.id)) return hotkey;
    return { ...hotkey, ...NO_MODIFIERS, ...(customKeys[hotkey.id] ?? { code: null }) };
  });
}

export function matchHotkey(event, isMac) {
  if (event.isComposing) return null;
  const otherMod = isMac ? event.ctrlKey : event.metaKey;
  if (otherMod) return null;
  const pressed = comboOf(event, isMac);
  const hotkey = activeHotkeys().find((candidate) => !candidate.native && sameCombo(candidate, pressed));
  return hotkey?.action ?? null;
}

// The numpad's / works as well as the main keyboard's.
export function comboOf(event, isMac) {
  const code = event.code === "NumpadDivide" ? "Slash" : event.code;
  return { mod: isMac ? event.metaKey : event.ctrlKey, alt: event.altKey, shift: event.shiftKey, code };
}

export const sameCombo = (a, b) => a.code !== null && a.code === b.code
  && Boolean(a.mod) === Boolean(b.mod) && Boolean(a.alt) === Boolean(b.alt) && Boolean(a.shift) === Boolean(b.shift);

const MODIFIER_CODES = /^(Control|Shift|Alt|Meta|OS)(Left|Right)?$/;

export const isModifierOnly = (event) => MODIFIER_CODES.test(event.code);

// Keys Chrome or Windows act on before the page can, so they could never work as a shortcut.
const CHROME_MOD_KEYS = new Set(["KeyN", "KeyT", "KeyW", "Tab", "PageUp", "PageDown", "KeyQ"]);
const CHROME_MOD_SHIFT_KEYS = new Set(["KeyN", "KeyT", "KeyW", "Tab", "KeyQ", "Delete"]);
const WINDOWS_ALT_KEYS = new Set(["KeyF", "KeyE", "F4", "Space", "Tab"]);

export function reservedReason(combo, isMac) {
  const label = hotkeyLabel(combo, isMac);
  if (!combo.mod && !combo.alt) return `Add ${isMac ? "⌘ or ⌥" : "Ctrl or Alt"}, so the key doesn't just type.`;
  if (!isMac && combo.alt && combo.shift && !combo.mod) return "Alt+Shift switches the keyboard language on Windows.";
  if (combo.mod && !combo.alt && (combo.shift ? CHROME_MOD_SHIFT_KEYS : CHROME_MOD_KEYS).has(combo.code)) return `Chrome keeps ${label} for itself.`;
  if (!isMac && combo.alt && !combo.mod && !combo.shift && WINDOWS_ALT_KEYS.has(combo.code)) return `${label} is kept by Chrome or Windows.`;
  return null;
}

// Settings from storage or a backup keep only well-formed keys for shortcuts that exist.
export function normalizeCustomKeys(keys) {
  if (typeof keys !== "object" || keys === null || Array.isArray(keys)) return {};
  return Object.fromEntries(Object.entries(keys).filter(([id, combo]) => {
    const hotkey = defaultHotkey(id);
    return hotkey && isEditable(hotkey) && (combo === null || isCombo(combo));
  }));
}

const isCombo = (combo) => typeof combo === "object" && combo !== null && typeof combo.code === "string" && combo.code !== ""
  && ["mod", "alt", "shift"].every((modifier) => typeof combo[modifier] === "boolean");

export function hotkeyLabel(hotkey, isMac) {
  if (hotkey.code === null) return "";
  const names = isMac ? { mod: "⌘", alt: "⌥", shift: "⇧" } : { mod: "Ctrl", alt: "Alt", shift: "Shift" };
  const parts = ["mod", "alt", "shift"].filter((modifier) => hotkey[modifier]).map((modifier) => names[modifier]);
  parts.push(keyName(hotkey.code, isMac));
  return parts.join(isMac ? "" : "+");
}

const KEY_NAMES = {
  Slash: "/", Comma: ",", Period: ".", Semicolon: ";", Quote: "'", BracketLeft: "[", BracketRight: "]", Backslash: "\\", Minus: "-", Equal: "=", Backquote: "`",
  Backspace: "Backspace", Enter: "Enter", Delete: "Delete", Space: "Space", ArrowUp: "↑", ArrowDown: "↓", ArrowLeft: "←", ArrowRight: "→",
};
const MAC_KEY_NAMES = { ...KEY_NAMES, Backspace: "⌫", Enter: "↩" };

const keyName = (code, isMac) => (isMac ? MAC_KEY_NAMES : KEY_NAMES)[code] ?? code.replace(/^(Key|Digit|Numpad)/, "");

// An action's first key that is set; "no key" when the user removed them all.
export function shortcutFor(action, isMac) {
  const hotkey = activeHotkeys().find((candidate) => candidate.action === action && candidate.code !== null);
  if (hotkey) return hotkeyLabel(hotkey, isMac);
  return HOTKEYS.some((candidate) => candidate.action === action) ? "no key" : "";
}

// Tooltip templates name shortcuts by action, e.g. "Pin note ({pin})" becomes "Pin note (Alt+P)".
export const fillShortcuts = (template, isMac) => template.replace(/\{(\w+)\}/g, (_, action) => shortcutFor(action, isMac));

export function applyShortcutTitles(root, isMac) {
  for (const element of root.querySelectorAll("[data-title]")) element.title = fillShortcuts(element.dataset.title, isMac);
}
