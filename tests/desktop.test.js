import "./dom.js";
import { test } from "node:test";
import assert from "node:assert/strict";
import { createFileArea, historyKey, recoveryMessage, toAccelerator, whenShown } from "../extension/desktop.js";
import { DEFAULT_UI, SCHEMA_VERSION, createStore } from "../extension/store.js";
import { defaultSettings } from "../extension/sprint.js";

function fakeBackend(initial = {}, { recovered = null, damagedPath = null } = {}) {
  const calls = [];
  const saves = [];
  let failNext = false;
  const invoke = async (command, args) => {
    calls.push(command);
    if (command === "storage_load") return { data: structuredClone(initial), recovered, damagedPath };
    if (command === "storage_save") {
      await new Promise((resolve) => setTimeout(resolve, 5));
      if (failNext) {
        failNext = false;
        throw new Error("disk full");
      }
      saves.push(structuredClone(args.data));
      return null;
    }
    throw new Error(`unexpected command ${command}`);
  };
  return { invoke, calls, saves, failOnce: () => { failNext = true; } };
}

test("the file is loaded once and get returns all keys or one key", async () => {
  const backend = fakeBackend({ ui: { theme: "dark" }, schemaVersion: 5 });
  const area = createFileArea(backend.invoke);
  assert.deepEqual(await area.get(null), { ui: { theme: "dark" }, schemaVersion: 5 });
  assert.deepEqual(await area.get("ui"), { ui: { theme: "dark" } });
  assert.deepEqual(await area.get("missing"), {});
  assert.equal(backend.calls.filter((command) => command === "storage_load").length, 1);
});

test("writes run one after another and each saves the whole map", async () => {
  const backend = fakeBackend();
  const area = createFileArea(backend.invoke);
  const changes = [];
  area.onChanged.addListener((change) => changes.push(change));
  await Promise.all([area.set({ a: 1 }), area.set({ b: 2 })]);
  assert.deepEqual(backend.saves, [{ a: 1 }, { a: 1, b: 2 }]);
  assert.deepEqual(changes, [{ a: { oldValue: undefined, newValue: 1 } }, { b: { oldValue: undefined, newValue: 2 } }]);
});

test("removing a key saves the map without it and reports no newValue", async () => {
  const backend = fakeBackend({ a: 1, b: 2 });
  const area = createFileArea(backend.invoke);
  const changes = [];
  area.onChanged.addListener((change) => changes.push(change));
  await area.remove(["a"]);
  assert.deepEqual(backend.saves, [{ b: 2 }]);
  assert.deepEqual(changes, [{ a: { oldValue: 1 } }]);
  assert.equal("newValue" in changes[0].a, false);
});

test("a value equal to what is stored fires no change for that key", async () => {
  const backend = fakeBackend({ a: { x: 1 } });
  const area = createFileArea(backend.invoke);
  const changes = [];
  area.onChanged.addListener((change) => changes.push(change));
  await area.set({ a: { x: 1 }, b: 2 });
  assert.deepEqual(changes, [{ b: { oldValue: undefined, newValue: 2 } }]);
});

test("a failed write rejects that call and the next write still saves", async () => {
  const backend = fakeBackend();
  const area = createFileArea(backend.invoke);
  backend.failOnce();
  await assert.rejects(area.set({ a: 1 }), /disk full/);
  await area.set({ b: 2 });
  assert.deepEqual(backend.saves.at(-1), { a: 1, b: 2 });
});

test("recovery reports what the load found", async () => {
  const area = createFileArea(fakeBackend({}, { recovered: "backup" }).invoke);
  assert.deepEqual(await area.recovery(), { recovered: "backup", damagedPath: null });
});

test("the store works on the file area: a fresh install gets defaults and the schema version", async () => {
  const backend = fakeBackend();
  const loaded = await createStore(createFileArea(backend.invoke)).load();
  assert.deepEqual(loaded, { notes: [], ui: DEFAULT_UI, settings: defaultSettings() });
  assert.equal(backend.saves.at(-1).schemaVersion, SCHEMA_VERSION);
});

test("toAccelerator names modifiers in Ctrl, Alt, Shift order", () => {
  assert.equal(toAccelerator({ mod: true, alt: true, shift: false, code: "KeyN" }), "Ctrl+Alt+KeyN");
  assert.equal(toAccelerator({ mod: true, alt: true, shift: true, code: "Digit1" }), "Ctrl+Alt+Shift+Digit1");
  assert.equal(toAccelerator({ mod: false, alt: true, shift: false, code: "F2" }), "Alt+F2");
  assert.equal(toAccelerator(null), null);
  assert.equal(toAccelerator({ mod: true, alt: false, shift: false, code: null }), null);
});

test("recoveryMessage explains a restored copy or a moved file", () => {
  assert.equal(recoveryMessage({ recovered: "backup", damagedPath: null }),
    "Notelet's notes file was damaged, so the last good copy was opened. Your most recent change may be missing.");
  assert.equal(recoveryMessage({ recovered: "reset", damagedPath: "C:\\x\\notelet.json.damaged-1" }),
    "Notelet's notes file was damaged and was moved to C:\\x\\notelet.json.damaged-1. Import a backup to bring your notes back.");
  assert.equal(recoveryMessage({ recovered: null, damagedPath: null }), null);
});

test("historyKey maps Alt+Left and Alt+Right only", () => {
  const event = (code, modifiers = {}) => ({ code, altKey: false, ctrlKey: false, shiftKey: false, metaKey: false, ...modifiers });
  assert.equal(historyKey(event("ArrowLeft", { altKey: true })), "back");
  assert.equal(historyKey(event("ArrowRight", { altKey: true })), "forward");
  assert.equal(historyKey(event("ArrowLeft", { altKey: true, ctrlKey: true })), null);
  assert.equal(historyKey(event("ArrowLeft", { altKey: true, shiftKey: true })), null);
  assert.equal(historyKey(event("ArrowLeft")), null);
  assert.equal(historyKey(event("ArrowUp", { altKey: true })), null);
});

test("historyKey leaves a key alone when a shortcut already handled it", () => {
  const event = { code: "ArrowLeft", altKey: true, ctrlKey: false, shiftKey: false, metaKey: false, defaultPrevented: true };
  assert.equal(historyKey(event), null);
});

function fakePage(visibilityState) {
  const listeners = {};
  const target = {
    visibilityState,
    addEventListener: (type, listener) => { (listeners[type] ??= []).push(listener); },
    removeEventListener: (type, listener) => { listeners[type] = (listeners[type] ?? []).filter((other) => other !== listener); },
  };
  const fire = (type) => [...(listeners[type] ?? [])].forEach((listener) => listener());
  return { target, fire, count: (type) => (listeners[type] ?? []).length };
}

test("whenShown runs at once on a visible page", () => {
  const page = fakePage("visible");
  let runs = 0;
  whenShown(page.target, page.target, () => { runs += 1; });
  assert.equal(runs, 1);
});

test("whenShown waits for a hidden page to be shown or focused, and runs once", () => {
  const page = fakePage("hidden");
  let runs = 0;
  whenShown(page.target, page.target, () => { runs += 1; });
  assert.equal(runs, 0);
  page.fire("visibilitychange");
  assert.equal(runs, 0);
  page.target.visibilityState = "visible";
  page.fire("visibilitychange");
  page.fire("focus");
  assert.equal(runs, 1);
  assert.equal(page.count("visibilitychange") + page.count("focus"), 0);
});

test("whenShown also runs on focus alone", () => {
  const page = fakePage("hidden");
  let runs = 0;
  whenShown(page.target, page.target, () => { runs += 1; });
  page.fire("focus");
  assert.equal(runs, 1);
});

test("isSaved is false after a failed write and true again after the next one succeeds", async () => {
  const backend = fakeBackend();
  const area = createFileArea(backend.invoke);
  assert.equal(area.isSaved(), true);
  backend.failOnce();
  await area.set({ a: 1 }).catch(() => {});
  assert.equal(area.isSaved(), false);
  await area.set({ b: 2 });
  assert.equal(area.isSaved(), true);
});
