import "./dom.js";
import { DEFAULT_SECTIONS } from "../extension/sections.js";
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_STATUSES, addDays, isIsoDate, isValidSprint, isValidStatus, newSprint, nextStatusId, parsePoints, sprintStats,
  normalizeSettings, sameSettings, statusFor, ticketSearchText, upgradeNote, validateSprintSettings,
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
  const stats = sprintStats(html, { sprint: SPRINT, today: new Date(2026, 9, 8), sections: DEFAULT_SECTIONS });
  assert.deepEqual(
    { completed: stats.completed, missing: stats.missing, over: stats.over, unpointed: stats.unpointed },
    { completed: 5, missing: 13, over: 0, unpointed: 1 },
  );
});

test("going past the target reports how far over", () => {
  const html = sprintHtml(ticket('data-checked="true" data-points="12.5"'), ticket('data-checked="true" data-points="7"'));
  const stats = sprintStats(html, { sprint: SPRINT, today: new Date(2026, 9, 8), sections: DEFAULT_SECTIONS });
  assert.equal(stats.completed, 19.5);
  assert.equal(stats.missing, 0);
  assert.equal(stats.over, 1.5);
});

test("sprint days count Monday to Friday only and stay within the sprint", () => {
  const html = sprintHtml();
  assert.deepEqual(pick(sprintStats(html, { sprint: SPRINT, today: new Date(2026, 9, 8), sections: DEFAULT_SECTIONS })), { days: 10, day: 9, left: 1 });
  assert.deepEqual(pick(sprintStats(html, { sprint: SPRINT, today: new Date(2026, 8, 1), sections: DEFAULT_SECTIONS })), { days: 10, day: 0, left: 10 });
  assert.deepEqual(pick(sprintStats(html, { sprint: SPRINT, today: new Date(2026, 11, 1), sections: DEFAULT_SECTIONS })), { days: 10, day: 10, left: 0 });
  assert.deepEqual(pick(sprintStats(html, { sprint: SPRINT, today: new Date(2026, 9, 3), sections: DEFAULT_SECTIONS })), { days: 10, day: 5, left: 5 });
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
const SETTINGS = { statuses: DEFAULT_STATUSES, sections: DEFAULT_SECTIONS };
const sprintNote = (sprint, deletedAt = null) => ({ id: crypto.randomUUID(), html: "<h1>Sprint</h1>", pinned: false, updatedAt: 1, deletedAt, sprint });

test("a first sprint starts today and lasts two weeks with target 18", () => {
  const note = newSprint(NOW, [], SETTINGS);
  assert.deepEqual(note.sprint, { start: "2026-10-08", end: "2026-10-21", target: 18 });
  assert.equal(
    note.html,
    '<h1>Sprint</h1><h2 data-section="last">Last Sprint</h2><ul class="checklist"></ul>'
      + '<h2 data-section="current">Current Sprint</h2><ul class="checklist"><li data-checked="false" data-status="s1"><br></li></ul>',
  );
});

test("a new sprint starts the next working day after the latest live sprint and lasts ten working days", () => {
  const notes = [
    sprintNote({ start: "2026-09-14", end: "2026-09-27", target: 20 }),
    sprintNote({ start: "2026-09-28", end: "2026-10-09", target: 16 }),
    sprintNote({ start: "2026-12-01", end: "2026-12-14", target: 99 }, 5),
  ];
  assert.deepEqual(newSprint(NOW, notes, SETTINGS).sprint, { start: "2026-10-12", end: "2026-10-23", target: 16 });
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
  assert.deepEqual(newSprint(saturday, [], SETTINGS).sprint, { start: "2026-10-12", end: "2026-10-23", target: 18 });
});

test("only counted sections add to the points", () => {
  const html = '<h2 data-section="last">L</h2><ul class="checklist"><li data-checked="true" data-points="3">old</li></ul>'
    + '<h2 data-section="current">C</h2><ul class="checklist"><li data-checked="true" data-points="5">a</li><li data-checked="false">b</li></ul>';
  const onlyCurrent = sprintStats(html, { sprint: SPRINT, today: new Date(2026, 9, 8), sections: DEFAULT_SECTIONS });
  assert.deepEqual([onlyCurrent.completed, onlyCurrent.unpointed], [5, 1]);
  const both = DEFAULT_SECTIONS.map((section) => ({ ...section, counts: true }));
  assert.equal(sprintStats(html, { sprint: SPRINT, today: new Date(2026, 9, 8), sections: both }).completed, 8);
});

test("section labels typed by the user are escaped in a new sprint", () => {
  const sections = [{ ...DEFAULT_SECTIONS[0], label: "<b>Old</b>" }, DEFAULT_SECTIONS[1]];
  assert.match(newSprint(NOW, [], { statuses: DEFAULT_STATUSES, sections }).html, /&lt;b&gt;Old&lt;\/b&gt;/);
});

test("settings saved before sections existed get the default sections", () => {
  assert.deepEqual(normalizeSettings({ statuses: DEFAULT_STATUSES }), { statuses: DEFAULT_STATUSES, sections: DEFAULT_SECTIONS.map((s) => ({ ...s })) });
  const custom = [{ ...DEFAULT_SECTIONS[0], counts: true }, DEFAULT_SECTIONS[1]];
  assert.deepEqual(normalizeSettings({ statuses: DEFAULT_STATUSES, sections: custom }).sections, custom);
});

test("settings differ when a section label or count flag differs", () => {
  const base = { statuses: DEFAULT_STATUSES, sections: DEFAULT_SECTIONS };
  assert.equal(sameSettings(base, { statuses: DEFAULT_STATUSES, sections: DEFAULT_SECTIONS.map((s) => ({ ...s })) }), true);
  assert.equal(sameSettings(base, { statuses: DEFAULT_STATUSES, sections: [{ ...DEFAULT_SECTIONS[0], counts: true }, DEFAULT_SECTIONS[1]] }), false);
});

test("upgrading a sprint note adds the sections; upgrading a Target note converts it first", () => {
  const settings = { statuses: DEFAULT_STATUSES, sections: DEFAULT_SECTIONS };
  const target = { id: "t", html: '<h1>Plan</h1><p>Target: 9</p><ul class="checklist"><li data-checked="true">a (2)</li></ul>', pinned: false, updatedAt: NOW, deletedAt: null };
  const upgraded = upgradeNote(target, settings, new Date(2026, 9, 8));
  assert.equal(upgraded.sprint.target, 9);
  assert.match(upgraded.html, /<h2 data-section="last">Last Sprint<\/h2><ul class="checklist"><\/ul><h2 data-section="current">Current Sprint<\/h2><ul class="checklist"><li /);
  const plain = { ...target, html: "<h1>Ideas</h1>" };
  assert.equal(upgradeNote(plain, settings, new Date(2026, 9, 8)), plain);
});

test("every section needs a name", () => {
  const valid = { start: "2026-09-28", end: "2026-10-09", target: 18, statuses: DEFAULT_STATUSES, sections: DEFAULT_SECTIONS };
  assert.equal(validateSprintSettings(valid), null);
  assert.match(validateSprintSettings({ ...valid, sections: [{ ...DEFAULT_SECTIONS[0], label: "  " }, DEFAULT_SECTIONS[1]] }), /section/);
});
