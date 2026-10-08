import { test } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_UI, SCHEMA_VERSION, createStore } from "../extension/store.js";

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
  assert.deepEqual(await createStore(area).load(), { notes: [], ui: DEFAULT_UI });
  assert.equal(area.data.schemaVersion, SCHEMA_VERSION);
});

test("notes are stored one key per note and loaded back", async () => {
  const area = fakeArea({ schemaVersion: 1 });
  const store = createStore(area);
  await store.saveNotes([note]);
  assert.deepEqual(area.data["note:a"], note);
  assert.deepEqual((await store.load()).notes, [note]);
});

test("removing notes deletes their keys", async () => {
  const area = fakeArea({ schemaVersion: 1, "note:a": note });
  await createStore(area).removeNotes(["a"]);
  assert.equal("note:a" in area.data, false);
});

test("saved UI state is merged over the defaults", async () => {
  const area = fakeArea({ schemaVersion: 1, ui: { sidebarWidth: 320 } });
  assert.deepEqual((await createStore(area).load()).ui, { ...DEFAULT_UI, sidebarWidth: 320 });
});

test("data from a newer schema is refused instead of misread", async () => {
  await assert.rejects(createStore(fakeArea({ schemaVersion: 2 })).load(), /newer version/);
});

test("changes from other tabs report updated and removed notes only", () => {
  const area = fakeArea();
  const received = [];
  createStore(area).onChange((change) => received.push(change));
  area.emit({ "note:a": { newValue: note }, "note:b": { oldValue: note }, ui: { newValue: DEFAULT_UI } });
  area.emit({ ui: { newValue: DEFAULT_UI } });
  assert.deepEqual(received, [{ updated: [note], removedIds: ["b"] }]);
});
