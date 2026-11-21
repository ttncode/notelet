# Brief — test command runs on Node 22; CI on Node 22

Follows spike 20261121-review-each-items-above-one-one, finding F4 (audit item 2).

## What is asked
- Who: the maintainer and any contributor running the unit tests.
- What: `npm test` must run the unit suite on current Node; CI and release must run on Node 22.
- Success: `npm test` passes 214 of 214 on Node 22.17; workflows set `node-version: 22`.
- Constraint: nothing else changes.

## What I found
- `package.json:7` is `node --test tests/`. On Node 22.17.1 it fails: `Cannot find module '/home/ttndev/workspace/personal/notelet/tests'`.
- `node --test "tests/*.test.js"` passes 214 of 214 on Node 22.17.1. Node 22 expands the quoted glob itself, so it does not depend on the shell (Windows CI uses pwsh/cmd for `npm test`).
- `.github/workflows/ci.yml:18` and `.github/workflows/release.yml:16` pin `node-version: 20`.
- Every test file is `tests/*.test.js`; `tests/dom.js` is a helper, not a test, and must not run as one. The glob excludes it.
- `test:e2e` names one file and is unaffected.

## Still unknown
- None blocking. Node 20's end of life (April 2026) is from my knowledge, not checked.

## Past learnings
- None: no learnings store (`.kiln/learnings/` does not exist), recall not run.

## Design (bounded: two sentences)
Change the script to the quoted glob, and set both workflows to Node 22. No new file, no new dependency.
