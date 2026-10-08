import "./dom.js";
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_STATUSES, addDays, isIsoDate, isValidSprint, isValidStatus, newSprint, nextStatusId, parsePoints, sprintStats,
  statusFor, ticketSearchText, validateSprintSettings,
} from "../extension/sprint.js";

const SPRINT = { start: "2026-09-28", end: "2026-10-09", target: 18 };
const ticket = (attrs, text = "t") => `<li ${attrs}>${text}</li>`;
const sprintHtml = (...items) => `<h1>Sprint</h1><ul class="checklist">${items.join("")}</ul>`;

test("only ticked tickets with points count as completed", () => {
  const html = sprintHtml(
    ticket('data-checked="true" data-points="5"'),
    ticket('data-checked="false" data-points="8"'),
    ticket('data-checked="true"'),
  );
  const stats = sprintStats(html, SPRINT, new Date(2026, 9, 8));
  assert.deepEqual(
    { completed: stats.completed, missing: stats.missing, over: stats.over, unpointed: stats.unpointed },
    { completed: 5, missing: 13, over: 0, unpointed: 1 },
  );
});

test("going past the target reports how far over", () => {
  const html = sprintHtml(ticket('data-checked="true" data-points="12.5"'), ticket('data-checked="true" data-points="7"'));
  const stats = sprintStats(html, SPRINT, new Date(2026, 9, 8));
  assert.equal(stats.completed, 19.5);
  assert.equal(stats.missing, 0);
  assert.equal(stats.over, 1.5);
});

test("the sprint day is clamped to the sprint", () => {
  const html = sprintHtml();
  assert.deepEqual(pick(sprintStats(html, SPRINT, new Date(2026, 9, 8))), { days: 12, day: 11, left: 1 });
  assert.deepEqual(pick(sprintStats(html, SPRINT, new Date(2026, 8, 1))), { days: 12, day: 0, left: 12 });
  assert.deepEqual(pick(sprintStats(html, SPRINT, new Date(2026, 11, 1))), { days: 12, day: 12, left: 0 });
});
const pick = ({ days, day, left }) => ({ days, day, left });

test("an unknown status shows as the first and cycles to the second", () => {
  assert.equal(statusFor(DEFAULT_STATUSES, "gone").id, "s1");
  assert.equal(nextStatusId(DEFAULT_STATUSES, "gone"), "s2");
  assert.equal(nextStatusId(DEFAULT_STATUSES, "s5"), "s1");
  assert.equal(nextStatusId(DEFAULT_STATUSES, "s2"), "s3");
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

test("search text lists each ticket's status label", () => {
  const html = sprintHtml(ticket('data-status="s3"'), ticket(""));
  assert.equal(ticketSearchText(html, DEFAULT_STATUSES), "In Review Todo");
});

const NOW = new Date(2026, 9, 8, 15, 0).getTime();
const sprintNote = (sprint, deletedAt = null) => ({ id: crypto.randomUUID(), html: "<h1>Sprint</h1>", pinned: false, updatedAt: 1, deletedAt, sprint });

test("a first sprint starts today and lasts two weeks with target 18", () => {
  const note = newSprint(NOW, [], DEFAULT_STATUSES);
  assert.deepEqual(note.sprint, { start: "2026-10-08", end: "2026-10-21", target: 18 });
  assert.equal(note.html, '<h1>Sprint</h1><ul class="checklist"><li data-checked="false" data-status="s1"><br></li></ul>');
});

test("a new sprint follows the latest live sprint and keeps its target", () => {
  const notes = [
    sprintNote({ start: "2026-09-14", end: "2026-09-27", target: 20 }),
    sprintNote({ start: "2026-09-28", end: "2026-10-09", target: 16 }),
    sprintNote({ start: "2026-12-01", end: "2026-12-14", target: 99 }, 5),
  ];
  assert.deepEqual(newSprint(NOW, notes, DEFAULT_STATUSES).sprint, { start: "2026-10-10", end: "2026-10-23", target: 16 });
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
