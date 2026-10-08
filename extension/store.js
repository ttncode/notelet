const NOTE_PREFIX = "note:";
const SCHEMA_KEY = "schemaVersion";
const UI_KEY = "ui";

export const SCHEMA_VERSION = 1;
export const DEFAULT_UI = Object.freeze({ sidebarWidth: 280, sidebarHidden: false, lastNoteId: null, scrollTop: 0 });

export function createStore(area) {
  return {
    load: () => load(area),
    saveNotes: (notes) => area.set(Object.fromEntries(notes.map((note) => [noteKey(note.id), note]))),
    removeNotes: (ids) => area.remove(ids.map(noteKey)),
    saveUi: (ui) => area.set({ [UI_KEY]: ui }),
    onChange: (listener) => area.onChanged.addListener((changes) => notifyNoteChanges(changes, listener)),
  };
}

async function load(area) {
  const stored = await area.get(null);
  const version = stored[SCHEMA_KEY];
  if (version === undefined) await area.set({ [SCHEMA_KEY]: SCHEMA_VERSION });
  else if (version > SCHEMA_VERSION) throw new Error("These notes were saved by a newer version of Notelet. Update the extension to open them.");
  const notes = Object.entries(stored).filter(([key]) => key.startsWith(NOTE_PREFIX)).map(([, note]) => note);
  return { notes, ui: { ...DEFAULT_UI, ...stored[UI_KEY] } };
}

function notifyNoteChanges(changes, listener) {
  const noteChanges = Object.entries(changes).filter(([key]) => key.startsWith(NOTE_PREFIX));
  if (noteChanges.length === 0) return;
  const updated = noteChanges.filter(([, change]) => change.newValue !== undefined).map(([, change]) => change.newValue);
  const removedIds = noteChanges.filter(([, change]) => change.newValue === undefined).map(([key]) => key.slice(NOTE_PREFIX.length));
  listener({ updated, removedIds });
}

const noteKey = (id) => `${NOTE_PREFIX}${id}`;
