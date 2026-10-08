// Chrome's list commands can leave the new list inside a <p>, which the HTML parser
// splits into empty paragraphs the next time the note is loaded.
export function liftListOutOfParagraph(list) {
  const paragraph = list.parentElement;
  if (paragraph?.tagName !== "P") return;
  const after = paragraph.ownerDocument.createElement("p");
  while (list.nextSibling) after.append(list.nextSibling);
  paragraph.after(list);
  if (after.textContent !== "" || after.querySelector("*")) list.after(after);
  if (paragraph.textContent === "") paragraph.remove();
}

const LIST_TAGS = new Set(["UL", "OL"]);
const LIST_CONTAINER_TAGS = new Set(["UL", "OL", "LI"]);

// Notes turns a styled list item into a standalone line; Chrome's formatBlock instead
// wraps the whole list in the heading.
export function setBlockType(block, tag) {
  const replacement = block.ownerDocument.createElement(tag);
  const nestedLists = [...block.children].filter((child) => LIST_TAGS.has(child.tagName));
  replacement.append(...[...block.childNodes].filter((node) => !nestedLists.includes(node)));
  if (!replacement.hasChildNodes()) replacement.append(block.ownerDocument.createElement("br"));
  if (block.tagName === "LI") moveItemOutOfList(block, [replacement, ...nestedLists]);
  else block.replaceWith(replacement);
  return replacement;
}

// Every list around the item is split at it, so the item and everything after it keep
// their order: the blocks go after the outermost list, followed by the trailing items.
function moveItemOutOfList(item, blocks) {
  const list = item.parentElement;
  let node = item;
  let trailing = [];
  while (LIST_CONTAINER_TAGS.has(node.parentElement?.tagName)) {
    const parent = node.parentElement;
    trailing = [...trailing, ...siblingsAfter(node)];
    if (LIST_TAGS.has(parent.tagName) && trailing.length > 0) {
      const shell = parent.cloneNode(false);
      shell.append(...trailing);
      trailing = [shell];
    }
    node = parent;
  }
  node.after(...blocks, ...trailing);
  item.remove();
  removeEmptyLists(list);
}

function siblingsAfter(node) {
  const siblings = [];
  for (let sibling = node.nextSibling; sibling; sibling = sibling.nextSibling) siblings.push(sibling);
  return siblings;
}

function removeEmptyLists(list) {
  let current = list;
  while (current && LIST_TAGS.has(current.tagName) && current.children.length === 0) {
    const parent = current.parentElement;
    current.remove();
    current = parent;
  }
}

// Splitting at the very start of an item, Chrome inserts the new item before it and keeps
// the caret in the original, so "the item under the caret" is not always the new one.
export function itemCreatedBySplit(itemBefore, itemAfter) {
  if (!itemBefore || !itemAfter) return null;
  return itemAfter === itemBefore ? itemBefore.previousElementSibling : itemAfter;
}

const LIST_SHORTCUTS = { "-": "dashed", "*": "bulleted", "•": "bulleted", "1.": "numbered", "1)": "numbered" };
const CHECKBOX_SHORTCUTS = { "[ ]": false, "[]": false, "[x]": true, "[X]": true };
const TEXT_NODE = 3;

export const listKindForShortcut = (prefix) => (Object.hasOwn(LIST_SHORTCUTS, prefix) ? LIST_SHORTCUTS[prefix] : null);

export const checkboxForShortcut = (prefix) => (Object.hasOwn(CHECKBOX_SHORTCUTS, prefix) ? { checked: CHECKBOX_SHORTCUTS[prefix] } : null);

export function removeLeadingText(element, count) {
  let remaining = count;
  for (const node of textNodesIn(element)) {
    if (remaining === 0) return;
    const removed = Math.min(remaining, node.textContent.length);
    node.textContent = node.textContent.slice(removed);
    remaining -= removed;
  }
}

function textNodesIn(element) {
  return [...element.childNodes].flatMap((node) => (node.nodeType === TEXT_NODE ? [node] : textNodesIn(node)));
}
