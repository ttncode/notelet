import { ownText } from "./model.js";

// What a copy from a note puts on the clipboard. The plain text marks list items the way
// Markdown and Notes do; the HTML keeps the structure but none of the page's colours or sizes,
// so the text takes on the look of wherever it is pasted.
const BLOCKS = new Set(["H1", "H2", "H3", "P", "PRE", "DIV"]);
const LISTS = new Set(["UL", "OL"]);
const NESTED_INDENT = "    ";
const HTML_MARKERS = { checked: "☑ ", unchecked: "☐ ", dashed: "– " };

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
  return blockLines(root, "").join("\n");
}

function blockLines(container, indent) {
  const lines = [];
  let loose = null;
  for (const node of container.childNodes) {
    if (LISTS.has(node.tagName)) {
      loose = null;
      lines.push(...listLines(node, indent));
    } else if (BLOCKS.has(node.tagName)) {
      loose = null;
      lines.push(...textLines(node, indent));
    } else {
      loose = loose ?? container.ownerDocument.createElement("span");
      if (loose.childNodes.length === 0) lines.push(loose);
      loose.append(node.cloneNode(true));
    }
  }
  return lines.flatMap((line) => (typeof line === "string" ? [line] : textLines(line, indent)));
}

const textLines = (element, indent) => ownText(element).split("\n").map((line) => `${indent}${line}`);

function listLines(list, indent) {
  return [...list.children].flatMap((item, index) => {
    const [first, ...rest] = ownText(item).split("\n");
    const nested = [...item.children].filter((child) => LISTS.has(child.tagName));
    return [
      `${indent}${textMarker(list, item, index)}${first}`,
      ...rest.map((line) => `${indent}${NESTED_INDENT}${line}`),
      ...nested.flatMap((child) => listLines(child, indent + NESTED_INDENT)),
    ];
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
  return copy.innerHTML;
}

function htmlMarker(list, item) {
  const marker = list.ownerDocument.createElement("span");
  marker.setAttribute("data-copy-marker", "");
  const kind = list.classList.contains("dashed") ? "dashed" : item.getAttribute("data-checked") === "true" ? "checked" : "unchecked";
  marker.textContent = HTML_MARKERS[kind];
  return marker;
}
