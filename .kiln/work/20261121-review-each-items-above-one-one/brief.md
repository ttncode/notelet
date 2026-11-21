# Brief — triage the six audit findings

## What is asked
- Who: the repository owner, who maintains Notelet alone.
- What: go through the six items of the 2026-11-21 ponytail audit one by one and decide which ones are worth a change.
- Success: each item gets a verdict (handle, fold into another, or drop) with evidence, so follow-up works can be opened for the ones kept.
- Constraint: a spike. Nothing in the source changes in this work.

## The six items
1. Own saves seen as edits from another window (false conflict toast, possible duplicated paragraph).
2. `npm test` fails on Node 22; CI pinned to Node 20.
3. Note positions collapse after about 23 drops into one slot.
4. Importing a backup can leave two Sprints notes.
5. No test for repeated moves (same root as 3).
6. `createFileArea` copies the chrome.storage API shape (same root as 1).

## What I found
- Item 1 is reproduced: a two-save run through the real `createFileArea` and `createStore`, with the app's own-write check copied out, flags the older save as foreign, and `mergeNote` reports a conflict. `mergeHtml` duplicates a paragraph when the two saves are an older and a newer version of the same typing.
- Item 2 is reproduced: `npm test` fails on Node 22.17; the glob form passes 214 of 214.
- Item 3 is reproduced: the 24th drop under the top note lands in the wrong place.
- Item 4 is read from code, not run: the import has no step that joins two board notes.

## Still unknown
- How often two saves of one note overlap on a real Windows install (depends on save latency).
- Whether the owner ever imports a backup into an install that already has a Sprints note.

## Past learnings
- None: this project keeps no learnings store (`.kiln/learnings/` does not exist), so recall was not run.
