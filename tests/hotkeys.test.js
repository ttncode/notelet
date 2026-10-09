import { test } from "node:test";
import assert from "node:assert/strict";
import { HOTKEYS, hotkeyLabel, matchHotkey } from "../extension/hotkeys.js";

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
