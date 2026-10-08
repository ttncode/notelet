import { createElement } from "./dom.js";
import { formatShortDate, statusFor } from "./sprint.js";

const RING_RADIUS = 16;
const GEAR_ICON = '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>';

export function renderSprintSummary(container, { stats, sprint, onSettings }) {
  container.hidden = sprint === null;
  if (sprint === null) return;
  container.setAttribute("aria-label", `${stats.completed} of ${stats.target} points completed`);
  container.replaceChildren(progressRing(stats), summaryText(stats, sprint), settingsButton(onSettings));
}

function progressRing({ completed, target }) {
  const ratio = target > 0 ? Math.min(1, completed / target) : 0;
  const circumference = 2 * Math.PI * RING_RADIUS;
  const wrap = createElement("div", "ring");
  // A zero-length round-capped stroke still paints a dot, so the arc is drawn only when there is progress.
  const arc = ratio > 0
    ? `<circle cx="20" cy="20" r="${RING_RADIUS}" class="ring-arc" stroke-dasharray="${circumference * ratio} ${circumference}" transform="rotate(-90 20 20)"/>`
    : "";
  wrap.innerHTML = `<svg viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="${RING_RADIUS}" class="ring-track"/>${arc}</svg>`;
  wrap.append(createElement("span", "ring-label", `${Math.round(ratio * 100)}%`));
  return wrap;
}

function summaryText(stats, sprint) {
  const text = createElement("div", "summary-text");
  const main = createElement("div", "summary-main");
  const state = stats.over > 0
    ? createElement("span", "summary-state over", `+${stats.over} over target`)
    : createElement("span", "summary-state", `${stats.missing} missing`);
  main.append(createElement("b", "", `${stats.completed} / ${stats.target} points`), state);
  const dayWord = stats.left === 1 ? "day" : "days";
  text.append(main, createElement("div", "summary-sub", `${formatShortDate(sprint.start)} → ${formatShortDate(sprint.end)} · Day ${stats.day} of ${stats.days} · ${stats.left} ${dayWord} left`));
  if (stats.unpointed > 0) {
    text.append(createElement("div", "summary-flag", `${stats.unpointed} ${stats.unpointed === 1 ? "ticket" : "tickets"} without points`));
  }
  return text;
}

function settingsButton(onSettings) {
  const button = createElement("button", "icon-button summary-settings");
  button.type = "button";
  button.title = "Sprint settings";
  button.setAttribute("aria-label", "Sprint settings");
  button.innerHTML = GEAR_ICON;
  button.addEventListener("click", onSettings);
  return button;
}

export function renderTicketChips(layer, options) {
  if (layer.contains(document.activeElement) && document.activeElement.tagName === "INPUT") return;
  const items = options.statuses === null ? [] : [...options.editorElement.querySelectorAll("ul.checklist > li")];
  const origin = layer.getBoundingClientRect();
  layer.replaceChildren(...items.map((item) => chipRow(item, origin, options)));
}

function chipRow(item, origin, options) {
  const row = createElement("div", "ticket-chip-row");
  const top = item.getBoundingClientRect().top - origin.top + parseFloat(getComputedStyle(item).paddingTop);
  row.style.top = `${top}px`;
  row.append(pointsChip(item, options), statusChip(item, options));
  return row;
}

function pointsChip(item, { editable, onPoints }) {
  const points = item.getAttribute("data-points");
  const chip = createElement("button", "chip chip-points", `${points ?? "–"} pt`);
  chip.type = "button";
  chip.disabled = !editable;
  chip.title = "Points";
  chip.addEventListener("click", () => {
    const input = pointsInput(item, points, onPoints);
    chip.replaceWith(input);
    input.focus();
    input.select();
  });
  return chip;
}

function pointsInput(item, points, onPoints) {
  const input = createElement("input", "chip chip-points-input");
  input.type = "text";
  input.inputMode = "decimal";
  input.size = 4;
  input.value = points ?? "";
  input.setAttribute("aria-label", "Points");
  let finished = false;
  const finish = (raw) => {
    if (finished) return;
    finished = true;
    input.blur();
    onPoints(item, raw);
  };
  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter") finish(input.value);
    if (event.key === "Escape") finish(undefined);
  });
  input.addEventListener("blur", () => finish(input.value));
  return input;
}

function statusChip(item, { statuses, editable, onStatus }) {
  const status = statusFor(statuses, item.getAttribute("data-status"));
  const chip = createElement("button", "chip chip-status", status.label);
  chip.type = "button";
  chip.disabled = !editable;
  chip.title = `Status: ${status.label} (click to change)`;
  chip.style.color = status.color;
  chip.style.background = `color-mix(in srgb, ${status.color} 18%, transparent)`;
  chip.addEventListener("click", () => onStatus(item));
  return chip;
}
