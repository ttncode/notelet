// Line editing works on blocks: a paragraph, heading, Monostyled block or list item is one line.
// shortcut: a block broken by Shift+Enter or "\n" still moves as one line; split on those if users ask.
export const LINE_SELECTOR = "h1,h2,h3,p,pre,li,div";

export const ABOVE = -1;
export const BELOW = 1;
const TEXT_NODE = 3;
const ELEMENT_NODE = 1;

// Lines move past their neighbour in the same list or at the top level; at an edge they stay.
export function moveLines(lines, direction) {
  if (lines.length === 0 || lines.some((line) => line.parentElement !== lines[0].parentElement)) return false;
  const neighbour = direction === ABOVE ? lines[0].previousElementSibling : lines.at(-1).nextElementSibling;
  if (!neighbour) return false;
  if (direction === ABOVE) lines.at(-1).after(neighbour);
  else lines[0].before(neighbour);
  return true;
}

export function duplicateLine(line, direction) {
  const copy = line.cloneNode(true);
  insertBeside(line, copy, direction);
  return copy;
}

// A list item gets an empty item of the same list; any other line gets a body line.
export function insertLine(line, direction) {
  const isItem = line.tagName === "LI";
  const blank = line.ownerDocument.createElement(isItem ? "li" : "p");
  blank.append(line.ownerDocument.createElement("br"));
  if (isItem && line.parentElement.classList.contains("checklist")) blank.setAttribute("data-checked", "false");
  insertBeside(line, blank, direction);
  return blank;
}

// The list goes too when its last item is removed, so no empty list is left behind.
export function removeLine(line) {
  const list = line.parentElement;
  line.remove();
  if (line.tagName === "LI" && list.children.length === 0) list.remove();
}

export function indentText(line) {
  line.prepend("\t");
}

export function outdentText(line) {
  const first = line.firstChild;
  if (first?.nodeType !== TEXT_NODE ||!first.textContent.startsWith("\t")) return false;
  first.textContent = first.textContent.slice(1);
  return true;
}

export function lineOf(root, node) {
  const line = (node.nodeType === TEXT_NODE ? node.parentElement : node).closest(LINE_SELECTOR);
  return line && line !== root && root.contains(line) ? line : null;
}

// A list item's own nested items are inside it, so going down skips them.
export function nextLine(root, line) {
  const lines = [...root.querySelectorAll(LINE_SELECTOR)];
  return lines.slice(lines.indexOf(line) + 1).find((other) => !line.contains(other)) ?? null;
}

export function previousLine(root, line) {
  const lines = [...root.querySelectorAll(LINE_SELECTOR)];
  return lines[lines.indexOf(line) - 1] ?? null;
}

// Triple-click and Shift+Down end a selection at the very start of the next line, which looks
// unselected, so copies and styles stop at the end of the line before it.
export function withoutNextLineStart(root, range) {
  const line = lineOf(root, range.endContainer);
  if (range.collapsed || !line || line.contains(range.startContainer)) return range;
  const head = range.cloneRange();
  head.setStart(line, 0);
  if (head.toString() !== "") return range;
  let boundary = line;
  while (boundary.parentElement !== root && !boundary.previousSibling) boundary = boundary.parentElement;
  const trimmed = range.cloneRange();
  trimmed.setEndBefore(boundary);
  return trimmed;
}

// For a range that becomes the live selection: between two blocks Chrome snaps its end back to
// the next line, so it has to sit inside the text. A copy needs the block end, to keep its line.
export function endingInsideText(range) {
  let last = range.endContainer.childNodes[range.endOffset - 1];
  if (!last) return range;
  while (last.lastChild) last = last.lastChild;
  const moved = range.cloneRange();
  if (last.nodeType === TEXT_NODE) moved.setEnd(last, last.length);
  else moved.setEndBefore(last);
  return moved;
}

const LINE_OR_LIST = `${LINE_SELECTOR},ul,ol`;
const isLineOrList = (node) => node.nodeType === ELEMENT_NODE && node.matches(LINE_OR_LIST);
const onlyHoldsLines = (line) => line.hasChildNodes() && [...line.childNodes].every(isLineOrList);
const selectionIsInside = (node, range) => isLineOrList(node) && node.contains(range.startContainer) && node.contains(range.endContainer);

// A list item is left out when only items nested inside it are selected.
export function selectedLines(root, range) {
  const trimmed = withoutNextLineStart(root, range);
  return [...root.querySelectorAll(LINE_SELECTOR)].filter((line) => trimmed.intersectsNode(line)
    && !onlyHoldsLines(line) && ![...line.children].some((child) => selectionIsInside(child, trimmed)));
}

function insertBeside(line, added, direction) {
  if (direction === ABOVE) line.before(added);
  else line.after(added);
}
