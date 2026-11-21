# 20261121-stop-app-s-own-overlapping-saves — no false conflict from the app's own saves

## Change
- Fixed: moving or editing a note quickly no longer shows "This note was also edited in another window", and no longer duplicates a paragraph, when no other window exists.

## Before release
- [x] The change carries no migration and reads no new configuration value. (checked)
- [x] `kiln verify` ran the full unit suite: exit 0, 217 of 217 pass on Node 22.17.1. (checked)
- [x] The regression test fails with the fix undone (2 fail) and passes with it. (checked)
- [ ] In the desktop app, holding Alt+Down on a note in the list shows no conflict message. (confirm)

## Release steps
1. Merge the pull request once CI is green.
2. Ship it in the next release as usual.

## After release
- [ ] After updating, fast note moves and edits show no "edited in another window" message. (confirm)

## Rollback
- Trigger: notes edited in Notelet stop saving, or the conflict message appears more often than before.
- Steps: `git revert` the merge commit, then open and merge that pull request, then release.
- Time: one revert pull request and one release.
