import { noteLines, ownText, parseHtml } from "./model.js";

const TARGET_LINE = /^Target:\s*(\d+(?:\.\d+)?)$/i;
const POINTS = /\((\d+(?:\.\d+)?)\)/g;

export function computePoints(html) {
  const target = findTarget(html);
  if (target === null) return null;
  const items = checklistItems(html);
  const pointed = items.filter((item) => item.points !== null);
  const completed = roundPoints(pointed.filter((item) => item.checked).reduce((sum, item) => sum + item.points, 0));
  return {
    target,
    completed,
    missing: Math.max(0, roundPoints(target - completed)),
    over: Math.max(0, roundPoints(completed - target)),
    unpointed: items.length - pointed.length,
  };
}

function findTarget(html) {
  const match = noteLines(html).map((line) => line.match(TARGET_LINE)).find(Boolean);
  return match ? Number(match[1]) : null;
}

function checklistItems(html) {
  return [...parseHtml(html).body.querySelectorAll("ul.checklist > li")].map((item) => ({
    checked: item.getAttribute("data-checked") === "true",
    points: lastPoints(ownText(item)),
  }));
}

function lastPoints(text) {
  const last = [...text.matchAll(POINTS)].at(-1);
  return last ? Number(last[1]) : null;
}

const roundPoints = (value) => Math.round(value * 100) / 100;
