import { createElement } from "./dom.js";
import { formatRowDate } from "./format.js";
import { notePreview, noteTitle } from "./model.js";
import { formatSprintRange } from "./sprint.js";

export function renderNoteList(container, { groups, currentId, emptyText, now, draggable }) {
  if (groups.length === 0) {
    container.replaceChildren(createElement("p", "list-empty", emptyText));
    return;
  }
  container.replaceChildren(...groups.map((group) => renderGroup(group, { currentId, now, draggable })));
}

function renderGroup({ label, notes }, { currentId, now, draggable }) {
  const section = createElement("section", "note-group");
  if (label) section.append(createElement("h2", "group-label", label));
  const card = createElement("div", "group-card");
  card.append(...notes.map((note) => renderRow(note, { isCurrent: note.id === currentId, now, draggable })));
  section.append(card);
  return section;
}

function renderRow(note, { isCurrent, now, draggable }) {
  const row = createElement("button", "note-row");
  row.type = "button";
  row.draggable = draggable;
  row.dataset.noteId = note.id;
  if (isCurrent) row.setAttribute("aria-current", "true");
  const meta = createElement("span", "note-row-meta");
  meta.append(createElement("span", "note-row-date", formatRowDate(note.updatedAt, now)), createElement("span", "note-row-preview", note.sprint ? formatSprintRange(note.sprint) : notePreview(note.html)));
  row.append(createElement("span", "note-row-title", noteTitle(note.html)), meta);
  return row;
}
