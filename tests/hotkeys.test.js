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
