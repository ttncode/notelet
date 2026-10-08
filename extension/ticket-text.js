const ELEMENT_NODE = 1;
const TEXT_NODE = 3;
const LIST_TAGS = new Set(["UL", "OL"]);
const POINTS_TOKEN = /\((\d+(?:[.,]\d+)?)\)/g;
const WORD_TOKEN = /\(([^()]+)\)/g;

// Moves "(5)" and "(In QC)" written at the end of a ticket line into data-points and
// data-status, so older plain-text tickets become chips.
export function convertTicket(item, statuses) {
  const nodes = ownTextNodes(item);
  const points = takeLastMatch(nodes, POINTS_TOKEN);
  const status = takeStatus(nodes, statuses);
  nodes.forEach((node) => { node.textContent = node.textContent.replace(/[ \t]{2,}/g, " "); });
  if (nodes.length > 0) nodes.at(-1).textContent = nodes.at(-1).textContent.trimEnd();
  if (points !== null) item.setAttribute("data-points", String(Number(points.replace(",", "."))));
  item.setAttribute("data-status", (status ?? statuses[0]).id);
}

function ownTextNodes(element) {
  return [...element.childNodes].flatMap((node) => {
    if (node.nodeType === TEXT_NODE) return [node];
    if (node.nodeType !== ELEMENT_NODE || LIST_TAGS.has(node.tagName)) return [];
    return ownTextNodes(node);
  });
}

function takeLastMatch(nodes, pattern) {
  for (const node of [...nodes].reverse()) {
    const match = [...node.textContent.matchAll(pattern)].at(-1);
    if (match) {
      cutMatch(node, match);
      return match[1];
    }
  }
  return null;
}

function takeStatus(nodes, statuses) {
  const normalize = (label) => label.toLowerCase().replace(/\s+/g, "");
  for (const node of nodes) {
    for (const match of node.textContent.matchAll(WORD_TOKEN)) {
      const status = statuses.find((candidate) => normalize(candidate.label) === normalize(match[1]));
      if (status) {
        cutMatch(node, match);
        return status;
      }
    }
  }
  return null;
}

function cutMatch(node, match) {
  node.textContent = node.textContent.slice(0, match.index) + node.textContent.slice(match.index + match[0].length);
}
