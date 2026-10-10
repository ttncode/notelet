import "./dom.js";
import { test } from "node:test";
import assert from "node:assert/strict";
import { mergeTrackers } from "../extension/board-merge.js";
import { isValidBoard, sprintName } from "../extension/board.js";

const NOW = Date.UTC(2026, 9, 10);
const DONE = "s5";
const oldTask = (title, { points = 3, status = "s2", done = false, id = title } = {}) => ({ id, title, points, status, done });
const group = (name, counts, tasks) => ({ id: name, name, counts, collapsed: false, tasks });
const tracker = ({ id, start, end, title = "Task Tracking", html = "<p><br></p>", pinned = false, groups }) => ({
  id, html, pinned, updatedAt: 1, deletedAt: null, position: 1, sprint: { start, end, target: 18, title, groups },
});

const FIRST = tracker({
  id: "n1", start: "2026-09-21", end: "2026-10-02",
  groups: [group("Last Sprint", false, []), group("Current Sprint", true, [oldTask("Fix login", { done: true }), oldTask("Write tests")])],
});
const SECOND = tracker({
  id: "n2", start: "2026-10-05", end: "2026-10-16", title: "Weekly Plan (05/10 - 16/10)", html: "<p>Ask BA about CSV</p>", pinned: true,
  groups: [
    group("Last Sprint", false, [oldTask("Write tests", { id: "copy" }), oldTask("Old leftover")]),
    group("Current Sprint", true, [oldTask("Export CSV", { status: DONE, points: 8 })]),
  ],
});

test("each tracker note becomes a sprint on one board", () => {
  const [boardNote] = mergeTrackers([SECOND, FIRST], { counts: [DONE], now: NOW });
  const { board } = boardNote;
  assert.equal(isValidBoard(board), true);
  assert.deepEqual(board.sprints.map((sprint) => [sprint.id, sprint.start, sprint.goal, sprint.tasks.map((task) => task.title)]), [
    ["n1", "2026-09-21", 18, ["Fix login", "Write tests"]],
    ["n2", "2026-10-05", 18, ["Export CSV"]],
  ]);
  assert.equal(sprintName(board.sprints[0]), "Sprint (21/09 – 02/10)");
  assert.equal(board.sprints[1].name, "Weekly Plan (05/10 - 16/10)");
  assert.equal(boardNote.pinned, true);
});

test("a ticked task keeps counting by taking the Done status", () => {
  const [{ board }] = mergeTrackers([FIRST], { counts: [DONE], now: NOW });
  assert.deepEqual(board.sprints[0].tasks.map((task) => task.status), [DONE, "s2"]);
  assert.equal("done" in board.sprints[0].tasks[0], false);
  assert.equal(board.sprints[0].tasks[0].note, "");
});

test("tasks from groups that did not count go to the backlog unless already on the board", () => {
  const [{ board }] = mergeTrackers([FIRST, SECOND], { counts: [DONE], now: NOW });
  assert.deepEqual(board.backlog.map((task) => task.title), ["Old leftover"]);
});

test("the old notes keep their own text under their title, or go to Recently Deleted", () => {
  const [, first, second] = mergeTrackers([FIRST, SECOND], { counts: [DONE], now: NOW });
  assert.equal(first.sprint, undefined);
  assert.equal(first.deletedAt, NOW);
  assert.equal(second.html, "<h1>Weekly Plan (05/10 - 16/10)</h1><p>Ask BA about CSV</p>");
  assert.equal(second.deletedAt, null);
});

test("merging the same tracker again replaces its sprint instead of adding a copy", () => {
  const [boardNote] = mergeTrackers([FIRST], { counts: [DONE], now: NOW });
  const [again] = mergeTrackers([boardNote, FIRST], { counts: [DONE], now: NOW });
  assert.equal(again.id, boardNote.id);
  assert.equal(again.board.sprints.length, 1);
});

test("nothing changes when there is no tracker note", () => {
  assert.deepEqual(mergeTrackers([{ id: "x", html: "<h1>A</h1>", pinned: false, updatedAt: 1, deletedAt: null }], { counts: [DONE], now: NOW }), []);
});
