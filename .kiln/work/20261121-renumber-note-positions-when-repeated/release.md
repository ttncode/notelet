# 20261121-renumber-note-positions-when-repeated — note order keeps working after many drops

## Change
- Fixed: dragging notes, or moving them with Alt+Up / Alt+Down, always lands them where aimed, even after many moves into the same place or between notes that share a place.

## Before release
- [x] The change carries no migration and reads no new configuration value. (checked)
- [x] `kiln verify` ran the full unit suite: exit 0, 218 of 218 pass on Node 22.17.1. (checked)
- [x] The new tests fail with the renumber disabled (3 fail) and the scale fix undone (1 fails), and pass with both. (checked)
- [ ] In the desktop app, dropping a note right under the top note 30 times keeps it second each time. (confirm)

## Release steps
1. Merge the pull request once CI is green.
2. Ship it in the next release as usual.

## After release
- [ ] After updating, the notes list keeps its manual order, and pinning or unpinning a note still places it by age. (confirm)

## Rollback
- Trigger: notes reorder on their own, or a drop lands in the wrong place more often than before.
- Steps: `git revert` the merge commit, then open and merge that pull request, then release.
- Time: one revert pull request and one release. Positions already rewritten stay valid numbers, so the old code reads them.
