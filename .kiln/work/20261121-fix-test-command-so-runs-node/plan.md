# Test command on Node 22 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: use kiln-implement to work this plan task by task. Steps use checkbox (`- [ ]`) syntax, and a checked box is a claim kiln re-checks rather than believes.

**Goal:** `npm test` runs the unit suite on Node 22, and CI and release run on Node 22.

**Architecture:** Replace the folder argument with a quoted glob that Node expands itself; bump `node-version` in both workflows.

**Tech Stack:** Node `node:test`, GitHub Actions `actions/setup-node@v4`.

**Spec:** `.kiln/work/20261121-fix-test-command-so-runs-node/brief.md`

## Global Constraints

- Test script: exactly `node --test "tests/*.test.js"` (JSON-escaped in package.json).
- Workflows: `node-version: 22`.
- No new dependency, no other file.

## Risk flags

- none

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|---------------|----------------------------|----------------|
| Node 22 run | `npm test` on Node 22.17 | 214 tests, 214 pass | n/a |
| Helper file | `tests/dom.js` exists | not run as a test file (glob needs `.test.js`) | n/a |

## Review Focus

- Windows shell quoting: `npm test` runs through cmd.exe on the CI runner; the double quotes must reach Node so Node, not the shell, expands the glob. Covered by CI's "Unit tests" step on windows-2022; not runnable here.
- Node 20 locally: the glob form requires Node ≥ 21 for glob expansion; on Node 20 it would look for a file literally named `tests/*.test.js`. Acceptable because both workflows move to 22; noted for contributors.

---

### Task 1: Test script and workflows

**Files:**
- Modify: `package.json:7`
- Modify: `.github/workflows/ci.yml:18`
- Modify: `.github/workflows/release.yml:16`

**Acceptance:**
- `npm test` passes 214 of 214 on Node 22.17.
- Both workflows set `node-version: 22`.

**Verification:** `npm test` → `# pass 214` and `# fail 0`.
**Depends on:** none · **Size:** S

**Interfaces:**
- Consumes: none
- Produces: none

- [ ] **Step 1: Run the current command to see it fail**

Run: `npm test`
Expected: FAIL with `Cannot find module '/home/ttndev/workspace/personal/notelet/tests'`

- [ ] **Step 2: Set `"test": "node --test \"tests/*.test.js\""` in `package.json:7`; set `node-version: 22` in `.github/workflows/ci.yml:18` and `.github/workflows/release.yml:16`**

- [ ] **Step 3: Run the command to see it pass**

Run: `npm test`
Expected: `# tests 214`, `# pass 214`, `# fail 0`
