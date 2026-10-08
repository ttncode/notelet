import "./dom.js";
import { test } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_UI, SCHEMA_VERSION, createStore } from "../extension/store.js";
import { defaultSettings } from "../extension/sprint.js";

function fakeArea(initial = {}) {
  const data = { ...initial };
  const listeners = [];
  return {
    data,
    emit: (changes) => listeners.forEach((listener) => listener(changes)),
    get: async () => ({ ...data }),
    set: async (items) => { Object.assign(data, items); },
    remove: async (keys) => { keys.forEach((key) => delete data[key]); },
    onChanged: { addListener: (listener) => listeners.push(listener) },
  };
}

const note = { id: "a", html: "<h1>A</h1>", pinned: false, updatedAt: 1, deletedAt: null };

test("a fresh install records the schema version and returns defaults", async () => {
  const area = fakeArea();
  assert.deepEqual(await createStore(area).load(), { notes: [], ui: DEFAULT_UI, settings: defaultSettings() });
  assert.equal(area.data.schemaVersion, SCHEMA_VERSION);
});

test("notes are stored one key per note and loaded back", async () => {
  const area = fakeArea({ schemaVersion: 2 });
  const store = createStore(area);
  await store.saveNotes([note]);
  assert.deepEqual(area.data["note:a"], note);
  assert.deepEqual((await store.load()).notes, [note]);
});

test("removing notes deletes their keys", async () => {
  const area = fakeArea({ schemaVersion: 2, "note:a": note });
  await createStore(area).removeNotes(["a"]);
  assert.equal("note:a" in area.data, false);
});

test("saved UI state is merged over the defaults", async () => {
  const area = fakeArea({ schemaVersion: 2, ui: { sidebarWidth: 320 } });
  assert.deepEqual((await createStore(area).load()).ui, { ...DEFAULT_UI, sidebarWidth: 320 });
});

test("data from a newer schema is refused instead of misread", async () => {
  await assert.rejects(createStore(fakeArea({ schemaVersion: 3 })).load(), /newer version/);
});

test("changes from other tabs report updated and removed notes only", () => {
  const area = fakeArea();
  const received = [];
  createStore(area).onChange((change) => received.push(change));
  area.emit({ "note:a": { newValue: note }, "note:b": { oldValue: note }, ui: { newValue: DEFAULT_UI } });
  area.emit({ ui: { newValue: DEFAULT_UI } });
  assert.deepEqual(received, [{ updated: [note], removedIds: ["b"] }]);
});

test("loading schema 1 migrates Target notes and stores default settings", async () => {
  const targetNote = { id: "t", html: "<h1>Plan</h1><p>Target: 9</p>", pinned: false, updatedAt: 1, deletedAt: null };
  const area = fakeArea({ schemaVersion: 1, "note:t": targetNote, "note:a": note });
  const loaded = await createStore(area).load(new Date(2026, 9, 8));
  assert.deepEqual(loaded.notes.find((n) => n.id === "t").sprint, { start: "2026-10-08", end: "2026-10-21", target: 9 });
  assert.equal(area.data.schemaVersion, 2);
  assert.deepEqual(area.data.settings, defaultSettings());
  assert.deepEqual(area.data["note:a"], note);
  assert.ok(area.data["note:t"].sprint);
});

test("status settings are saved and reported to other tabs", async () => {
  const area = fakeArea({ schemaVersion: 2 });
  const store = createStore(area);
  const received = [];
  store.onChange((change) => received.push(change));
  const settings = { statuses: [{ id: "s1", label: "Open", color: "#000000" }] };
  await store.saveSettings(settings);
  assert.deepEqual(area.data.settings, settings);
  area.emit({ settings: { newValue: settings } });
  assert.deepEqual(received, [{ updated: [], removedIds: [], settings }]);
});

test("a theme change in another tab is reported, other layout changes are not", () => {
  const area = fakeArea();
  const received = [];
  createStore(area).onChange((change) => received.push(change));
  area.emit({ ui: { oldValue: { ...DEFAULT_UI }, newValue: { ...DEFAULT_UI, sidebarWidth: 300 } } });
  area.emit({ ui: { oldValue: { ...DEFAULT_UI }, newValue: { ...DEFAULT_UI, theme: "dark" } } });
  assert.deepEqual(received, [{ updated: [], removedIds: [], theme: "dark" }]);
});

test("the theme defaults to System", () => {
  assert.equal(DEFAULT_UI.theme, "system");
});
