export const HOTKEYS = [
  // Chrome reserves Ctrl+Shift+T (reopen closed tab) and pages cannot override it.
  { action: "title", label: "Title", alt: true, shift: true, code: "KeyT" },
  { action: "heading", label: "Heading", mod: true, shift: true, code: "KeyH" },
  { action: "subheading", label: "Subheading", mod: true, shift: true, code: "KeyJ" },
  { action: "body", label: "Body", mod: true, shift: true, code: "KeyB" },
  { action: "checklist", label: "Checklist", mod: true, shift: true, code: "KeyL" },
  { action: "toggleCheck", label: "Tick / untick item", mod: true, shift: true, code: "KeyU" },
  { action: "bold", label: "Bold", mod: true, code: "KeyB", native: true },
  { action: "italic", label: "Italic", mod: true, code: "KeyI", native: true },
  { action: "underline", label: "Underline", mod: true, code: "KeyU", native: true },
  { action: "undo", label: "Undo", mod: true, code: "KeyZ" },
  { action: "redo", label: "Redo", mod: true, shift: true, code: "KeyZ" },
  { action: "redo", label: "Redo", mod: true, code: "KeyY" },
  { action: "pastePlain", label: "Paste as plain text", mod: true, shift: true, code: "KeyV", native: true },
  { action: "search", label: "Search notes", mod: true, code: "KeyF" },
  // Chrome reserves Ctrl+N (new window).
  { action: "newNote", label: "New note", alt: true, code: "KeyN" },
];

export function matchHotkey(event, isMac) {
  if (event.isComposing) return null;
  const mod = isMac ? event.metaKey : event.ctrlKey;
  const otherMod = isMac ? event.ctrlKey : event.metaKey;
  if (otherMod) return null;
  const hotkey = HOTKEYS.find((candidate) => !candidate.native
    && candidate.code === event.code
    && Boolean(candidate.mod) === mod
    && Boolean(candidate.shift) === event.shiftKey
    && Boolean(candidate.alt) === event.altKey);
  return hotkey?.action ?? null;
}

export function hotkeyLabel(hotkey, isMac) {
  const names = isMac ? { mod: "⌘", alt: "⌥", shift: "⇧" } : { mod: "Ctrl", alt: "Alt", shift: "Shift" };
  const parts = ["mod", "alt", "shift"].filter((modifier) => hotkey[modifier]).map((modifier) => names[modifier]);
  parts.push(hotkey.code.replace("Key", ""));
  return parts.join(isMac ? "" : "+");
}
