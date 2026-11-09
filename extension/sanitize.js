import { parseHtml } from "./model.js";

const ELEMENT_NODE = 1;
const TEXT_NODE = 3;
const COMMENT_NODE = 8;
const SHOW_TEXT = 4;
const KEPT_TAGS = {
  h1: "h1", h2: "h2", h3: "h3", h4: "h3", h5: "h3", h6: "h3", p: "p", pre: "pre", ul: "ul", ol: "ol", li: "li",
  b: "b", strong: "b", i: "i", em: "i", u: "u", s: "s", strike: "s", del: "s", a: "a", br: "br",
};
const PARAGRAPH_LIKE = new Set([
  "div", "section", "article", "blockquote", "tr", "header", "footer", "main", "figure", "figcaption", "dt", "dd", "address", "caption",
]);
const DROPPED = new Set([
  "script", "style", "img", "picture", "video", "audio", "iframe", "object", "embed", "svg", "canvas", "template",
  "noscript", "head", "title", "meta", "link", "button", "input", "select", "textarea",
]);
const BLOCK_TAGS = new Set([...PARAGRAPH_LIKE, "h1", "h2", "h3", "h4", "h5", "h6", "p", "pre", "ul", "ol", "li", "table", "tbody", "thead", "tfoot"]);
const CELL_TAGS = new Set(["td", "th"]);
const LIST_CLASSES = new Set(["checklist", "dashed"]);
const CHECKED_VALUES = new Set(["true", "false"]);
const POINTS_VALUE = /^\d+(\.\d+)?$/;
const STATUS_ID = /^[a-z0-9-]{1,24}$/;
const SECTION_IDS = new Set(["last", "current"]);
const SAFE_URL = /^(https?:|mailto:)/i;
const ROOT_BLOCKS = new Set(["h1", "h2", "h3", "p", "pre", "ul", "ol"]);
const BOLD_TAGS = new Set(["b", "strong"]);
const NOT_BOLD_STYLE = /font-weight:\s*(normal|[1-4]00)\b/i;
const LIST_TAGS = new Set(["UL", "OL"]);

export function sanitizeHtml(html) {
  return cleanBody(parseHtml(html).body);
}

// For HTML from another app. A whole note cannot go through this: the "\n" in its text is a real
// line, while in a page's source it is only how the markup was laid out.
export function sanitizePastedHtml(html) {
  const { body } = parseHtml(html);
  collapseSourceWhitespace(body);
  return cleanBody(body);
}

function cleanBody(source) {
  const target = source.ownerDocument.createElement("div");
  appendClean(source, target);
  wrapLooseInline(target);
  return target.innerHTML;
}

const KEEPS_WHITESPACE = 'pre, textarea, [style*="white-space:pre"], [style*="white-space: pre"]';
const LINE_EDGE_TAGS = new Set([...BLOCK_TAGS, ...CELL_TAGS, "body", "br"]);
const isLineEdge = (node) => node.nodeType === ELEMENT_NODE && LINE_EDGE_TAGS.has(node.tagName.toLowerCase());

function adjacentContent(node, direction) {
  let sibling = node[direction];
  while (sibling?.nodeType === COMMENT_NODE) sibling = sibling[direction];
  return sibling;
}

const touchesLineEdge = (node, direction) => {
  const sibling = adjacentContent(node, direction);
  return sibling ? isLineEdge(sibling) : isLineEdge(node.parentElement);
};

// Follows how a browser renders source text; only ASCII whitespace, so &nbsp; stays.
function collapseSourceWhitespace(root) {
  const walker = root.ownerDocument.createTreeWalker(root, SHOW_TEXT);
  const textNodes = [];
  while (walker.nextNode()) if (!walker.currentNode.parentElement.closest(KEEPS_WHITESPACE)) textNodes.push(walker.currentNode);
  for (const node of textNodes) {
    let text = node.textContent.replace(/[ \t\r\n\f]+/g, " ");
    if (touchesLineEdge(node, "previousSibling")) text = text.replace(/^ /, "");
    if (touchesLineEdge(node, "nextSibling")) text = text.replace(/ $/, "");
    node.textContent = text;
  }
}

export const normalizeLineBreaks = (text) => text.replace(/\r\n?/g, "\n");

const escapeHtml = (text) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export function plainTextToHtml(text) {
  return normalizeLineBreaks(text).replace(/\n$/, "").split("\n").map((line) => `<p>${escapeHtml(line) || "<br>"}</p>`).join("");
}

const URL_TRAILING_PUNCTUATION = /[.,;:!?'\]]+$/;
const countOf = (text, char) => text.split(char).length - 1;

// Punctuation typed after a URL belongs to the sentence; a ")" only stays if the URL opened it.
export function linkableUrl(text) {
  const url = text.replace(URL_TRAILING_PUNCTUATION, "");
  return url.endsWith(")") && countOf(url, ")") > countOf(url, "(") ? linkableUrl(url.slice(0, -1)) : url;
}

// Text left at the top level has no block to style or count as a line, so it gets one.
function wrapLooseInline(container) {
  let paragraph = null;
  for (const node of [...container.childNodes]) {
    if (node.nodeType === ELEMENT_NODE && ROOT_BLOCKS.has(node.tagName.toLowerCase())) {
      paragraph = null;
      continue;
    }
    if (!paragraph && node.nodeType === TEXT_NODE && node.textContent.trim() === "") {
      node.remove();
      continue;
    }
    if (!paragraph) {
      paragraph = container.ownerDocument.createElement("p");
      node.before(paragraph);
    }
    paragraph.append(node);
  }
}

function appendClean(source, target) {
  for (const node of source.childNodes) {
    if (node.nodeType === TEXT_NODE) target.append(target.ownerDocument.createTextNode(node.textContent));
    else if (node.nodeType === ELEMENT_NODE) appendElement(node, target);
  }
}

function appendElement(element, target) {
  const tag = element.tagName.toLowerCase();
  // Ticks and dashes Notelet adds to its own copies (see clipboard.js).
  if (DROPPED.has(tag) || element.hasAttribute("data-copy-marker")) return;
  if (isOnlyParagraphOfItem(element)) {
    appendClean(element, target);
    return;
  }
  const cleanTag = cleanTagFor(element, tag);
  if (cleanTag === null) {
    appendClean(element, target);
    if (CELL_TAGS.has(tag)) target.append(target.ownerDocument.createTextNode(" "));
    return;
  }
  const clean = target.ownerDocument.createElement(cleanTag);
  copyAllowedAttributes(element, clean, cleanTag);
  appendClean(element, clean);
  target.append(clean);
}

// Docs and Word put each list item's text in a <p>; left there, the <p> would be the line that
// styles and line moves act on, instead of the item.
function isOnlyParagraphOfItem(element) {
  const item = element.parentElement;
  if (element.tagName !== "P" || item?.tagName !== "LI") return false;
  const hasOwnText = [...item.childNodes].some((node) => node.nodeType === TEXT_NODE && node.textContent.trim() !== "");
  return !hasOwnText && [...item.children].filter((child) => !LIST_TAGS.has(child.tagName)).length === 1;
}

function cleanTagFor(element, tag) {
  if (tag === "a") return SAFE_URL.test(element.getAttribute("href")?.trim() ?? "") ? "a" : null;
  // Google Docs wraps a whole copy in <b style="font-weight:normal">.
  if (BOLD_TAGS.has(tag) && NOT_BOLD_STYLE.test(element.getAttribute("style") ?? "")) return null;
  if (Object.hasOwn(KEPT_TAGS, tag)) return KEPT_TAGS[tag];
  if (PARAGRAPH_LIKE.has(tag)) return hasBlockChild(element) ? null : "p";
  return null;
}

function hasBlockChild(element) {
  return [...element.children].some((child) => BLOCK_TAGS.has(child.tagName.toLowerCase()));
}

function copyAllowedAttributes(source, clean, tag) {
  if (tag === "a") clean.setAttribute("href", source.getAttribute("href").trim());
  if (tag === "ul") {
    const kind = (source.getAttribute("class") ?? "").split(/\s+/).find((name) => LIST_CLASSES.has(name));
    if (kind) clean.setAttribute("class", kind);
  }
  if (tag === "li") copyTicketAttributes(source, clean);
  if (tag === "h2" && SECTION_IDS.has(source.getAttribute("data-section"))) clean.setAttribute("data-section", source.getAttribute("data-section"));
}

function copyTicketAttributes(source, clean) {
  const checked = source.getAttribute("data-checked");
  const points = source.getAttribute("data-points");
  const status = source.getAttribute("data-status");
  if (CHECKED_VALUES.has(checked)) clean.setAttribute("data-checked", checked);
  if (points !== null && POINTS_VALUE.test(points)) clean.setAttribute("data-points", points);
  if (status !== null && STATUS_ID.test(status)) clean.setAttribute("data-status", status);
}
