# Brief — the app's own overlapping saves no longer show a false conflict

Follows spike 20261121-review-each-items-above-one-one, findings F1 and F2 (audit item 1).

## What is asked
- Who: the owner, who sees "This note was also edited in another window…" when no other window exists.
- What: a change event from this window's own save must never be merged as another window's edit.
- Why now: the spike reproduced it; fast note moves (holding Alt+Down) trigger it.
- Success: a save that finishes after a newer save of the same note started is recognised as this window's own; no merge, no toast, no duplicated paragraph.
- Constraint: the user's answer to "Will Notelet ever run a second window?" was "Yes, maybe later" — keep the cross-window merge (`merge.js`, `acceptRemote`) and fix the own-save check in place.

## What I found
- `extension/app.js:365-367` `persist` records only the latest JSON per note in `written` (`Map<id, string>`).
- `extension/app.js:540` `acceptRemote` treats an event as own only when it equals that latest JSON.
- `extension/desktop.js:24-28`: each write fires its change event after its own save finishes and before its promise resolves. A first save still in flight when a second persist runs has its event compared against the second's JSON, so it reads as foreign.
- Every save path goes through `persist` (app.js:360, 389, 413, 462, 495, 710), so one fix covers all of them.
- `app.js` cannot be imported in Node (it reads `window.__TAURI__` at load), so the own-save tracking needs to live in a module the tests can import.

## Still unknown
- None blocking.

## Past learnings
- None: no learnings store (`.kiln/learnings/` does not exist), recall not run.

## Design (bounded: two sentences)
Track every version of a note this window has in flight, not only the latest, and release each one when its save settles; the change event for any in-flight version is this window's own. The tracker is a small export beside the merge code in `extension/merge.js`, used by `persist` and `acceptRemote` in `app.js`.
