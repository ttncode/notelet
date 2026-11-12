import { LINE_SELECTOR } from "./lines.js";

const LOZENGE_PADDING_PX = 3;
const BOUNCE_DURATION_MS = 900;
// Grow, settle, hold, then fade, like the macOS find indicator.
const BOUNCE_KEYFRAMES = [
  { transform: "scale(1)", opacity: 1 },
  { transform: "scale(1.25)", opacity: 1, offset: 0.15 },
  { transform: "scale(1)", opacity: 1, offset: 0.35 },
  { transform: "scale(1)", opacity: 1, offset: 0.75 },
  { transform: "scale(1)", opacity: 0 },
];
const REDUCED_MOTION = globalThis.matchMedia?.("(prefers-reduced-motion: reduce)");

const escapeRegExp = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const TEXT_NODE = 3;

const textNodes = (node) => (node.nodeType === TEXT_NODE ? [node] : [...node.childNodes].flatMap(textNodes));

/**
 * Every case-insensitive occurrence of `query` in the text under `root`, in document order.
 * A match never crosses from one line into the next. Each is `{ start, end }`, both
 * `{ node, offset }` positions in text nodes, ready for a Range.
 */
export function findMatches(root, query) {
  if (query === "") return [];
  const pattern = new RegExp(escapeRegExp(query), "giu");
  return lineRuns(root).flatMap((run) => matchesInRun(run, pattern));
}

// Consecutive text nodes on the same line, so a match can span bold or a link but not a line break.
function lineRuns(root) {
  return textNodes(root).reduce((runs, node) => {
    const line = node.parentElement.closest(LINE_SELECTOR);
    const last = runs.at(-1);
    if (last?.line === line) last.nodes.push(node);
    else runs.push({ line, nodes: [node] });
    return runs;
  }, []);
}

function matchesInRun(run, pattern) {
  const text = run.nodes.map((node) => node.data).join("");
  return [...text.matchAll(pattern)].map((match) => ({
    start: locate(run.nodes, { index: match.index, atEnd: false }),
    end: locate(run.nodes, { index: match.index + match[0].length, atEnd: true }),
  }));
}

// An index on the boundary of two nodes is the end of the first or the start of the second.
function locate(nodes, { index, atEnd }) {
  let nodeStart = 0;
  for (const node of nodes) {
    const nodeEnd = nodeStart + node.data.length;
    if (atEnd ? index <= nodeEnd : index < nodeEnd) return { node, offset: index - nodeStart };
    nodeStart = nodeEnd;
  }
  const last = nodes.at(-1);
  return { node: last, offset: last.data.length };
}

function toRange({ start, end }) {
  const range = document.createRange();
  range.setStart(start.node, start.offset);
  range.setEnd(end.node, end.offset);
  return range;
}

// The CSS Custom Highlight API paints matches without touching the note's HTML, so saving and undo never see them.
function paint(name, ranges) {
  if (!globalThis.CSS?.highlights) return;
  if (ranges.length === 0) CSS.highlights.delete(name);
  else CSS.highlights.set(name, new Highlight(...ranges));
}

function scrollToRange(scroller, range) {
  const match = range.getBoundingClientRect();
  if (match.height === 0) return;
  const view = scroller.getBoundingClientRect();
  if (match.top >= view.top && match.bottom <= view.bottom) return;
  scroller.scrollTop += match.top - view.top - (view.height - match.height) / 2;
}

// A copy of the matched text in a yellow lozenge pops over the match, then fades.
function bounce(range) {
  if (REDUCED_MOTION?.matches) return;
  const box = range.getBoundingClientRect();
  if (box.height === 0) return;
  const lozenge = document.createElement("span");
  lozenge.className = "find-lozenge";
  lozenge.append(range.cloneContents());
  Object.assign(lozenge.style, {
    left: `${box.left - LOZENGE_PADDING_PX}px`,
    top: `${box.top}px`,
    height: `${box.height}px`,
    lineHeight: `${box.height}px`,
    font: getComputedStyle(range.startContainer.parentElement).font,
  });
  document.body.append(lozenge);
  lozenge.animate(BOUNCE_KEYFRAMES, { duration: BOUNCE_DURATION_MS, easing: "ease-out" })
    .addEventListener("finish", () => lozenge.remove());
}

function countText(total, index) {
  if (total === 0) return "Not found";
  return `${index + 1} of ${total}`;
}

/**
 * The find bar over the note: Ctrl+F opens it, Enter and Shift+Enter step through matches, Esc
 * or Done close it and leave the current match selected. It also shows a notes search's matches
 * in the note opened from the results.
 */
export function createFind({ bar, editorElement, scroller }) {
  const input = bar.querySelector(".find-input");
  const count = bar.querySelector(".find-count");
  let ranges = [];
  let index = 0;

  const isOpen = () => !bar.hidden;
  const current = () => ranges[index] ?? null;

  function update() {
    ranges = findMatches(editorElement, input.value).map(toRange);
    index = Math.min(index, Math.max(ranges.length - 1, 0));
    paint("find-match", ranges);
    paint("find-current", ranges.length > 0 ? [current()] : []);
    count.textContent = input.value === "" ? "" : countText(ranges.length, index);
  }

  function reveal() {
    const range = current();
    if (!range) return;
    scrollToRange(scroller, range);
    bounce(range);
  }

  function step(direction) {
    if (ranges.length === 0) return;
    index = (index + direction + ranges.length) % ranges.length;
    update();
    reveal();
  }

  function open() {
    clearSearchMatches();
    bar.hidden = false;
    input.focus();
    input.select();
    update();
    reveal();
  }

  function close() {
    if (!isOpen()) return;
    bar.hidden = true;
    ranges = [];
    paint("find-match", []);
    paint("find-current", []);
  }

  // Like macOS, the editor gets back the focus with the current match selected.
  function finish() {
    const range = current();
    close();
    editorElement.focus();
    if (!range) return;
    document.getSelection().removeAllRanges();
    document.getSelection().addRange(range);
  }

  // A note just opened from the search results scrolls to its first match.
  function showSearchMatches(query) {
    const found = findMatches(editorElement, query).map(toRange);
    paint("search-match", found);
    if (found.length > 0) scrollToRange(scroller, found[0]);
  }

  function clearSearchMatches() {
    paint("search-match", []);
  }

  function onInputKeydown(event) {
    if (event.key === "Escape") {
      event.preventDefault();
      finish();
    } else if (event.key === "Enter") {
      event.preventDefault();
      step(event.shiftKey ? -1 : 1);
    }
  }

  input.addEventListener("input", () => {
    index = 0;
    update();
    reveal();
  });
  input.addEventListener("keydown", onInputKeydown);
  bar.querySelector(".find-previous").addEventListener("click", () => step(-1));
  bar.querySelector(".find-next").addEventListener("click", () => step(1));
  bar.querySelector(".find-done").addEventListener("click", finish);
  editorElement.addEventListener("input", () => {
    clearSearchMatches();
    if (isOpen()) update();
  });

  // The note under the bar changed: its matches are found again where they now are.
  const refresh = () => {
    if (isOpen()) update();
  };

  return { open, close, refresh, showSearchMatches, clearSearchMatches };
}
