import { test } from "node:test";
import assert from "node:assert/strict";
import { formatDayMonth, formatEditedDate, formatRowDate } from "../extension/format.js";

const NOW = new Date(2026, 9, 8, 22, 30).getTime();

test("a note edited today shows a 24-hour time; older notes show day/month/year", () => {
  assert.equal(formatRowDate(new Date(2026, 9, 8, 13, 12).getTime(), NOW), "13:12");
  assert.equal(formatRowDate(new Date(2026, 8, 30, 9, 0).getTime(), NOW), "30/09/2026");
});

test("the note's edited date is long and 24-hour", () => {
  assert.equal(formatEditedDate(new Date(2026, 9, 8, 13, 12).getTime()), "8 October 2026 at 13:12");
});

test("sprint dates show as day/month", () => {
  assert.equal(formatDayMonth(Date.UTC(2026, 8, 28)), "28/09");
});
