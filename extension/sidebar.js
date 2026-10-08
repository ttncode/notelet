import { createElement } from "./dom.js";
import { notePreview, noteTitle } from "./model.js";
import { formatSprintRange } from "./sprint.js";

export function renderNoteList(container, { groups, currentId, emptyText, now }) {
  if (groups.length === 0) {
    container.replaceChildren(createElement("p", "list-empty", emptyText));
    return;
  }
  container.replaceChildren(...groups.map((group) => renderGroup(group, currentId, now)));
}

function renderGroup({ label, notes }, currentId, now) {
  const section = createElement("section", "note-group");
  section.append(createElement("h2", "group-label", label), ...notes.map((note) => renderRow(note, note.id === currentId, now)));
  return section;
}

function renderRow(note, isCurrent, now) {
  const row = createElement("button", "note-row");
  row.type = "button";
  row.dataset.noteId = note.id;
  if (isCurrent) row.setAttribute("aria-current", "true");
  const meta = createElement("span", "note-row-meta");
  meta.append(createElement("span", "note-row-date", formatRowDate(note.updatedAt, now)), createElement("span", "note-row-preview", note.sprint ? formatSprintRange(note.sprint) : notePreview(note.html)));
  row.append(createElement("span", "note-row-title", noteTitle(note.html)), meta);
  return row;
}

function formatRowDate(timestamp, now) {
  const date = new Date(timestamp);
  if (date.toDateString() === new Date(now).toDateString()) return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  return date.toLocaleDateString();
}
