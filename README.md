<p align="center">
  <img src="extension/icons/icon-128.png" width="88" alt="">
</p>

<h1 align="center">Notelet</h1>

<p align="center">
  Notes for Chrome in the style of iPhone Notes, with sprint tracking built in.<br>
  No account, no sync, nothing sent anywhere.
</p>

<p align="center">
  <a href="https://github.com/ttncode/notelet/releases/latest"><img src="https://img.shields.io/github/v/release/ttncode/notelet" alt="Latest release"></a>
  <a href="LICENSE"><img src="https://img.shields.io/github/license/ttncode/notelet" alt="License: MIT"></a>
  <img src="https://img.shields.io/badge/Chrome-Manifest%20V3-yellow" alt="Chrome Manifest V3">
</p>

<p align="center">
  <a href="https://github.com/ttncode/notelet/releases/latest"><b>Download</b></a> ·
  <a href="#install">Install</a> ·
  <a href="#sprints">Sprints</a> ·
  <a href="#keyboard-shortcuts">Shortcuts</a> ·
  <a href="#back-up-and-restore">Backups</a>
</p>

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="assets/screenshots/notelet-dark.png">
  <img src="assets/screenshots/notelet-light.png" width="900" alt="Notelet with the pinned Sprints note open on the current sprint: a donut of points by status shows done points against the goal above the sprint's tasks, each with points and a status, then the month card; the notes list on the left shows Pinned and Notes cards">
</picture>

## Highlights

- **Feels like Notes.** Title, Heading and Body styles, bulleted, dashed, numbered and check lists, pinned notes, Recently Deleted, light and dark themes. In a narrow window it switches to the iPhone layout and its slide between screens.
- **Sprints in one note.** Every sprint and a Backlog live in one Sprints note: a points donut, goals per sprint and per month, drag-and-drop tasks and a rich-text note for each task.
- **Keyboard first.** Every button has a shortcut, and you can change any of them.
- **Back and forward.** The mouse's side buttons, the browser's Back and Forward and Alt+← / Alt+→ step through screens.
- **Two windows, nothing lost.** Edit in the popup and a full page at once; changes merge instead of overwriting each other.
- **Private.** Notes stay in your Chrome profile. Export a backup file whenever you like.

<p>
  <img src="assets/screenshots/notelet-narrow-list.png" width="260" alt="Narrow layout in dark mode showing the notes list as Pinned and Notes cards with 24-hour times, the note count and the compose button at the bottom">
  <img src="assets/screenshots/notelet-narrow-note.png" width="260" alt="Narrow layout in dark mode showing the current sprint with its status donut and its tasks, each with points and a status">
</p>

Notelet is an independent project and is not affiliated with or endorsed by Apple.

## Install

1. Download `notelet-<version>.zip` from [Releases](https://github.com/ttncode/notelet/releases/latest).
2. Unzip it into a folder you will keep, so `manifest.json` sits directly inside it. On Windows, `%LOCALAPPDATA%\Programs\Notelet` works well. Avoid Downloads, the Desktop and OneDrive folders, which can be cleaned up or made online-only.
3. Open `chrome://extensions` and turn on **Developer mode**.
4. Click **Load unpacked** and choose that folder.
5. Pin Notelet to the toolbar. To open it from anywhere, set a shortcut at `chrome://extensions/shortcuts` (suggested: `Alt+.`).

Clicking the Notelet icon opens a small window at the top right that you can move and resize; it remembers where you left it. The ⤢ button in that window opens Notelet as a full page.

Works the same in Edge (`edge://extensions`) and Brave (`brave://extensions`).

## Update

Extensions loaded this way never update themselves.

1. Export a backup (**⋯** above the notes list → **Export**).
2. Replace the folder's contents with the new release.
3. In `chrome://extensions`, click the reload icon on Notelet. Don't click **Remove**: that deletes your notes.

Your notes stay: Notelet's extension ID is fixed, so Chrome keeps the same storage even if you move the folder (load it again from the new place).

## Back up and restore

Notes live only in this browser profile. **Removing the extension deletes all of them**, and Chrome offers no way to keep them, so export regularly.

- **Export** saves every note, sprint, setting and custom shortcut to one `.json` file.
- **Import** merges a backup back in: a note with the same ID is replaced, and everything else is kept. Backups from any earlier version import, and old task-tracking notes in them join the Sprints note.

## Sprints

Press `Alt+S` (or the compose button → **Sprints**) to open the Sprints note. It holds every sprint and a Backlog, and opens on the current sprint.

| On the sprint screen | What it does |
|---|---|
| Donut | The sprint's points by status, with done points against the goal in the middle and what is left below. |
| Tasks | Each row has a title, points and a status. **+ Add Task** opens a line; Enter adds the task and starts the next, Esc stops. |
| A task | Click it to change its title, points, status or sprint, write a note with the usual text styles and checklists, or delete it. |
| Moving tasks | Drag to reorder, or drop on another sprint or the Backlog under **Other Lists**. Alt+↑ / Alt+↓ moves the focused task. |
| Month card | Adds up the sprints that end in that month. The goal is their goals added up, unless you type your own; clear it to go back to the sum. |
| ⚙ Settings | The sprint's name, dates and goal; which statuses count as done for sprints and for months (Done by default); the status list; delete a sprint (its tasks go to the Backlog). |

**All Sprints** lists every sprint by month with each month's progress, and **+ New Sprint** starts one the working day after the latest ends: ten working days, the same goal. When a sprint has ended with open tasks, one button moves them to the next sprint or the Backlog. Anything else goes in **Notes** under the sprint, as ordinary note text.

Task tracking notes from earlier versions are merged into the Sprints note automatically: each becomes a sprint, ticked tasks count as Done, Last Sprint tasks not already on the board go to the Backlog, and any text of their own stays as a normal note under the old title.

## Keyboard shortcuts

Press `Ctrl+/` (`⌘/` on Mac) for the full list, grouped by topic. Every button shows its shortcut in its tooltip, and lists, menus and sheets also work with Tab, the arrow keys, Enter and Esc.

| Action | Windows and Linux | Mac |
|---|---|---|
| New note | `Alt+N` | `⌥N` |
| Open Sprints | `Alt+S` | `⌥S` |
| Search notes | `Ctrl+F` | `⌘F` |
| Go to the notes list / the note | `Alt+1` / `Alt+3` | `⌥1` / `⌥3` |
| Text styles menu | `Alt+A` | `⌥A` |
| Checklist | `Ctrl+Shift+L` | `⇧⌘L` |
| Back / Forward | mouse side buttons, `Alt+←` / `Alt+→` | mouse side buttons, `⌘[` / `⌘]` |
| All shortcuts | `Ctrl+/` | `⌘/` |

Text styles follow Notes for Mac with Ctrl in place of Cmd; where Chrome keeps a key for itself (Ctrl+N, Ctrl+Shift+T) Notelet uses Alt instead.

**To change a shortcut**, click its key in the list and press the new one. Esc, Tab or a click elsewhere cancels; Backspace removes the key. Keys Chrome or Windows keep are refused, and a key another shortcut uses asks before taking it over. ↺ resets one shortcut; **Reset All to Default** resets them all.

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
