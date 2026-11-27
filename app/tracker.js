// A tracker from before the Sprints note lived in note.sprint: { start, end, target, title, groups:
// [{ id, name, counts, collapsed, tasks: [{ id, title, points, status, done }] }] }. What is left here
// reads and checks that shape so older notes and backups can still be merged into the board.

export const DEFAULT_TRACKER_TITLE = "Task Tracking";
const MAX_NAME_LENGTH = 60;
const MAX_TITLE_LENGTH = 1000;
const STATUS_ID = /^[a-z0-9-]{1,24}$/;

export const newGroup = ({ name, counts }) => ({ id: crypto.randomUUID(), name, counts, collapsed: false, tasks: [] });

export const trackerTitle = (sprint) => sprint.title?.trim() || DEFAULT_TRACKER_TITLE;

export const roundPoints = (value) => Math.round(value * 100) / 100;

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
