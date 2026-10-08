import { test } from "node:test";
import assert from "node:assert/strict";
import { History } from "../extension/history.js";

const state = (html) => ({ html, caret: html.length });

test("undo returns the state before the last change and redo returns it back", () => {
  const history = new History();
  history.record(state("a"));
  assert.deepEqual(history.undo(state("ab")), state("a"));
  assert.deepEqual(history.redo(state("a")), state("ab"));
});

test("undo and redo with nothing recorded return null", () => {
  const history = new History();
  assert.equal(history.undo(state("a")), null);
  assert.equal(history.redo(state("a")), null);
});

test("a new change after undo clears redo", () => {
  const history = new History();
  history.record(state("a"));
  history.undo(state("ab"));
  history.record(state("a"));
  assert.equal(history.redo(state("ac")), null);
});

test("recording the same state twice keeps one entry", () => {
  const history = new History();
  history.record(state("a"));
  history.record(state("a"));
  history.undo(state("ab"));
  assert.equal(history.undo(state("a")), null);
});

test("undo skips checkpoints that equal the current state", () => {
  const history = new History();
  history.record(state("a"));
  history.record(state("ab"));
  assert.deepEqual(history.undo(state("ab")), state("a"));
});

test("only the newest 200 states are kept", () => {
  const history = new History();
  for (let i = 0; i < 205; i++) history.record(state(`s${i}`));
  let current = state("now");
  let steps = 0;
  for (let previous = history.undo(current); previous; previous = history.undo(current)) {
    current = previous;
    steps += 1;
  }
  assert.equal(steps, 200);
  assert.deepEqual(current, state("s5"));
});

test("clear forgets everything", () => {
  const history = new History();
  history.record(state("a"));
  history.clear();
  assert.equal(history.undo(state("b")), null);
});
