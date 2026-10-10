# Notelet

[![Latest release](https://img.shields.io/github/v/release/ttncode/notelet)](https://github.com/ttncode/notelet/releases/latest)
[![License: MIT](https://img.shields.io/github/license/ttncode/notelet)](LICENSE)
![Chrome Manifest V3](https://img.shields.io/badge/Chrome-Manifest%20V3-yellow)

Lightweight notes for Chrome in the style of the Notes app on iPhone, with sprint tracking. Notes stay in your browser — no account, no sync, nothing sent anywhere.

Notelet is an independent project and is not affiliated with or endorsed by Apple.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="assets/screenshots/notelet-dark.png">
  <img src="assets/screenshots/notelet-light.png" width="900" alt="Notelet with the pinned Sprints note open on the current sprint: a donut of points by status shows done points against the goal above the sprint's tasks, each with points and a status, then the month card; the notes list on the left shows Pinned and Notes cards">
</picture>

In a narrow window Notelet switches to the iPhone layout: the list first, then the note with a back button.

<p>
  <img src="assets/screenshots/notelet-narrow-list.png" width="260" alt="Narrow layout in dark mode showing the notes list as Pinned and Notes cards with 24-hour times, the note count and the compose button at the bottom">
  <img src="assets/screenshots/notelet-narrow-note.png" width="260" alt="Narrow layout in dark mode showing the current sprint with its status donut and its tasks, each with points and a status">
</p>

## Install

1. Download `notelet-<version>.zip` from [Releases](../../releases) and unzip it into a folder you will keep.
2. Open `chrome://extensions` and turn on **Developer mode**.
3. Click **Load unpacked** and choose the unzipped folder (the one containing `manifest.json`).
4. Pin Notelet to the toolbar. To open it from the keyboard, set a shortcut at `chrome://extensions/shortcuts` (suggested: `Alt+.`).

Clicking the Notelet icon opens a small window at the top right that you can move and resize anywhere; it remembers where you left it. The ⤢ button in that window opens Notelet as a full page.

Works the same in Edge (`edge://extensions`) and Brave (`brave://extensions`).

## Update

Extensions loaded this way never update themselves.

1. Export a backup (**⋯** above the notes list → **Export**).
2. Replace the folder's contents with the new release.
3. In `chrome://extensions`, click the reload icon on Notelet.

Your notes stay: Notelet's extension ID is fixed, so Chrome keeps the same storage.

## Back up your notes

Notes live only in this browser profile. **Removing the extension deletes all of them**, and Chrome offers no way to keep them. Export regularly; **Import** merges a backup back in (a note with the same ID is replaced).

## Sprints

Press `Alt+S` (or the compose button → **Sprints**) to open the Sprints note: one note that holds every sprint and a Backlog. It opens on the current sprint.

- The donut shows the sprint's points by status, with done points against the goal in the middle and what is left to do below.
- Each task row has its title, points and status. **+ Add Task** opens a line for a new task; Enter adds it and starts the next, Esc stops. Click a task to open it: change its title, points, status or sprint, write a note with the usual text styles and checklists, or delete it.
- Drag a task to reorder it, or drop it on another sprint or the Backlog under **Other Lists**. Alt+Up / Alt+Down moves the focused task.
- Done points come from statuses: by default only **Done** counts. ⚙ chooses which statuses count for sprints and for months, edits the sprint's name, dates and goal and the status list shared by all sprints, and deletes a sprint (its tasks go to the Backlog).
- The month card adds up the sprints that end in that month. Its goal is their goals added up unless you type your own; clear it to go back to the sum.
- **All Sprints** lists every sprint by month with each month's progress. **+ New Sprint** starts one the working day after the latest sprint ends, ten working days long, with the same goal.
- When a sprint has ended with open tasks, one button moves them to the next sprint or the Backlog.
- Anything else goes in **Notes** under the sprint, as ordinary note text.

Task tracking notes from earlier versions are merged into the Sprints note automatically: each becomes a sprint, ticked tasks count as Done, Last Sprint tasks not already on the board go to the Backlog, and any text of their own stays as a normal note under the old title. Export a backup before updating.

## Keyboard shortcuts

Press `Ctrl+/` (or choose **⋯ → Keyboard Shortcuts**) for the full list. Every button has a shortcut, shown in its tooltip; the notes list, menus and dialogs also work with Tab, the arrow keys, Enter and Esc. Text styles follow Notes for Mac with Ctrl in place of Cmd; where Chrome reserves a shortcut (Ctrl+N, Ctrl+Shift+T) Notelet uses Alt instead.

To change a shortcut, click its key in that list and press the new one (Esc cancels, Backspace removes it). Keys Chrome or Windows keep are refused, and a key another shortcut uses asks before taking it over. ↺ resets one shortcut; **Reset All to Default** resets them all.

## Development

```bash
npm install
npm test                  # unit tests for the pure modules
node tools/make-icons.mjs # regenerate icons
tools/package.sh          # build dist/notelet-<version>.zip
```

Load the `extension/` folder unpacked to try changes, then click reload in `chrome://extensions`.

Working in WSL? Chrome's folder picker cannot open `\\wsl.localhost` paths, so copy the folder to the Windows side and load the copy:

```bash
rsync -a --delete extension/ /mnt/c/Users/<you>/Notelet-dev/
```

## License

[MIT](LICENSE)
