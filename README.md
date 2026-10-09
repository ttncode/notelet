# Notelet

[![Latest release](https://img.shields.io/github/v/release/ttncode/notelet)](https://github.com/ttncode/notelet/releases/latest)
[![License: MIT](https://img.shields.io/github/license/ttncode/notelet)](LICENSE)
![Chrome Manifest V3](https://img.shields.io/badge/Chrome-Manifest%20V3-yellow)

Lightweight notes for Chrome in the style of the Notes app on iPhone, with task tracking for sprints. Notes stay in your browser — no account, no sync, nothing sent anywhere.

Notelet is an independent project and is not affiliated with or endorsed by Apple.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="assets/screenshots/notelet-dark.png">
  <img src="assets/screenshots/notelet-light.png" width="900" alt="Notelet with a pinned task tracker open: a donut of points by status shows 13 of 18 points done above the Last Sprint and Current Sprint groups of tasks, each with a tick, points and a status; the notes list on the left shows Pinned and Notes cards">
</picture>

In a narrow window Notelet switches to the iPhone layout: the list first, then the note with a back button.

<p>
  <img src="assets/screenshots/notelet-narrow-list.png" width="260" alt="Narrow layout in dark mode showing the notes list as Pinned and Notes cards with 24-hour times, the note count and the compose button at the bottom">
  <img src="assets/screenshots/notelet-narrow-note.png" width="260" alt="Narrow layout in dark mode showing the task tracker with its status donut and the Last Sprint group, each task with its status under the title">
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

## Task tracking

Click the compose button and choose **New Task Tracking** (or press `Alt+S`). A tracker starts the working day after your last one ends, lasts ten working days (Monday to Friday), keeps the last target and copies the last tracker's group names.

- The donut shows the points of the counted groups by status, with done points against the target in the middle and what is still missing below.
- Tasks live in groups, **Last Sprint** and **Current Sprint** to start with. Each row has a tick, the task, its points and a status dropdown. **+ Add Task** adds one; **+ Add Group** adds a group, and clicking a group's name renames it. The chevron folds a group away.
- Tick a task when its development is done; only ticked tasks with points count as completed. Status is for tracking only.
- In a task, Enter adds the next task and Backspace on an empty one removes it. Drag the ⋮⋮ grip, or press Alt+Up / Alt+Down, to move a task, also into another group.
- ⚙ changes the dates and target, **Count points from** (tick any of this tracker's groups; only Current Sprint by default) and the status names, colours and order shared by all trackers.
- Anything else goes in **Notes** under the groups, as ordinary note text.

Sprint notes from earlier versions, including ones with a `Target: 18` line, are converted automatically: their Last Sprint and Current Sprint lists become groups and the rest stays as notes.

## Keyboard shortcuts

Press `Ctrl+/` (or choose **⋯ → Keyboard Shortcuts**) for the full list. Every button has a shortcut, shown in its tooltip; the notes list, menus and dialogs also work with Tab, the arrow keys, Enter and Esc. Text styles follow Notes for Mac with Ctrl in place of Cmd; where Chrome reserves a shortcut (Ctrl+N, Ctrl+Shift+T) Notelet uses Alt instead.

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
