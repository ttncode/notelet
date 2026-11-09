const BLOCK_SELECTOR = "h1,h2,h3,p,pre,li,div";

export function caretElement(root) {
  const selection = document.getSelection();
  if (!selection.rangeCount) return null;
  const node = selection.focusNode;
  const element = node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement;
  return root.contains(element) ? element : null;
}

export function caretBlock(root) {
  const block = caretElement(root)?.closest(BLOCK_SELECTOR);
  return block && block !== root && root.contains(block) ? block : null;
}

export function caretOffset(root) {
  const selection = document.getSelection();
  if (!selection.rangeCount || !root.contains(selection.focusNode)) return 0;
  const range = document.createRange();
  range.selectNodeContents(root);
  range.setEnd(selection.focusNode, selection.focusOffset);
  return range.toString().length;
}

export function setCaretOffset(root, offset) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let remaining = offset;
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (remaining <= node.length) {
      placeCaret(node, remaining);
      return;
    }
    remaining -= node.length;
  }
  placeCaretAtEnd(root);
}

export function isCaretAtEndOf(element) {
  const selection = document.getSelection();
  if (!selection.rangeCount) return false;
  const range = document.createRange();
  range.selectNodeContents(element);
  range.setStart(selection.focusNode, selection.focusOffset);
  return range.toString() === "";
}

export function placeCaret(node, offset) {
  const range = document.createRange();
  range.setStart(node, offset);
  range.collapse(true);
  selectRange(range);
}

export const placeCaretAtStart = (element) => placeCaret(element, 0);

export function placeCaretAtEnd(element) {
  const range = document.createRange();
  range.selectNodeContents(element);
  range.collapse(false);
  selectRange(range);
}

export function placeCaretAfter(node) {
  const range = document.createRange();
  range.setStartAfter(node);
  range.collapse(true);
  selectRange(range);
}

// Selection fields are live, so this copies them. Text nodes survive a line changing type or
// moving, which lets restoreSelection put back exactly what was selected; replaced maps lines
// that were swapped for a new element, for selections that sit on the line itself.
export function saveSelection() {
  const { anchorNode, anchorOffset, focusNode, focusOffset } = document.getSelection();
  return { anchorNode, anchorOffset, focusNode, focusOffset };
}

export function restoreSelection(saved, replaced = new Map()) {
  const anchor = replaced.get(saved.anchorNode) ?? saved.anchorNode;
  const focus = replaced.get(saved.focusNode) ?? saved.focusNode;
  if (!anchor?.isConnected || !focus?.isConnected) return;
  document.getSelection().setBaseAndExtent(anchor, Math.min(saved.anchorOffset, nodeLength(anchor)), focus, Math.min(saved.focusOffset, nodeLength(focus)));
}

const nodeLength = (node) => (node.nodeType === Node.TEXT_NODE ? node.length : node.childNodes.length);

function selectRange(range) {
  const selection = document.getSelection();
  selection.removeAllRanges();
  selection.addRange(range);
}
