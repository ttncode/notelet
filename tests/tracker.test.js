import { test } from "node:test";
import assert from "node:assert/strict";
import { roundPoints, trackerTitle } from "../extension/tracker.js";

test("an old tracker with an empty title is called Task Tracking", () => {
  assert.equal(trackerTitle({ title: " " }), "Task Tracking");
  assert.equal(trackerTitle({ title: "Weekly Plan" }), "Weekly Plan");
});

test("points round to two decimals", () => {
  assert.equal(roundPoints(0.1 + 0.2), 0.3);
});
