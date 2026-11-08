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

test("a toast can carry one action button that runs and closes the toast", async () => {
  const { parseHTML } = await import("linkedom");
  const { document } = parseHTML('<html><body><div id="toast" hidden></div></body></html>');
  globalThis.document = document;
  const { showToast } = await import("../extension/dialogs.js");
  let ran = 0;
  showToast("Moving from the extension?", { label: "Import backup", run: () => { ran += 1; } });
  const toast = document.getElementById("toast");
  const button = toast.querySelector("button");
  assert.equal(toast.hidden, false);
  assert.match(toast.textContent, /Moving from the extension\?/);
  assert.equal(button.textContent, "Import backup");
  button.click();
  assert.equal(ran, 1);
  assert.equal(toast.hidden, true);
  showToast("Saved.");
  assert.equal(toast.querySelector("button"), null);
  assert.equal(toast.textContent, "Saved.");
});
