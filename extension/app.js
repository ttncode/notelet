import { backupFileName, createBackup, parseBackup } from "./backup.js";
import { renderChart } from "./chart.js";
import { downloadFile, openHelp, pickTextFile, showToast } from "./dialogs.js";
import { NoteEditor } from "./editor.js";
import { matchHotkey } from "./hotkeys.js";
import { setupLayout } from "./layout.js";
import { groupNotes, isEmptyNote, isExpired, newNote, noteText, noteTitle, remoteNotesToApply } from "./model.js";
import { computePoints } from "./points.js";
import { sanitizeHtml } from "./sanitize.js";
import { createSaveScheduler } from "./scheduler.js";
import { renderNoteList } from "./sidebar.js";
import { createStore } from "./store.js";

const SAVE_DELAY_MS = 500;
const SAVE_MAX_WAIT_MS = 5000;
const UI_SAVE_DELAY_MS = 300;
const MENU_GAP_PX = 6;
const VIEWPORT_MARGIN_PX = 8;
const IS_MAC = /mac/i.test(navigator.userAgentData?.platform ?? navigator.platform);
const SAVE_FAILED_MESSAGE = "Couldn't save your last change. Your text is still here — keep this tab open and try again, or export a backup.";

const byId = (id) => document.getElementById(id);
const store = createStore(chrome.storage.local);
const notes = new Map();
const saves = createSaveScheduler({ delayMs: SAVE_DELAY_MS, maxWaitMs: SAVE_MAX_WAIT_MS, save: saveNow });
const state = { currentId: null, mode: "notes", query: "", ui: null };
let editor;
let layout;
let uiSaveTimer = null;

main().catch((error) => {
  console.error("Notelet failed to start", error);
  showToast(error instanceof Error ? error.message : String(error));
});

async function main() {
  const loaded = await store.load();
  loaded.notes.forEach((note) => notes.set(note.id, note));
  state.ui = loaded.ui;
  await removeStaleNotes();
  editor = new NoteEditor({ element: byId("editor"), isMac: IS_MAC, onChange: onEditorChange });
  layout = setupLayout({ resizer: byId("resizer"), ui: state.ui, onUiChange: saveUiSoon });
  wireControls();
  store.onChange(applyRemoteChanges);
  openInitialNote();
}

async function removeStaleNotes() {
  const now = Date.now();
  const staleIds = [...notes.values()]
    .filter((note) => isExpired(note, now) || (note.deletedAt === null && isEmptyNote(note.html)))
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
    .filter((note) => state.query === "" || noteText(note.html).toLowerCase().includes(state.query))
    .sort((a, b) => b.updatedAt - a.updatedAt);
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
  editor.load(notes.get(id).html);
  renderAll();
  byId("editor-scroll").scrollTop = scrollTop;
  if (reveal) layout.showEditor();
  saveUiSoon({ lastNoteId: id, scrollTop });
}

function discardIfEmpty(previousId, nextId) {
  const previous = notes.get(previousId);
  if (!previous || previousId === nextId || previous.deletedAt !== null || !isEmptyNote(previous.html)) return;
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
  const groups = state.mode === "deleted" ? deletedGroups(visible) : groupNotes(visible, Date.now());
  // ponytail: whole list re-rendered on every edit; fine for hundreds of notes, virtualise if it ever lags.
  renderNoteList(list, { groups, currentId: state.currentId, emptyText: state.query ? "No Results" : "No Notes", now: Date.now() });
  if (listHadFocus) list.querySelector('[aria-current="true"]')?.focus();
  renderSidebarChrome();
}

const deletedGroups = (visible) => (visible.length > 0 ? [{ label: "Recently Deleted", notes: visible }] : []);

function renderSidebarChrome() {
  const inDeleted = state.mode === "deleted";
  const deletedCount = [...notes.values()].filter((note) => note.deletedAt !== null).length;
  const toggle = byId("deleted-toggle");
  byId("list-title").textContent = inDeleted ? "Recently Deleted" : "Notes";
  toggle.hidden = !inDeleted && deletedCount === 0;
  toggle.textContent = inDeleted ? "‹ Notes" : `Recently Deleted (${deletedCount})`;
}

function renderEditorPane() {
  const note = notes.get(state.currentId);
  const inDeleted = state.mode === "deleted";
  const deleteLabel = inDeleted ? "Delete permanently" : "Delete note";
  byId("editor-empty").hidden = Boolean(note);
  byId("editor").hidden = !note;
  byId("note-date").textContent = note ? formatEditedDate(note.updatedAt) : "";
  byId("pin-button").setAttribute("aria-pressed", String(Boolean(note?.pinned)));
  byId("delete-button").setAttribute("aria-label", deleteLabel);
  byId("delete-button").title = deleteLabel;
  document.body.classList.toggle("viewing-deleted", inDeleted);
  editor.setReadOnly(inDeleted || !note);
  renderNoteDetails(note);
}

function renderNoteDetails(note) {
  renderChart(byId("chart"), note ? computePoints(note.html) : null);
  document.title = note ? `${noteTitle(note.html)} – Notelet` : "Notelet";
}

const formatEditedDate = (timestamp) => new Date(timestamp).toLocaleString(undefined, { dateStyle: "long", timeStyle: "short" });

function onEditorChange(html) {
  const note = notes.get(state.currentId);
  if (!note || note.deletedAt !== null || note.html === html) return;
  const updated = { ...note, html, updatedAt: Date.now() };
  notes.set(updated.id, updated);
  saves.schedule(updated.id);
  renderList();
  byId("note-date").textContent = formatEditedDate(updated.updatedAt);
  renderNoteDetails(updated);
}

function saveNow(id) {
  const note = notes.get(id);
  if (note) store.saveNotes([note]).catch(reportSaveError);
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
  state.mode = "notes";
  clearSearch();
  const note = newNote(Date.now());
  notes.set(note.id, note);
  store.saveNotes([note]).catch(reportSaveError);
  selectNote(note.id);
  editor.focusStart();
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

function recoverCurrent() {
  const recovered = updateCurrent(() => ({ deletedAt: null }));
  if (!recovered) return;
  state.mode = "notes";
  selectNote(recovered.id);
}

function toggleDeletedView() {
  state.mode = state.mode === "deleted" ? "notes" : "deleted";
  clearSearch();
  selectFirstVisible();
}

function exportNotes() {
  flushSaves();
  const now = new Date();
  downloadFile(createBackup([...notes.values()], now), backupFileName(now));
}

async function importNotes() {
  const text = await pickTextFile(".json,application/json");
  if (text === null) return;
  const result = parseBackup(text);
  if (!result.ok) {
    showToast(result.error);
    return;
  }
  const imported = result.notes.map((note) => ({ ...note, html: sanitizeHtml(note.html) }));
  await store.saveNotes(imported);
  imported.forEach((note) => {
    saves.cancel(note.id);
    notes.set(note.id, note);
  });
  refreshAfterOutsideChange(imported.map((note) => note.id));
  showToast(`Imported ${imported.length} ${imported.length === 1 ? "note" : "notes"}.`);
}

function reportImportError(error) {
  console.error("Notelet: import failed", error);
  showToast("Import failed; your existing notes were not changed.");
}

function applyRemoteChanges({ updated, removedIds }) {
  const newer = remoteNotesToApply(updated, { local: notes, isPending: saves.isPending });
  const removed = removedIds.filter((id) => notes.has(id) && !saves.isPending(id));
  if (newer.length === 0 && removed.length === 0) return;
  newer.forEach((note) => notes.set(note.id, note));
  removed.forEach((id) => notes.delete(id));
  refreshAfterOutsideChange(newer.map((note) => note.id));
}

function refreshAfterOutsideChange(changedIds) {
  const current = notes.get(state.currentId);
  const stillInView = current && (current.deletedAt !== null) === (state.mode === "deleted");
  if (!stillInView) {
    selectFirstVisible();
    return;
  }
  if (changedIds.includes(current.id) && !editor.isFocused()) editor.load(current.html);
  renderAll();
}

function wireControls() {
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
}

function wireButtons() {
  const handlers = {
    "new-note-button": createNote,
    "new-note-list-button": createNote,
    "pin-button": togglePin,
    "delete-button": deleteCurrent,
    "recover-button": recoverCurrent,
    "sidebar-toggle": () => layout.toggleSidebar(),
    "back-button": () => layout.showList(),
    "deleted-toggle": toggleDeletedView,
    "export-button": exportNotes,
    "import-button": () => importNotes().catch(reportImportError),
    "help-button": () => openHelp({ dialog: byId("help"), isMac: IS_MAC, version: chrome.runtime.getManifest().version }),
  };
  for (const [id, handler] of Object.entries(handlers)) byId(id).addEventListener("click", handler);
}

function wireSidebar() {
  const list = byId("note-list");
  list.addEventListener("click", (event) => {
    const row = event.target.closest(".note-row");
    if (row) selectNote(row.dataset.noteId);
  });
  list.addEventListener("keydown", onListKeydown);
  byId("search").addEventListener("input", (event) => {
    state.query = event.target.value.trim().toLowerCase();
    renderList();
  });
}

function onListKeydown(event) {
  const step = { ArrowDown: 1, ArrowUp: -1 }[event.key];
  if (!step) return;
  const rows = [...byId("note-list").querySelectorAll(".note-row")];
  const next = rows[rows.indexOf(document.activeElement) + step];
  if (!next) return;
  event.preventDefault();
  selectNote(next.dataset.noteId, { reveal: false });
}

function onAppHotkey(event) {
  const action = matchHotkey(event, IS_MAC);
  if (action === "search") {
    event.preventDefault();
    layout.showList();
    byId("search").focus();
  } else if (action === "newNote") {
    event.preventDefault();
    createNote();
  }
}

function positionFormatMenu(event) {
  if (event.newState !== "open") return;
  const anchor = byId("format-button").getBoundingClientRect();
  const menu = event.target;
  const maxLeft = window.innerWidth - menu.offsetWidth - VIEWPORT_MARGIN_PX;
  menu.style.top = `${anchor.bottom + MENU_GAP_PX}px`;
  menu.style.left = `${Math.max(VIEWPORT_MARGIN_PX, Math.min(anchor.left, maxLeft))}px`;
}
