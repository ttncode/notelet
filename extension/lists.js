// Chrome's list commands can leave the new list inside a <p>, which the HTML parser
// splits into empty paragraphs the next time the note is loaded.
export function liftListOutOfParagraph(list) {
  const paragraph = list.parentElement;
  if (paragraph?.tagName !== "P") return;
  const after = paragraph.ownerDocument.createElement("p");
  while (list.nextSibling) after.append(list.nextSibling);
  paragraph.after(list);
  if (after.hasChildNodes()) list.after(after);
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

function moveItemOutOfList(item, blocks) {
  const list = item.parentElement;
  const topList = outermostList(list);
  const rest = topList === list ? listAfter(item) : null;
  topList.after(...blocks, ...(rest ? [rest] : []));
  item.remove();
  if (list.children.length === 0) list.remove();
}

function listAfter(item) {
  const rest = item.parentElement.cloneNode(false);
  while (item.nextSibling) rest.append(item.nextSibling);
  return rest.hasChildNodes() ? rest : null;
}

function outermostList(list) {
  let top = list;
  while (top.parentElement && LIST_CONTAINER_TAGS.has(top.parentElement.tagName)) top = top.parentElement;
  return top;
}
