import { codeBlockFirstLines, codeBlockLines, languageOf } from "./code-block.js";

// Syntax colours for code blocks. Prism (vendor/prism.js) finds the tokens; the CSS Custom
// Highlight API colours them without adding any element to the note, so the saved HTML, the
// caret and Undo never see them.

// Prism's token types, folded into the few colours code is shown in.
const TOKEN_GROUPS = {
  comment: "comment", prolog: "comment", doctype: "comment", cdata: "comment",
  keyword: "keyword", boolean: "keyword", important: "keyword", atrule: "keyword", title: "keyword",
  string: "string", char: "string", "attr-value": "string", regex: "string", url: "string",
  number: "number", constant: "number",
  function: "function", "class-name": "function", builtin: "function",
  tag: "tag", selector: "tag", property: "tag", "attr-name": "tag", key: "tag",
  variable: "variable",
};
export const HIGHLIGHT_GROUPS = [...new Set(Object.values(TOKEN_GROUPS))];

// The coloured stretches of text, as { group, start, end } offsets. Text inside a token that
// has no colour of its own takes the colour of the token around it.
export function tokenRanges(text, language) {
  const grammar = globalThis.Prism?.languages[language];
  if (!grammar) return [];
  const ranges = [];
  collectRanges(globalThis.Prism.tokenize(text, grammar), { start: 0, group: null, ranges });
  return ranges;
}

function collectRanges(stream, { start, group, ranges }) {
  let offset = start;
  for (const token of stream) {
    if (typeof token === "string") {
      if (group) ranges.push({ group, start: offset, end: offset + token.length });
    } else {
      collectRanges([].concat(token.content), { start: offset, group: groupOf(token) ?? group, ranges });
    }
    offset += token.length;
  }
}

function groupOf(token) {
  const names = [token.type, ...[].concat(token.alias ?? [])];
  return names.map((name) => TOKEN_GROUPS[name]).find(Boolean) ?? null;
}

const editorRoots = new Set();
let paintFrame = 0;

// Colours the code in root on the next frame, along with every other editor's code, since the
// page has one set of highlights for all of them.
export function refreshCodeColours(root) {
  if (!globalThis.CSS?.highlights || !globalThis.Prism) return;
  editorRoots.add(root);
  cancelAnimationFrame(paintFrame);
  paintFrame = requestAnimationFrame(paintCodeColours);
}

function paintCodeColours() {
  const highlights = new Map(HIGHLIGHT_GROUPS.map((group) => [group, new Highlight()]));
  for (const root of editorRoots) {
    for (const firstLine of codeBlockFirstLines(root)) paintCodeBlock(codeBlockLines(firstLine), highlights);
  }
  for (const [group, highlight] of highlights) CSS.highlights.set(`code-${group}`, highlight);
}

function paintCodeBlock(lines, highlights) {
  const language = languageOf(lines);
  if (!language) return;
  const { text, pieces } = codeText(lines);
  for (const { group, start, end } of tokenRanges(text, language)) {
    const range = new Range();
    const from = positionAt(pieces, start);
    const to = positionAt(pieces, end);
    range.setStart(from.node, from.offset);
    range.setEnd(to.node, to.offset);
    highlights.get(group).add(range);
  }
}

// The block's text as Prism reads it, with "\n" for each <br> and between lines, and where each
// text node starts in it.
function codeText(lines) {
  let text = "";
  const pieces = [];
  lines.forEach((line, index) => {
    if (index > 0) text += "\n";
    const walker = document.createTreeWalker(line, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      if (node.nodeName === "BR") {
        text += "\n";
      } else if (node.nodeType === Node.TEXT_NODE) {
        pieces.push({ node, start: text.length });
        text += node.data;
      }
    }
  });
  return { text, pieces };
}

// An offset that falls on a line break moves to the start of the next text.
function positionAt(pieces, offset) {
  const piece = pieces.find(({ node, start }) => offset <= start + node.length) ?? pieces.at(-1);
  return { node: piece.node, offset: Math.min(Math.max(0, offset - piece.start), piece.node.length) };
}
