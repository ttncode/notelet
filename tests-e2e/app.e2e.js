// Runs against the built app through tauri-driver (see .github/workflows/ci.yml); not part of npm test.
import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { HOTKEYS } from "../extension/hotkeys.js";
import { newSession } from "./webdriver.js";

const APPLICATION = process.env.NOTELET_APP ?? "desktop/target/release/notelet.exe";
// Longer than the editor's save delay, so the note is on disk.
const SAVE_SETTLE_MS = 1500;
const STEP_SETTLE_MS = 400;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const comboName = ({ mod, alt, shift, code }) => [code, Boolean(mod), Boolean(alt), Boolean(shift)].join();
const noteCount = "return document.querySelectorAll('#note-list .note-row').length";

let app;

before(async () => {
  app = await newSession(APPLICATION);
  await app.waitFor("return document.readyState === 'complete' && Boolean(window.__TAURI__)");
  await sleep(STEP_SETTLE_MS);
});

after(async () => {
  await app?.end();
});

async function newNoteInEditor(text) {
  await app.press({ alt: true, code: "KeyN" });
  await app.waitFor("return document.activeElement?.closest('#editor') !== null");
  await app.type(text);
}

test("every default in-app shortcut reaches the page", async () => {
  await newNoteInEditor("shortcut check");
  await app.execute(`
    window.__seen = [];
    window.__record = (event) => {
      if (/^(Control|Alt|Shift|Meta)/.test(event.code)) return;
      window.__seen.push([event.code, event.ctrlKey, event.altKey, event.shiftKey].join());
      event.preventDefault();
      event.stopImmediatePropagation();
    };
    addEventListener("keydown", window.__record, { capture: true });
  `);
  for (const combo of HOTKEYS) await app.press(combo);
  const seen = new Set(await app.execute("removeEventListener('keydown', window.__record, { capture: true }); return window.__seen"));
  const missing = HOTKEYS.filter((combo) => !seen.has(comboName(combo))).map((combo) => `${combo.id} (${comboName(combo)})`);
  assert.deepEqual(missing, []);
});

test("Alt+N adds a note and Alt+1 / Alt+3 move between the list and the note", async () => {
  const before = await app.execute(noteCount);
  await newNoteInEditor("second");
  assert.equal(await app.execute(noteCount), before + 1);
  await app.press({ alt: true, code: "Digit1" });
  await app.waitFor("return document.activeElement?.closest('#note-list') !== null");
  await app.press({ alt: true, code: "Digit3" });
  await app.waitFor("return document.activeElement?.closest('#editor') !== null");
});

test("Ctrl+/ opens and closes the shortcut list; Ctrl+F goes to search", async () => {
  await app.press({ mod: true, code: "Slash" });
  await app.waitFor("return document.getElementById('help').open");
  await app.press({ mod: true, code: "Slash" });
  await app.waitFor("return !document.getElementById('help').open");
  await app.press({ mod: true, code: "KeyF" });
  await app.waitFor("return document.activeElement?.id === 'search'");
  await app.press({ code: "Escape" });
});

test("Ctrl+Z undoes typing", async () => {
  await newNoteInEditor("undo me");
  const typed = await app.execute("return document.getElementById('editor').innerText");
  await app.press({ mod: true, code: "KeyZ" });
  await sleep(STEP_SETTLE_MS);
  assert.notEqual(await app.execute("return document.getElementById('editor').innerText"), typed);
});

test("Alt+Left goes back exactly one step", async () => {
  await app.press({ alt: true, code: "Digit1" });
  await sleep(STEP_SETTLE_MS);
  await app.press({ alt: true, code: "Digit3" });
  await sleep(STEP_SETTLE_MS);
  const depth = await app.execute("return history.state.depth");
  await app.press({ alt: true, code: "ArrowLeft" });
  await sleep(STEP_SETTLE_MS);
  assert.equal(await app.execute("return history.state.depth"), depth - 1);
});

test("Alt+Enter maximizes and restores the window", async () => {
  const width = await app.execute("return window.outerWidth");
  await app.press({ alt: true, code: "Enter" });
  await app.waitFor(`return window.outerWidth > ${width}`);
  await app.press({ alt: true, code: "Enter" });
  await app.waitFor(`return window.outerWidth === ${width}`);
});

test("browser keys do nothing: reload, zoom and print", async () => {
  await app.execute("window.__sentinel = 1; window.__printed = false; addEventListener('beforeprint', () => { window.__printed = true; })");
  const ratio = await app.execute("return devicePixelRatio");
  await app.press({ code: "F5" });
  await app.press({ mod: true, code: "KeyR" });
  await app.press({ mod: true, code: "Equal" });
  await app.press({ mod: true, code: "Minus" });
  await app.press({ mod: true, code: "KeyP" });
  await sleep(SAVE_SETTLE_MS);
  assert.equal(await app.execute("return window.__sentinel"), 1);
  assert.equal(await app.execute("return devicePixelRatio"), ratio);
  assert.equal(await app.execute("return window.__printed"), false);
});

test("a note survives a restart", async () => {
  const marker = `persist-${Date.now()}`;
  await newNoteInEditor(marker);
  await sleep(SAVE_SETTLE_MS);
  await app.end();
  app = await newSession(APPLICATION);
  await app.waitFor(`return document.getElementById('note-list')?.innerText.includes(${JSON.stringify(marker)})`, 10000);
});
