// Before the Sprints note, each sprint was its own tracker note (note.sprint) with groups of
// tasks and a tick box per task. This module folds those notes into the one board.
import { MAX_SPRINT_NAME_LENGTH, newBoard } from "./board.js";
import { EMPTY_BODY_HTML, isEmptyNote, newNote } from "./model.js";
import { DEFAULT_TRACKER_TITLE, trackerTitle } from "./tracker.js";

// Returns the notes to save: the board, created or updated, and every tracker note it took in.
// counts: the status ids that count as done for a sprint; the first one replaces a tick.
export function mergeTrackers(notes, { counts, now }) {
  const trackers = notes
    .filter((note) => note.sprint && note.deletedAt === null)
    .toSorted((a, b) => a.sprint.start.localeCompare(b.sprint.start));
  if (trackers.length === 0) return [];
  const boardNote = notes.find((note) => note.board && note.deletedAt === null) ?? newBoardNote({ now, pinned: trackers.some((note) => note.pinned) });
  const board = trackers.reduce((current, note) => mergeTracker(current, { note, counts }), boardNote.board);
  return [{ ...boardNote, board, updatedAt: now }, ...trackers.map((note) => retireTracker(note, now))];
}

export const newBoardNote = ({ now, pinned = false }) => ({ ...newNote(now), html: EMPTY_BODY_HTML, pinned, board: newBoard() });

// The sprint keeps the tracker note's id, so importing the same backup twice replaces it.
// Tasks from groups that did not count (Last Sprint) go to the backlog unless one with the
// same title is already on the board, since those groups mostly repeat the previous sprint.
function mergeTracker(board, { note, counts }) {
  const { sprint } = note;
  const others = { ...board, sprints: board.sprints.filter((existing) => existing.id !== note.id) };
  const takenIds = new Set(allTasks(others).map((task) => task.id));
  const toTask = (task) => boardTask(task, { counts, takenIds });
  const groups = sprint.groups ?? [];
  const tasks = groups.filter((group) => group.counts).flatMap((group) => group.tasks).map(toTask);
  const knownTitles = new Set([...allTasks(others), ...tasks].map((task) => titleKey(task.title)));
  const leftovers = groups.filter((group) => !group.counts).flatMap((group) => group.tasks)
    .filter((task) => task.title.trim() !== "" && !knownTitles.has(titleKey(task.title)))
    .map(toTask);
  const merged = { id: note.id, name: sprintNameOf(sprint), start: sprint.start, end: sprint.end, goal: sprint.target, tasks };
  return { ...others, sprints: [...others.sprints, merged], backlog: [...others.backlog, ...leftovers] };
}

const allTasks = (board) => [...board.backlog, ...board.sprints.flatMap((sprint) => sprint.tasks)];

const titleKey = (title) => title.trim().toLowerCase();

const sprintNameOf = (sprint) => {
  const title = (sprint.title ?? "").trim();
  return title === DEFAULT_TRACKER_TITLE ? "" : title.slice(0, MAX_SPRINT_NAME_LENGTH);
};

// A ticked task whose status does not count as done takes the first counted status, so the
// sprint keeps the points it showed before the tick box went away.
function boardTask(task, { counts, takenIds }) {
  const id = takenIds.has(task.id) ? crypto.randomUUID() : task.id;
  takenIds.add(id);
  const status = task.done && !counts.includes(task.status) ? counts[0] : task.status;
  return { id, title: task.title, points: task.points, status, note: "" };
}

// The note keeps its own text under its old title; with no text it goes to Recently Deleted.
function retireTracker(note, now) {
  const { sprint, ...rest } = note;
  const hasText = !isEmptyNote(note.html);
  const html = `<h1>${escapeHtml(trackerTitle(sprint))}</h1>${hasText ? note.html : ""}`;
  return { ...rest, html, updatedAt: now, deletedAt: hasText ? null : now };
}

const HTML_ESCAPES = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" };

const escapeHtml = (text) => text.replace(/[&<>"]/g, (character) => HTML_ESCAPES[character]);
