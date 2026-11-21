# Note order after repeated drops — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: use kiln-implement to work this plan task by task. Steps use checkbox (`- [ ]`) syntax, and a checked box is a claim kiln re-checks rather than believes.

**Goal:** A drop or step always lands where it was aimed, however many times notes go into the same gap.

**Architecture:** `placeNote` keeps its midpoint; when the midpoint is not strictly between its neighbours it renumbers the section and returns the other notes' new positions. `applyPlacement` saves them with the moved note.

**Tech Stack:** plain ES modules, `node:test`.

**Spec:** `.kiln/work/20261121-renumber-note-positions-when-repeated/brief.md`

## Global Constraints

- Existing results in `tests/model.test.js:61-74` stay exactly as they are (no `renumbered` key when no renumber happens).
- Renumbered neighbours keep their `updatedAt`.
- No new file, no new dependency.

## Risk flags

- none

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|---------------|----------------------------|----------------|
| Room left | neighbours 1000 apart | `{ position, pinned }` only, as today | n/a |
| Gap used up | 40 drops right under the top note | every drop lands second | n/a |
| Neighbours already equal | two notes share one position, drop between them | lands between them, order of the rest kept | n/a |
| Pinned section | renumber while dropping into the pinned section | only pinned notes renumbered | n/a |

## Review Focus

- Step with Alt+Up/Down through a collapsed gap: `stepNote` goes through `placeNote`, so it is covered by the same code; one assertion in the repeated-drop test steps once.
- A renumber touches every note of the section: one save of all of them in one `persist` call.

---

### Task 1: Renumber on collision, applied by the app

**Files:**
- Modify: `extension/model.js:62-84` (`placeNote`, `positionBetween`)
- Modify: `extension/app.js` `applyPlacement`
- Test: `tests/model.test.js`

**Acceptance:**
- Every matrix row passes as a test.
- `applyPlacement` saves the moved note and every renumbered note in one `persist` call, renumbered notes without a new `updatedAt`.

**Verification:** `node --test "tests/*.test.js"` → `# fail 0`.
**Depends on:** none · **Size:** S

**Interfaces:**
- Produces: `placeNote(notes, { id, targetId, placement }) → { position: number, pinned: boolean, renumbered?: Array<{ id: string, position: number }> }`; `stepNote` returns the same shape or `null`.

- [ ] **Step 1: Write the failing tests in `tests/model.test.js`**

```js
test("forty drops right under the top note all land second", () => {
  // notes: top (position T), under (T - 1000); 40 times: add n_i at T - 5000 - i, place it after "top",
  // apply { position } to n_i and every renumbered { id, position }; assert sorted[1].id === n_i each time.
  // Then stepNote the second note down once (step: 1) and assert it is third.
});

test("a drop between two notes that share a position lands between them", () => {
  const notes = [note({ id: "a", position: 10 }), note({ id: "b", position: 5 }), note({ id: "c", position: 5 }), note({ id: "m", position: 1 })];
  // place "m" after "b"; apply; assert the order is a, b, m, c and a stays first.
});

test("renumbering stays inside the pinned section", () => {
  // two pinned notes sharing a position and one unpinned note; place a third pinned note between the pinned pair;
  // assert renumbered holds only pinned ids.
});
```

Each test applies a result with one helper in the test file: `apply(notes, id, result)` → notes with `result.position`/`pinned` on `id` and each `renumbered` position on its note.

- [ ] **Step 2: Run them to see them fail**

Run: `node --test tests/model.test.js`
Expected: FAIL on the forty-drops test (a drop lands third or lower)

- [ ] **Step 3: In `placeNote`, when `positionBetween` returns a value equal to `above` or `below`'s position, build the section's new order with the moved note inserted, give the i-th note from the top `(count - i) * POSITION_STEP`, and return the moved note's position with `renumbered` for the others; in `applyPlacement`, apply `renumbered` to those notes (no `updatedAt` change) and persist them together with the moved note**

- [ ] **Step 4: Run the tests to see them pass**

Run: `node --test "tests/*.test.js"`
Expected: `# fail 0`, 217 tests (214 baseline + 3; the unit suite on `main` has 214)
