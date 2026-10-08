import "./dom.js";
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  EMPTY_NOTE_HTML, groupNotes, isEmptyNote, isExpired, newNote, noteLines, notePreview, noteText, noteTitle,
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
  assert.match(created.id, /^[0-9a-f-]{36}$/);
});

test("notes are grouped pinned first, then by age, newest first", () => {
  const notes = [
    note({ id: "old", updatedAt: NOW - 20 * DAY_MS }),
    note({ id: "pin", pinned: true, updatedAt: NOW - 40 * DAY_MS }),
    note({ id: "today", updatedAt: NOW - 3_600_000 }),
    note({ id: "week", updatedAt: NOW - 3 * DAY_MS }),
    note({ id: "today2", updatedAt: NOW }),
  ];
  const summary = groupNotes(notes, NOW).map((group) => [group.label, group.notes.map((n) => n.id)]);
  assert.deepEqual(summary, [
    ["Pinned", ["pin"]],
    ["Today", ["today2", "today"]],
    ["Previous 7 Days", ["week"]],
    ["Previous 30 Days", ["old"]],
  ]);
});

test("notes older than 30 days are grouped by month", () => {
  const updatedAt = NOW - 60 * DAY_MS;
  const [group] = groupNotes([note({ updatedAt })], NOW);
  assert.equal(group.label, new Date(updatedAt).toLocaleDateString(undefined, { month: "long", year: "numeric" }));
});

test("deleted notes expire after 30 days", () => {
  assert.equal(isExpired(note({ deletedAt: NOW - 31 * DAY_MS }), NOW), true);
  assert.equal(isExpired(note({ deletedAt: NOW - 29 * DAY_MS }), NOW), false);
  assert.equal(isExpired(note(), NOW), false);
});
