import { test } from "node:test";
import assert from "node:assert/strict";
import { HOTKEYS } from "../extension/hotkeys.js";
import { keyValue } from "../tests-e2e/webdriver.js";

test("WebDriver key values for letters, digits, function keys and punctuation", () => {
  assert.equal(keyValue("KeyN"), "n");
  assert.equal(keyValue("Digit1"), "1");
  assert.equal(keyValue("F1"), "");
  assert.equal(keyValue("F5"), "");
  assert.equal(keyValue("F12"), "");
  assert.equal(keyValue("Slash"), "/");
  assert.equal(keyValue("ArrowLeft"), "");
  assert.throws(() => keyValue("NumpadAdd"), /no WebDriver key/);
});

test("every default shortcut has a WebDriver key, so the end-to-end test can press it", () => {
  for (const hotkey of HOTKEYS) assert.doesNotThrow(() => keyValue(hotkey.code), hotkey.id);
});
