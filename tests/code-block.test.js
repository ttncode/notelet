import "./dom.js";
import { test } from "node:test";
import assert from "node:assert/strict";
import { codeBlockLines, fenceLanguage, isCodeLanguage, languageOf, setLanguage, unifyCodeLanguages } from "../app/code-block.js";
import { parseHtml } from "../app/model.js";

const body = (html) => parseHtml(html).body;

test("a code block is the run of Monostyled lines around a line", () => {
  const note = body("<p>a</p><pre>one</pre><pre>two</pre><pre>three</pre><p>b</p><pre>other</pre>");
  const lines = codeBlockLines(note.querySelectorAll("pre")[1]);
  assert.deepEqual(lines.map((line) => line.textContent), ["one", "two", "three"]);
});

test("setting a language marks every line of the block, and plain text clears it", () => {
  const note = body("<pre>one</pre><pre>two</pre>");
  const lines = codeBlockLines(note.firstChild);
  setLanguage(lines, "php");
  assert.equal(note.innerHTML, '<pre data-language="php">one</pre><pre data-language="php">two</pre>');
  setLanguage(lines, "");
  assert.equal(note.innerHTML, "<pre>one</pre><pre>two</pre>");
});

test("a block's language is the first known one on its lines", () => {
  const note = body('<pre>one</pre><pre data-language="nonsense">two</pre><pre data-language="bash">three</pre>');
  assert.equal(languageOf(codeBlockLines(note.firstChild)), "bash");
  assert.equal(languageOf(codeBlockLines(body("<pre>x</pre>").firstChild)), "");
});

test("a code fence gives its language, with the usual short names", () => {
  assert.equal(fenceLanguage("```"), "");
  assert.equal(fenceLanguage("```php"), "php");
  assert.equal(fenceLanguage("```JS"), "javascript");
  assert.equal(fenceLanguage("```sh"), "bash");
  assert.equal(fenceLanguage("```cobol"), null);
  assert.equal(fenceLanguage("``"), null);
  assert.equal(fenceLanguage("text ```php"), null);
});

test("plain text is not a language", () => {
  assert.equal(isCodeLanguage(""), false);
  assert.equal(isCodeLanguage("python"), true);
});

test("a line that joins a code block takes its language, and a block that already agrees is left alone", () => {
  const note = body('<pre>// header</pre><pre data-language="php">echo 1;</pre><p>x</p><pre data-language="sql">SELECT 1;</pre>');
  unifyCodeLanguages(note);
  assert.equal(note.innerHTML, '<pre data-language="php">// header</pre><pre data-language="php">echo 1;</pre><p>x</p><pre data-language="sql">SELECT 1;</pre>');
});
