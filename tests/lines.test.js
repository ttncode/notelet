import "./dom.js";
import { test } from "node:test";
import assert from "node:assert/strict";
import { parseHtml } from "../extension/model.js";
import {
  ABOVE, BELOW, duplicateLine, indentText, insertLine, lineOf, moveLine, nextLine, outdentText, previousLine, removeLine,
} from "../extension/lines.js";

const NOTE = "<h1>Title</h1><p>one</p><ul class=\"checklist\"><li data-checked=\"true\">a<ul><li>nested</li></ul></li><li data-checked=\"false\">b</li></ul><p>two</p>";
const note = (html = NOTE) => parseHtml(html).body;
const line = (body, text) => [...body.querySelectorAll("h1,p,li")].find((element) => element.firstChild.textContent === text);

test("a line moves past its neighbour and stays put at an edge", () => {
  const body = note();
  assert.equal(moveLine(line(body, "one"), ABOVE), true);
  assert.match(body.innerHTML, /^<p>one<\/p><h1>Title<\/h1>/);
  assert.equal(moveLine(line(body, "b"), BELOW), false);
  assert.equal(moveLine(line(body, "b"), ABOVE), true);
  assert.match(body.innerHTML, /<ul class="checklist"><li data-checked="false">b<\/li><li data-checked="true">a/);
});

test("a duplicate keeps the line's style, ticks and nested items", () => {
  const body = note();
  const copy = duplicateLine(line(body, "a"), BELOW);
  assert.equal(copy.outerHTML, line(body, "a").outerHTML);
  assert.equal(copy.previousElementSibling, line(body, "a"));
  assert.equal(duplicateLine(line(body, "Title"), ABOVE), body.firstChild);
  assert.match(body.innerHTML, /^<h1>Title<\/h1><h1>Title<\/h1><p>one/);
});

test("an inserted line is an empty item in a list, unticked in a checklist, and a body line elsewhere", () => {
  const body = note();
  assert.equal(insertLine(line(body, "b"), ABOVE).outerHTML, '<li data-checked="false"><br></li>');
  assert.equal(insertLine(line(body, "Title"), BELOW).outerHTML, "<p><br></p>");
  assert.match(body.innerHTML, /^<h1>Title<\/h1><p><br><\/p><p>one<\/p>/);
});

test("removing a list's last item removes the list too", () => {
  const body = note("<p>x</p><ul><li>only</li></ul>");
  removeLine(line(body, "only"));
  assert.equal(body.innerHTML, "<p>x</p>");
});

test("indent adds a leading tab and outdent takes one off", () => {
  const body = note("<p>text</p>");
  indentText(line(body, "text"));
  assert.equal(body.innerHTML, "<p>\ttext</p>");
  assert.equal(outdentText(body.firstChild), true);
  assert.equal(outdentText(body.firstChild), false);
  assert.equal(body.innerHTML, "<p>text</p>");
});

test("the lines next to a list item skip its own nested items", () => {
  const body = note();
  assert.equal(nextLine(body, line(body, "a")), line(body, "b"));
  assert.equal(previousLine(body, line(body, "b")), line(body, "nested"));
  assert.equal(previousLine(body, line(body, "nested")), line(body, "a"));
  assert.equal(nextLine(body, line(body, "two")), null);
});

test("the line of a node is its block, never the note itself", () => {
  const body = note();
  assert.equal(lineOf(body, line(body, "one").firstChild), line(body, "one"));
  assert.equal(lineOf(body, body), null);
});
