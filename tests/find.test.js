import "./dom.js";
import { test } from "node:test";
import assert from "node:assert/strict";
import { parseHtml } from "../extension/model.js";
import { findMatches } from "../extension/find.js";

const note = (html) => parseHtml(html).body;
const spans = (matches) => matches.map(({ start, end }) => [start.node.data, start.offset, end.node.data, end.offset]);

test("finds every match, ignoring case, in document order", () => {
  const body = note("<h1>Plan</h1><p>plan the PLAN</p><ul><li>a plan</li></ul>");
  assert.deepEqual(spans(findMatches(body, "plan")), [
    ["Plan", 0, "Plan", 4],
    ["plan the PLAN", 0, "plan the PLAN", 4],
    ["plan the PLAN", 9, "plan the PLAN", 13],
    ["a plan", 2, "a plan", 6],
  ]);
});

test("a match can span bold or a link on one line", () => {
  const body = note("<p>re<b>lea</b>se</p>");
  assert.deepEqual(spans(findMatches(body, "release")), [["re", 0, "se", 2]]);
});

test("a match ending at the end of a node ends there, not at the next node's start", () => {
  const body = note("<p><b>tag</b> v1</p>");
  assert.deepEqual(spans(findMatches(body, "tag")), [["tag", 0, "tag", 3]]);
});

test("a match never runs from one line into the next", () => {
  const body = note("<p>foo</p><p>bar</p><ul><li>ba<ul><li>r</li></ul></li></ul>");
  assert.deepEqual(findMatches(body, "foobar"), []);
  assert.equal(findMatches(body, "bar").length, 1);
});

test("the query is plain text, not a pattern", () => {
  const body = note("<p>a.b axb (x) [y]</p>");
  assert.equal(findMatches(body, "a.b").length, 1);
  assert.equal(findMatches(body, "(x)").length, 1);
  assert.equal(findMatches(body, "[y]").length, 1);
});

test("an empty query finds nothing", () => {
  assert.deepEqual(findMatches(note("<p>text</p>"), ""), []);
});
