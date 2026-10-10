import "./dom.js";
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  EMPTY_NOTE_HTML, isEmptyNote, isExpired, newNote, noteLines, notePreview, noteText, noteTitle, orderedGroups, placeNote,
  stepNote,
} from "../extension/model.js";

const DAY_MS = 86_400_000;
const NOW = new Date(2026, 9, 8, 15, 0).getTime();
const note = (overrides) => ({ id: "n", html: "<h1>T</h1>", pinned: false, updatedAt: NOW, deletedAt: null, ...overrides });

test("title and preview come from the first two lines of text", () => {
  const html = "<h1>Weekly Plan</h1><p></p><p>Target: 18</p>";
  assert.equal(noteTitle(html), "Weekly Plan");
  assert.equal(notePreview(html), "Target: 18");
});

test("a note without text has fallback title and preview and counts as empty", () => {
  assert.equal(noteTitle(EMPTY_NOTE_HTML), "New Note");
  assert.equal(notePreview(EMPTY_NOTE_HTML), "No additional text");
  assert.equal(isEmptyNote(EMPTY_NOTE_HTML), true);
  assert.equal(isEmptyNote("<p> x </p>"), false);
});

test("nested list text is not repeated in its parent item", () => {
  const html = '<ol><li>Question<ul class="dashed"><li>Answer</li></ul></li></ol>';
  assert.deepEqual(noteLines(html), ["Question", "Answer"]);
});

test("line breaks and monostyled blocks split into lines", () => {
  assert.deepEqual(noteLines("<p>a<br>b</p><pre>c\nd</pre>"), ["a", "b", "c", "d"]);
  assert.equal(noteText("<p>a<br>b</p>"), "a\nb");
});

test("new notes start empty with a title line", () => {
  const created = newNote(NOW);
  assert.equal(created.html, EMPTY_NOTE_HTML);
  assert.equal(created.pinned, false);
  assert.equal(created.deletedAt, null);
  assert.equal(created.updatedAt, NOW);
  assert.equal(created.position, NOW);
  assert.match(created.id, /^[0-9a-f-]{36}$/);
});

test("notes are listed pinned first, then in their own order, highest position first", () => {
  const notes = [
    note({ id: "low", position: 1 }),
    note({ id: "pin", pinned: true, position: 0 }),
    note({ id: "high", position: 9 }),
    note({ id: "legacy", updatedAt: 5 }),
  ];
  const summary = orderedGroups(notes).map((group) => [group.label, group.notes.map((n) => n.id)]);
  assert.deepEqual(summary, [["Pinned", ["pin"]], ["Notes", ["high", "legacy", "low"]]]);
});

test("without pinned notes the list has no section headings", () => {
  assert.deepEqual(orderedGroups([note({ id: "a", position: 1 })]).map((group) => group.label), [null]);
});

test("a dropped note lands between its new neighbours and takes their pinned state", () => {
  const notes = [note({ id: "a", position: 30 }), note({ id: "b", position: 20 }), note({ id: "c", position: 10 }), note({ id: "p", pinned: true, position: 99 })];
  assert.deepEqual(placeNote(notes, { id: "a", targetId: "c", placement: "before" }), { position: 15, pinned: false });
  assert.deepEqual(placeNote(notes, { id: "c", targetId: "a", placement: "before" }), { position: 1030, pinned: false });
  assert.deepEqual(placeNote(notes, { id: "a", targetId: "c", placement: "after" }), { position: -990, pinned: false });
  assert.deepEqual(placeNote(notes, { id: "b", targetId: "p", placement: "after" }), { position: -901, pinned: true });
});

test("moving a note one step swaps it with its neighbour in the same section", () => {
  const notes = [note({ id: "a", position: 30 }), note({ id: "b", position: 20 }), note({ id: "c", position: 10 })];
  assert.deepEqual(stepNote(notes, { id: "c", step: -1 }), { position: 25, pinned: false });
  assert.deepEqual(stepNote(notes, { id: "a", step: 1 }), { position: 15, pinned: false });
  assert.equal(stepNote(notes, { id: "a", step: -1 }), null);
});

test("deleted notes expire after 30 days", () => {
  assert.equal(isExpired(note({ deletedAt: NOW - 31 * DAY_MS }), NOW), true);
  assert.equal(isExpired(note({ deletedAt: NOW - 29 * DAY_MS }), NOW), false);
  assert.equal(isExpired(note(), NOW), false);
});


test("loose text after the blocks does not become the title", () => {
  assert.equal(noteTitle("<h1>Real title</h1><p>body</p>stray"), "Real title");
});
