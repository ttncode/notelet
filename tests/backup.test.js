import { test } from "node:test";
import assert from "node:assert/strict";
import { backupFileName, createBackup, parseBackup } from "../extension/backup.js";
import { DEFAULT_SECTIONS } from "../extension/sections.js";
import { defaultSettings } from "../extension/sprint.js";

const SETTINGS = defaultSettings();

const NOW = new Date(2026, 9, 8, 9, 30);
const notes = [
  { id: "a", html: "<h1>Weekly Plan</h1><p>Target: 18</p>", pinned: true, updatedAt: 1, deletedAt: null },
  { id: "b", html: "<h1>Old</h1>", pinned: false, updatedAt: 2, deletedAt: 3 },
];
const backupWith = (overrides) => JSON.stringify({ app: "notelet", version: 2, exportedAt: NOW.toISOString(), settings: SETTINGS, notes, ...overrides });

test("an export imports back to the same notes", () => {
  assert.deepEqual(parseBackup(createBackup(notes, SETTINGS, NOW)), { ok: true, version: 4, notes, settings: SETTINGS });
});

test("unknown note fields are dropped on import", () => {
  const result = parseBackup(backupWith({ notes: [{ ...notes[0], extra: "x" }] }));
  assert.deepEqual(result.notes, [notes[0]]);
});

test("a file that is not JSON is rejected", () => {
  assert.equal(parseBackup("# Target\n- Monthly").ok, false);
});

test("JSON from another app is rejected", () => {
  assert.deepEqual(parseBackup(JSON.stringify({ notes: [] })), { ok: false, error: "This file is not a Notelet backup." });
  assert.equal(parseBackup("null").ok, false);
});

test("a backup from a newer version asks for an update", () => {
  assert.match(parseBackup(backupWith({ version: 5 })).error, /newer version/);
});

test("a backup without a notes list is rejected", () => {
  assert.equal(parseBackup(backupWith({ notes: "x" })).ok, false);
});

test("one damaged note rejects the whole file and names it", () => {
  const damaged = [notes[0], { ...notes[1], html: 5 }];
  assert.deepEqual(parseBackup(backupWith({ notes: damaged })), {
    ok: false,
    error: "Note 2 in this backup is damaged, so nothing was imported.",
  });
  assert.equal(parseBackup(backupWith({ notes: [{ ...notes[0], deletedAt: "yesterday" }] })).ok, false);
  assert.equal(parseBackup(backupWith({ notes: [{ ...notes[0], id: "" }] })).ok, false);
});

test("backup files are named after the local date", () => {
  assert.equal(backupFileName(NOW), "notelet-backup-2026-10-08.json");
});

test("sprint data survives a round trip and a broken sprint rejects the file", () => {
  const sprintNote = { ...notes[0], sprint: { start: "2026-09-28", end: "2026-10-09", target: 18 } };
  assert.deepEqual(parseBackup(createBackup([sprintNote], SETTINGS, NOW)).notes, [sprintNote]);
  const broken = { ...sprintNote, sprint: { start: "2026-10-09", end: "2026-09-28", target: 18 } };
  assert.equal(parseBackup(backupWith({ notes: [broken] })).ok, false);
});

test("a version 2 backup needs a valid status list", () => {
  assert.equal(parseBackup(backupWith({ settings: { statuses: [] } })).ok, false);
  assert.equal(parseBackup(backupWith({ settings: { statuses: [{ id: "s1", label: "", color: "#000000" }] } })).ok, false);
});

test("a version 1 backup still imports, without settings", () => {
  const v1 = JSON.stringify({ app: "notelet", version: 1, exportedAt: NOW.toISOString(), notes });
  assert.deepEqual(parseBackup(v1), { ok: true, version: 1, notes, settings: null });
});

test("a note's list position survives a round trip and a bad one rejects the file", () => {
  const placed = { ...notes[0], position: 1234.5 };
  assert.deepEqual(parseBackup(createBackup([placed], SETTINGS, NOW)).notes, [placed]);
  assert.equal(parseBackup(backupWith({ notes: [{ ...notes[0], position: "top" }] })).ok, false);
});

test("a version 2 backup keeps its section settings so its sprint notes can become groups", () => {
  const withSections = { ...SETTINGS, sections: DEFAULT_SECTIONS };
  assert.deepEqual(parseBackup(backupWith({ settings: withSections })).settings, withSections);
  assert.equal(parseBackup(backupWith({ settings: { ...SETTINGS, sections: [DEFAULT_SECTIONS[0]] } })).ok, false);
});

const trackerNote = {
  ...notes[0],
  sprint: {
    start: "2026-09-28", end: "2026-10-09", target: 18, title: "Task Tracking",
    groups: [{ id: "g1", name: "Current Sprint", counts: true, collapsed: false, tasks: [{ id: "t1", title: "#1 Fix", points: 3, status: "s2", done: true }] }],
  },
};

test("tracker groups and tasks survive a round trip; a broken task rejects the file", () => {
  assert.deepEqual(parseBackup(createBackup([trackerNote], SETTINGS, NOW)).notes, [trackerNote]);
  const brokenTask = { ...trackerNote.sprint.groups[0].tasks[0], points: -1 };
  const broken = { ...trackerNote, sprint: { ...trackerNote.sprint, groups: [{ ...trackerNote.sprint.groups[0], tasks: [brokenTask] }] } };
  assert.equal(parseBackup(backupWith({ version: 3, notes: [broken] })).ok, false);
});
