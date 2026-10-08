// A task tracker lives in note.sprint: { start, end, target, title, groups: [{ id, name, counts,
// collapsed, tasks: [{ id, title, points, status, done }] }] }. Every edit returns a new sprint.

export const DEFAULT_TRACKER_TITLE = "Task Tracking";
export const DEFAULT_GROUPS = Object.freeze([
  Object.freeze({ name: "Last Sprint", counts: false }),
  Object.freeze({ name: "Current Sprint", counts: true }),
]);
const MAX_NAME_LENGTH = 60;
const MAX_TITLE_LENGTH = 1000;
const STATUS_ID = /^[a-z0-9-]{1,24}$/;

export const newTask = (status) => ({ id: crypto.randomUUID(), title: "", points: null, status, done: false });

export const newGroup = ({ name, counts }) => ({ id: crypto.randomUUID(), name, counts, collapsed: false, tasks: [] });

export const trackerTitle = (sprint) => sprint.title?.trim() || DEFAULT_TRACKER_TITLE;

export const countedTasks = (sprint) => sprint.groups.filter((group) => group.counts).flatMap((group) => group.tasks);

export function updateGroup(sprint, { groupId, change }) {
  return { ...sprint, groups: sprint.groups.map((group) => (group.id === groupId ? { ...group, ...change } : group)) };
}

export function updateTask(sprint, { taskId, change }) {
  const groups = sprint.groups.map((group) => ({ ...group, tasks: group.tasks.map((task) => (task.id === taskId ? { ...task, ...change } : task)) }));
  return { ...sprint, groups };
}

export function insertTask(sprint, { groupId, index, task }) {
  const groups = sprint.groups.map((group) => (group.id === groupId ? { ...group, tasks: group.tasks.toSpliced(index, 0, task) } : group));
  return { ...sprint, groups };
}

export function removeTask(sprint, taskId) {
  return { ...sprint, groups: sprint.groups.map((group) => ({ ...group, tasks: group.tasks.filter((task) => task.id !== taskId) })) };
}

export function findTask(sprint, taskId) {
  for (const group of sprint.groups) {
    const index = group.tasks.findIndex((task) => task.id === taskId);
    if (index !== -1) return { group, index, task: group.tasks[index] };
  }
  return null;
}

// index is the place in the destination group once the task has been taken out.
export function moveTask(sprint, { taskId, groupId, index }) {
  const found = findTask(sprint, taskId);
  if (!found) return sprint;
  return insertTask(removeTask(sprint, taskId), { groupId, index, task: found.task });
}

// One step up or down; past the first or last task it crosses into the neighbouring group.
export function stepTask(sprint, { taskId, step }) {
  const found = findTask(sprint, taskId);
  if (!found) return null;
  const groupIndex = sprint.groups.indexOf(found.group);
  const index = found.index + step;
  if (index >= 0 && index < found.group.tasks.length) return { groupId: found.group.id, index };
  const neighbour = sprint.groups[groupIndex + step];
  if (!neighbour) return null;
  return { groupId: neighbour.id, index: step < 0 ? neighbour.tasks.length : 0 };
}

export const addGroup = (sprint, group) => ({ ...sprint, groups: [...sprint.groups, group] });

export function pointsByStatus(sprint, statuses) {
  const tasks = countedTasks(sprint);
  const known = new Set(statuses.map((status) => status.id));
  const statusOf = (task) => (known.has(task.status) ? task.status : statuses[0].id);
  return statuses.map((status) => ({
    status,
    points: roundPoints(tasks.filter((task) => statusOf(task) === status.id).reduce((sum, task) => sum + (task.points ?? 0), 0)),
  }));
}

export function groupPoints(group) {
  const sum = (tasks) => roundPoints(tasks.reduce((total, task) => total + (task.points ?? 0), 0));
  return { done: sum(group.tasks.filter((task) => task.done)), total: sum(group.tasks) };
}

export const roundPoints = (value) => Math.round(value * 100) / 100;

export function trackerSearchText(sprint, statuses) {
  const label = (id) => (statuses.find((status) => status.id === id) ?? statuses[0]).label;
  return [trackerTitle(sprint), ...sprint.groups.flatMap((group) => [group.name, ...group.tasks.flatMap((task) => [task.title, label(task.status)])])].join("\n");
}

export function isValidGroups(groups) {
  return Array.isArray(groups) && groups.every((group) => typeof group === "object" && group !== null
    && typeof group.id === "string" && group.id !== ""
    && typeof group.name === "string" && group.name.length <= MAX_NAME_LENGTH
    && typeof group.counts === "boolean" && typeof group.collapsed === "boolean"
    && Array.isArray(group.tasks) && group.tasks.every(isValidTask));
}

function isValidTask(task) {
  return typeof task === "object" && task !== null
    && typeof task.id === "string" && task.id !== ""
    && typeof task.title === "string" && task.title.length <= MAX_TITLE_LENGTH
    && (task.points === null || (Number.isFinite(task.points) && task.points >= 0))
    && typeof task.status === "string" && STATUS_ID.test(task.status)
    && typeof task.done === "boolean";
}

export const pickGroups = (groups) => groups.map(({ id, name, counts, collapsed, tasks }) => ({
  id, name, counts, collapsed, tasks: tasks.map(({ id: taskId, title, points, status, done }) => ({ id: taskId, title, points, status, done })),
}));
