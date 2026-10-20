// Line editing works on blocks: a paragraph, heading, Monostyled block or list item is one line.
// shortcut: a block broken by Shift+Enter or "\n" still moves as one line; split on those if users ask.
export const LINE_SELECTOR = "h1,h2,h3,p,pre,li,div";

export const ABOVE = -1;
export const BELOW = 1;
const TEXT_NODE = 3;

// A line moves past its neighbour in the same list or at the top level; at an edge it stays.
export function moveLine(line, direction) {
  const neighbour = direction === ABOVE ? line.previousElementSibling : line.nextElementSibling;
  if (!neighbour) return false;
  insertBeside(neighbour, line, direction);
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

function insertBeside(line, added, direction) {
  if (direction === ABOVE) line.before(added);
  else line.after(added);
}
