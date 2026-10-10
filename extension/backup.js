import { isValidBoard, pickBoard } from "./board.js";
import { isValidSections } from "./sections.js";
import { isValidSprint, isValidStatus } from "./sprint.js";
import { pickGroups } from "./tracker.js";

export const BACKUP_APP = "notelet";
export const BACKUP_VERSION = 4;
const SUPPORTED_VERSIONS = new Set([1, 2, 3, 4]);

export function createBackup(notes, settings, now) {
  const backup = { app: BACKUP_APP, version: BACKUP_VERSION, exportedAt: now.toISOString(), settings, notes: notes.map(pickNoteFields) };
  return JSON.stringify(backup, null, 2);
}

export function backupFileName(now) {
  const pad = (number) => String(number).padStart(2, "0");
  return `notelet-backup-${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}.json`;
}

export function parseBackup(text) {
  const data = parseJson(text);
  if (data === undefined) return failure("This file is not a valid backup: it is not JSON.");
  if (data?.app !== BACKUP_APP) return failure("This file is not a Notelet backup.");
  if (typeof data.version === "number" && data.version > BACKUP_VERSION) {
    return failure("This backup comes from a newer version of Notelet. Update the extension, then import again.");
  }
  if (!SUPPORTED_VERSIONS.has(data.version) || !Array.isArray(data.notes)) return failure("This backup is damaged and cannot be imported.");
  if (data.version >= 2 && !isValidSettings(data.settings)) return failure("The status settings in this backup are damaged, so nothing was imported.");
  const damagedIndex = data.notes.findIndex((note) => !isValidNote(note));
  if (damagedIndex !== -1) return failure(`Note ${damagedIndex + 1} in this backup is damaged, so nothing was imported.`);
  const settings = data.version >= 2 ? pickSettings(data.settings) : null;
  return { ok: true, version: data.version, notes: data.notes.map(pickNoteFields), settings };
}

function parseJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    // Not JSON is an expected input; parseBackup turns it into a message for the user.
    return undefined;
  }
}

function isValidSettings(settings) {
  return Array.isArray(settings?.statuses) && settings.statuses.length > 0 && settings.statuses.every(isValidStatus)
    && (settings.sections === undefined || isValidSections(settings.sections))
    && isValidCounts(settings.sprintCounts) && isValidCounts(settings.monthCounts);
}

const isValidCounts = (ids) => ids === undefined || (Array.isArray(ids) && ids.every((id) => typeof id === "string"));

function pickSettings({ statuses, sections, sprintCounts, monthCounts }) {
  return {
    statuses: statuses.map(pickStatusFields),
    ...(sections === undefined ? {} : { sections: sections.map(({ id, label, counts }) => ({ id, label, counts })) }),
    ...(sprintCounts === undefined ? {} : { sprintCounts: [...sprintCounts] }),
    ...(monthCounts === undefined ? {} : { monthCounts: [...monthCounts] }),
  };
}

function isValidNote(note) {
  return typeof note === "object" && note !== null
    && typeof note.id === "string" && note.id !== ""
    && typeof note.html === "string"
    && typeof note.pinned === "boolean"
    && Number.isFinite(note.updatedAt)
    && (note.deletedAt === null || Number.isFinite(note.deletedAt))
    && (note.sprint === undefined || note.sprint === null || isValidSprint(note.sprint))
    && (note.board === undefined || isValidBoard(note.board))
    && (note.position === undefined || Number.isFinite(note.position));
}

function pickNoteFields({ id, html, pinned, updatedAt, deletedAt, sprint, board, position }) {
  const note = { id, html, pinned, updatedAt, deletedAt, ...(position === undefined ? {} : { position }) };
  if (board) return { ...note, board: pickBoard(board) };
  return sprint ? { ...note, sprint: pickSprintFields(sprint) } : note;
}

function pickSprintFields({ start, end, target, title, groups }) {
  const sprint = { start, end, target, ...(title === undefined ? {} : { title }) };
  return groups === undefined ? sprint : { ...sprint, groups: pickGroups(groups) };
}

const pickStatusFields = ({ id, label, color }) => ({ id, label, color });
const failure = (error) => ({ ok: false, error });
