const DAY_MS = 86_400_000;
const RECENTLY_DELETED_DAYS = 30;
const TEXT_BLOCKS = "h1,h2,h3,p,pre,li,div";
const NESTED_BLOCKS = "ul,ol,p,h1,h2,h3,pre,div";
const FALLBACK_TITLE = "New Note";
const FALLBACK_PREVIEW = "No additional text";

export const EMPTY_NOTE_HTML = "<h1><br></h1>";

export function parseHtml(html) {
  return new DOMParser().parseFromString(`<!doctype html><html><body>${html}</body></html>`, "text/html");
}

export function ownText(element) {
  const clone = element.cloneNode(true);
  clone.querySelectorAll(NESTED_BLOCKS).forEach((child) => child.remove());
  clone.querySelectorAll("br").forEach((lineBreak) => lineBreak.replaceWith(clone.ownerDocument.createTextNode("\n")));
  return clone.textContent;
}

export function noteLines(html) {
  const body = parseHtml(html).body;
  return [...body.querySelectorAll(TEXT_BLOCKS), body]
    .flatMap((block) => ownText(block).split("\n"))
    .map((line) => line.trim())
    .filter(Boolean);
}

export const noteTitle = (html) => noteLines(html)[0] ?? FALLBACK_TITLE;
export const notePreview = (html) => noteLines(html)[1] ?? FALLBACK_PREVIEW;
export const noteText = (html) => noteLines(html).join("\n");
export const isEmptyNote = (html) => noteLines(html).length === 0;

export function newNote(now) {
  return { id: crypto.randomUUID(), html: EMPTY_NOTE_HTML, pinned: false, updatedAt: now, deletedAt: null, position: now };
}

const POSITION_STEP = 1000;

// Notes created before manual ordering existed keep their old place by edit time.
const notePosition = (note) => note.position ?? note.updatedAt;
const byPosition = (a, b) => notePosition(b) - notePosition(a);

export function orderedGroups(notes) {
  const pinned = notes.filter((note) => note.pinned).sort(byPosition);
  const others = notes.filter((note) => !note.pinned).sort(byPosition);
  if (pinned.length === 0) return others.length > 0 ? [{ label: null, notes: others }] : [];
  return [{ label: "Pinned", notes: pinned }, ...(others.length > 0 ? [{ label: "Notes", notes: others }] : [])];
}

export function placeNote(notes, { id, targetId, placement }) {
  const target = notes.find((note) => note.id === targetId);
  const section = notes.filter((note) => note.id !== id && note.pinned === target.pinned).sort(byPosition);
  const index = section.indexOf(target);
  const above = placement === "before" ? section[index - 1] : target;
  const below = placement === "before" ? target : section[index + 1];
  return { position: positionBetween(above, below), pinned: target.pinned };
}

export function stepNote(notes, { id, step }) {
  const moving = notes.find((note) => note.id === id);
  const section = notes.filter((note) => note.pinned === moving.pinned).sort(byPosition);
  const neighbour = section[section.indexOf(moving) + step];
  if (!neighbour) return null;
  return placeNote(notes, { id, targetId: neighbour.id, placement: step < 0 ? "before" : "after" });
}

function positionBetween(above, below) {
  if (above && below) return (notePosition(above) + notePosition(below)) / 2;
  if (below) return notePosition(below) + POSITION_STEP;
  return notePosition(above) - POSITION_STEP;
}

export function isExpired(note, now) {
  return note.deletedAt !== null && now - note.deletedAt > RECENTLY_DELETED_DAYS * DAY_MS;
}

// A note with an unsaved edit in this tab keeps the local version, so that edit's save
// lands later and wins instead of being silently replaced.
export function remoteNotesToApply(incoming, { local, isPending }) {
  return incoming.filter((note) => !isPending(note.id) && !(local.get(note.id)?.updatedAt >= note.updatedAt));
}
