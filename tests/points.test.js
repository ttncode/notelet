import "./dom.js";
import { test } from "node:test";
import assert from "node:assert/strict";
import { computePoints } from "../extension/points.js";

const item = (text, checked) => `<li data-checked="${checked}">${text}</li>`;
const sprint = (items, targetLine = "Target: 18") => `<h1>Sprint</h1><p>${targetLine}</p><ul class="checklist">${items.join("")}</ul>`;

test("a note without a Target line has no chart", () => {
  assert.equal(computePoints('<h1>Notes</h1><ul class="checklist"><li data-checked="true">a (5)</li></ul>'), null);
});

test("only ticked items count as completed", () => {
  const html = sprint([item("#1 A (5)", true), item("#2 B (8)", false)]);
  assert.deepEqual(computePoints(html), { target: 18, completed: 5, missing: 13, over: 0, unpointed: 0 });
});

test("the last number in parentheses is the points, so status and years do not interfere", () => {
  const html = sprint([item("#101 Restrict access (5) (InQC)", true), item("Fix report (2024) (3)", true)]);
  assert.equal(computePoints(html).completed, 8);
});

test("decimal points add up without floating point noise", () => {
  const html = sprint([item("a (0.1)", true), item("b (0.2)", true), item("c (1.25)", true)]);
  assert.equal(computePoints(html).completed, 1.55);
});

test("completing more than the target reports how far over", () => {
  const html = sprint([item("a (3)", true), item("b (4)", true)], "Target: 5");
  assert.deepEqual(computePoints(html), { target: 5, completed: 7, missing: 0, over: 2, unpointed: 0 });
});

test("items without points are counted separately", () => {
  const html = sprint([item("#103 Draft template (InProgress)", false), item("a (2)", true)]);
  assert.equal(computePoints(html).unpointed, 1);
});

test("nested checklist items count once each", () => {
  const html = `<p>Target: 9</p><ul class="checklist"><li data-checked="true">parent (3)<ul class="checklist">${item("child (2)", true)}</ul></li></ul>`;
  assert.equal(computePoints(html).completed, 5);
});

test("the first Target line wins and its case does not matter", () => {
  assert.equal(computePoints("<p>target: 9</p><p>Target: 36</p>").target, 9);
});
