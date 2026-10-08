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
  return [body, ...body.querySelectorAll(TEXT_BLOCKS)]
    .flatMap((block) => ownText(block).split("\n"))
    .map((line) => line.trim())
    .filter(Boolean);
}

export const noteTitle = (html) => noteLines(html)[0] ?? FALLBACK_TITLE;
export const notePreview = (html) => noteLines(html)[1] ?? FALLBACK_PREVIEW;
export const noteText = (html) => noteLines(html).join("\n");
export const isEmptyNote = (html) => noteLines(html).length === 0;

export function newNote(now) {
  return { id: crypto.randomUUID(), html: EMPTY_NOTE_HTML, pinned: false, updatedAt: now, deletedAt: null };
}

export function groupNotes(notes, now) {
  const groups = new Map([["Pinned", []], ["Today", []], ["Previous 7 Days", []], ["Previous 30 Days", []]]);
  for (const note of [...notes].sort((a, b) => b.updatedAt - a.updatedAt)) {
    const label = note.pinned ? "Pinned" : dateGroupLabel(note.updatedAt, now);
    if (!groups.has(label)) groups.set(label, []);
    groups.get(label).push(note);
  }
  return [...groups].filter(([, grouped]) => grouped.length > 0).map(([label, grouped]) => ({ label, notes: grouped }));
}

function dateGroupLabel(timestamp, now) {
  const startOfToday = new Date(now).setHours(0, 0, 0, 0);
  if (timestamp >= startOfToday) return "Today";
  if (timestamp >= startOfToday - 7 * DAY_MS) return "Previous 7 Days";
  if (timestamp >= startOfToday - 30 * DAY_MS) return "Previous 30 Days";
  return new Date(timestamp).toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

export function isExpired(note, now) {
  return note.deletedAt !== null && now - note.deletedAt > RECENTLY_DELETED_DAYS * DAY_MS;
}

// A note with an unsaved edit in this tab keeps the local version, so that edit's save
// lands later and wins instead of being silently replaced.
export function remoteNotesToApply(incoming, { local, isPending }) {
  return incoming.filter((note) => !isPending(note.id) && !(local.get(note.id)?.updatedAt >= note.updatedAt));
}
