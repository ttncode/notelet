# Review — 20261121-stop-app-s-own-overlapping-saves

lenses: reviewer reported, blind-hunter reported, edge-case-hunter reported, verification-gap reported, intent-alignment reported, code-review-specialist reported, security-auditor reported, test-engineer reported

Scope — predicted 3 · actual 3

Rules: no rule is routed to this change, so there is no checklist.

Bar: nothing lowers the bar.

## Triage log

| # | Reader(s) | Location | Finding | Verdict | Grade | Route |
|---|---|---|---|---|---|---|
| 1 | verification-gap, reviewer, code-review, intent, blind, test-engineer | tests/merge.test.js (third test), extension/app.js persist / acceptRemote | the integration test uses its own copy of `persist`; a regression in app.js's two wiring lines would pass the suite | real: no test imports app.js (it reads `window.__TAURI__` at load) | Important · Unlikely | note |
| 2 | edge-case, reviewer, code-review, blind, test-engineer | extension/merge.js `release` | `splice(indexOf(...), 1)` removes the last version when `indexOf` is -1 | real but unreachable: each release closure runs once, from `.finally` | Minor · Unlikely | drop |
| 3 | security, intent, blind, code-review, edge-case, test-engineer | extension/merge.js comment; extension/desktop.js:24-28 | correctness depends on the change event firing before the save settles; a future storage area that fires later would misread own saves | real dependency; holds for the only area the app uses; the third test fails if desktop.js changes that order | Minor · Unlikely | note |
| 4 | reviewer, blind, test-engineer | extension/app.js acceptRemote | an event matching an already-settled own save is now classed as foreign | unreachable today: the file area never fires after settle; with local equal to remote the merge reports no conflict | Minor · Unlikely | drop |
| 5 | blind, test-engineer | tests/merge.test.js third test | overlap forced by 10 ms vs 30 ms timers; a late timer would still pass without overlapping | real: the assertions would hold without overlap | Minor · Possible | note |
| 6 | blind, test-engineer | tests/merge.test.js | untested: failure mid-overlap, multi-note partial overlap, an id never tracked, double release | real gaps in edge cases of a 15-line helper | Minor · Unlikely | drop |
| 7 | blind | extension/store.js saveMigration | migration note writes are not tracked as own | false: the migration runs inside `store.load()` (app.js:76), before `store.onChange` is registered (app.js:95) | false | drop |
| 8 | reviewer, code-review, blind | extension/merge.js placement | own-save tracking is bookkeeping, not merging | plan's decision, beside the code that reads it | — | drop |
| 9 | blind | extension/app.js `const ownSaves` | the call site lost its comment | the name says what it is; the why is on the helper | — | drop |
| 10 | blind, intent | .gitignore | kiln line not in the diff | kiln setup, not this change | — | declined to judge |
| 11 | test-engineer | end to end | no test asserts "no toast, no merge" in the app | same root as 1 | — | note (with 1) |

## Fixed

None: no finding landed in a fix-now cell.

## Rulings

- Ruling: finding 1 is not fixed here — app.js cannot be imported in Node, and moving the save sequence into merge.js (`ownSaves.save(store, notes)`) adds surface the plan did not name; the two wiring lines were read by six readers and match the tested copy — cost if wrong: a later edit to persist could bring the false conflict back unnoticed.

## Deferred

- Move the track-save-release sequence into one exported helper so the test exercises the shipped code (finding 1, 11).
- Replace the timer-forced overlap with deferred promises the test resolves itself (finding 5).
- If a second window or another storage area arrives, revisit the event-before-settle dependency (finding 3).

## Declined to judge

- The `.gitignore` kiln line and `.kiln/`: kiln setup, not this change.
- Empty read-only dotfiles at the repo root: sandbox placeholders.
- e2e tests and the real Tauri app: not run in this session.
