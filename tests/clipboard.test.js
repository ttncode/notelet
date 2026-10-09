import "./dom.js";
import { test } from "node:test";
import assert from "node:assert/strict";
import { clipboardHtml, clipboardText } from "../extension/clipboard.js";
import { parseHtml } from "../extension/model.js";
import { sanitizeHtml } from "../extension/sanitize.js";

const NOTE = '<h1>Todo</h1><h2>Heading</h2><p>Body <b>bold</b> <a href="https://example.com">link</a></p>'
  + '<ul class="checklist"><li data-checked="true">Done item</li><li data-checked="false">Open item</li></ul>'
  + "<ul><li>Bullet<ul><li>Nested</li></ul></li></ul>"
  + '<ul class="dashed"><li>Dash</li></ul><ol><li>One</li><li>Two</li></ol><pre>mono  text\nsecond</pre>';
const root = (html) => parseHtml(html).body;

test("plain text marks every kind of list the Markdown way", () => {
  assert.equal(clipboardText(root(NOTE)), [
    "Todo", "Heading", "Body bold link",
    "- [x] Done item", "- [ ] Open item",
    "• Bullet", "    • Nested",
    "- Dash",
    "1. One", "2. Two",
    "mono  text", "second",
  ].join("\n"));
});

test("a selection inside one line copies just its text", () => {
  assert.equal(clipboardText(root("part of <b>a</b> line")), "part of a line");
});

test("HTML keeps the structure, adds visible ticks and dashes and no styling", () => {
  const html = clipboardHtml(root(NOTE));
  assert.match(html, /<li data-checked="true"><span data-copy-marker="">☑ <\/span>Done item<\/li>/);
  assert.match(html, /<li data-checked="false"><span data-copy-marker="">☐ <\/span>Open item<\/li>/);
  assert.match(html, /<li><span data-copy-marker="">– <\/span>Dash<\/li>/);
  assert.match(html, /<b>bold<\/b>/);
  assert.doesNotMatch(html, /color|background|font-size/);
});

test("pasting a Notelet copy back into a note drops the added ticks and dashes", () => {
  const pasted = sanitizeHtml(clipboardHtml(root(NOTE)));
  assert.match(pasted, /<ul class="checklist"><li data-checked="true">Done item<\/li>/);
  assert.match(pasted, /<ul class="dashed"><li>Dash<\/li><\/ul>/);
});

const PASTED = "<p>Cập nhật UI:\n  - Thêm badge\n  - Luôn hiển thị</p>";

test("line breaks typed as Enter, Shift+Enter or pasted text all come out as lines", () => {
  assert.equal(clipboardText(root(PASTED)), "Cập nhật UI:\n  - Thêm badge\n  - Luôn hiển thị");
  assert.equal(clipboardText(root("<p>a<br>b<br></p><p><br></p><p>c</p>")), "a\nb\n\nc");
});

test("blocks nested inside other blocks or list items are not dropped", () => {
  assert.equal(clipboardText(root("<div>first<div>second</div></div>")), "first\nsecond");
  assert.equal(clipboardText(root("<ul><li>item<p>more</p></li></ul>")), "• item\n    more");
});

// linkedom writes a non-breaking space as &#160;, Chrome as &nbsp;.
const withNbsp = (html) => html.replace(/&#160;|&nbsp;/g, "\u00a0");

test("HTML keeps line breaks, indents and tabs that other apps would collapse", () => {
  const html = withNbsp(clipboardHtml(root(PASTED)));
  assert.equal(html, "<p>Cập nhật UI:<br>  - Thêm badge<br>  - Luôn hiển thị</p>");
  assert.equal(withNbsp(clipboardHtml(root("<p>a\tb  c</p>"))), "<p>a    b  c</p>");
  assert.equal(clipboardHtml(root("<pre>keep\n  as is</pre>")), "<pre>keep\n  as is</pre>");
});
