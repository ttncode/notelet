import { test } from "node:test";
import assert from "node:assert/strict";
import { defaultPopupBounds, POPUP_PATH } from "../extension/popup-window.js";

test("the first popup opens at the top right of the current browser window", () => {
  assert.deepEqual(defaultPopupBounds({ left: 100, top: 50, width: 1600, height: 900 }), { left: 1264, top: 122, width: 420, height: 640 });
});

test("a popup never starts off the left or top edge of the screen", () => {
  assert.deepEqual(defaultPopupBounds({ left: -8, top: -8, width: 300, height: 400 }), { left: 0, top: 64, width: 420, height: 640 });
});

test("the popup is the notes page in popup view", () => {
  assert.equal(POPUP_PATH, "notes.html?view=popup");
});
