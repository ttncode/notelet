import { test } from "node:test";
import assert from "node:assert/strict";
import { isPointOutside } from "../extension/dialogs.js";

const RECT = { left: 100, top: 50, right: 400, bottom: 300 };

test("a click inside the dialog box, edges included, is not outside", () => {
  assert.equal(isPointOutside(RECT, { x: 250, y: 150 }), false);
  assert.equal(isPointOutside(RECT, { x: 100, y: 50 }), false);
  assert.equal(isPointOutside(RECT, { x: 400, y: 300 }), false);
});

test("a click beyond any edge is outside", () => {
  assert.equal(isPointOutside(RECT, { x: 99, y: 150 }), true);
  assert.equal(isPointOutside(RECT, { x: 401, y: 150 }), true);
  assert.equal(isPointOutside(RECT, { x: 250, y: 49 }), true);
  assert.equal(isPointOutside(RECT, { x: 250, y: 301 }), true);
});
