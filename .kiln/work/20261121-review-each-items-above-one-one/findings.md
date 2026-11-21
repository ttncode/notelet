# Audit triage — which of the six items to handle

## Answer
- Handle items 1, 2 and 3; fold 5 into 3 and 6 into 1; item 4 only if backups are ever imported into an install that already has a Sprints note. (kiln)
- Item 1 is real: when two saves of one note overlap, the app reads its own older save as another window's edit and shows a false conflict message. (confirmed: F1)
- When the overlapping saves are of note text, the same path keeps both versions of the paragraph, so text is duplicated. (confirmed: F2)
- Item 2 is real: the project's test command runs no tests on the current Node release. (confirmed: F4)
- Item 3 is real: dropping notes into the same place about two dozen times makes further drops land in the wrong place. (confirmed: F5)
- Item 4 is a gap, not yet seen by a user: an import from another install's backup adds a second Sprints note instead of joining the existing one. (confirmed: F6)

## Impact
- Item 1 gives the owner a scary "edited in another window" message during fast note moves (holding Alt+Down) and can, rarely, double a paragraph of a note. (confirmed: F1)
- There can be no other window, so the whole merge feature that causes item 1 protects against nothing and can be removed. (confirmed: F3)
- Item 2 means a contributor on a current Node sees a broken test suite, and CI stays on an end-of-life Node. (confirmed: F4)
- Item 3 breaks manual note order for someone who keeps dropping notes into the same place, such as always putting the current note second; drops spread over different places stay fine much longer. (confirmed: F5)
- Recommended order: 2 first (one line), then 1 (a deletion, about 380 lines), then 3 (small fix plus one test), and 4 last or never. (kiln)

## Options
1. Open three follow-up works: 2, then 1 (with 6), then 3 (with 5); leave 4 as a known limit noted in the README. (kiln)
2. The same three, plus 4 as a fourth work that joins an imported Sprints note into the existing one. (kiln)
3. Only 2 and 3; keep the merge code in case a second window ever comes back. (kiln)

## Questions for you
- Do you ever import a backup into an install that already has a Sprints note (a second PC, or after a reinstall where you opened Sprints first)?
- Is a second window, or a return of the browser extension, planned? If yes, item 1 needs a fix rather than a deletion.

## Not checked
- How often two saves of one note overlap on a real Windows install — needs timing of the save in the running app.
- Item 4 was read from the code, not run in the app — needs an import test in the end-to-end suite or by hand.
- Node 20's end of life (April 2026) is from my own knowledge, not checked against the Node release page — check nodejs.org/en/about/previous-releases.

## Scope and method
- Read the save, change-event, merge, import and ordering code; ran three small Node scripts against the real modules; ran the unit suite with both test commands on Node 22.17.

## Findings
### F1. An older own save is treated as a foreign edit
- What: each save fires a change event when it finishes; the app compares it with the last version it wrote, so a slower first save that finishes after a second save started looks foreign, and the merge reports a conflict.
- Where: extension/desktop.js:28, extension/app.js:540, extension/app.js:96
- Basis: ran .kiln/tmp/20261121-review-each-items-above-one-one/race.mjs (real createFileArea, createStore and mergeNote, 50 ms save, second save 30 ms later, the app's written-check copied in); it printed "event for position 90 seen as ANOTHER WINDOW" and "merge conflict: true".
- Reachable: yes — holding Alt+Down on a note in the list saves on every key repeat.
- Action: remove the cross-window path (item 1 with 6).

### F2. The text merge keeps both versions of a paragraph
- What: merging an older and a newer version of one paragraph keeps both.
- Where: extension/merge.js:79
- Basis: ran mergeHtml("<p>a</p>", "<p>abc</p>", "<p>ab</p>") with linkedom; it returned { value: '<p>abc</p><p>ab</p>', conflict: true }.
- Reachable: only when two text saves of one note overlap, for example a save followed at once by hiding the window; rare.
- Action: goes away with F1's removal.

### F3. Only one window can exist
- What: the app registers the single-instance plugin, which only brings the window forward on a second launch, and the config defines one window.
- Where: desktop/src/lib.rs:282, desktop/tauri.conf.json:13
- Basis: read both lines; grep for WebviewWindowBuilder in desktop/src found nothing.
- Reachable: n/a.
- Action: none; this is why F1's code can be deleted.

### F4. The test command runs no tests on Node 22
- What: the script passes a folder to node --test, which Node 22 reads as a file name.
- Where: package.json:7, .github/workflows/ci.yml:18
- Basis: ran npm test on Node 22.17.1: "Cannot find module '<repo>/tests'"; ran node --test "tests/*.test.js": 214 pass, 0 fail.
- Reachable: every test run on Node 22.
- Action: use the glob in package.json and move CI to Node 22.

### F5. Positions collapse after repeated drops into one slot
- What: each drop takes the midpoint of its neighbours, and timestamps have too few bits left after about 23 halvings.
- Where: extension/model.js:81
- Basis: ran .kiln/tmp/20261121-review-each-items-above-one-one/pos.mjs (40 drops right under the top note through placeNote); it printed "drop 24 lands wrong; 2nd is n22 true".
- Reachable: yes — drag and drop, or Alt+Up and Alt+Down, in the notes list.
- Action: renumber the section when the midpoint equals a neighbour; one test that repeats the drop 30 times (item 5).

### F6. Import does not join two Sprints notes
- What: a new Sprints note gets a random id, and import saves backup notes as they are, so a backup's Sprints note with another id sits beside the local one; opening Sprints picks the first.
- Where: extension/board-merge.js:19, extension/model.js:47, extension/app.js:495, extension/app.js:399
- Basis: read those lines; nothing in importNotes or mergeTrackers joins two board notes (mergeTrackers only folds old tracker notes, extension/board-merge.js:14).
- Reachable: only by importing a backup from another install into one that already has a Sprints note.
- Action: decide per the question above.

## Out of scope
- board-merge.js "mergeTrackers" is the one-time migration of old tracker notes, not the cross-window merge; it stays.
