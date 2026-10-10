import { addDays, isIsoDate, isoDate, formatShortDate, sprintDatesFrom, workingDaysBetween } from "./sprint.js";
import { roundPoints } from "./tracker.js";

// The Sprints note keeps every sprint and the backlog in note.board:
// { sprints: [{ id, name, start, end, goal, tasks }], backlog: [task], monthGoals: { "YYYY-MM": points } }.
// A task is { id, title, points, status, note }, where note is the task's rich text ("" when empty).
// An empty sprint name means the sprint is named after its dates. Every edit returns a new board.

export const BACKLOG_ID = "backlog";
export const BOARD_TITLE = "Sprints";
const DEFAULT_GOAL = 18;
export const MAX_SPRINT_NAME_LENGTH = 100;
const MAX_TITLE_LENGTH = 1000;
const STATUS_ID = /^[a-z0-9-]{1,24}$/;
const MONTH_KEY = /^\d{4}-(0[1-9]|1[0-2])$/;

export const newBoard = () => ({ sprints: [], backlog: [], monthGoals: {} });

export const newTask = ({ title = "", status }) => ({ id: crypto.randomUUID(), title, points: null, status, note: "" });

export const sprintName = (sprint) => sprint.name.trim() || `Sprint (${formatShortDate(sprint.start)} – ${formatShortDate(sprint.end)})`;

export const findSprint = (board, sprintId) => board.sprints.find((sprint) => sprint.id === sprintId) ?? null;

export const listName = (board, listId) => (listId === BACKLOG_ID ? "Backlog" : sprintName(findSprint(board, listId)));

// Newest first: by end date, then by start date.
export const sprintsByDate = (board) => board.sprints.toSorted((a, b) => b.end.localeCompare(a.end) || b.start.localeCompare(a.start));

// The next sprint starts the working day after the latest one ends and keeps its goal.
export function newSprint(board, today) {
  const [latest] = sprintsByDate(board);
  const dates = sprintDatesFrom(latest ? addDays(latest.end, 1) : isoDate(today));
  return { id: crypto.randomUUID(), name: "", ...dates, goal: latest?.goal ?? DEFAULT_GOAL, tasks: [] };
}

export const addSprint = (board, sprint) => ({ ...board, sprints: [...board.sprints, sprint] });

export function updateSprint(board, { sprintId, change }) {
  return { ...board, sprints: board.sprints.map((sprint) => (sprint.id === sprintId ? { ...sprint, ...change } : sprint)) };
}

// The sprint's tasks go to the end of the backlog rather than being lost with it.
export function removeSprint(board, sprintId) {
  const removed = findSprint(board, sprintId);
  if (!removed) return board;
  return { ...board, sprints: board.sprints.filter((sprint) => sprint !== removed), backlog: [...board.backlog, ...removed.tasks] };
}

export const tasksOf = (board, listId) => (listId === BACKLOG_ID ? board.backlog : findSprint(board, listId)?.tasks ?? []);

const listIds = (board) => [BACKLOG_ID, ...board.sprints.map((sprint) => sprint.id)];

function mapTaskLists(board, change) {
  return { ...board, backlog: change(board.backlog, BACKLOG_ID), sprints: board.sprints.map((sprint) => ({ ...sprint, tasks: change(sprint.tasks, sprint.id) })) };
}

export function findTask(board, taskId) {
  for (const listId of listIds(board)) {
    const tasks = tasksOf(board, listId);
    const index = tasks.findIndex((task) => task.id === taskId);
    if (index !== -1) return { listId, index, task: tasks[index] };
  }
  return null;
}

export function updateTask(board, { taskId, change }) {
  return mapTaskLists(board, (tasks) => tasks.map((task) => (task.id === taskId ? { ...task, ...change } : task)));
}

export const removeTask = (board, taskId) => mapTaskLists(board, (tasks) => tasks.filter((task) => task.id !== taskId));

export function insertTask(board, { listId, index, task }) {
  return mapTaskLists(board, (tasks, id) => (id === listId ? tasks.toSpliced(Math.min(index, tasks.length), 0, task) : tasks));
}

// index is the place in the destination list once the task has been taken out; it defaults to the end.
export function moveTask(board, { taskId, listId, index = Infinity }) {
  const found = findTask(board, taskId);
  if (!found) return board;
  return insertTask(removeTask(board, taskId), { listId, index, task: found.task });
}

export const openTasks = (tasks, counts) => tasks.filter((task) => !counts.includes(task.status));

// Unfinished tasks of a sprint go to another sprint or the backlog, in their order.
export function moveOpenTasks(board, { sprintId, listId, counts }) {
  const open = openTasks(findSprint(board, sprintId)?.tasks ?? [], counts);
  return open.reduce((current, task) => moveTask(current, { taskId: task.id, listId }), board);
}

const sumPoints = (tasks) => roundPoints(tasks.reduce((sum, task) => sum + (task.points ?? 0), 0));

export const donePoints = (tasks, counts) => sumPoints(tasks.filter((task) => counts.includes(task.status)));

const progress = ({ goal, done }) => ({ goal, done, toGo: Math.max(0, roundPoints(goal - done)), over: Math.max(0, roundPoints(done - goal)) });

// counts: the status ids that count as done.
export function sprintProgress(sprint, counts) {
  return { ...progress({ goal: sprint.goal, done: donePoints(sprint.tasks, counts) }), unpointed: sprint.tasks.filter((task) => task.points === null).length };
}

export function sprintDays(sprint, today) {
  const days = Math.max(1, workingDaysBetween(sprint.start, sprint.end));
  const todayIso = isoDate(today);
  const lastCounted = todayIso < sprint.end ? todayIso : sprint.end;
  const day = todayIso < sprint.start ? 0 : Math.min(days, workingDaysBetween(sprint.start, lastCounted));
  return { days, day, left: days - day };
}

export function sprintPhase(sprint, today) {
  const todayIso = isoDate(today);
  if (todayIso < sprint.start) return "planned";
  return todayIso > sprint.end ? "closed" : "active";
}

// The sprint holding today; between sprints the next one; after the last sprint, the latest.
export function currentSprint(board, today) {
  const todayIso = isoDate(today);
  const byDate = sprintsByDate(board);
  return byDate.find((sprint) => sprint.start <= todayIso && todayIso <= sprint.end)
    ?? byDate.filter((sprint) => sprint.start > todayIso).at(-1)
    ?? byDate[0]
    ?? null;
}

// A sprint belongs to the month its end date falls in, so a month never counts a sprint twice.
export const monthOf = (sprint) => sprint.end.slice(0, 7);

export const monthsOf = (board) => [...new Set(sprintsByDate(board).map(monthOf))];

export const sprintsInMonth = (board, month) => sprintsByDate(board).filter((sprint) => monthOf(sprint) === month);

// Without a goal of its own, a month's goal is the sum of its sprints' goals.
export function monthProgress(board, { month, counts }) {
  const sprints = sprintsInMonth(board, month);
  const autoGoal = roundPoints(sprints.reduce((sum, sprint) => sum + sprint.goal, 0));
  const goal = board.monthGoals[month] ?? autoGoal;
  return { ...progress({ goal, done: donePoints(sprints.flatMap((sprint) => sprint.tasks), counts) }), autoGoal, sprintCount: sprints.length };
}

// A null goal goes back to the automatic one.
export function setMonthGoal(board, { month, goal }) {
  const others = Object.fromEntries(Object.entries(board.monthGoals).filter(([key]) => key !== month));
  return { ...board, monthGoals: goal === null ? others : { ...others, [month]: goal } };
}

export function pointsByStatus(tasks, statuses) {
  const known = new Set(statuses.map((status) => status.id));
  const statusOf = (task) => (known.has(task.status) ? task.status : statuses[0].id);
  return statuses.map((status) => ({ status, points: sumPoints(tasks.filter((task) => statusOf(task) === status.id)) }));
}

// noteText turns a task's rich text into plain text.
export function boardSearchText(board, { statuses, noteText }) {
  const label = (id) => (statuses.find((status) => status.id === id) ?? statuses[0]).label;
  const taskText = (task) => [task.title, label(task.status), task.note ? noteText(task.note) : ""];
  return [BOARD_TITLE, ...board.sprints.map(sprintName), ...listIds(board).flatMap((listId) => tasksOf(board, listId).flatMap(taskText))].join("\n");
}

export function isValidBoard(board) {
  return typeof board === "object" && board !== null
    && Array.isArray(board.sprints) && board.sprints.every(isValidSprint)
    && Array.isArray(board.backlog) && board.backlog.every(isValidTask)
    && isValidMonthGoals(board.monthGoals);
}

function isValidSprint(sprint) {
  return typeof sprint === "object" && sprint !== null
    && typeof sprint.id === "string" && sprint.id !== ""
    && typeof sprint.name === "string" && sprint.name.length <= MAX_SPRINT_NAME_LENGTH
    && isIsoDate(sprint.start) && isIsoDate(sprint.end) && sprint.end >= sprint.start
    && Number.isFinite(sprint.goal) && sprint.goal > 0
    && Array.isArray(sprint.tasks) && sprint.tasks.every(isValidTask);
}

function isValidTask(task) {
  return typeof task === "object" && task !== null
    && typeof task.id === "string" && task.id !== ""
    && typeof task.title === "string" && task.title.length <= MAX_TITLE_LENGTH
    && (task.points === null || (Number.isFinite(task.points) && task.points >= 0))
    && typeof task.status === "string" && STATUS_ID.test(task.status)
    && typeof task.note === "string";
}

function isValidMonthGoals(goals) {
  return typeof goals === "object" && goals !== null && !Array.isArray(goals)
    && Object.entries(goals).every(([month, goal]) => MONTH_KEY.test(month) && Number.isFinite(goal) && goal >= 0);
}

const pickTask = ({ id, title, points, status, note }) => ({ id, title, points, status, note });

export function pickBoard({ sprints, backlog, monthGoals }) {
  return {
    sprints: sprints.map(({ id, name, start, end, goal, tasks }) => ({ id, name, start, end, goal, tasks: tasks.map(pickTask) })),
    backlog: backlog.map(pickTask),
    monthGoals: { ...monthGoals },
  };
}
