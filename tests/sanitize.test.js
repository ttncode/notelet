import "./dom.js";
import { test } from "node:test";
import assert from "node:assert/strict";
import { parseHtml } from "../extension/model.js";
import { sanitizeHtml } from "../extension/sanitize.js";

test("keeps the editor's own structure unchanged", () => {
  const html = '<h1>T</h1><h2>H</h2><h3>S</h3><p>a <b>b</b> <i>c</i> <u>d</u> <s>e</s><br></p>'
    + '<ul class="checklist"><li data-checked="true">x</li></ul><ul class="dashed"><li>y</li></ul>'
    + '<ol><li>z</li></ol><pre>code</pre><p><a href="https://example.test/">link</a></p>';
  assert.equal(sanitizeHtml(html), html);
});

test("drops scripts, styles, images and frames with their content", () => {
  const html = '<p>a</p><script>alert(1)</script><style>p{}</style><img src="x" onerror="alert(1)"><iframe src="https://x.test"></iframe>';
  assert.equal(sanitizeHtml(html), "<p>a</p>");
});

test("strips event handlers, inline styles and classes", () => {
  assert.equal(sanitizeHtml('<p onclick="alert(1)" style="color:red" class="x">a</p>'), "<p>a</p>");
});

test("unwraps links that are not http, https or mailto", () => {
  const html = '<a href="javascript:alert(1)">x</a><a href=" JaVaScRiPt:alert(1)">y</a><a href="/relative">z</a><a href="mailto:a@b.test">m</a>';
  assert.equal(sanitizeHtml(html), '<p>xyz<a href="mailto:a@b.test">m</a></p>');
});

test("maps equivalent tags onto the editor's own", () => {
  assert.equal(sanitizeHtml("<strong>a</strong><em>b</em><del>c</del><h5>d</h5>"), "<p><b>a</b><i>b</i><s>c</s></p><h3>d</h3>");
});

test("turns web page wrappers into paragraphs and drops spans", () => {
  const html = '<div><span style="font-size:20px">Hello</span></div><div><p>Para</p></div>';
  assert.equal(sanitizeHtml(html), "<p>Hello</p><p>Para</p>");
});

test("turns table rows into paragraphs", () => {
  assert.equal(sanitizeHtml("<table><tr><td>a</td><td>b</td></tr><tr><td>c</td></tr></table>"), "<p>a b </p><p>c </p>");
});

test("keeps only known list classes and checked values", () => {
  assert.equal(
    sanitizeHtml('<ul class="todo checklist"><li data-checked="yes" data-x="1">a</li></ul>'),
    '<ul class="checklist"><li>a</li></ul>',
  );
});

test("text that looks like markup stays text", () => {
  assert.equal(sanitizeHtml("<p>&lt;script&gt;alert(1)&lt;/script&gt;</p>"), "<p>&lt;script&gt;alert(1)&lt;/script&gt;</p>");
});

test("loose text and inline formatting at the top level are wrapped in paragraphs", () => {
  assert.equal(sanitizeHtml("<div><p>a</p>b <b>c</b></div>d<h2>e</h2>"), "<p>a</p><p>b <b>c</b>d</p><h2>e</h2>");
});

test("whitespace between blocks does not create empty paragraphs", () => {
  assert.equal(sanitizeHtml("<p>a</p>\n  <p>b</p>"), "<p>a</p><p>b</p>");
});

test("ticket points and status attributes are kept only when well formed", () => {
  const kept = parseHtml(sanitizeHtml('<ul class="checklist"><li data-checked="true" data-points="2.5" data-status="s-1a2b">a</li></ul>')).body.querySelector("li");
  assert.deepEqual(
    ["data-checked", "data-points", "data-status"].map((name) => kept.getAttribute(name)),
    ["true", "2.5", "s-1a2b"],
  );
  assert.equal(
    sanitizeHtml('<ul class="checklist"><li data-points="lots" data-status="<b>">a</li></ul>'),
    '<ul class="checklist"><li>a</li></ul>',
  );
});

test("section headings keep their section marker; other values are dropped", () => {
  const kept = parseHtml(sanitizeHtml('<h2 data-section="current">Current Sprint</h2>')).body.querySelector("h2");
  assert.equal(kept.getAttribute("data-section"), "current");
  assert.equal(sanitizeHtml('<h2 data-section="evil">x</h2><p data-section="last">y</p>'), "<h2>x</h2><p>y</p>");
});
