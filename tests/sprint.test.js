import "./dom.js";
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_STATUSES, addDays, isIsoDate, nextStatusId, parsePoints, sprintStats, statusFor, ticketSearchText,
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
