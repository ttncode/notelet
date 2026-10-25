import { test } from "node:test";
import assert from "node:assert/strict";
import { nextCase, wordAt } from "../extension/case.js";

const press = (text) => nextCase(text)(text);

test("the case goes lowercase, UPPERCASE, Capitalize Each Word and back", () => {
  assert.equal(press("hello world"), "HELLO WORLD");
  assert.equal(press("HELLO WORLD"), "Hello World");
  assert.equal(press("Hello World"), "hello world");
  assert.equal(press("hELLo"), "hello");
});

test("a step that changes nothing is skipped", () => {
  assert.equal(press("A"), "a");
  assert.equal(press("I'M OK"), "I'm Ok");
});

test("capitalizing text split over nodes looks at the character before it", () => {
  const change = nextCase("HELLO");
  assert.equal(change("LO", "L"), "lo");
  assert.equal(change("LO", " "), "Lo");
});

test("the word at the caret takes letters, digits and apostrophes", () => {
  assert.deepEqual(wordAt("say don't now", 6), [4, 9]);
  assert.deepEqual(wordAt("say don't now", 4), [4, 9]);
  assert.deepEqual(wordAt("a  b", 2), [2, 2]);
});
