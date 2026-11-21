# Brief — note order keeps working after many drops into one place

Follows spike 20261121-review-each-items-above-one-one, finding F5 (audit items 3 and 5).

## What is asked
- Who: the owner, who re-sorts notes by drag and drop or Alt+Up / Alt+Down.
- What: a drop or step must always land where it was aimed, however many times notes go into the same gap.
- Success: 40 drops right under the top note all land second; existing single-move results stay as they are.
- Constraint: positions of neighbours may change, but their `updatedAt` must not (they were not edited).

## What I found
- `extension/model.js:80-84` `positionBetween` takes the midpoint of the two neighbours. Positions start as millisecond timestamps (about 1.7e12, `newNote` in model.js:47), so after about 23 halvings of a 1000 gap the midpoint equals a neighbour; the spike's script showed drop 24 landing wrong.
- `placeNote` (model.js:62-69) returns `{ position, pinned }` for the moved note only; `stepNote` (model.js:71-77) calls it.
- `extension/app.js` `applyPlacement` merges that into the one note and persists it. It is the only caller of both functions (app.js:699, 739).
- `tests/model.test.js:61-74` pin the current single-move results.
- Notes that already share a position (collapsed earlier, or old notes with equal `updatedAt`) hit the same case: the midpoint equals both.

## Still unknown
- None blocking.

## Past learnings
- None: no learnings store (`.kiln/learnings/` does not exist), recall not run.

## Design (bounded: two sentences)
When the midpoint is not strictly between its neighbours, renumber the whole section in its new order, POSITION_STEP apart, and return the other notes' new positions as `renumbered: [{ id, position }]` beside the moved note's `{ position, pinned }`. `applyPlacement` applies and saves those positions with the moved note, leaving their `updatedAt` alone.
