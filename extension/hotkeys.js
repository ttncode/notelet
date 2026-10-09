export const HOTKEYS = [
  // Chrome reserves Ctrl+Shift+T (reopen closed tab), and Alt+Shift is Windows' keyboard-language switch.
  { action: "title", label: "Title", alt: true, code: "KeyT" },
  { action: "heading", label: "Heading", mod: true, shift: true, code: "KeyH" },
  { action: "subheading", label: "Subheading", mod: true, shift: true, code: "KeyJ" },
  { action: "body", label: "Body", mod: true, shift: true, code: "KeyB" },
  // Notes uses Shift+Cmd+M, but Ctrl+Shift+M is Chrome's profile menu.
  { action: "monostyled", label: "Monostyled", mod: true, shift: true, code: "KeyK" },
  { action: "bulleted", label: "Bulleted list", mod: true, shift: true, code: "Digit7" },
  { action: "dashed", label: "Dashed list", mod: true, shift: true, code: "Digit8" },
  { action: "numbered", label: "Numbered list", mod: true, shift: true, code: "Digit9" },
  { action: "checklist", label: "Checklist", mod: true, shift: true, code: "KeyL" },
  { action: "toggleCheck", label: "Tick / untick item or task", mod: true, shift: true, code: "KeyU" },
  { action: "bold", label: "Bold", mod: true, code: "KeyB", native: true },
  { action: "italic", label: "Italic", mod: true, code: "KeyI", native: true },
  { action: "underline", label: "Underline", mod: true, code: "KeyU", native: true },
  { action: "strikethrough", label: "Strikethrough", mod: true, shift: true, code: "KeyX" },
  { action: "formatMenu", label: "Text styles menu", alt: true, code: "KeyA" },
  { action: "undo", label: "Undo", mod: true, code: "KeyZ" },
  { action: "redo", label: "Redo", mod: true, shift: true, code: "KeyZ" },
  { action: "redo", label: "Redo", mod: true, code: "KeyY" },
  { action: "pastePlain", label: "Paste as plain text", mod: true, shift: true, code: "KeyV", native: true },
  // Chrome reserves Ctrl+N (new window).
  { action: "newNote", label: "New note", alt: true, code: "KeyN" },
  { action: "newSprint", label: "New task tracking", alt: true, code: "KeyS" },
  { action: "noteMenu", label: "Note menu", alt: true, code: "KeyO" },
  { action: "pin", label: "Pin / unpin note", alt: true, code: "KeyP" },
  // Ctrl+Shift+Delete is Chrome's clear browsing data.
  { action: "deleteNote", label: "Delete note", mod: true, shift: true, code: "Backspace" },
  { action: "recover", label: "Recover deleted note", alt: true, code: "KeyU" },
  { action: "focusList", label: "Go to notes list", alt: true, code: "Digit1" },
  { action: "search", label: "Search notes", mod: true, code: "KeyF" },
  { action: "search", label: "Search notes", alt: true, code: "Digit2" },
  { action: "focusEditor", label: "Go to note", alt: true, code: "Digit3" },
  { action: "toggleSidebar", label: "Show / hide notes list", alt: true, code: "Digit0" },
  { action: "listMenu", label: "Notes list menu", alt: true, code: "KeyM" },
  { action: "deletedView", label: "Recently Deleted / back to notes", alt: true, code: "KeyR" },
  { action: "theme", label: "Theme: System, Light, Dark", alt: true, code: "KeyL" },
  // Alt+E opens Chrome's menu on Windows.
  { action: "export", label: "Export backup", alt: true, code: "KeyX" },
  { action: "import", label: "Import backup", alt: true, code: "KeyI" },
  { action: "trackerSettings", label: "Task tracking settings", mod: true, code: "Comma" },
  { action: "addGroup", label: "Add group", alt: true, code: "KeyG" },
  { action: "toggleGroup", label: "Fold / unfold group", alt: true, code: "KeyC" },
  { action: "openFullPage", label: "Open full page (popup)", alt: true, code: "Enter" },
  { action: "help", label: "Show or hide this list", mod: true, code: "Slash" },
];

export function matchHotkey(event, isMac) {
  if (event.isComposing) return null;
  const mod = isMac ? event.metaKey : event.ctrlKey;
  const otherMod = isMac ? event.ctrlKey : event.metaKey;
  if (otherMod) return null;
  // The numpad's / works as well as the main keyboard's.
  const code = event.code === "NumpadDivide" ? "Slash" : event.code;
  const hotkey = HOTKEYS.find((candidate) => !candidate.native
    && candidate.code === code
    && Boolean(candidate.mod) === mod
    && Boolean(candidate.shift) === event.shiftKey
    && Boolean(candidate.alt) === event.altKey);
  return hotkey?.action ?? null;
}

export function hotkeyLabel(hotkey, isMac) {
  const names = isMac ? { mod: "⌘", alt: "⌥", shift: "⇧" } : { mod: "Ctrl", alt: "Alt", shift: "Shift" };
  const parts = ["mod", "alt", "shift"].filter((modifier) => hotkey[modifier]).map((modifier) => names[modifier]);
  parts.push(keyName(hotkey.code, isMac));
  return parts.join(isMac ? "" : "+");
}

const KEY_NAMES = { Slash: "/", Comma: ",", Backspace: "Backspace", Enter: "Enter" };
const MAC_KEY_NAMES = { ...KEY_NAMES, Backspace: "⌫", Enter: "↩" };

const keyName = (code, isMac) => (isMac ? MAC_KEY_NAMES : KEY_NAMES)[code] ?? code.replace(/^(Key|Digit)/, "");

export function shortcutFor(action, isMac) {
  const hotkey = HOTKEYS.find((candidate) => candidate.action === action);
  return hotkey ? hotkeyLabel(hotkey, isMac) : "";
}

// Tooltip templates name shortcuts by action, e.g. "Pin note ({pin})" becomes "Pin note (Alt+P)".
export const fillShortcuts = (template, isMac) => template.replace(/\{(\w+)\}/g, (_, action) => shortcutFor(action, isMac));

export function applyShortcutTitles(root, isMac) {
  for (const element of root.querySelectorAll("[data-title]")) element.title = fillShortcuts(element.dataset.title, isMac);
}
