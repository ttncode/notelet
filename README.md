# Notelet

Lightweight notes for Chrome in the style of the Notes app on iPhone, with a points chart for sprint notes. Notes stay in your browser — no account, no sync, nothing sent anywhere.

Notelet is an independent project and is not affiliated with or endorsed by Apple.

## Install

1. Download `notelet-<version>.zip` from [Releases](../../releases) and unzip it into a folder you will keep.
2. Open `chrome://extensions` and turn on **Developer mode**.
3. Click **Load unpacked** and choose the unzipped folder (the one containing `manifest.json`).
4. Pin Notelet to the toolbar. To open it from the keyboard, set a shortcut at `chrome://extensions/shortcuts` (suggested: `Alt+Shift+N`).

Works the same in Edge (`edge://extensions`) and Brave (`brave://extensions`).

## Update

Extensions loaded this way never update themselves.

1. Export a backup (sidebar → **Export**).
2. Replace the folder's contents with the new release.
3. In `chrome://extensions`, click the reload icon on Notelet.

Your notes stay: Notelet's extension ID is fixed, so Chrome keeps the same storage.

## Back up your notes

Notes live only in this browser profile. **Removing the extension deletes all of them**, and Chrome offers no way to keep them. Export regularly; **Import** merges a backup back in (a note with the same ID is replaced).

## Sprint points chart

Add a line `Target: 18` to a note and list your tickets as a checklist with points in parentheses:

```
Target: 18
◯ #101 Restrict access (5) (InQC)
◯ #102 Switch admin logic (8) (InReview)
```

The last number in parentheses is the ticket's points. Tick a ticket when its development is done; the bar shows target, completed and missing (or how far over).

## Keyboard shortcuts

Click **?** in the sidebar for the full list. Text styles follow Notes for Mac with Ctrl in place of Cmd; where Chrome reserves a shortcut (Ctrl+N, Ctrl+Shift+T) Notelet uses Alt instead.

## Development

```bash
npm install
npm test                  # unit tests for the pure modules
node tools/make-icons.mjs # regenerate icons
tools/package.sh          # build dist/notelet-<version>.zip
```

Load the `extension/` folder unpacked to try changes, then click reload in `chrome://extensions`.

## License

[MIT](LICENSE)
