# Review — 20261121-renumber-note-positions-when-repeated

lenses: reviewer reported, blind-hunter reported, edge-case-hunter reported, verification-gap reported, intent-alignment reported, code-review-specialist reported, security-auditor reported, test-engineer reported

Scope — predicted 3 · actual 3

Rules: no rule is routed to this change, so there is no checklist.

Bar: nothing lowers the bar.

## Triage log

| # | Reader(s) | Location | Finding | Verdict | Grade | Route |
|---|---|---|---|---|---|---|
| 1 | reviewer, blind, edge-case, intent, code-review, test-engineer | extension/model.js `spacedOut` | renumbering to 1000·n put a section on a different scale from timestamps; after it, unpin sends a note to the bottom, pin to the bottom of Pinned, recover and import to the top | real: the reviewer reproduced the unpin case; new test RED before the fix | Important · Likely | fix pass |
| 2 | verification-gap, blind, test-engineer | tests/model.test.js | no renumber test uses `placement: "before"`; a mutant using `index + 1` for both survives | real gap; the code's `index` for "before" is correct by reading (insert before the target) | Important · Unlikely | note |
| 3 | verification-gap, blind, intent, code-review, test-engineer | extension/app.js `applyPlacement` | the tests apply results with their own helper; app.js's apply, `saves.cancel` and single `persist` are untested | real: app.js cannot be imported in Node | Important · Unlikely | note |
| 4 | verification-gap, blind, code-review, test-engineer, reviewer | tests/model.test.js pinned test | asserts only that renumbered ids start with "p", not the order | real, weak assertion | Minor · Possible | note |
| 5 | test-engineer | extension/model.js `fitsBetween` | each half untested alone; spacing values untested | real | Minor · Unlikely | drop |
| 6 | blind, edge-case, test-engineer | merge path | two windows renumbering at once could conflict | single window today | Minor · Unlikely | drop |
| 7 | blind | extension/app.js `saves.cancel` on neighbours | could drop a pending edit | false: `onEditorChange` and `onBoardChange` write the edit into `notes` before scheduling (reviewer checked), and the renumbered note is saved from `notes` | false | drop |
| 8 | blind | extension/model.js comment | "about 23 drops" depends on a 1000 gap | real; the comment now says "a 1000 gap" | Minor · Possible | fixed with 1 |
| 9 | blind, code-review | extension/app.js | the local `spacedOut` array shares the model function's name | readable in context | — | drop |
| 10 | intent, blind, test-engineer | extension/app.js | the `updatedAt` constraint has no test | real; same root as 3 | — | note (with 3) |
| 11 | blind, intent | .gitignore | kiln line not in the diff | kiln setup | — | declined to judge |

## Fixed

fixed 1 (renumbered section on another scale) — a renumbered note that is unpinned lands by its age, not at the bottom of the list RED→GREEN, suite 218/218

## Rulings

- Ruling: findings 2 and 3 are not fixed here — 2 is code correct by reading with an unpinned mutant gap, 3 needs app.js importable in Node; both are below a fix-now cell — cost if wrong: a later edit to the "before" index or to `applyPlacement` could ship unseen.

## Deferred

- A renumber test with `placement: "before"` and a stronger pinned-order assertion (findings 2, 4).
- Move the apply step into a pure model function the tests can call (finding 3, same as #104's deferred helper).

## Declined to judge

- The `.gitignore` kiln line and `.kiln/`: kiln setup, not this change.
- Empty read-only dotfiles at the repo root: sandbox placeholders.
- e2e drag behaviour in the real app: not run in this session.
