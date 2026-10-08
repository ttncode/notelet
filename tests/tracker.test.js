import { test } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_STATUSES } from "../extension/sprint.js";
import {
  findTask, groupPoints, insertTask, moveTask, pointsByStatus, removeTask, stepTask, trackerSearchText, trackerTitle, updateTask,
} from "../extension/tracker.js";

const task = (id, points = null, status = "s1", done = false) => ({ id, title: `task ${id}`, points, status, done });
const SPRINT = {
  start: "2026-09-28", end: "2026-10-09", target: 18, title: "",
  groups: [
    { id: "last", name: "Last Sprint", counts: false, collapsed: false, tasks: [task("a", 3, "s4", true)] },
    { id: "current", name: "Current Sprint", counts: true, collapsed: false, tasks: [task("b", 5, "s3", true), task("c", 2, "gone"), task("d")] },
  ],
};
const ids = (sprint) => sprint.groups.map((group) => group.tasks.map((item) => item.id));

test("tasks are inserted, updated and removed without touching the original", () => {
  const inserted = insertTask(SPRINT, { groupId: "current", index: 1, task: task("x") });
  assert.deepEqual(ids(inserted), [["a"], ["b", "x", "c", "d"]]);
  assert.equal(findTask(updateTask(inserted, { taskId: "x", change: { done: true } }), "x").task.done, true);
  assert.deepEqual(ids(removeTask(inserted, "b")), [["a"], ["x", "c", "d"]]);
  assert.deepEqual(ids(SPRINT), [["a"], ["b", "c", "d"]]);
});

test("a task moves within its group or into another one", () => {
  assert.deepEqual(ids(moveTask(SPRINT, { taskId: "d", groupId: "current", index: 0 })), [["a"], ["d", "b", "c"]]);
  assert.deepEqual(ids(moveTask(SPRINT, { taskId: "b", groupId: "last", index: 1 })), [["a", "b"], ["c", "d"]]);
});

test("stepping past the first or last task crosses into the neighbouring group", () => {
  assert.deepEqual(stepTask(SPRINT, { taskId: "c", step: -1 }), { groupId: "current", index: 0 });
  assert.deepEqual(stepTask(SPRINT, { taskId: "b", step: -1 }), { groupId: "last", index: 1 });
  assert.deepEqual(stepTask(SPRINT, { taskId: "a", step: 1 }), { groupId: "current", index: 0 });
  assert.equal(stepTask(SPRINT, { taskId: "a", step: -1 }), null);
  assert.equal(stepTask(SPRINT, { taskId: "d", step: 1 }), null);
});

test("the chart adds up points by status in counted groups; an unknown status counts as the first", () => {
  const byStatus = Object.fromEntries(pointsByStatus(SPRINT, DEFAULT_STATUSES).map(({ status, points }) => [status.label, points]));
  assert.deepEqual(byStatus, { Todo: 2, "In Progress": 0, "In Review": 5, "In QC": 0, Done: 0 });
});

test("each group shows its done and total points", () => {
  assert.deepEqual(groupPoints(SPRINT.groups[1]), { done: 5, total: 7 });
});

test("an empty title falls back to Task Tracking, and search covers titles, groups and statuses", () => {
  assert.equal(trackerTitle(SPRINT), "Task Tracking");
  const text = trackerSearchText(SPRINT, DEFAULT_STATUSES);
  for (const word of ["Task Tracking", "Last Sprint", "task b", "In Review", "Todo"]) assert.ok(text.includes(word), word);
});
