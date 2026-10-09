// What a copy from a note puts on the clipboard. The plain text marks list items the way
// Markdown and Notes do; the HTML keeps the structure but none of the page's colours or sizes,
// so the text takes on the look of wherever it is pasted.
const BLOCKS = new Set(["H1", "H2", "H3", "P", "PRE", "DIV"]);
const LISTS = new Set(["UL", "OL"]);
const NESTED_INDENT = "    ";
const HTML_MARKERS = { checked: "☑ ", unchecked: "☐ ", dashed: "– " };
const TEXT_NODE = 3;
const NBSP = "\u00a0";
const TAB_SPACES = 4;

// A selection across several items of one list clones only the items; wrap them back in
// their list so the copy still knows which kind of list it was.
export function selectedContent(range) {
  const container = document.createElement("div");
  container.append(range.cloneContents());
  const common = range.commonAncestorContainer;
  if (!LISTS.has(common.tagName)) return container;
  const list = common.cloneNode(false);
  list.append(...container.childNodes);
  container.append(list);
  return container;
}

export function clipboardText(root) {
  return linesOf(root, "").join("\n");
}

// Notes keep line breaks three ways: separate blocks, <br>, and "\n" inside the text (what a
// pasted plain text becomes, shown by white-space: pre-wrap). All three become lines here, and
// blocks nested in other blocks are walked rather than dropped.
function linesOf(container, indent) {
  const lines = [];
  let current = null;
  const endLine = () => {
    lines.push(`${indent}${current ?? ""}`);
    current = null;
  };
  const visit = (node) => {
    if (node.nodeType === TEXT_NODE) {
      node.textContent.split("\n").forEach((part, index) => {
        if (index > 0) endLine();
        current = (current ?? "") + part;
      });
    } else if (node.tagName === "BR") {
      endLine();
    } else if (LISTS.has(node.tagName) || BLOCKS.has(node.tagName)) {
      if (current !== null) endLine();
      lines.push(...(LISTS.has(node.tagName) ? listLines(node, indent) : linesOf(node, indent)));
    } else {
      node.childNodes.forEach(visit);
    }
  };
  container.childNodes.forEach(visit);
  if (current !== null) endLine();
  return lines;
}

function listLines(list, indent) {
  return [...list.children].flatMap((item, index) => {
    const [first = "", ...rest] = linesOf(item, "");
    return [`${indent}${textMarker(list, item, index)}${first}`, ...rest.map((line) => `${indent}${NESTED_INDENT}${line}`)];
  });
}

function textMarker(list, item, index) {
  if (list.tagName === "OL") return `${index + 1}. `;
  if (list.classList.contains("checklist")) return item.getAttribute("data-checked") === "true" ? "- [x] " : "- [ ] ";
  if (list.classList.contains("dashed")) return "- ";
  return "• ";
}

// Checklist ticks and dashes are drawn by CSS, so other apps would show neither; they become
// characters. data-copy-marker lets a paste back into Notelet drop them again.
export function clipboardHtml(root) {
  const copy = root.cloneNode(true);
  for (const list of copy.querySelectorAll("ul.checklist, ul.dashed")) {
    list.setAttribute("style", "list-style: none; padding-left: 0");
    for (const item of list.children) item.prepend(htmlMarker(list, item));
  }
  keepLineBreaksAndSpaces(copy);
  return copy.innerHTML;
}

// Other apps collapse whitespace in HTML, so a "\n", an indent or a tab that Notelet shows
// would vanish there: line breaks become <br> and the spaces that matter become non-breaking.
function keepLineBreaksAndSpaces(root) {
  const walker = root.ownerDocument.createTreeWalker(root, 4);
  const textNodes = [];
  while (walker.nextNode()) if (!walker.currentNode.parentElement.closest("pre")) textNodes.push(walker.currentNode);
  for (const node of textNodes) {
    const parts = node.textContent.split("\n").map(keepSpaces);
    const pieces = parts.flatMap((part, index) => (index === 0 ? [part] : [root.ownerDocument.createElement("br"), part]));
    node.replaceWith(...pieces);
  }
}

const keepSpaces = (line) => line
  .replace(/\t/g, " ".repeat(TAB_SPACES))
  .replace(/^ +/, (spaces) => NBSP.repeat(spaces.length))
  .replace(/ {2,}/g, (spaces) => ` ${NBSP.repeat(spaces.length - 1)}`);

function htmlMarker(list, item) {
  const marker = list.ownerDocument.createElement("span");
  marker.setAttribute("data-copy-marker", "");
  const kind = list.classList.contains("dashed") ? "dashed" : item.getAttribute("data-checked") === "true" ? "checked" : "unchecked";
  marker.textContent = HTML_MARKERS[kind];
  return marker;
}
