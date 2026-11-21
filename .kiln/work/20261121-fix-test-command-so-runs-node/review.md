# Review — 20261121-fix-test-command-so-runs-node

lenses: reviewer reported, blind-hunter reported, edge-case-hunter reported, verification-gap reported, intent-alignment reported, code-review-specialist reported, security-auditor reported, test-engineer reported

Scope — predicted 3 · actual 3

Rules: no rule is routed to this change, so there is no checklist.

Bar: nothing lowers the bar.

## Triage log

| # | Reader(s) | Location | Finding | Verdict | Grade | Route |
|---|---|---|---|---|---|---|
| 1 | verification-gap, edge-case, blind, security, code-review, reviewer, test-engineer | package.json (no `engines`), README.md:141-146 | Nothing tells a contributor Node ≥ 21 is needed; on Node 20 `npm test` fails loudly with a "Could not find" error | real: Node 21+ expands the glob (doc/api/test.md); README names no Node version | Minor · Possible | note |
| 2 | edge-case, reviewer, code-review, test-engineer | package.json:7 | `tests/*.test.js` does not recurse; a future `tests/sub/x.test.js` would be skipped | real but no subfolder exists today (`tests/` has 24 `*.test.js` files and `dom.js`) | Minor · Unlikely | drop |
| 3 | test-engineer | package.json:7 | a glob that matches nothing exits 0 with 0 tests, so a moved `tests/` folder would pass CI | real: `node --test "nonexist/*.test.js"` exited 0 here | Minor · Unlikely | drop |
| 4 | intent, reviewer, code-review, test-engineer | package.json:7 on windows-2022 | cmd.exe quoting not run here | not a defect: Node's own docs recommend the double-quoted form; CI's "Unit tests" step shows `# tests 214` | Minor · Unlikely | note (Not checked) |
| 5 | blind | ci.yml:18, release.yml:16 | Node version copied in two workflows | pre-existing pattern, not introduced here | — | deferred |
| 6 | blind | PR body | the PR should say what broke | taken: the PR body states the Node 22 error | — | note (SHIP) |
| 7 | blind | CI e2e and `npx tauri build` | not exercised on Node 22 by this diff | real gap; CI runs both on the PR | Minor · Unlikely | note |
| 8 | blind, intent | .gitignore | the kiln line is in the tree but not in the diff | kiln setup, not this change; kept out of the change's paths | — | declined to judge |
| 9 | blind | changelog | no changelog entry | false: the repository has no changelog file (`git ls-files` finds none) | false | drop |
| 10 | security | release.yml, ci.yml | third-party actions pinned by tag; msedgedriver-tool unpinned | pre-existing, outside the diff | — | deferred |
| 11 | security, reviewer, code-review, test-engineer | repo root | empty sandbox placeholder dotfiles are untracked | not part of the change; SHIP stages named paths only | — | declined to judge |

## Fixed

None: no finding landed in a fix-now cell.

## Rulings

- Ruling: finding 1 (Node version note) is not added — the brief says nothing else changes, and the failure is loud, not silent — cost if wrong: a contributor on Node 20 reads one confusing error.

## Deferred

- Node version kept in two workflows; `actions/setup-node` can read `node-version-file` once `engines` or `.nvmrc` exists (finding 5).
- Pin third-party actions to commit SHAs, and `cargo install --git` msedgedriver-tool with `--rev` and `--locked` (finding 10).

## Declined to judge

- The `.gitignore` kiln line and `.kiln/`: kiln setup, not this change.
- Empty read-only dotfiles at the repo root (`.bashrc`, `.mcp.json`, `.claude/…`): sandbox placeholders, not the user's files.
- Node 20's end-of-life date: changes nothing about correctness.
