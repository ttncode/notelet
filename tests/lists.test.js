import "./dom.js";
import { test } from "node:test";
import assert from "node:assert/strict";
import { parseHtml } from "../extension/model.js";
import { liftListOutOfParagraph } from "../extension/lists.js";

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
