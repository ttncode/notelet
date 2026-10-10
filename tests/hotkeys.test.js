import { test } from "node:test";
import assert from "node:assert/strict";
import { HOTKEYS, fillShortcuts, hotkeyLabel, matchHotkey, normalizeCustomKeys, reservedReason, setCustomKeys } from "../extension/hotkeys.js";

const key = (code, modifiers = {}) => ({
  code, ctrlKey: false, metaKey: false, shiftKey: false, altKey: false, isComposing: false, ...modifiers,
});

test("Ctrl is the modifier on Windows and Linux", () => {
  assert.equal(matchHotkey(key("KeyL", { ctrlKey: true, shiftKey: true }), false), "checklist");
  assert.equal(matchHotkey(key("KeyL", { metaKey: true, shiftKey: true }), false), null);
});

test("Cmd is the modifier on Mac and Ctrl does not stand in for it", () => {
  assert.equal(matchHotkey(key("KeyL", { metaKey: true, shiftKey: true }), true), "checklist");
  assert.equal(matchHotkey(key("KeyL", { ctrlKey: true, shiftKey: true }), true), null);
});

test("nothing fires while an IME composition is active", () => {
  assert.equal(matchHotkey(key("KeyL", { ctrlKey: true, shiftKey: true, isComposing: true }), false), null);
});

test("Chrome-reserved shortcuts use Alt fallbacks that avoid Windows' Alt+Shift language switch", () => {
  assert.equal(matchHotkey(key("KeyT", { altKey: true }), false), "title");
  assert.equal(matchHotkey(key("KeyT", { altKey: true, shiftKey: true }), false), null);
  assert.equal(matchHotkey(key("KeyN", { altKey: true }), false), "newNote");
});

test("undo, both redo forms and search are matched", () => {
  assert.equal(matchHotkey(key("KeyZ", { ctrlKey: true }), false), "undo");
  assert.equal(matchHotkey(key("KeyZ", { ctrlKey: true, shiftKey: true }), false), "redo");
  assert.equal(matchHotkey(key("KeyY", { ctrlKey: true }), false), "redo");
  assert.equal(matchHotkey(key("KeyF", { ctrlKey: true }), false), "search");
});

test("shortcuts the browser already handles are not matched", () => {
  assert.equal(matchHotkey(key("KeyB", { ctrlKey: true }), false), null);
  assert.equal(matchHotkey(key("KeyV", { ctrlKey: true, shiftKey: true }), false), null);
});

test("labels use each platform's modifier names", () => {
  const checklist = HOTKEYS.find((hotkey) => hotkey.action === "checklist");
  assert.equal(hotkeyLabel(checklist, false), "Ctrl+Shift+L");
  assert.equal(hotkeyLabel(checklist, true), "⌘⇧L");
});

test("Alt+S starts a new sprint", () => {
  assert.equal(matchHotkey(key("KeyS", { altKey: true }), false), "newSprint");
});

test("lists use Notes' Shift+7, 8 and 9, matched by key position so any keyboard layout works", () => {
  assert.equal(matchHotkey(key("Digit7", { ctrlKey: true, shiftKey: true }), false), "bulleted");
  assert.equal(matchHotkey(key("Digit8", { metaKey: true, shiftKey: true }), true), "dashed");
  assert.equal(matchHotkey(key("Digit9", { ctrlKey: true, shiftKey: true }), false), "numbered");
  assert.equal(hotkeyLabel(HOTKEYS.find((hotkey) => hotkey.action === "numbered"), false), "Ctrl+Shift+9");
});

test("Alt+1, Alt+2 and Alt+3 go to the notes list, search and the note", () => {
  assert.equal(matchHotkey(key("Digit1", { altKey: true }), false), "focusList");
  assert.equal(matchHotkey(key("Digit2", { altKey: true }), false), "search");
  assert.equal(matchHotkey(key("Digit3", { altKey: true }), false), "focusEditor");
});

test("Ctrl+/ shows the shortcut list, labelled with a slash", () => {
  assert.equal(matchHotkey(key("Slash", { ctrlKey: true }), false), "help");
  assert.equal(matchHotkey(key("NumpadDivide", { ctrlKey: true }), false), "help");
  const help = HOTKEYS.find((hotkey) => hotkey.action === "help");
  assert.equal(hotkeyLabel(help, false), "Ctrl+/");
  assert.equal(hotkeyLabel(help, true), "⌘/");
});

test("no two shortcuts share a key", () => {
  const keys = HOTKEYS.map((hotkey) => [hotkey.mod, hotkey.shift, hotkey.alt, hotkey.code].join());
  assert.equal(new Set(keys).size, keys.length);
});

test("every button's shortcut is matched", () => {
  assert.equal(matchHotkey(key("Digit0", { altKey: true }), false), "toggleSidebar");
  assert.equal(matchHotkey(key("KeyP", { altKey: true }), false), "pin");
  assert.equal(matchHotkey(key("Backspace", { ctrlKey: true, shiftKey: true }), false), "deleteNote");
  assert.equal(matchHotkey(key("Comma", { ctrlKey: true }), false), "trackerSettings");
  assert.equal(matchHotkey(key("KeyK", { ctrlKey: true, shiftKey: true }), false), "monostyled");
  assert.equal(matchHotkey(key("KeyX", { ctrlKey: true, shiftKey: true }), false), "strikethrough");
});

test("tooltips name each button's shortcut for the platform", () => {
  assert.equal(fillShortcuts("Delete note ({deleteNote})", false), "Delete note (Ctrl+Shift+Backspace)");
  assert.equal(fillShortcuts("Delete note ({deleteNote})", true), "Delete note (⌘⇧⌫)");
  assert.equal(fillShortcuts("Search ({search}) · settings ({trackerSettings})", false), "Search (Ctrl+F) · settings (Ctrl+,)");
});

test("every shortcut has a group and each group is listed in one run, so help shows it once", () => {
  const groups = HOTKEYS.map((hotkey) => hotkey.group);
  assert.ok(groups.every(Boolean));
  const runs = groups.filter((group, index) => group !== groups[index - 1]);
  assert.equal(runs.length, new Set(groups).size);
});

test("a changed shortcut matches its new key, and a removed one matches nothing", () => {
  setCustomKeys({ pin: { mod: true, alt: false, shift: true, code: "KeyP" }, newNote: null });
  try {
    assert.equal(matchHotkey(key("KeyP", { ctrlKey: true, shiftKey: true }), false), "pin");
    assert.equal(matchHotkey(key("KeyP", { altKey: true }), false), null);
    assert.equal(matchHotkey(key("KeyN", { altKey: true }), false), null);
    assert.equal(fillShortcuts("Pin ({pin}) · New ({newNote})", false), "Pin (Ctrl+Shift+P) · New (no key)");
  } finally {
    setCustomKeys({});
  }
  assert.equal(matchHotkey(key("KeyP", { altKey: true }), false), "pin");
});

test("keys the browser or Windows keep, and keys without Ctrl or Alt, are refused with a reason", () => {
  const combo = (code, modifiers) => ({ mod: false, alt: false, shift: false, code, ...modifiers });
  assert.match(reservedReason(combo("KeyT", { mod: true }), false), /Chrome keeps Ctrl\+T/);
  assert.match(reservedReason(combo("KeyN", { mod: true, shift: true }), false), /Chrome keeps/);
  assert.match(reservedReason(combo("KeyK", { alt: true, shift: true }), false), /keyboard language/);
  assert.match(reservedReason(combo("KeyF", { alt: true }), false), /Chrome or Windows/);
  assert.match(reservedReason(combo("KeyK", {}), false), /Ctrl or Alt/);
  assert.equal(reservedReason(combo("KeyK", { mod: true, alt: true }), false), null);
});

test("stored shortcut changes keep only well-formed keys for shortcuts that can change", () => {
  const stored = {
    pin: { mod: true, alt: false, shift: false, code: "KeyJ" },
    newNote: null,
    bold: { mod: true, alt: false, shift: false, code: "KeyJ" },
    gone: null,
    search: { mod: "yes", alt: false, shift: false, code: "KeyJ" },
  };
  assert.deepEqual(Object.keys(normalizeCustomKeys(stored)), ["pin", "newNote"]);
  assert.deepEqual(normalizeCustomKeys("nope"), {});
  assert.deepEqual(new Set(HOTKEYS.map((hotkey) => hotkey.id)).size, HOTKEYS.length);
});
