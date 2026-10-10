// Three-way merge for notes edited in two windows at once. base is the version both windows
// last saw in storage, local is this window's version and remote the one another window just
// saved. Whatever only one side changed is kept. Where both changed the same value differently,
// this window's version wins; where both changed the same paragraph, both versions are kept.
// Either way conflict is reported.
import { parseHtml } from "./model.js";

const NO_CONFLICT = { conflict: false };

function same(a, b) {
  if (a === b) return true;
  if (typeof a !== "object" || typeof b !== "object" || a === null || b === null) return false;
  return JSON.stringify(a) === JSON.stringify(b);
}

export function mergeValue(base, local, remote) {
  if (same(local, base)) return { value: remote, ...NO_CONFLICT };
  if (same(remote, base) || same(local, remote)) return { value: local, ...NO_CONFLICT };
  return { value: local, conflict: true };
}

// diff3 over two edits of one sequence: the items both sides kept unchanged anchor the merge,
// and each stretch between anchors is resolved like a single value. keepBoth keeps both sides'
// items where they clash instead of only this window's.
export function mergeSequence(base, local, remote, { keepBoth = false } = {}) {
  const toLocal = matchedIndexes(base, local);
  const toRemote = matchedIndexes(base, remote);
  const anchors = base.map((_, index) => index).filter((index) => toLocal.has(index) && toRemote.has(index));
  const merged = [];
  let conflict = false;
  let at = { base: 0, local: 0, remote: 0 };
  for (const anchor of [...anchors, base.length]) {
    const end = anchor === base.length ? { base: base.length, local: local.length, remote: remote.length } : { base: anchor, local: toLocal.get(anchor), remote: toRemote.get(anchor) };
    const stretch = mergeStretch(base.slice(at.base, end.base), local.slice(at.local, end.local), remote.slice(at.remote, end.remote), keepBoth);
    conflict ||= stretch.conflict;
    merged.push(...stretch.value);
    if (anchor < base.length) merged.push(base[anchor]);
    at = { base: end.base + 1, local: end.local + 1, remote: end.remote + 1 };
  }
  return { value: merged, conflict };
}

// Inserts at the same place from both sides are both kept; same-length stretches merge item by
// item, so changes to neighbouring items do not clash.
function mergeStretch(base, local, remote, keepBoth) {
  const whole = mergeValue(base, local, remote);
  if (!whole.conflict) return whole;
  const both = [...local, ...remote.filter((item) => !local.some((other) => same(other, item)))];
  if (base.length === 0) return { value: both, ...NO_CONFLICT };
  if (base.length > 1 && local.length === base.length && remote.length === base.length) {
    const items = base.map((item, index) => mergeStretch([item], [local[index]], [remote[index]], keepBoth));
    return { value: items.flatMap((item) => item.value), conflict: items.some((item) => item.conflict) };
  }
  return keepBoth ? { value: both, conflict: true } : whole;
}

// Longest common subsequence as a map from base index to the other side's index.
function matchedIndexes(base, other) {
  const lengths = Array.from({ length: base.length + 1 }, () => new Array(other.length + 1).fill(0));
  for (let i = base.length - 1; i >= 0; i -= 1) {
    for (let j = other.length - 1; j >= 0; j -= 1) {
      lengths[i][j] = same(base[i], other[j]) ? lengths[i + 1][j + 1] + 1 : Math.max(lengths[i + 1][j], lengths[i][j + 1]);
    }
  }
  const matches = new Map();
  for (let i = 0, j = 0; i < base.length && j < other.length;) {
    if (same(base[i], other[j])) matches.set(i++, j++);
    else if (lengths[i + 1][j] >= lengths[i][j + 1]) i += 1;
    else j += 1;
  }
  return matches;
}

// Note text merges paragraph by paragraph: edits to different paragraphs both survive, and a
// paragraph both windows changed is kept in both versions, so no typing is lost.
export function mergeHtml(base, local, remote) {
  if (local === remote || remote === base) return { value: local, ...NO_CONFLICT };
  if (local === base) return { value: remote, ...NO_CONFLICT };
  const merged = mergeSequence(blocksOf(base), blocksOf(local), blocksOf(remote), { keepBoth: true });
  return { value: merged.value.join(""), conflict: merged.conflict };
}

const blocksOf = (html) => [...parseHtml(html).body.childNodes].map((node) => (node.nodeType === 1 ? node.outerHTML : node.textContent)).filter((block) => block !== "");

const NOTE_FIELDS = ["pinned", "position", "deletedAt", "sprint"];

export function mergeNote(base, local, remote) {
  const fields = NOTE_FIELDS.map((field) => [field, mergeValue(base[field], local[field], remote[field])]);
  const html = mergeHtml(base.html, local.html, remote.html);
  const board = local.board && remote.board ? mergeBoard(base.board ?? local.board, local.board, remote.board) : { value: local.board, ...NO_CONFLICT };
  const parts = [...fields.map(([, part]) => part), html, board];
  const note = {
    ...remote,
    ...local,
    ...Object.fromEntries(fields.filter(([, part]) => part.value !== undefined).map(([field, part]) => [field, part.value])),
    html: html.value,
    ...(board.value ? { board: board.value } : {}),
    updatedAt: Math.max(local.updatedAt, remote.updatedAt),
  };
  return { note, conflict: parts.some((part) => part.conflict) };
}

const SPRINT_FIELDS = ["name", "start", "end", "goal"];
const TASK_FIELDS = ["title", "points", "status"];
const BACKLOG = "backlog";

// Sprints and tasks merge by id and field by field; a task note merges like note text.
export function mergeBoard(base, local, remote) {
  let conflict = false;
  const track = (part) => {
    conflict ||= part.conflict;
    return part.value;
  };
  const sprintIds = track(mergeSequence(base.sprints.map(idOf), local.sprints.map(idOf), remote.sprints.map(idOf)));
  const sprints = sprintIds.map((id) => mergeSprint(id, { base, local, remote, track }));
  const alive = aliveTasks({ base, local, remote });
  const lists = new Map([[BACKLOG, []], ...sprints.map((sprint) => [sprint.id, []])]);
  const placed = new Set();
  for (const listId of lists.keys()) {
    const order = track(mergeSequence(taskIds(base, listId), taskIds(local, listId), taskIds(remote, listId)));
    for (const id of order) if (alive.has(id) && !placed.has(id)) placeTask(lists, { listId: preferredList({ id, base, local, remote, lists }) ?? listId, id, placed });
  }
  for (const id of alive.keys()) if (!placed.has(id)) placeTask(lists, { listId: preferredList({ id, base, local, remote, lists }) ?? BACKLOG, id, placed });
  const task = (id) => mergeTask(id, { base, local, remote, track });
  const monthGoals = mergeMonthGoals({ base, local, remote, track });
  return {
    value: { sprints: sprints.map((sprint) => ({ ...sprint, tasks: lists.get(sprint.id).map(task) })), backlog: lists.get(BACKLOG).map(task), monthGoals },
    conflict,
  };
}

const idOf = (item) => item.id;

function mergeSprint(id, { base, local, remote, track }) {
  const [was, mine, theirs] = [base, local, remote].map((board) => board.sprints.find((sprint) => sprint.id === id));
  const start = mine ?? theirs;
  if (!was || !mine || !theirs) return { ...start, tasks: [] };
  return { ...start, ...Object.fromEntries(SPRINT_FIELDS.map((field) => [field, track(mergeValue(was[field], mine[field], theirs[field]))])), tasks: [] };
}

const listTasks = (board, listId) => (listId === BACKLOG ? board.backlog : board.sprints.find((sprint) => sprint.id === listId)?.tasks ?? []);

const taskIds = (board, listId) => listTasks(board, listId).map(idOf);

const allTasks = (board) => new Map([...board.backlog, ...board.sprints.flatMap((sprint) => sprint.tasks)].map((task) => [task.id, task]));

function listOf(board, taskId) {
  if (board.backlog.some((task) => task.id === taskId)) return BACKLOG;
  return board.sprints.find((sprint) => sprint.tasks.some((task) => task.id === taskId))?.id ?? null;
}

// A task deleted on one side stays deleted; a new task from either side is kept.
function aliveTasks({ base, local, remote }) {
  const [was, mine, theirs] = [base, local, remote].map(allTasks);
  return new Map([...mine, ...theirs].filter(([id]) => !was.has(id) || (mine.has(id) && theirs.has(id))));
}

// A task sits where the side that moved it put it; if both moved it, where this window put it.
function preferredList({ id, base, local, remote, lists }) {
  const [was, mine, theirs] = [base, local, remote].map((board) => listOf(board, id));
  const choice = mergeValue(was, mine ?? theirs, theirs ?? mine).value;
  return [choice, mine, theirs].find((listId) => lists.has(listId)) ?? null;
}

function placeTask(lists, { listId, id, placed }) {
  lists.get(listId).push(id);
  placed.add(id);
}

function mergeTask(id, { base, local, remote, track }) {
  const [was, mine, theirs] = [base, local, remote].map((board) => allTasks(board).get(id));
  if (!mine || !theirs) return mine ?? theirs;
  if (!was) return mine;
  const fields = Object.fromEntries(TASK_FIELDS.map((field) => [field, track(mergeValue(was[field], mine[field], theirs[field]))]));
  return { ...mine, ...fields, note: track(mergeHtml(was.note, mine.note, theirs.note)) };
}

function mergeMonthGoals({ base, local, remote, track }) {
  const months = new Set([...Object.keys(local.monthGoals), ...Object.keys(remote.monthGoals), ...Object.keys(base.monthGoals)]);
  const entries = [...months].map((month) => [month, track(mergeValue(base.monthGoals[month], local.monthGoals[month], remote.monthGoals[month]))]);
  return Object.fromEntries(entries.filter(([, goal]) => goal !== undefined));
}
