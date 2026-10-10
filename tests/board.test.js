import "./dom.js";
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  BACKLOG_ID, currentSprint, findTask, isValidBoard, monthProgress, monthsOf, moveOpenTasks, moveTask, newBoard, newSprint, removeSprint,
  pointsByStatus, setMonthGoal, sprintDays, sprintName, sprintPhase, sprintProgress, boardSearchText,
} from "../extension/board.js";
import { DEFAULT_STATUSES } from "../extension/sprint.js";

const DONE = "s5";
const QC = "s4";
let nextId = 0;
const task = (points, status = DONE, extra = {}) => ({ id: `t${nextId++}`, title: "Task", points, status, note: "", ...extra });
const sprint = (start, end, tasks = [], extra = {}) => ({ id: `${start}`, name: "", start, end, goal: 18, tasks, ...extra });

// The example from planning: two-week sprints, an 18 point goal each.
const EXAMPLE = {
  ...newBoard(),
  sprints: [
    sprint("2026-08-24", "2026-09-04", [task(5), task(5), task(8)]),
    sprint("2026-09-07", "2026-09-18", [task(5), task(3), task(8)]),
    sprint("2026-09-21", "2026-10-02", [task(2), task(8), task(8)]),
    sprint("2026-10-05", "2026-10-16", [task(8), task(8), task(2), task(2)]),
    sprint("2026-10-19", "2026-10-30", [task(8), task(8), task(2)]),
    sprint("2026-11-02", "2026-11-13", [task(12), task(3), task(3)]),
    sprint("2026-11-16", "2026-11-27", [task(12), task(3), task(3)]),
  ],
};

test("a month counts the sprints that end in it, and its goal is theirs added up", () => {
  const summary = (month) => {
    const { goal, done, toGo, over } = monthProgress(EXAMPLE, { month, counts: [DONE] });
    return { goal, done, toGo, over };
  };
  assert.deepEqual(summary("2026-09"), { goal: 36, done: 34, toGo: 2, over: 0 });
  assert.deepEqual(summary("2026-10"), { goal: 54, done: 56, toGo: 0, over: 2 });
  assert.deepEqual(summary("2026-11"), { goal: 36, done: 36, toGo: 0, over: 0 });
  assert.deepEqual(monthsOf(EXAMPLE), ["2026-11", "2026-10", "2026-09"]);
});

test("a month goal of its own replaces the automatic one until it is cleared", () => {
  const custom = setMonthGoal(EXAMPLE, { month: "2026-10", goal: 60 });
  assert.equal(monthProgress(custom, { month: "2026-10", counts: [DONE] }).goal, 60);
  assert.equal(monthProgress(custom, { month: "2026-10", counts: [DONE] }).autoGoal, 54);
  assert.equal(monthProgress(setMonthGoal(custom, { month: "2026-10", goal: null }), { month: "2026-10", counts: [DONE] }).goal, 54);
});

test("only the counted statuses add to done; tasks without points are reported", () => {
  const counted = sprint("2026-10-05", "2026-10-16", [task(5, DONE), task(3, QC), task(8, "s2"), task(null, DONE)]);
  assert.deepEqual(sprintProgress(counted, [DONE]), { goal: 18, done: 5, toGo: 13, over: 0, unpointed: 1 });
  assert.equal(sprintProgress(counted, [QC, DONE]).done, 8);
});

test("a new sprint starts the working day after the latest one and keeps its goal", () => {
  const board = { ...newBoard(), sprints: [sprint("2026-10-05", "2026-10-16", [], { goal: 20 })] };
  const next = newSprint(board, new Date(2026, 9, 10));
  assert.deepEqual({ start: next.start, end: next.end, goal: next.goal, name: next.name }, { start: "2026-10-19", end: "2026-10-30", goal: 20, name: "" });
  const first = newSprint(newBoard(), new Date(2026, 9, 10));
  assert.deepEqual({ start: first.start, end: first.end, goal: first.goal }, { start: "2026-10-12", end: "2026-10-23", goal: 18 });
});

test("a sprint without a name is named after its dates", () => {
  assert.equal(sprintName(sprint("2026-10-05", "2026-10-16")), "Sprint (05/10 – 16/10)");
  assert.equal(sprintName(sprint("2026-10-05", "2026-10-16", [], { name: "Release 2" })), "Release 2");
});

test("the current sprint holds today, else the next one, else the latest", () => {
  const at = (month, day) => currentSprint(EXAMPLE, new Date(2026, month - 1, day))?.start;
  assert.equal(at(10, 7), "2026-10-05");
  assert.equal(at(10, 17), "2026-10-19");
  assert.equal(at(12, 25), "2026-11-16");
  assert.equal(currentSprint(newBoard(), new Date()), null);
  assert.equal(sprintPhase(EXAMPLE.sprints[3], new Date(2026, 9, 7)), "active");
  assert.equal(sprintPhase(EXAMPLE.sprints[4], new Date(2026, 9, 7)), "planned");
  assert.equal(sprintPhase(EXAMPLE.sprints[0], new Date(2026, 9, 7)), "closed");
  assert.deepEqual(sprintDays(EXAMPLE.sprints[3], new Date(2026, 9, 9)), { days: 10, day: 5, left: 5 });
});

test("a task moves to another sprint or the backlog", () => {
  const moving = EXAMPLE.sprints[3].tasks[0];
  const toNext = moveTask(EXAMPLE, { taskId: moving.id, listId: EXAMPLE.sprints[4].id, index: 0 });
  assert.deepEqual(findTask(toNext, moving.id), { listId: EXAMPLE.sprints[4].id, index: 0, task: moving });
  assert.equal(toNext.sprints[3].tasks.length, 3);
  assert.equal(findTask(moveTask(toNext, { taskId: moving.id, listId: BACKLOG_ID }), moving.id).listId, BACKLOG_ID);
});

test("completing a sprint moves only its open tasks, in order", () => {
  const open = [task(3, "s1"), task(2, "s2")];
  const board = { ...newBoard(), sprints: [sprint("2026-10-05", "2026-10-16", [open[0], task(8, DONE), open[1]])] };
  const moved = moveOpenTasks(board, { sprintId: "2026-10-05", listId: BACKLOG_ID, counts: [DONE] });
  assert.deepEqual(moved.backlog, open);
  assert.equal(moved.sprints[0].tasks.length, 1);
});

test("removing a sprint keeps its tasks in the backlog", () => {
  const removed = removeSprint(EXAMPLE, "2026-08-24");
  assert.equal(removed.sprints.length, EXAMPLE.sprints.length - 1);
  assert.deepEqual(removed.backlog, EXAMPLE.sprints[0].tasks);
});

test("search covers sprint names, task titles, statuses and task notes", () => {
  const board = { ...newBoard(), backlog: [task(1, DONE, { title: "Export CSV", note: "<p>branch orders-csv</p>" })] };
  const text = boardSearchText(board, { statuses: DEFAULT_STATUSES, noteText: (html) => html.replace(/<[^>]+>/g, "") });
  assert.match(text, /Export CSV/);
  assert.match(text, /branch orders-csv/);
  assert.match(text, /Done/);
});

test("a damaged board is rejected", () => {
  assert.equal(isValidBoard(EXAMPLE), true);
  assert.equal(isValidBoard({ ...EXAMPLE, monthGoals: { "2026-13": 10 } }), false);
  assert.equal(isValidBoard({ ...EXAMPLE, backlog: [{ ...task(1), note: null }] }), false);
  assert.equal(isValidBoard({ ...EXAMPLE, sprints: [sprint("2026-10-16", "2026-10-05")] }), false);
});

test("the chart adds up points by status; an unknown status counts as the first", () => {
  const tasks = [task(2, "gone"), task(5, "s3"), task(null, "s3")];
  const byStatus = Object.fromEntries(pointsByStatus(tasks, DEFAULT_STATUSES).map(({ status, points }) => [status.label, points]));
  assert.deepEqual(byStatus, { Todo: 2, "In Progress": 0, "In Review": 5, "In QC": 0, Done: 0 });
});

test("sprint days count Monday to Friday only and stay within the sprint", () => {
  const twoWeeks = sprint("2026-09-28", "2026-10-09");
  const days = (month, day) => sprintDays(twoWeeks, new Date(2026, month - 1, day));
  assert.deepEqual(days(10, 8), { days: 10, day: 9, left: 1 });
  assert.deepEqual(days(9, 1), { days: 10, day: 0, left: 10 });
  assert.deepEqual(days(12, 1), { days: 10, day: 10, left: 0 });
});
