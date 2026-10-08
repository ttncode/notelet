import { test } from "node:test";
import assert from "node:assert/strict";
import { backupFileName, createBackup, parseBackup } from "../extension/backup.js";

const NOW = new Date(2026, 9, 8, 9, 30);
const notes = [
  { id: "a", html: "<h1>Weekly Plan</h1><p>Target: 18</p>", pinned: true, updatedAt: 1, deletedAt: null },
  { id: "b", html: "<h1>Old</h1>", pinned: false, updatedAt: 2, deletedAt: 3 },
];
const backupWith = (overrides) => JSON.stringify({ app: "notelet", version: 1, exportedAt: NOW.toISOString(), notes, ...overrides });

test("an export imports back to the same notes", () => {
  assert.deepEqual(parseBackup(createBackup(notes, NOW)), { ok: true, notes });
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
  assert.match(parseBackup(backupWith({ version: 2 })).error, /newer version/);
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
