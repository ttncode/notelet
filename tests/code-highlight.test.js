import "./dom.js";
import "../extension/vendor/prism.js";
import { test } from "node:test";
import assert from "node:assert/strict";
import { HIGHLIGHT_GROUPS, tokenRanges } from "../extension/code-highlight.js";

const coloured = (text, language) => tokenRanges(text, language).map(({ group, start, end }) => [group, text.slice(start, end)]);

test("every menu language has a Prism grammar", () => {
  for (const language of ["bash", "css", "html", "javascript", "json", "markdown", "php", "python", "sql", "typescript", "yaml"]) {
    assert.ok(globalThis.Prism.languages[language], language);
  }
});

test("bash commands, strings and comments get their colours", () => {
  assert.deepEqual(coloured('echo "hi" # note', "bash"), [["function", "echo"], ["string", '"hi"'], ["comment", "# note"]]);
});

test("a token's plain inner text takes the colour of the token around it", () => {
  assert.deepEqual(coloured("const s = `a ${b}`;", "javascript").filter(([group]) => group === "string"), [["string", "`"], ["string", "a "], ["string", "`"]]);
});

test("offsets run across lines", () => {
  const text = "<?php\n// say hi\necho 'hi';";
  for (const [, part] of coloured(text, "php")) assert.ok(text.includes(part));
  assert.ok(coloured(text, "php").some(([group, part]) => group === "comment" && part === "// say hi"));
});

test("plain text and unknown languages get no colours", () => {
  assert.deepEqual(tokenRanges("echo hi", ""), []);
  assert.deepEqual(tokenRanges("echo hi", "cobol"), []);
});

test("every colour group has a CSS rule", async () => {
  const { readFile } = await import("node:fs/promises");
  const css = await readFile(new URL("../extension/notes.css", import.meta.url), "utf8");
  for (const group of HIGHLIGHT_GROUPS) assert.match(css, new RegExp(`::highlight\\(code-${group}\\)`), group);
});
