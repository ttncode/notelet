# 20261121-fix-test-command-so-runs-node — test command on Node 22

## Change
- Fixed: `npm test` runs the unit suite on Node 22, and CI and release builds run on Node 22. Nothing changes for people using the app.

## Before release
- [x] The change carries no migration and reads no new configuration value. (checked)
- [x] `kiln verify` ran the full unit suite (`npm test`'s new form): exit 0, 214 of 214 pass on Node 22.17.1. (checked)
- [ ] The CI "Unit tests" step on windows-2022 shows `# tests 214` on this pull request. (confirm)

## Release steps
1. Merge the pull request once CI is green.
2. Nothing else: the release workflow picks up Node 22 at the next `v*` tag.

## After release
- [ ] The next `v*` tag's Release run passes its `npm test` step on Node 22. (confirm)

## Rollback
- Trigger: CI or the Release run fails on Node 22 in its install or unit-test step.
- Steps: `git revert` the merge commit, then open and merge that pull request.
- Time: one revert pull request.
