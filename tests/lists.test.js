import "./dom.js";
import { test } from "node:test";
import assert from "node:assert/strict";
import { parseHtml } from "../extension/model.js";
import { liftListOutOfParagraph, setBlockType } from "../extension/lists.js";

function paragraphWith(...children) {
  const doc = parseHtml("");
  const paragraph = doc.createElement("p");
  const list = doc.createElement("ul");
  list.append(doc.createElement("li"));
  paragraph.append(...children.map((child) => (child === "list" ? list : doc.createTextNode(child))));
  doc.body.append(paragraph);
  return { body: doc.body, list };
}

test("a list Chrome nests inside an empty paragraph is moved out and the paragraph removed", () => {
  const { body, list } = paragraphWith("list");
  liftListOutOfParagraph(list);
  assert.equal(body.innerHTML, "<ul><li></li></ul>");
});

test("text around the list keeps its place in paragraphs before and after it", () => {
  const { body, list } = paragraphWith("before", "list", "after");
  liftListOutOfParagraph(list);
  assert.equal(body.innerHTML, "<p>before</p><ul><li></li></ul><p>after</p>");
});

test("a list that is not inside a paragraph is left alone", () => {
  const { body, list } = paragraphWith("list");
  liftListOutOfParagraph(list);
  liftListOutOfParagraph(list);
  assert.equal(body.innerHTML, "<ul><li></li></ul>");
});

function convert(html, selector, tag) {
  const body = parseHtml(html).body;
  const block = [...body.querySelectorAll(selector.tag)].find((element) => element.firstChild.textContent === selector.text);
  setBlockType(block, tag);
  return body.innerHTML;
}

test("a paragraph changes style and keeps its formatting", () => {
  assert.equal(convert("<p>a <b>b</b></p>", { tag: "p", text: "a " }, "h1"), "<h1>a <b>b</b></h1>");
});

test("styling a middle list item splits the list around it", () => {
  const html = '<ul class="checklist"><li data-checked="true">a</li><li data-checked="false">b</li><li data-checked="false">c</li></ul>';
  assert.equal(
    convert(html, { tag: "li", text: "b" }, "h2"),
    '<ul class="checklist"><li data-checked="true">a</li></ul><h2>b</h2><ul class="checklist"><li data-checked="false">c</li></ul>',
  );
});

test("styling the only item removes the empty list", () => {
  assert.equal(convert("<ul><li>a</li></ul>", { tag: "li", text: "a" }, "p"), "<p>a</p>");
});

test("styling the first item keeps the rest of the list after it", () => {
  assert.equal(convert("<ol><li>a</li><li>b</li></ol>", { tag: "li", text: "a" }, "h3"), "<h3>a</h3><ol><li>b</li></ol>");
});

test("a list nested in the styled item follows it", () => {
  const html = '<ul><li>a<ul class="dashed"><li>x</li></ul></li></ul>';
  assert.equal(convert(html, { tag: "li", text: "a" }, "p"), '<p>a</p><ul class="dashed"><li>x</li></ul>');
});

test("an item of a list nested by Chrome keeps its place and splits the lists around it", () => {
  const html = "<ul><li>a</li><ul><li>b</li><li>c</li></ul></ul>";
  assert.equal(convert(html, { tag: "li", text: "b" }, "h2"), "<ul><li>a</li></ul><h2>b</h2><ul><ul><li>c</li></ul></ul>");
});

test("an item nested inside another item keeps its place before the following items", () => {
  const html = '<ol><li>a<ul class="dashed"><li>b</li><li>c</li></ul></li><li>d</li></ol>';
  assert.equal(
    convert(html, { tag: "li", text: "b" }, "h2"),
    '<ol><li>a</li></ol><h2>b</h2><ol><ul class="dashed"><li>c</li></ul><li>d</li></ol>',
  );
});

test("an empty item becomes an empty block the caret can sit in", () => {
  const body = parseHtml("<ul><li></li></ul>").body;
  setBlockType(body.querySelector("li"), "h1");
  assert.equal(body.innerHTML, "<h1><br></h1>");
});
