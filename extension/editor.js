import { History } from "./history.js";
import { matchHotkey } from "./hotkeys.js";
import {
  checkboxForShortcut, itemCreatedBySplit, liftListOutOfParagraph, listKindForShortcut, removeLeadingText, setBlockType,
} from "./lists.js";
import { EMPTY_NOTE_HTML } from "./model.js";
import { sanitizeHtml } from "./sanitize.js";
import {
  caretBlock, caretElement, caretOffset, isCaretAtEndOf, placeCaret, placeCaretAfter, placeCaretAtEnd, placeCaretAtStart, setCaretOffset,
} from "./selection.js";

const TYPING_PAUSE_MS = 1000;
const IME_PROCESS_KEYCODE = 229;
const URL_BEFORE_CARET = /(https?:\/\/[^\s<>"]+)$/;
const HEADING_TAGS = new Set(["H1", "H2", "H3"]);
const BLOCK_ACTIONS = { title: "h1", heading: "h2", subheading: "h3", body: "p", monostyled: "pre" };
const INLINE_ACTIONS = { bold: "bold", italic: "italic", underline: "underline", strikethrough: "strikeThrough" };
const LIST_ACTIONS = new Set(["bulleted", "dashed", "numbered", "checklist"]);
const EDITOR_ACTIONS = new Set([...Object.keys(BLOCK_ACTIONS), ...Object.keys(INLINE_ACTIONS), ...LIST_ACTIONS, "toggleCheck", "undo", "redo"]);
const PASTE_INPUT_TYPES = new Set(["insertFromPaste", "insertFromPasteAsQuotation", "insertFromDrop"]);
const BURST_KINDS = new Set(["type", "delete"]);
const CHECKLIST_ITEM = "ul.checklist > li";

export class NoteEditor {
  #element;
  #isMac;
  #onChange;
  #history = new History();
  #lastInput = { at: 0, kind: "" };
  #savedRange = null;
  #itemBeforeEnter = null;
  #emptyHtml = EMPTY_NOTE_HTML;

  constructor({ element, isMac, onChange }) {
    this.#element = element;
    this.#isMac = isMac;
    this.#onChange = onChange;
    document.execCommand("defaultParagraphSeparator", false, "p");
    this.#listen();
  }

  // emptyHtml is what the text falls back to when everything is deleted: a title line for a
  // note, a body line under a tracker.
  load(html, { emptyHtml = EMPTY_NOTE_HTML } = {}) {
    this.#emptyHtml = emptyHtml;
    this.#element.innerHTML = html;
    this.#history.clear();
    this.#lastInput = { at: 0, kind: "" };
    this.#savedRange = null;
  }

  setReadOnly(readOnly) {
    this.#element.contentEditable = String(!readOnly);
  }

  isFocused() {
    return this.#element.contains(document.activeElement);
  }

  // Back to where the caret last was in this note, or to the end of its last line.
  focus() {
    this.#element.focus();
    if (!this.#savedRange) {
      const blocks = this.#element.querySelectorAll("h1,h2,h3,p,pre,li");
      placeCaretAtEnd(blocks[blocks.length - 1] ?? this.#element);
      return;
    }
    document.getSelection().removeAllRanges();
    document.getSelection().addRange(this.#savedRange);
  }

  // A new note's empty title line is where typing starts.
  focusStart() {
    this.#element.focus();
    const blocks = [...this.#element.querySelectorAll("h1,h2,h3,p,pre,li")];
    const firstEmpty = blocks.find((block) => block.textContent === "");
    placeCaretAtStart(firstEmpty ?? this.#element.firstElementChild ?? this.#element);
  }

  run(action) {
    if (!this.#element.isContentEditable) return;
    if (action === "undo") return this.#undo();
    if (action === "redo") return this.#redo();
    this.#restoreSelection();
    this.#checkpoint();
    this.#apply(action);
    this.#changed();
  }

  #apply(action) {
    if (Object.hasOwn(BLOCK_ACTIONS, action)) return this.#setBlock(BLOCK_ACTIONS[action]);
    if (Object.hasOwn(INLINE_ACTIONS, action)) return document.execCommand(INLINE_ACTIONS[action]);
    if (LIST_ACTIONS.has(action)) return this.#keepCaretInBlock(() => this.#toggleList(action));
    if (action === "toggleCheck") return this.#toggleCheckAtCaret();
    throw new Error(`Unknown editor action: ${action}`);
  }

  #listen() {
    const element = this.#element;
    element.addEventListener("keydown", (event) => this.#onKeydown(event));
    element.addEventListener("beforeinput", (event) => this.#onBeforeInput(event));
    element.addEventListener("input", (event) => this.#onInput(event));
    element.addEventListener("compositionstart", () => this.#checkpoint());
    element.addEventListener("compositionend", () => this.#changed());
    element.addEventListener("mousedown", (event) => this.#onMouseDown(event));
    element.addEventListener("click", (event) => this.#onClick(event));
    document.addEventListener("selectionchange", () => this.#rememberSelection());
  }

  #onKeydown(event) {
    if (event.isComposing || event.keyCode === IME_PROCESS_KEYCODE) return;
    const action = matchHotkey(event, this.#isMac);
    if (action && EDITOR_ACTIONS.has(action)) {
      event.preventDefault();
      this.run(action);
    } else if (event.key === "Enter" && !event.shiftKey) {
      this.#onEnter(event);
    } else if (event.key === "Tab") {
      this.#onTab(event);
    } else if (event.key === " ") {
      this.#onSpace(event);
    }
  }

  #onBeforeInput(event) {
    if (event.inputType === "historyUndo" || event.inputType === "historyRedo") {
      event.preventDefault();
      if (event.inputType === "historyUndo") this.#undo();
      else this.#redo();
      return;
    }
    if (event.inputType === "insertParagraph") this.#itemBeforeEnter = caretElement(this.#element)?.closest(CHECKLIST_ITEM) ?? null;
    if (!event.isComposing) this.#checkpointTyping(event.inputType);
  }

  #onInput(event) {
    if (event.isComposing) return;
    if (PASTE_INPUT_TYPES.has(event.inputType)) this.#sanitizeInPlace();
    if (event.inputType === "insertParagraph") this.#uncheckNewItem();
    this.#ensureContent();
    this.#changed();
  }

  #onEnter(event) {
    this.#linkifyBeforeCaret();
    const block = caretBlock(this.#element);
    if (!block || !HEADING_TAGS.has(block.tagName) || !isCaretAtEndOf(block)) return;
    event.preventDefault();
    this.#checkpoint();
    const paragraph = document.createElement("p");
    paragraph.append(document.createElement("br"));
    block.after(paragraph);
    placeCaretAtStart(paragraph);
    this.#changed();
  }

  #onTab(event) {
    event.preventDefault();
    this.#checkpoint();
    if (caretElement(this.#element)?.closest("li")) {
      document.execCommand(event.shiftKey ? "outdent" : "indent");
      this.#matchNestedListKind();
    } else if (!event.shiftKey) {
      document.execCommand("insertText", false, "\t");
    }
    this.#changed();
  }

  #onSpace(event) {
    if (this.#applyListShortcut(event)) return;
    const link = this.#linkifyBeforeCaret();
    if (!link) return;
    event.preventDefault();
    const space = document.createTextNode(" ");
    link.after(space);
    placeCaret(space, 1);
    this.#changed();
  }

  // Notes turns "- ", "* ", "1. " at the start of a body line into a list, and "[ ] " at the
  // start of a list item into a checklist item. The space goes in first so Ctrl+Z gives the text back.
  #applyListShortcut(event) {
    const block = caretBlock(this.#element);
    if (!block || !document.getSelection().isCollapsed) return false;
    const prefix = block.textContent.slice(0, caretOffset(block));
    const isItem = block.tagName === "LI";
    const kind = !isItem && (block.tagName === "P" || block.tagName === "DIV") ? listKindForShortcut(prefix) : null;
    const checkbox = isItem ? checkboxForShortcut(prefix) : null;
    if (!kind && !checkbox) return false;
    event.preventDefault();
    document.execCommand("insertText", false, " ");
    this.#checkpoint();
    removeLeadingText(block, prefix.length + 1);
    if (!block.textContent && !block.querySelector("br")) block.append(document.createElement("br"));
    placeCaretAtStart(block);
    if (kind) this.#toggleList(kind);
    else this.#makeChecklistItem(block, checkbox.checked);
    this.#changed();
    return true;
  }

  #makeChecklistItem(item, checked) {
    if (item.parentElement.tagName === "UL") applyListKind(item.parentElement, "checklist");
    else this.#toggleList("checklist");
    const current = caretElement(this.#element)?.closest(CHECKLIST_ITEM) ?? item;
    current.setAttribute("data-checked", String(checked));
  }

  #onMouseDown(event) {
    const item = event.target.closest?.(CHECKLIST_ITEM);
    if (!item || event.target !== item || !this.#element.isContentEditable) return;
    const circleWidth = parseFloat(getComputedStyle(item).paddingLeft);
    if (event.clientX - item.getBoundingClientRect().left > circleWidth) return;
    event.preventDefault();
    this.#checkpoint();
    toggleChecked(item);
    this.#changed();
  }

  #onClick(event) {
    const link = event.target.closest?.("a[href]");
    if (!link) return;
    event.preventDefault();
    window.open(link.href, "_blank", "noopener");
  }

  #setBlock(tag) {
    const block = caretBlock(this.#element);
    if (!block) return;
    const offset = caretOffset(block);
    setCaretOffset(setBlockType(block, tag), offset);
  }

  #toggleList(kind) {
    const current = caretElement(this.#element)?.closest("ul,ol");
    if (current && listKind(current) === kind) {
      document.execCommand(listCommand(current));
      return;
    }
    const block = caretBlock(this.#element);
    if (!current && block && block.tagName !== "P" && block.tagName !== "DIV") setCaretOffset(setBlockType(block, "p"), 0);
    if (!current || (current.tagName === "OL") !== (kind === "numbered")) {
      document.execCommand(kind === "numbered" ? "insertOrderedList" : "insertUnorderedList");
    }
    const list = caretElement(this.#element)?.closest("ul,ol");
    if (!list) return;
    unwrapStyledSpans(list);
    applyListKind(list, kind);
    const { focusNode, focusOffset } = document.getSelection();
    liftListOutOfParagraph(list);
    placeCaret(focusNode, focusOffset);
  }

  // Chrome's list and block commands rebuild the line and drop the caret at its start.
  #keepCaretInBlock(change) {
    const before = document.getSelection().isCollapsed ? caretBlock(this.#element) : null;
    const offset = before ? caretOffset(before) : null;
    change();
    const after = caretBlock(this.#element);
    if (after && offset !== null) setCaretOffset(after, offset);
  }

  #matchNestedListKind() {
    const list = caretElement(this.#element)?.closest("ul,ol");
    const parent = list?.parentElement?.closest("ul,ol");
    if (list && parent && parent.tagName === list.tagName) applyListKind(list, listKind(parent));
  }

  #toggleCheckAtCaret() {
    const item = caretElement(this.#element)?.closest(CHECKLIST_ITEM);
    if (item) toggleChecked(item);
  }

  #uncheckNewItem() {
    const item = itemCreatedBySplit(this.#itemBeforeEnter, caretElement(this.#element)?.closest(CHECKLIST_ITEM) ?? null);
    this.#itemBeforeEnter = null;
    if (!item?.matches(CHECKLIST_ITEM)) return;
    item.setAttribute("data-checked", "false");
    item.removeAttribute("data-points");
    item.removeAttribute("data-status");
  }

  #linkifyBeforeCaret() {
    const selection = document.getSelection();
    const node = selection.focusNode;
    if (!selection.isCollapsed || node?.nodeType !== Node.TEXT_NODE) return null;
    if (!this.#element.contains(node) || node.parentElement.closest("a")) return null;
    const end = selection.focusOffset;
    const match = node.textContent.slice(0, end).match(URL_BEFORE_CARET);
    if (!match) return null;
    this.#checkpoint();
    const range = document.createRange();
    range.setStart(node, end - match[1].length);
    range.setEnd(node, end);
    const link = document.createElement("a");
    link.href = match[1];
    range.surroundContents(link);
    placeCaretAfter(link);
    return link;
  }

  #sanitizeInPlace() {
    const caret = caretOffset(this.#element);
    this.#element.innerHTML = sanitizeHtml(this.#element.innerHTML);
    setCaretOffset(this.#element, caret);
  }

  #ensureContent() {
    const element = this.#element;
    if (element.textContent !== "" || element.querySelector("h1,h2,h3,p,pre,li")) return;
    element.innerHTML = this.#emptyHtml;
    placeCaretAtStart(element.firstElementChild);
  }

  #checkpointTyping(inputType) {
    const kind = inputType === "insertText" ? "type" : inputType.startsWith("delete") ? "delete" : inputType;
    const now = Date.now();
    const continuesBurst = BURST_KINDS.has(kind) && kind === this.#lastInput.kind && now - this.#lastInput.at < TYPING_PAUSE_MS;
    if (!continuesBurst) this.#checkpoint();
    this.#lastInput = { at: now, kind };
  }

  #checkpoint() {
    this.#history.record(this.#snapshot());
    this.#lastInput = { at: 0, kind: "" };
  }

  #snapshot() {
    return { html: this.#element.innerHTML, caret: caretOffset(this.#element) };
  }

  #undo() {
    const previous = this.#history.undo(this.#snapshot());
    if (previous) this.#restore(previous);
  }

  #redo() {
    const next = this.#history.redo(this.#snapshot());
    if (next) this.#restore(next);
  }

  #restore(snapshot) {
    this.#element.innerHTML = snapshot.html;
    setCaretOffset(this.#element, snapshot.caret);
    this.#lastInput = { at: 0, kind: "" };
    this.#changed();
  }

  #rememberSelection() {
    const selection = document.getSelection();
    if (selection.rangeCount && this.#element.contains(selection.anchorNode)) this.#savedRange = selection.getRangeAt(0).cloneRange();
  }

  #restoreSelection() {
    const selection = document.getSelection();
    if ((selection.rangeCount && this.#element.contains(selection.anchorNode)) || !this.#savedRange) return;
    this.#element.focus();
    selection.removeAllRanges();
    selection.addRange(this.#savedRange);
  }

  #changed() {
    this.#onChange(this.#element.innerHTML);
  }
}

function listKind(list) {
  if (list.tagName === "OL") return "numbered";
  if (list.classList.contains("checklist")) return "checklist";
  if (list.classList.contains("dashed")) return "dashed";
  return "bulleted";
}

const listCommand = (list) => (list.tagName === "OL" ? "insertOrderedList" : "insertUnorderedList");

function applyListKind(list, kind) {
  if (kind === "checklist" || kind === "dashed") list.setAttribute("class", kind);
  else list.removeAttribute("class");
  for (const item of list.children) {
    if (kind !== "checklist") item.removeAttribute("data-checked");
    else if (!item.hasAttribute("data-checked")) item.setAttribute("data-checked", "false");
  }
}

// Switching between list types, Chrome wraps the text in <span style="font-size: …"> copied
// from the old list; the note has no inline styles, so the spans only get in the way.
function unwrapStyledSpans(list) {
  list.querySelectorAll("span[style]").forEach((span) => span.replaceWith(...span.childNodes));
}

function toggleChecked(item) {
  item.setAttribute("data-checked", item.getAttribute("data-checked") === "true" ? "false" : "true");
}
