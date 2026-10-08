import "./dom.js";
import { DEFAULT_SECTIONS } from "../extension/sections.js";
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_STATUSES, addDays, isIsoDate, isValidSprint, isValidStatus, newSprint, parsePoints, sprintStats,
  normalizeSettings, sameSettings, statusFor, upgradeNote, validateSprintSettings,
} from "../extension/sprint.js";

const task = (points, done, status = "s1") => ({ id: crypto.randomUUID(), title: "t", points, status, done });
const group = (counts, ...tasks) => ({ id: crypto.randomUUID(), name: "g", counts, collapsed: false, tasks });
const SPRINT = { start: "2026-09-28", end: "2026-10-09", target: 18, title: "Task Tracking", groups: [] };
const withTasks = (...tasks) => ({ ...SPRINT, groups: [group(true, ...tasks)] });

test("only ticked tasks with points count as completed", () => {
  const stats = sprintStats(withTasks(task(5, true), task(8, false), task(null, true)), new Date(2026, 9, 8));
  assert.deepEqual(
    { completed: stats.completed, missing: stats.missing, over: stats.over, unpointed: stats.unpointed },
    { completed: 5, missing: 13, over: 0, unpointed: 1 },
  );
});

test("going past the target reports how far over", () => {
  const stats = sprintStats(withTasks(task(12.5, true), task(7, true)), new Date(2026, 9, 8));
  assert.equal(stats.completed, 19.5);
  assert.equal(stats.missing, 0);
  assert.equal(stats.over, 1.5);
});

test("sprint days count Monday to Friday only and stay within the sprint", () => {
  assert.deepEqual(pick(sprintStats(SPRINT, new Date(2026, 9, 8))), { days: 10, day: 9, left: 1 });
  assert.deepEqual(pick(sprintStats(SPRINT, new Date(2026, 8, 1))), { days: 10, day: 0, left: 10 });
  assert.deepEqual(pick(sprintStats(SPRINT, new Date(2026, 11, 1))), { days: 10, day: 10, left: 0 });
  assert.deepEqual(pick(sprintStats(SPRINT, new Date(2026, 9, 3))), { days: 10, day: 5, left: 5 });
});
const pick = ({ days, day, left }) => ({ days, day, left });

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
const sprintNote = (sprint, deletedAt = null) => ({ id: crypto.randomUUID(), html: "<p><br></p>", pinned: false, updatedAt: 1, deletedAt, sprint });
const dates = ({ start, end, target }) => ({ start, end, target });
const groupShape = (sprint) => sprint.groups.map(({ name, counts, tasks }) => [name, counts, tasks.length]);

test("a first tracker starts today, lasts two weeks with target 18 and has empty Last and Current Sprint groups", () => {
  const note = newSprint(NOW, []);
  assert.deepEqual(dates(note.sprint), { start: "2026-10-08", end: "2026-10-21", target: 18 });
  assert.equal(note.sprint.title, "Task Tracking");
  assert.deepEqual(groupShape(note.sprint), [["Last Sprint", false, 0], ["Current Sprint", true, 0]]);
  assert.equal(note.html, "<p><br></p>");
});

test("a new tracker copies the latest tracker's group names and count settings, not its tasks", () => {
  const latest = sprintNote({ ...SPRINT, groups: [group(true, task(3, true)), { ...group(false), name: "Support" }] });
  assert.deepEqual(groupShape(newSprint(NOW, [latest]).sprint), [["g", true, 0], ["Support", false, 0]]);
});

test("a new sprint starts the next working day after the latest live sprint and lasts ten working days", () => {
  const notes = [
    sprintNote({ start: "2026-09-14", end: "2026-09-27", target: 20 }),
    sprintNote({ start: "2026-09-28", end: "2026-10-09", target: 16 }),
    sprintNote({ start: "2026-12-01", end: "2026-12-14", target: 99 }, 5),
  ];
  assert.deepEqual(dates(newSprint(NOW, notes).sprint), { start: "2026-10-12", end: "2026-10-23", target: 16 });
});

test("settings need an end on or after the start, a positive target and labelled statuses", () => {
  const valid = { start: "2026-09-28", end: "2026-10-09", target: 18, statuses: DEFAULT_STATUSES };
  assert.equal(validateSprintSettings(valid), null);
  assert.match(validateSprintSettings({ ...valid, end: "2026-09-01" }), /end date/);
  assert.match(validateSprintSettings({ ...valid, target: 0 }), /Target/);
  assert.match(validateSprintSettings({ ...valid, statuses: [] }), /at least one/);
  assert.match(validateSprintSettings({ ...valid, statuses: [{ id: "s1", label: " ", color: "#000000" }] }), /label/);
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
  const reordered = { statuses: DEFAULT_STATUSES.map(({ id, label, color }) => ({ color, id, label })) };
  assert.equal(sameSettings({ statuses: DEFAULT_STATUSES }, reordered), true);
  assert.equal(sameSettings({ statuses: DEFAULT_STATUSES }, { statuses: DEFAULT_STATUSES.slice(1) }), false);
  assert.equal(sameSettings({ statuses: DEFAULT_STATUSES }, { statuses: [{ ...DEFAULT_STATUSES[0], color: "#000000" }, ...DEFAULT_STATUSES.slice(1)] }), false);
});

test("a first sprint created on a weekend starts the following Monday", () => {
  const saturday = new Date(2026, 9, 10, 9, 0).getTime();
  assert.deepEqual(dates(newSprint(saturday, []).sprint), { start: "2026-10-12", end: "2026-10-23", target: 18 });
});

test("only groups that count add to the points", () => {
  const sprint = { ...SPRINT, groups: [group(false, task(3, true)), group(true, task(5, true), task(null, false))] };
  assert.deepEqual([sprintStats(sprint, new Date(2026, 9, 8)).completed, sprintStats(sprint, new Date(2026, 9, 8)).unpointed], [5, 1]);
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
