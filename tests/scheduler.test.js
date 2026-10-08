import { test, mock } from "node:test";
import assert from "node:assert/strict";
import { createSaveScheduler } from "../extension/scheduler.js";

function setup() {
  mock.timers.enable({ apis: ["setTimeout", "Date"] });
  const saved = [];
  const scheduler = createSaveScheduler({ delayMs: 500, maxWaitMs: 5000, save: (id) => saved.push(id) });
  return { saved, scheduler };
}

test("a save runs once typing pauses", (t) => {
  t.after(() => mock.timers.reset());
  const { saved, scheduler } = setup();
  scheduler.schedule("a");
  mock.timers.tick(400);
  scheduler.schedule("a");
  mock.timers.tick(400);
  assert.deepEqual(saved, []);
  mock.timers.tick(100);
  assert.deepEqual(saved, ["a"]);
  assert.equal(scheduler.isPending("a"), false);
});

test("continuous typing still saves at least every five seconds", (t) => {
  t.after(() => mock.timers.reset());
  const { saved, scheduler } = setup();
  for (let elapsed = 0; elapsed <= 5000; elapsed += 250) {
    scheduler.schedule("a");
    mock.timers.tick(250);
  }
  assert.deepEqual(saved, ["a"]);
});

test("flush saves every pending note now and cancel drops one", (t) => {
  t.after(() => mock.timers.reset());
  const { saved, scheduler } = setup();
  scheduler.schedule("a");
  scheduler.schedule("b");
  scheduler.cancel("b");
  assert.equal(scheduler.isPending("a"), true);
  scheduler.flush();
  mock.timers.tick(1000);
  assert.deepEqual(saved, ["a"]);
});
