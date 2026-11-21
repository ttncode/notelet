# Own overlapping saves — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: use kiln-implement to work this plan task by task. Steps use checkbox (`- [ ]`) syntax, and a checked box is a claim kiln re-checks rather than believes.

**Goal:** A change event from any save this window still has in flight is recognised as its own, so it is never merged as another window's edit.

**Architecture:** Replace `written` (latest JSON per note) with a tracker that holds every in-flight version per note and drops each when its save settles. The change event fires before the save's promise settles (`desktop.js:24-28`), so the version is still held when its event arrives.

**Tech Stack:** plain ES modules, `node:test`.

**Spec:** `.kiln/work/20261121-stop-app-s-own-overlapping-saves/brief.md`

## Global Constraints

- Keep `merge.js`'s merge functions and `acceptRemote`; the user may add a second window later.
- No new file, no new dependency.

## Risk flags

- none

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|---------------|----------------------------|----------------|
| Overlap | save v1 in flight, save v2 starts, v1's event arrives | v1's event is own | n/a |
| Last save | v2's event arrives | own | n/a |
| Settled | both saves settled | neither version is held | n/a |
| Failed save | the save rejects | its version is released, nothing held | the caller's `.catch` still runs |
| Same JSON twice | the same note version saved twice | still own until both settle | n/a |
| Foreign | a version never saved here | not own | n/a |

## Review Focus

- A save that never settles (Rust hangs) keeps its version held; harmless, since only an identical foreign version would be misread. No test.
- `importNotes` awaits `persist`; its rejection must still reach `reportImportError` after the release. Covered by the failed-save row.

---

### Task 1: In-flight own-save tracker, wired into the app

**Files:**
- Modify: `extension/merge.js` (add `createOwnSaves`)
- Modify: `extension/app.js:48`, `:365-367`, `:540`
- Test: `tests/merge.test.js`

**Acceptance:**
- Every matrix row passes as a test.
- `app.js` has no `written` map; `persist` and `acceptRemote` use the tracker.

**Verification:** `node --test "tests/*.test.js"` → `# fail 0`.
**Depends on:** none · **Size:** S

**Interfaces:**
- Produces: `createOwnSaves(): { track(notes: Note[]): () => void, isOwn(note: Note): boolean }` in `extension/merge.js`. `track` holds one copy of each note's `JSON.stringify` and returns a function that releases exactly those copies.

- [ ] **Step 1: Write the failing tests in `tests/merge.test.js`**

```js
test("an older save that finishes after a newer one started is still this window's own", async () => {
  const saves = createOwnSaves();
  const v1 = { id: "n", position: 90 };
  const v2 = { id: "n", position: 80 };
  const release1 = saves.track([v1]);
  const release2 = saves.track([v2]);
  assert.equal(saves.isOwn(v1), true);
  release1();
  assert.equal(saves.isOwn(v2), true);
  release2();
  assert.equal(saves.isOwn(v1), false);
  assert.equal(saves.isOwn(v2), false);
});

test("the same version saved twice stays own until both saves settle; a version never saved is not own", () => {
  const saves = createOwnSaves();
  const v = { id: "n", position: 1 };
  const first = saves.track([v]);
  const second = saves.track([v]);
  first();
  assert.equal(saves.isOwn(v), true);
  second();
  assert.equal(saves.isOwn(v), false);
  assert.equal(saves.isOwn({ id: "n", position: 2 }), false);
});

test("with the real file area, an overlapping older save's change event is recognised as own", async () => {
  // createFileArea + createStore with a 30 ms save; persist v1, then v2 after 10 ms;
  // record isOwn(remote) for every event; expect [true, true].
  // A save that rejects releases its version: invoke rejects, isOwn(v) false after the catch.
});
```

The third test fills in the comments as code, using `createFileArea` (`../extension/desktop.js`) and `createStore` (`../extension/store.js`), with persist written as `const release = saves.track(notes); return store.saveNotes(notes).finally(release);`.

- [ ] **Step 2: Run them to see them fail**

Run: `node --test tests/merge.test.js`
Expected: FAIL with `SyntaxError` / `createOwnSaves` not exported

- [ ] **Step 3: Implement `createOwnSaves()` in `extension/merge.js`; in `app.js` replace `written` with `const ownSaves = createOwnSaves();`, make `persist` `const release = ownSaves.track(changed); return store.saveNotes(changed).finally(release);`, and make `acceptRemote`'s check `if (ownSaves.isOwn(remote)) return null;`**

The per-note store is `Map<id, string[]>`; release removes one matching copy per note and deletes the key when its list is empty.

- [ ] **Step 4: Run the tests to see them pass**

Run: `node --test "tests/*.test.js"`
Expected: `# fail 0`, three more tests than the 214 baseline (217)
