export const HOTKEYS = [
  // Chrome reserves Ctrl+Shift+T (reopen closed tab), and Alt+Shift is Windows' keyboard-language switch.
  { action: "title", label: "Title", alt: true, code: "KeyT" },
  { action: "heading", label: "Heading", mod: true, shift: true, code: "KeyH" },
  { action: "subheading", label: "Subheading", mod: true, shift: true, code: "KeyJ" },
  { action: "body", label: "Body", mod: true, shift: true, code: "KeyB" },
  { action: "bulleted", label: "Bulleted list", mod: true, shift: true, code: "Digit7" },
  { action: "dashed", label: "Dashed list", mod: true, shift: true, code: "Digit8" },
  { action: "numbered", label: "Numbered list", mod: true, shift: true, code: "Digit9" },
  { action: "checklist", label: "Checklist", mod: true, shift: true, code: "KeyL" },
  { action: "toggleCheck", label: "Tick / untick item", mod: true, shift: true, code: "KeyU" },
  { action: "bold", label: "Bold", mod: true, code: "KeyB", native: true },
  { action: "italic", label: "Italic", mod: true, code: "KeyI", native: true },
  { action: "underline", label: "Underline", mod: true, code: "KeyU", native: true },
  { action: "undo", label: "Undo", mod: true, code: "KeyZ" },
  { action: "redo", label: "Redo", mod: true, shift: true, code: "KeyZ" },
  { action: "redo", label: "Redo", mod: true, code: "KeyY" },
  { action: "pastePlain", label: "Paste as plain text", mod: true, shift: true, code: "KeyV", native: true },
  { action: "focusList", label: "Go to notes list", alt: true, code: "Digit1" },
  { action: "search", label: "Search notes", alt: true, code: "Digit2" },
  { action: "focusEditor", label: "Go to note", alt: true, code: "Digit3" },
  { action: "search", label: "Search notes", mod: true, code: "KeyF" },
  { action: "help", label: "Show or hide this list", mod: true, code: "Slash" },
  // Chrome reserves Ctrl+N (new window).
  { action: "newNote", label: "New note", alt: true, code: "KeyN" },
  { action: "newSprint", label: "New task tracking", alt: true, code: "KeyS" },
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
  parts.push(hotkey.code === "Slash" ? "/" : hotkey.code.replace(/^(Key|Digit)/, ""));
  return parts.join(isMac ? "" : "+");
}
