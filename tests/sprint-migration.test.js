import "./dom.js";
import { test } from "node:test";
import assert from "node:assert/strict";
import { parseHtml } from "../extension/model.js";
import { DEFAULT_STATUSES, migrateTargetNote } from "../extension/sprint.js";

const UPDATED_2026 = new Date(2026, 9, 1).getTime();
const TODAY = new Date(2026, 9, 8);
const tickets = (html) => [...parseHtml(html).body.querySelectorAll("ul.checklist > li")].map((item) => ({
  checked: item.getAttribute("data-checked"),
  points: item.getAttribute("data-points"),
  status: item.getAttribute("data-status"),
  text: item.textContent,
}));
const note = (html, extra = {}) => ({ id: "n", html, pinned: false, updatedAt: UPDATED_2026, deletedAt: null, ...extra });

test("a Target note becomes a sprint with points and statuses moved into attributes", () => {
  const html = '<h1>Weekly Plan (28/09 - 09/10) - (6) Points</h1><p>Target: 18</p><h2>Current Sprint</h2>'
    + '<ul class="checklist"><li data-checked="true">#101 Restrict access (5) (InQC)</li>'
    + '<li data-checked="false">#103 Draft template (InProgress)</li>'
    + '<li data-checked="false">#104 Unknown status (3) (Blocked)</li></ul>';
  const migrated = migrateTargetNote(note(html), DEFAULT_STATUSES, TODAY);
  assert.deepEqual(migrated.sprint, { start: "2026-09-28", end: "2026-10-09", target: 18 });
  assert.equal(migrated.html.includes("Target"), false);
  assert.match(migrated.html, /<h2>Current Sprint<\/h2>/);
  assert.deepEqual(tickets(migrated.html), [
    { checked: "true", points: "5", status: "s4", text: "#101 Restrict access" },
    { checked: "false", points: null, status: "s2", text: "#103 Draft template" },
    { checked: "false", points: "3", status: "s1", text: "#104 Unknown status (Blocked)" },
  ]);
});

test("a year in a ticket title is kept; only the last number is the points", () => {
  const html = '<p>Target: 9</p><ul class="checklist"><li data-checked="false">Fix report (2024) (3)</li></ul>';
  assert.deepEqual(tickets(migrateTargetNote(note(html), DEFAULT_STATUSES, TODAY).html), [
    { checked: "false", points: "3", status: "s1", text: "Fix report (2024)" },
  ]);
});

test("a title range across New Year ends in the next year", () => {
  const migrated = migrateTargetNote(note("<h1>Sprint 28/12 - 08/01</h1><p>Target: 9</p>"), DEFAULT_STATUSES, TODAY);
  assert.deepEqual(migrated.sprint, { start: "2026-12-28", end: "2027-01-08", target: 9 });
});

test("without a valid title range the sprint starts today and lasts two weeks", () => {
  const plain = migrateTargetNote(note("<h1>Plan</h1><p>Target: 9</p>"), DEFAULT_STATUSES, TODAY);
  const impossible = migrateTargetNote(note("<h1>Plan 31/02 - 05/03</h1><p>Target: 9</p>"), DEFAULT_STATUSES, TODAY);
  assert.deepEqual(plain.sprint, { start: "2026-10-08", end: "2026-10-21", target: 9 });
  assert.deepEqual(impossible.sprint, plain.sprint);
});

test("notes without a Target line and notes already migrated are returned unchanged", () => {
  const ordinary = note("<h1>Ideas</h1><p>Target practice (2)</p>");
  const done = note("<p>Target: 9</p>", { sprint: { start: "2026-09-28", end: "2026-10-09", target: 9 } });
  assert.equal(migrateTargetNote(ordinary, DEFAULT_STATUSES, TODAY), ordinary);
  assert.equal(migrateTargetNote(done, DEFAULT_STATUSES, TODAY), done);
});

test("a Target of 0 is not a usable sprint, so the note is left as it is", () => {
  const zero = note("<h1>Plan</h1><p>Target: 0</p>");
  assert.equal(migrateTargetNote(zero, DEFAULT_STATUSES, TODAY), zero);
});

test("a Dec–Jan range edited in January belongs to the sprint that just ended", () => {
  const editedInJanuary = note("<h1>Plan 22/12 - 02/01</h1><p>Target: 9</p>", { updatedAt: new Date(2027, 0, 2).getTime() });
  assert.deepEqual(migrateTargetNote(editedInJanuary, DEFAULT_STATUSES, TODAY).sprint, { start: "2026-12-22", end: "2027-01-02", target: 9 });
});
