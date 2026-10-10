import "./dom.js";
import { test } from "node:test";
import assert from "node:assert/strict";
import { mergeBoard, mergeHtml, mergeNote, mergeSequence, mergeValue } from "../extension/merge.js";

test("a value changed on one side only takes that change; both changed keeps this window's", () => {
  assert.deepEqual(mergeValue(1, 1, 2), { value: 2, conflict: false });
  assert.deepEqual(mergeValue(1, 3, 1), { value: 3, conflict: false });
  assert.deepEqual(mergeValue(1, 3, 3), { value: 3, conflict: false });
  assert.deepEqual(mergeValue(1, 3, 4), { value: 3, conflict: true });
});

test("sequences keep inserts and removals from both sides", () => {
  assert.deepEqual(mergeSequence(["a", "b", "c"], ["a", "x", "b", "c"], ["a", "b", "c", "y"]).value, ["a", "x", "b", "c", "y"]);
  assert.deepEqual(mergeSequence(["a", "b", "c"], ["a", "c"], ["a", "b", "c", "y"]).value, ["a", "c", "y"]);
  assert.deepEqual(mergeSequence(["a", "b"], ["a", "x"], ["a", "y"]), { value: ["a", "x"], conflict: true });
});

test("note text merges paragraph by paragraph and keeps both versions of a paragraph both changed", () => {
  const base = "<h1>Plan</h1><p>one</p><p>two</p>";
  const local = "<h1>Plan</h1><p>one A</p><p>two</p>";
  const remote = "<h1>Plan</h1><p>one</p><p>two B</p>";
  assert.deepEqual(mergeHtml(base, local, remote), { value: "<h1>Plan</h1><p>one A</p><p>two B</p>", conflict: false });
  assert.deepEqual(mergeHtml(base, "<h1>Plan</h1><p>one A</p><p>two</p>", "<h1>Plan</h1><p>one B</p><p>two</p>"), {
    value: "<h1>Plan</h1><p>one A</p><p>one B</p><p>two</p>", conflict: true,
  });
});

const task = (id, extra = {}) => ({ id, title: id, points: null, status: "s1", note: "", ...extra });
const BASE = {
  sprints: [{ id: "s1", name: "", start: "2026-10-05", end: "2026-10-16", goal: 18, tasks: [task("t1"), task("t2")] }],
  backlog: [task("b1")],
  monthGoals: {},
};
const editTask = (board, id, change) => ({
  ...board,
  sprints: board.sprints.map((sprint) => ({ ...sprint, tasks: sprint.tasks.map((item) => (item.id === id ? { ...item, ...change } : item)) })),
  backlog: board.backlog.map((item) => (item.id === id ? { ...item, ...change } : item)),
});
const tasksOf = (board) => board.sprints[0].tasks.map(({ id, points, note }) => [id, points, note]);

test("edits to different tasks in two windows both survive", () => {
  const merged = mergeBoard(BASE, editTask(BASE, "t1", { points: 3 }), editTask(BASE, "t2", { points: 8 }));
  assert.deepEqual(tasksOf(merged.value), [["t1", 3, ""], ["t2", 8, ""]]);
  assert.equal(merged.conflict, false);
});

test("different fields of one task both survive; the same field keeps this window's", () => {
  const merged = mergeBoard(BASE, editTask(BASE, "t1", { points: 3 }), editTask(BASE, "t1", { note: "<p>from B</p>" }));
  assert.deepEqual(tasksOf(merged.value)[0], ["t1", 3, "<p>from B</p>"]);
  const clash = mergeBoard(BASE, editTask(BASE, "t1", { points: 3 }), editTask(BASE, "t1", { points: 5 }));
  assert.deepEqual([tasksOf(clash.value)[0][1], clash.conflict], [3, true]);
});

test("new tasks from both windows are kept and a task moved in one window stays moved", () => {
  const local = { ...BASE, sprints: [{ ...BASE.sprints[0], tasks: [...BASE.sprints[0].tasks, task("n1")] }] };
  const remote = { ...BASE, sprints: [{ ...BASE.sprints[0], tasks: [BASE.sprints[0].tasks[1], task("n2")] }], backlog: [...BASE.backlog, BASE.sprints[0].tasks[0]] };
  const merged = mergeBoard(BASE, local, remote).value;
  assert.deepEqual(merged.sprints[0].tasks.map((item) => item.id), ["t2", "n1", "n2"]);
  assert.deepEqual(merged.backlog.map((item) => item.id), ["b1", "t1"]);
});

test("a task deleted in one window stays deleted", () => {
  const local = { ...BASE, sprints: [{ ...BASE.sprints[0], tasks: [BASE.sprints[0].tasks[1]] }] };
  assert.deepEqual(mergeBoard(BASE, local, editTask(BASE, "t1", { points: 2 })).value.sprints[0].tasks.map((item) => item.id), ["t2"]);
});

test("tasks added to a sprint deleted in the other window land in the backlog", () => {
  const local = { ...BASE, sprints: [], backlog: [...BASE.backlog, ...BASE.sprints[0].tasks] };
  const remote = { ...BASE, sprints: [{ ...BASE.sprints[0], tasks: [...BASE.sprints[0].tasks, task("n2")] }] };
  const merged = mergeBoard(BASE, local, remote).value;
  assert.deepEqual([merged.sprints.length, merged.backlog.map((item) => item.id)], [0, ["b1", "t1", "t2", "n2"]]);
});

test("sprint settings and month goals merge field by field", () => {
  const local = { ...BASE, sprints: [{ ...BASE.sprints[0], goal: 20 }] };
  const remote = { ...BASE, sprints: [{ ...BASE.sprints[0], name: "Release" }], monthGoals: { "2026-10": 40 } };
  const merged = mergeBoard(BASE, local, remote).value;
  assert.deepEqual([merged.sprints[0].goal, merged.sprints[0].name, merged.monthGoals], [20, "Release", { "2026-10": 40 }]);
});

test("a whole note merges its text, pin and board, and keeps the newer time", () => {
  const base = { id: "n", html: "<p>a</p><p>b</p>", pinned: false, updatedAt: 1, deletedAt: null, position: 1 };
  const { note, conflict } = mergeNote(base, { ...base, html: "<p>a 1</p><p>b</p>", updatedAt: 5 }, { ...base, html: "<p>a</p><p>b 2</p>", pinned: true, updatedAt: 3 });
  assert.deepEqual({ html: note.html, pinned: note.pinned, updatedAt: note.updatedAt, conflict }, { html: "<p>a 1</p><p>b 2</p>", pinned: true, updatedAt: 5, conflict: false });
});
