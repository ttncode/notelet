import "./dom.js";
import { DEFAULT_SECTIONS } from "../extension/sections.js";
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_STATUSES, addDays, defaultSettings, isIsoDate, isValidSprint, isValidStatus, parsePoints,
  normalizeSettings, sameSettings, statusFor, upgradeNote, validateSprintSettings,
} from "../extension/sprint.js";

test("an unknown status shows as the first", () => {
  assert.equal(statusFor(DEFAULT_STATUSES, "gone").id, "s1");
});

test("points input accepts decimals with a comma, clears on empty and rejects the rest", () => {
  assert.equal(parsePoints("5"), 5);
  assert.equal(parsePoints(" 1,5 "), 1.5);
  assert.equal(parsePoints(""), null);
  assert.equal(parsePoints("abc"), undefined);
  assert.equal(parsePoints("-3"), undefined);
});

test("dates add across months and invalid dates are rejected", () => {
  assert.equal(addDays("2026-09-28", 13), "2026-10-11");
  assert.equal(isIsoDate("2026-02-28"), true);
  assert.equal(isIsoDate("2026-02-31"), false);
  assert.equal(isIsoDate("28/09/2026"), false);
});

const NOW = new Date(2026, 9, 8, 15, 0).getTime();
const SETTINGS = { statuses: DEFAULT_STATUSES, sections: DEFAULT_SECTIONS };
const task = (points, done, status = "s1") => ({ id: crypto.randomUUID(), title: "t", points, status, done });
const group = (counts, ...tasks) => ({ id: crypto.randomUUID(), name: "g", counts, collapsed: false, tasks });
const SPRINT = { start: "2026-09-28", end: "2026-10-09", target: 18, title: "Task Tracking", groups: [] };

test("settings need an end on or after the start, a positive goal, labelled statuses and counted statuses", () => {
  const valid = { sprint: { start: "2026-09-28", end: "2026-10-09", goal: 18 }, statuses: DEFAULT_STATUSES, sprintCounts: ["s5"], monthCounts: ["s5"] };
  assert.equal(validateSprintSettings(valid), null);
  assert.equal(validateSprintSettings({ ...valid, sprint: null }), null);
  assert.match(validateSprintSettings({ ...valid, sprint: { ...valid.sprint, end: "2026-09-01" } }), /end date/);
  assert.match(validateSprintSettings({ ...valid, sprint: { ...valid.sprint, goal: 0 } }), /Goal/);
  assert.match(validateSprintSettings({ ...valid, statuses: [] }), /at least one/);
  assert.match(validateSprintSettings({ ...valid, statuses: [{ id: "s1", label: " ", color: "#000000" }] }), /label/);
  assert.match(validateSprintSettings({ ...valid, monthCounts: [] }), /months/);
});

test("stored sprints and statuses are checked field by field", () => {
  assert.equal(isValidSprint({ start: "2026-09-28", end: "2026-10-09", target: 18 }), true);
  assert.equal(isValidSprint({ start: "2026-10-09", end: "2026-09-28", target: 18 }), false);
  assert.equal(isValidSprint({ start: "2026-09-28", end: "2026-10-09", target: -1 }), false);
  assert.equal(isValidStatus({ id: "s-1a2b", label: "Blocked", color: "#ff0000" }), true);
  assert.equal(isValidStatus({ id: "Bad Id", label: "x", color: "#ff0000" }), false);
  assert.equal(isValidStatus({ id: "s1", label: "x", color: "red" }), false);
  assert.equal(isValidStatus({ id: "s1", label: "a".repeat(21), color: "#ff0000" }), false);
});

test("settings with the same statuses are the same whatever the key order", () => {
  const settingsOf = (statuses) => normalizeSettings({ statuses });
  const reordered = settingsOf(DEFAULT_STATUSES.map(({ id, label, color }) => ({ color, id, label })));
  assert.equal(sameSettings(settingsOf(DEFAULT_STATUSES), reordered), true);
  assert.equal(sameSettings(settingsOf(DEFAULT_STATUSES), settingsOf(DEFAULT_STATUSES.slice(1))), false);
  assert.equal(sameSettings(settingsOf(DEFAULT_STATUSES), settingsOf([{ ...DEFAULT_STATUSES[0], color: "#000000" }, ...DEFAULT_STATUSES.slice(1)])), false);
  assert.equal(sameSettings(settingsOf(DEFAULT_STATUSES), { ...settingsOf(DEFAULT_STATUSES), monthCounts: ["s4", "s5"] }), false);
});

test("counted statuses default to Done and drop statuses that no longer exist", () => {
  assert.deepEqual(defaultSettings().sprintCounts, ["s5"]);
  assert.deepEqual(defaultSettings().monthCounts, ["s5"]);
  const settings = normalizeSettings({ statuses: DEFAULT_STATUSES.slice(0, 4), sprintCounts: ["s4", "s5"], monthCounts: ["s5"] });
  assert.deepEqual([settings.sprintCounts, settings.monthCounts], [["s4"], ["s4"]]);
});



test("upgrading a Target note makes a tracker with its tickets as tasks; trackers and plain notes are left alone", () => {
  const target = { id: "t", html: '<h1>Plan</h1><p>Target: 9</p><ul class="checklist"><li data-checked="true">a (2)</li></ul>', pinned: false, updatedAt: NOW, deletedAt: null };
  const upgraded = upgradeNote(target, SETTINGS, new Date(2026, 9, 8));
  assert.equal(upgraded.sprint.target, 9);
  assert.equal(upgraded.sprint.title, "Plan");
  assert.deepEqual(upgraded.sprint.groups.map((g) => g.tasks.map(({ title, points, done }) => [title, points, done])), [[], [["a", 2, true]]]);
  assert.equal(upgradeNote(upgraded, SETTINGS, new Date(2026, 9, 8)), upgraded);
  const plain = { ...target, html: "<h1>Ideas</h1>" };
  assert.equal(upgradeNote(plain, SETTINGS, new Date(2026, 9, 8)), plain);
});

test("stored groups are checked field by field", () => {
  assert.equal(isValidSprint({ ...SPRINT, groups: [group(true, task(2, false))] }), true);
  assert.equal(isValidSprint({ ...SPRINT, groups: [{ ...group(true), counts: "yes" }] }), false);
  assert.equal(isValidSprint({ ...SPRINT, groups: [group(true, { ...task(2, false), status: "Bad Id" })] }), false);
});
