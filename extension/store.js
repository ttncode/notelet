import { defaultSettings, migrateTargetNote } from "./sprint.js";

const NOTE_PREFIX = "note:";
const SCHEMA_KEY = "schemaVersion";
const UI_KEY = "ui";
const SETTINGS_KEY = "settings";

export const SCHEMA_VERSION = 2;
export const DEFAULT_UI = Object.freeze({ sidebarWidth: 280, sidebarHidden: false, lastNoteId: null, scrollTop: 0 });

export function createStore(area) {
  return {
    load: (today = new Date()) => load(area, today),
    saveNotes: (notes) => area.set(Object.fromEntries(notes.map((note) => [noteKey(note.id), note]))),
    removeNotes: (ids) => area.remove(ids.map(noteKey)),
    saveUi: (ui) => area.set({ [UI_KEY]: ui }),
    saveSettings: (settings) => area.set({ [SETTINGS_KEY]: settings }),
    onChange: (listener) => area.onChanged.addListener((changes) => notifyChanges(changes, listener)),
  };
}

async function load(area, today) {
  const stored = await area.get(null);
  const version = stored[SCHEMA_KEY] ?? 0;
  if (version > SCHEMA_VERSION) throw new Error("These notes were saved by a newer version of Notelet. Update the extension to open them.");
  const settings = stored[SETTINGS_KEY] ?? defaultSettings();
  const storedNotes = Object.entries(stored).filter(([key]) => key.startsWith(NOTE_PREFIX)).map(([, note]) => note);
  const notes = version < SCHEMA_VERSION ? storedNotes.map((note) => migrateTargetNote(note, settings.statuses, today)) : storedNotes;
  if (version < SCHEMA_VERSION) await saveMigration(area, settings, notes.filter((note, index) => note !== storedNotes[index]));
  return { notes, ui: { ...DEFAULT_UI, ...stored[UI_KEY] }, settings };
}

function saveMigration(area, settings, changedNotes) {
  const notes = Object.fromEntries(changedNotes.map((note) => [noteKey(note.id), note]));
  return area.set({ ...notes, [SETTINGS_KEY]: settings, [SCHEMA_KEY]: SCHEMA_VERSION });
}

function notifyChanges(changes, listener) {
  const noteChanges = Object.entries(changes).filter(([key]) => key.startsWith(NOTE_PREFIX));
  const settings = changes[SETTINGS_KEY]?.newValue;
  if (noteChanges.length === 0 && settings === undefined) return;
  const updated = noteChanges.filter(([, change]) => change.newValue !== undefined).map(([, change]) => change.newValue);
  const removedIds = noteChanges.filter(([, change]) => change.newValue === undefined).map(([key]) => key.slice(NOTE_PREFIX.length));
  listener(settings === undefined ? { updated, removedIds } : { updated, removedIds, settings });
}

const noteKey = (id) => `${NOTE_PREFIX}${id}`;
