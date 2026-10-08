import { parseHtml } from "./model.js";

const ELEMENT_NODE = 1;
const TEXT_NODE = 3;
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
const SAFE_URL = /^(https?:|mailto:)/i;
const ROOT_BLOCKS = new Set(["h1", "h2", "h3", "p", "pre", "ul", "ol"]);

export function sanitizeHtml(html) {
  const source = parseHtml(html).body;
  const target = source.ownerDocument.createElement("div");
  appendClean(source, target);
  wrapLooseInline(target);
  return target.innerHTML;
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
  if (DROPPED.has(tag)) return;
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

function cleanTagFor(element, tag) {
  if (tag === "a") return SAFE_URL.test(element.getAttribute("href")?.trim() ?? "") ? "a" : null;
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
  if (tag === "li" && CHECKED_VALUES.has(source.getAttribute("data-checked"))) {
    clean.setAttribute("data-checked", source.getAttribute("data-checked"));
  }
}
