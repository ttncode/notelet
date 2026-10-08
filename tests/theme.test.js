import { test } from "node:test";
import assert from "node:assert/strict";
import { nextTheme, themeLabel } from "../extension/theme.js";

test("the theme cycles System, Light, Dark and back", () => {
  assert.equal(nextTheme("system"), "light");
  assert.equal(nextTheme("light"), "dark");
  assert.equal(nextTheme("dark"), "system");
});

test("an unknown stored theme is treated as System", () => {
  assert.equal(nextTheme("purple"), "light");
  assert.equal(themeLabel("purple"), "Theme: System");
  assert.equal(themeLabel("dark"), "Theme: Dark");
});
