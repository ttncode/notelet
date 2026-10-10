import { backupFileName, createBackup, parseBackup } from "./backup.js";
import { closeOnOutsideClick, downloadFile, openHelp, pickTextFile, showToast } from "./dialogs.js";
import { mergeTrackers, newBoardNote } from "./board-merge.js";
import { boardSearchText, findSprint, removeSprint, updateSprint } from "./board.js";
import { createBoardView } from "./board-view.js";
import { NoteEditor } from "./editor.js";
import { formatEditedDate } from "./format.js";
import { applyShortcutTitles, matchHotkey } from "./hotkeys.js";
import { setupLayout } from "./layout.js";
import { EMPTY_BODY_HTML, EMPTY_NOTE_HTML, isBlankNote, isExpired, newNote, noteText, noteTitleOf, orderedGroups, placeNote, remoteNotesToApply, stepNote } from "./model.js";
import { legacySections, normalizeSettings, sameSettings, upgradeNote } from "./sprint.js";
import { openSprintSettings } from "./sprint-settings.js";
import { sanitizeHtml } from "./sanitize.js";
import { createSaveScheduler } from "./scheduler.js";
import { renderNoteList } from "./sidebar.js";
import { createStore } from "./store.js";
import { applyTheme, nextTheme, themeLabel } from "./theme.js";

const SAVE_DELAY_MS = 500;
const SAVE_MAX_WAIT_MS = 5000;
const UI_SAVE_DELAY_MS = 300;
const MENU_GAP_PX = 6;
const VIEWPORT_MARGIN_PX = 8;
const IS_POPUP = new URLSearchParams(location.search).get("view") === "popup";
const FULL_PAGE_URL = chrome.runtime.getURL("notes.html");
const IS_MAC = /mac/i.test(navigator.userAgentData?.platform ?? navigator.platform);
const SAVE_FAILED_MESSAGE = "Couldn't save your last change. Your text is still here — keep this tab open and try again, or export a backup.";

const THEME_ICONS = {
  system: '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/></svg>',
  light: '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>',
  dark: '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/></svg>',
};
const byId = (id) => document.getElementById(id);
const store = createStore(chrome.storage.local);
const notes = new Map();
const saves = createSaveScheduler({ delayMs: SAVE_DELAY_MS, maxWaitMs: SAVE_MAX_WAIT_MS, save: saveNow });
const state = { currentId: null, mode: "notes", query: "", ui: null, settings: null };
let editor;
let layout;
let boardView;
let uiSaveTimer = null;

main().catch((error) => {
  console.error("Notelet failed to start", error);
  showToast(error instanceof Error ? error.message : String(error));
});

async function main() {
  document.body.classList.toggle("popup-view", IS_POPUP);
  const loaded = await store.load();
  loaded.notes.forEach((note) => notes.set(note.id, note));
  state.ui = loaded.ui;
  state.settings = loaded.settings;
  showTheme(state.ui.theme);
  await removeStaleNotes();
  editor = new NoteEditor({ element: byId("editor"), isMac: IS_MAC, onChange: onEditorChange });
  layout = setupLayout({ resizer: byId("resizer"), ui: state.ui, onUiChange: saveUiSoon });
  boardView = createBoardView({ container: byId("board"), isMac: IS_MAC, onChange: onBoardChange, onSettings: openSettings });
  applyShortcutTitles(document, IS_MAC);
  wireControls();
  store.onChange(applyRemoteChanges);
  openInitialNote();
}

async function removeStaleNotes() {
  const now = Date.now();
  const staleIds = [...notes.values()]
    .filter((note) => isExpired(note, now) || (note.deletedAt === null && isBlankNote(note)))
    .map((note) => note.id);
  if (staleIds.length === 0) return;
  staleIds.forEach((id) => notes.delete(id));
  await store.removeNotes(staleIds);
}

function openInitialNote() {
  const last = notes.get(state.ui.lastNoteId);
  if (last && last.deletedAt === null) selectNote(last.id, { scrollTop: state.ui.scrollTop });
  else selectFirstVisible();
}

function visibleNotes() {
  const showDeleted = state.mode === "deleted";
  return [...notes.values()]
    .filter((note) => (note.deletedAt !== null) === showDeleted)
    .filter((note) => state.query === "" || searchText(note).toLowerCase().includes(state.query))
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

function searchText(note) {
  if (!note.board) return noteText(note.html);
  return `${boardSearchText(note.board, { statuses: state.settings.statuses, noteText })}\n${noteText(note.html)}`;
}

function selectFirstVisible() {
  const [first] = visibleNotes();
  if (first) {
    selectNote(first.id);
    return;
  }
  discardIfEmpty(state.currentId, null);
  state.currentId = null;
  renderAll();
}

function selectNote(id, { scrollTop = 0, reveal = true } = {}) {
  discardIfEmpty(state.currentId, id);
  state.currentId = id;
  loadEditor(notes.get(id));
  renderAll();
  byId("editor-scroll").scrollTop = scrollTop;
  if (reveal) layout.showEditor();
  saveUiSoon({ lastNoteId: id, scrollTop });
}

const loadEditor = (note) => editor.load(note.html, { emptyHtml: note.sprint || note.board ? EMPTY_BODY_HTML : EMPTY_NOTE_HTML });

function discardIfEmpty(previousId, nextId) {
  const previous = notes.get(previousId);
  if (!previous || previousId === nextId || previous.deletedAt !== null || !isBlankNote(previous)) return;
  removePermanently(previous.id);
}

function removePermanently(id) {
  saves.cancel(id);
  notes.delete(id);
  store.removeNotes([id]).catch(reportSaveError);
}

function renderAll() {
  renderList();
  renderEditorPane();
}

function renderList() {
  const list = byId("note-list");
  const listHadFocus = list.contains(document.activeElement);
  const visible = visibleNotes();
  const inNotes = state.mode === "notes";
  const groups = inNotes ? orderedGroups(visible) : deletedGroups(visible);
  // ponytail: whole list re-rendered on every edit; fine for hundreds of notes, virtualise if it ever lags.
  renderNoteList(list, { groups, currentId: state.currentId, emptyText: state.query ? "No Results" : "No Notes", now: Date.now(), draggable: inNotes });
  if (listHadFocus) list.querySelector('[aria-current="true"]')?.focus();
  renderSidebarChrome();
}

const deletedGroups = (visible) => (visible.length > 0 ? [{ label: null, notes: visible }] : []);

// Saves first: closing the popup window would otherwise cut off a pending write.
async function openFullPage() {
  clearTimeout(uiSaveTimer);
  await Promise.all([saves.flush(), store.saveUi(state.ui)]);
  const [fullPage] = await chrome.runtime.getContexts({ contextTypes: ["TAB"], documentUrls: [FULL_PAGE_URL] });
  if (fullPage) {
    await chrome.tabs.update(fullPage.tabId, { active: true });
    await chrome.windows.update(fullPage.windowId, { focused: true });
  } else {
    await chrome.tabs.create({ url: FULL_PAGE_URL });
  }
  await chrome.windows.remove((await chrome.windows.getCurrent()).id);
}

function cycleTheme() {
  const theme = nextTheme(state.ui.theme);
  showTheme(theme);
  saveUiSoon({ theme });
}

function showTheme(theme) {
  applyTheme(theme);
  byId("theme-icon").innerHTML = THEME_ICONS[theme] ?? THEME_ICONS.system;
  byId("theme-label").textContent = themeLabel(theme);
}

function renderSidebarChrome() {
  const inDeleted = state.mode === "deleted";
  const all = [...notes.values()];
  const deletedCount = all.filter((note) => note.deletedAt !== null).length;
  const shownCount = inDeleted ? deletedCount : all.length - deletedCount;
  byId("list-title").textContent = inDeleted ? "Recently Deleted" : "Notes";
  byId("deleted-toggle").hidden = !inDeleted;
  byId("deleted-menu-item").hidden = inDeleted || deletedCount === 0;
  byId("deleted-menu-label").textContent = `Recently Deleted (${deletedCount})`;
  byId("note-count").textContent = `${shownCount} ${shownCount === 1 ? "Note" : "Notes"}`;
}

function renderEditorPane() {
  const note = notes.get(state.currentId);
  const inDeleted = state.mode === "deleted";
  const deleteLabel = inDeleted ? "Delete Permanently" : "Delete";
  byId("editor-empty").hidden = Boolean(note);
  byId("editor").hidden = !note;
  byId("note-date").textContent = note ? formatEditedDate(note.updatedAt) : "";
  byId("pin-label").textContent = note?.pinned ? "Unpin Note" : "Pin Note";
  byId("delete-label").textContent = deleteLabel;
  document.body.classList.toggle("has-note", Boolean(note));
  document.body.classList.toggle("viewing-deleted", inDeleted);
  editor.setReadOnly(inDeleted || !note);
  renderNoteDetails(note);
}

function renderNoteDetails(note) {
  const board = note?.board ?? null;
  document.body.classList.toggle("board-view", board !== null);
  boardView.render(board ? { board, settings: state.settings, today: new Date(), editable: state.mode === "notes" } : null);
  document.title = note ? `${noteTitleOf(note)} – Notelet` : "Notelet";
}

// A board edit saves without rebuilding the editor; the board view redraws itself when it needs to.
function onBoardChange(board) {
  const note = notes.get(state.currentId);
  if (!note?.board || note.deletedAt !== null) return;
  const updated = { ...note, board, updatedAt: Date.now() };
  notes.set(updated.id, updated);
  saves.schedule(updated.id);
  renderList();
  byId("note-date").textContent = formatEditedDate(updated.updatedAt);
}

function openSettings() {
  const note = notes.get(state.currentId);
  if (!note?.board) return;
  const sprint = findSprint(note.board, boardView.viewedSprintId());
  openSprintSettings({ dialog: byId("sprint-settings"), sprint, settings: state.settings, onSave: saveSprintSettings, onDelete: deleteSprint });
}

function saveSprintSettings({ sprintId, sprintChange, settings }) {
  state.settings = settings;
  store.saveSettings(state.settings).catch(reportSaveError);
  if (sprintId) updateCurrent((note) => ({ board: updateSprint(note.board, { sprintId, change: sprintChange }) }));
  renderAll();
}

function deleteSprint(sprintId) {
  updateCurrent((note) => ({ board: removeSprint(note.board, sprintId) }));
  renderAll();
}

function onEditorChange(changedHtml) {
  const note = notes.get(state.currentId);
  if (!note || note.deletedAt !== null || note.html === changedHtml) return;
  const updated = { ...note, html: changedHtml, updatedAt: Date.now() };
  notes.set(updated.id, updated);
  saves.schedule(updated.id);
  renderList();
  byId("note-date").textContent = formatEditedDate(updated.updatedAt);
  renderNoteDetails(updated);
}

function saveNow(id) {
  const note = notes.get(id);
  return note ? store.saveNotes([note]).catch(reportSaveError) : undefined;
}

const flushSaves = () => saves.flush();

function reportSaveError(error) {
  console.error("Notelet: save failed", error);
  showToast(SAVE_FAILED_MESSAGE);
}

function saveUiSoon(patch) {
  Object.assign(state.ui, patch);
  clearTimeout(uiSaveTimer);
  uiSaveTimer = setTimeout(() => {
    store.saveUi(state.ui).catch((error) => console.error("Notelet: could not save layout", error));
  }, UI_SAVE_DELAY_MS);
}

function updateCurrent(change) {
  const note = notes.get(state.currentId);
  if (!note) return null;
  const updated = { ...note, ...change(note), updatedAt: Date.now() };
  saves.cancel(updated.id);
  notes.set(updated.id, updated);
  store.saveNotes([updated]).catch(reportSaveError);
  return updated;
}

function createNote() {
  openCreated(newNote(Date.now()));
}

// There is one Sprints note; it is made the first time it is asked for.
function openBoard() {
  const existing = liveNotes().find((note) => note.board);
  if (!existing) {
    openCreated(newBoardNote({ now: Date.now() }));
    return;
  }
  state.mode = "notes";
  clearSearch();
  selectNote(existing.id);
}

function openCreated(note) {
  state.mode = "notes";
  clearSearch();
  notes.set(note.id, note);
  store.saveNotes([note]).catch(reportSaveError);
  selectNote(note.id);
  if (!note.board) editor.focusStart();
}

function clearSearch() {
  state.query = "";
  byId("search").value = "";
}

function togglePin() {
  updateCurrent((note) => ({ pinned: !note.pinned }));
  renderAll();
}

function deleteCurrent() {
  const note = notes.get(state.currentId);
  if (!note) return;
  if (note.deletedAt === null) updateCurrent(() => ({ deletedAt: Date.now() }));
  else if (window.confirm("Delete this note permanently? This can't be undone.")) removePermanently(note.id);
  else return;
  state.currentId = null;
  selectFirstVisible();
}

// A recovered tracker note from before the Sprints note joins the board.
function recoverCurrent() {
  const recovered = updateCurrent(() => ({ deletedAt: null }));
  if (!recovered) return;
  state.mode = "notes";
  if (!recovered.sprint) {
    selectNote(recovered.id);
    return;
  }
  absorbTrackers();
  openBoard();
}

function absorbTrackers() {
  const changed = mergeTrackers([...notes.values()], { counts: state.settings.sprintCounts, now: Date.now() });
  changed.forEach((note) => {
    saves.cancel(note.id);
    notes.set(note.id, note);
  });
  if (changed.length > 0) store.saveNotes(changed).catch(reportSaveError);
  return changed.map((note) => note.id);
}

function toggleDeletedView() {
  state.mode = state.mode === "deleted" ? "notes" : "deleted";
  clearSearch();
  selectFirstVisible();
}

function exportNotes() {
  flushSaves();
  const now = new Date();
  downloadFile(createBackup([...notes.values()], state.settings, now), backupFileName(now));
}

async function importNotes() {
  const text = await pickTextFile(".json,application/json");
  if (text === null) return;
  const result = parseBackup(text);
  if (!result.ok) {
    showToast(result.error);
    return;
  }
  await adoptImportedSettings(result.settings);
  const today = new Date();
  const upgradeSettings = { statuses: state.settings.statuses, sections: legacySections(result.settings) };
  const imported = result.notes.map((note) => upgradeNote({ ...note, html: sanitizeHtml(note.html) }, upgradeSettings, today));
  await store.saveNotes(imported);
  imported.forEach((note) => {
    saves.cancel(note.id);
    notes.set(note.id, note);
  });
  refreshAfterOutsideChange([...imported.map((note) => note.id), ...absorbTrackers()]);
  showToast(`Imported ${imported.length} ${imported.length === 1 ? "note" : "notes"}.`);
}

async function adoptImportedSettings(settings) {
  if (!settings || sameSettings(normalizeSettings(settings), state.settings)) return;
  if (!window.confirm("Replace your status settings with the ones in this backup?")) return;
  state.settings = normalizeSettings(settings);
  await store.saveSettings(state.settings);
}

function reportImportError(error) {
  console.error("Notelet: import failed", error);
  showToast("Import failed; your existing notes were not changed.");
}

function applyRemoteChanges({ updated, removedIds, settings, theme }) {
  if (theme) {
    state.ui.theme = theme;
    showTheme(theme);
  }
  if (settings) state.settings = normalizeSettings(settings);
  const newer = remoteNotesToApply(updated, { local: notes, isPending: saves.isPending });
  const removed = removedIds.filter((id) => notes.has(id) && !saves.isPending(id));
  newer.forEach((note) => notes.set(note.id, note));
  removed.forEach((id) => notes.delete(id));
  if (newer.length === 0 && removed.length === 0 && !settings) return;
  refreshAfterOutsideChange(newer.map((note) => note.id));
}

function refreshAfterOutsideChange(changedIds) {
  const current = notes.get(state.currentId);
  const stillInView = current && (current.deletedAt !== null) === (state.mode === "deleted");
  if (!stillInView) {
    selectFirstVisible();
    return;
  }
  if (changedIds.includes(current.id) && !isEditingCurrentNote()) loadEditor(current);
  renderAll();
}

// A focused board field counts as editing, so a save from another tab waits instead of
// replacing the task being typed into.
function isEditingCurrentNote() {
  return editor.isFocused() || boardView.isEditing();
}

function wireControls() {
  closeOnOutsideClick(byId("help"));
  closeOnOutsideClick(byId("sprint-settings"));
  wireEditorActions();
  wireButtons();
  wireSidebar();
  document.addEventListener("keydown", onAppHotkey);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) flushSaves();
  });
  window.addEventListener("pagehide", flushSaves);
  byId("editor-scroll").addEventListener("scroll", () => saveUiSoon({ scrollTop: byId("editor-scroll").scrollTop }), { passive: true });
}

function wireEditorActions() {
  const menu = byId("format-menu");
  for (const button of document.querySelectorAll("[data-action]")) {
    button.addEventListener("mousedown", (event) => event.preventDefault());
    button.addEventListener("click", () => {
      editor.run(button.dataset.action);
      if (menu.matches(":popover-open")) menu.hidePopover();
    });
  }
  byId("format-button").addEventListener("mousedown", (event) => event.preventDefault());
  menu.addEventListener("toggle", positionFormatMenu);
  wireComposeMenu();
}

function wireComposeMenu() {
  const menu = byId("compose-menu");
  let anchor = byId("new-note-button");
  for (const id of ["new-note-button", "new-note-list-button"]) {
    byId(id).addEventListener("click", () => { anchor = byId(id); });
  }
  menu.addEventListener("toggle", (event) => { if (event.newState === "open") positionMenu(menu, anchor); });
  for (const button of menu.querySelectorAll("[data-compose]")) {
    button.addEventListener("click", () => {
      menu.hidePopover();
      if (button.dataset.compose === "sprint") openBoard();
      else createNote();
    });
  }
}

function wireButtons() {
  const handlers = {
    "pin-button": togglePin,
    "delete-button": deleteCurrent,
    "recover-button": recoverCurrent,
    "sidebar-toggle": () => layout.toggleSidebar(),
    "back-button": () => layout.showList(),
    "deleted-toggle": toggleDeletedView,
    "deleted-menu-item": toggleDeletedView,
    "theme-button": cycleTheme,
    "open-full-page": () => openFullPage().catch((error) => console.error("Notelet: could not open the full page", error)),
    "export-button": exportNotes,
    "import-button": () => importNotes().catch(reportImportError),
    "help-button": showHelp,
  };
  for (const [id, handler] of Object.entries(handlers)) byId(id).addEventListener("click", handler);
  wireListMenu();
  wireNoteMenu();
  for (const menu of document.querySelectorAll(".format-menu[popover]")) menu.addEventListener("keydown", onMenuKeydown);
}

function wireNoteMenu() {
  const menu = byId("note-menu");
  menu.addEventListener("toggle", (event) => { if (event.newState === "open") positionMenu(menu, byId("note-menu-button")); });
  menu.addEventListener("click", (event) => { if (event.target.closest(".menu-item")) menu.hidePopover(); });
}

// Theme stays open so it can be clicked through System, Light and Dark.
function wireListMenu() {
  const menu = byId("list-menu");
  menu.addEventListener("toggle", (event) => { if (event.newState === "open") positionMenu(menu, byId("list-menu-button")); });
  menu.addEventListener("click", (event) => {
    const item = event.target.closest(".menu-item");
    if (item && item.id !== "theme-button") menu.hidePopover();
  });
}

function wireSidebar() {
  const list = byId("note-list");
  list.addEventListener("click", (event) => {
    const row = event.target.closest(".note-row");
    if (row) selectNote(row.dataset.noteId);
  });
  list.addEventListener("keydown", onListKeydown);
  wireNoteDragging();
  byId("search").addEventListener("input", (event) => {
    state.query = event.target.value.trim().toLowerCase();
    renderList();
  });
}

function onListKeydown(event) {
  const row = event.target.closest(".note-row");
  if (event.key === "Enter" && row) {
    event.preventDefault();
    if (row.dataset.noteId !== state.currentId) selectNote(row.dataset.noteId);
    focusEditor();
    return;
  }
  const step = { ArrowDown: 1, ArrowUp: -1 }[event.key];
  if (!step) return;
  if (event.altKey) {
    moveFocusedNote(event, step);
    return;
  }
  const rows = [...byId("note-list").querySelectorAll(".note-row")];
  const next = rows[rows.indexOf(document.activeElement) + step];
  if (!next) return;
  event.preventDefault();
  selectNote(next.dataset.noteId, { reveal: false });
}

function moveFocusedNote(event, step) {
  const id = document.activeElement?.dataset?.noteId;
  if (!id || state.mode !== "notes") return;
  event.preventDefault();
  applyPlacement(id, stepNote(liveNotes(), { id, step }));
  byId("note-list").querySelector(`[data-note-id="${id}"]`)?.focus();
}

const liveNotes = () => [...notes.values()].filter((note) => note.deletedAt === null);

function applyPlacement(id, placement) {
  if (!placement) return;
  const updated = { ...notes.get(id), ...placement, updatedAt: Date.now() };
  saves.cancel(id);
  notes.set(id, updated);
  store.saveNotes([updated]).catch(reportSaveError);
  renderList();
}

function wireNoteDragging() {
  const list = byId("note-list");
  let draggedId = null;
  const dropRow = (event) => {
    const row = event.target.closest?.(".note-row");
    return draggedId && row && row.dataset.noteId !== draggedId ? row : null;
  };
  list.addEventListener("dragstart", (event) => {
    const row = event.target.closest?.(".note-row");
    if (!row || state.mode !== "notes") return;
    draggedId = row.dataset.noteId;
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", draggedId);
    row.classList.add("dragging");
  });
  list.addEventListener("dragover", (event) => {
    const row = dropRow(event);
    if (!row) return;
    event.preventDefault();
    markDropTarget(row, dropPlacement(row, event.clientY));
  });
  list.addEventListener("drop", (event) => {
    const row = dropRow(event);
    if (!row) return;
    event.preventDefault();
    applyPlacement(draggedId, placeNote(liveNotes(), { id: draggedId, targetId: row.dataset.noteId, placement: dropPlacement(row, event.clientY) }));
  });
  list.addEventListener("dragend", () => {
    draggedId = null;
    clearDropMarks();
  });
}

function dropPlacement(row, y) {
  const box = row.getBoundingClientRect();
  return y < box.top + box.height / 2 ? "before" : "after";
}

function markDropTarget(row, placement) {
  clearDropMarks();
  row.classList.add(placement === "before" ? "drop-before" : "drop-after");
}

function clearDropMarks() {
  byId("note-list").querySelectorAll(".drop-before, .drop-after, .dragging").forEach((row) => row.classList.remove("drop-before", "drop-after", "dragging"));
}

// Each returns false when it does not apply here, so the key keeps its normal meaning.
const APP_HOTKEYS = {
  search: () => {
    layout.showList();
    byId("search").focus();
  },
  help: () => (byId("help").open ? byId("help").close() : showHelp()),
  focusList: () => focusNoteList(),
  focusEditor: () => focusEditor(),
  newNote: () => createNote(),
  newSprint: () => openBoard(),
  toggleSidebar: () => layout.toggleSidebar(),
  listMenu: () => {
    layout.showList();
    openMenu(byId("list-menu"));
  },
  deletedView: () => toggleDeletedView(),
  theme: () => cycleTheme(),
  export: () => exportNotes(),
  import: () => importNotes().catch(reportImportError),
  formatMenu: () => state.mode === "notes" && notes.has(state.currentId) && openMenu(byId("format-menu")),
  noteMenu: () => notes.has(state.currentId) && openMenu(byId("note-menu")),
  pin: () => state.mode === "notes" && notes.has(state.currentId) && togglePin(),
  deleteNote: () => notes.has(state.currentId) && deleteCurrent(),
  recover: () => state.mode === "deleted" && notes.has(state.currentId) && recoverCurrent(),
  openFullPage: () => IS_POPUP && openFullPage().catch((error) => console.error("Notelet: could not open the full page", error)),
  trackerSettings: () => Boolean(notes.get(state.currentId)?.board) && openSettings(),
};

function onAppHotkey(event) {
  const run = APP_HOTKEYS[matchHotkey(event, IS_MAC)];
  if (run && run() !== false) event.preventDefault();
}

// A menu opened from the keyboard takes focus so arrow keys and Enter work in it.
function openMenu(menu) {
  if (!menu.matches(":popover-open")) menu.showPopover();
  firstMenuButton(menu)?.focus();
}

const menuButtons = (menu) => [...menu.querySelectorAll("button")].filter((button) => !button.hidden && button.offsetParent !== null);
const firstMenuButton = (menu) => menuButtons(menu)[0];

function onMenuKeydown(event) {
  const step = { ArrowDown: 1, ArrowUp: -1 }[event.key];
  if (!step) return;
  const buttons = menuButtons(event.currentTarget);
  const index = buttons.indexOf(document.activeElement);
  event.preventDefault();
  buttons[(index + step + buttons.length) % buttons.length]?.focus();
}

const showHelp = () => openHelp({ dialog: byId("help"), isMac: IS_MAC, version: chrome.runtime.getManifest().version });

function focusNoteList() {
  layout.showList();
  const list = byId("note-list");
  (list.querySelector('[aria-current="true"]') ?? list.querySelector(".note-row"))?.focus();
}

function focusEditor() {
  if (!notes.has(state.currentId)) return;
  layout.showEditor();
  editor.focus();
}

function positionFormatMenu(event) {
  if (event.newState === "open") positionMenu(event.target, byId("format-button"));
}

// Right edge lines up with the button, like iOS; a menu that would run off the bottom opens upwards.
function positionMenu(menu, anchorElement) {
  const anchor = anchorElement.getBoundingClientRect();
  const fitsBelow = anchor.bottom + MENU_GAP_PX + menu.offsetHeight <= window.innerHeight - VIEWPORT_MARGIN_PX;
  const maxLeft = window.innerWidth - menu.offsetWidth - VIEWPORT_MARGIN_PX;
  menu.style.top = `${fitsBelow ? anchor.bottom + MENU_GAP_PX : anchor.top - MENU_GAP_PX - menu.offsetHeight}px`;
  menu.style.left = `${Math.max(VIEWPORT_MARGIN_PX, Math.min(anchor.right - menu.offsetWidth, maxLeft))}px`;
}
