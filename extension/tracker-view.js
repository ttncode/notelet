import { createElement } from "./dom.js";
import { formatShortDate, parsePoints, sprintStats } from "./sprint.js";
import {
  addGroup, findTask, groupPoints, insertTask, moveTask, newGroup, newTask, pointsByStatus, removeTask, stepTask, updateGroup, updateTask,
} from "./tracker.js";

const DONUT_RADIUS = 15.9155;
const DONUT_LENGTH = 100;
const NEW_GROUP_NAME = "New Group";
const GEAR_ICON = '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>';
const CHEVRON_ICON = '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>';

// The tracker is plain DOM rebuilt from note.sprint. Typing in a title or name updates the data
// without a rebuild so the caret stays put; everything else rebuilds and puts focus back on the
// control with the same data-key.
export function createTrackerView({ container, onChange, onSettings }) {
  let context = null;
  const change = (update, { focus = null, select = false } = {}) => {
    const sprint = update(context.sprint);
    if (sprint === context.sprint) return;
    context = { ...context, sprint };
    onChange(sprint, { rebuild: focus !== null });
    if (focus !== null) render(context, { focus, select });
  };
  const render = (next, { focus = activeKey(container), select = false } = {}) => {
    context = next;
    container.hidden = next === null;
    if (next === null) return container.replaceChildren();
    container.replaceChildren(...buildTracker(next));
    restoreFocus(container, { key: focus, select });
  };
  wireEvents(container, { get: () => context, change, onSettings });
  return {
    render,
    isEditing: () => container.contains(document.activeElement),
    focusTitle: () => restoreFocus(container, { key: "title", select: true }),
  };
}

function buildTracker({ sprint, statuses, today, editable }) {
  const stats = sprintStats(sprint, today);
  return [
    header(sprint, editable),
    createElement("p", "tracker-sub", subtitle(sprint, stats)),
    chart({ sprint, statuses, stats }),
    ...sprint.groups.map((group) => groupSection({ group, statuses, editable })),
    ...(editable ? [actionButton({ action: "add-group", label: "Add Group", className: "add-group" })] : []),
    createElement("h2", "tracker-notes-label", "Notes"),
  ];
}

function header(sprint, editable) {
  const head = createElement("div", "tracker-head");
  const title = editableText({ tag: "h1", className: "tracker-title", text: sprint.title ?? "", key: "title", editable });
  title.dataset.placeholder = "Task Tracking";
  title.setAttribute("aria-label", "Tracker title");
  const gear = createElement("button", "icon-button");
  gear.type = "button";
  gear.dataset.action = "settings";
  gear.title = "Tracker settings";
  gear.setAttribute("aria-label", "Tracker settings");
  gear.innerHTML = GEAR_ICON;
  head.append(title, gear);
  return head;
}

function subtitle(sprint, stats) {
  const dayWord = stats.left === 1 ? "day" : "days";
  return `${formatShortDate(sprint.start)} – ${formatShortDate(sprint.end)} · Day ${stats.day} of ${stats.days} · ${stats.left} ${dayWord} left`;
}

function chart({ sprint, statuses, stats }) {
  const card = createElement("div", "tracker-chart");
  const slices = pointsByStatus(sprint, statuses);
  card.setAttribute("role", "img");
  card.setAttribute("aria-label", `${stats.completed} of ${stats.target} points done`);
  card.append(donut({ slices, stats }), legend({ slices, stats }));
  return card;
}

function donut({ slices, stats }) {
  const total = slices.reduce((sum, slice) => sum + slice.points, 0);
  let offset = 0;
  const arcs = slices.filter((slice) => slice.points > 0).map((slice) => {
    const length = (slice.points / total) * DONUT_LENGTH;
    const arc = `<circle cx="20" cy="20" r="${DONUT_RADIUS}" fill="none" stroke="${slice.status.color}" stroke-width="5" stroke-dasharray="${length} ${DONUT_LENGTH - length}" stroke-dashoffset="${-offset}"/>`;
    offset += length;
    return arc;
  });
  const wrap = createElement("div", "donut");
  wrap.innerHTML = `<svg viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="${DONUT_RADIUS}" fill="none" stroke="var(--fill)" stroke-width="5"/>${arcs.join("")}</svg>`;
  const label = createElement("div", "donut-label");
  label.append(createElement("b", "", `${stats.completed}/${stats.target}`), createElement("span", "", "pt done"));
  wrap.append(label);
  return wrap;
}

function legend({ slices, stats }) {
  const list = createElement("div", "chart-legend");
  for (const { status, points } of slices) {
    const dot = createElement("i", "legend-dot");
    dot.style.background = status.color;
    list.append(dot, createElement("span", "", status.label), createElement("span", "legend-points", `${points} pt`));
  }
  list.append(createElement("p", "chart-note", chartNote(stats)));
  return list;
}

function chartNote(stats) {
  const progress = stats.over > 0 ? `${stats.over} pt over target` : stats.missing > 0 ? `${stats.missing} pt missing` : "Target reached";
  if (stats.unpointed === 0) return progress;
  return `${progress} · ${stats.unpointed} ${stats.unpointed === 1 ? "task" : "tasks"} without points`;
}

function groupSection({ group, statuses, editable }) {
  const section = createElement("section", "tracker-group");
  section.dataset.groupId = group.id;
  const card = createElement("div", "task-card");
  card.hidden = group.collapsed;
  card.append(...group.tasks.map((task) => taskRow({ task, statuses, editable })));
  if (editable) card.append(actionButton({ action: "add-task", label: "Add Task", className: "add-task" }));
  section.append(groupHeader(group, editable), card);
  return section;
}

function groupHeader(group, editable) {
  const head = createElement("div", "group-head");
  const name = editableText({ tag: "span", className: "group-name", text: group.name, key: `group:${group.id}`, editable });
  name.dataset.placeholder = "Group";
  name.setAttribute("aria-label", "Group name");
  const { done, total } = groupPoints(group);
  const count = `${group.tasks.length} ${group.tasks.length === 1 ? "task" : "tasks"} · ${done} / ${total} pt`;
  const toggle = createElement("button", "group-toggle");
  toggle.type = "button";
  toggle.dataset.action = "collapse";
  toggle.dataset.key = `collapse:${group.id}`;
  toggle.setAttribute("aria-expanded", String(!group.collapsed));
  toggle.setAttribute("aria-label", group.collapsed ? "Show tasks" : "Hide tasks");
  toggle.innerHTML = CHEVRON_ICON;
  head.append(name);
  if (group.counts) head.append(createElement("span", "counts-badge", "Counts"));
  head.append(createElement("span", "group-count", count), toggle);
  return head;
}

function taskRow({ task, statuses, editable }) {
  const row = createElement("div", "task-row");
  row.dataset.taskId = task.id;
  const grip = createElement("span", "task-grip", "⋮⋮");
  grip.draggable = editable;
  grip.title = "Drag to move (or Alt+↑ / Alt+↓ in the task)";
  grip.setAttribute("aria-hidden", "true");
  const title = editableText({ tag: "span", className: "task-title", text: task.title, key: `title:${task.id}`, editable });
  title.dataset.placeholder = "New task";
  title.setAttribute("aria-label", "Task");
  row.append(grip, tick(task, editable), title, pointsField(task, editable), statusField({ task, statuses, editable }));
  return row;
}

function tick(task, editable) {
  const button = createElement("button", "task-tick");
  button.type = "button";
  button.dataset.action = "tick";
  button.dataset.key = `tick:${task.id}`;
  button.disabled = !editable;
  button.setAttribute("role", "checkbox");
  button.setAttribute("aria-checked", String(task.done));
  button.setAttribute("aria-label", "Done");
  return button;
}

function pointsField(task, editable) {
  const input = createElement("input", "task-points");
  input.type = "text";
  input.inputMode = "decimal";
  input.placeholder = "+ pt";
  input.value = task.points === null ? "" : `${task.points}`;
  input.disabled = !editable;
  input.dataset.key = `points:${task.id}`;
  input.setAttribute("aria-label", "Points");
  return input;
}

function statusField({ task, statuses, editable }) {
  const select = createElement("select", "task-status");
  const current = statuses.find((status) => status.id === task.status) ?? statuses[0];
  select.append(...statuses.map((status) => {
    const option = createElement("option", "", status.label);
    option.value = status.id;
    option.selected = status === current;
    return option;
  }));
  select.style.setProperty("--status-color", current.color);
  select.disabled = !editable;
  select.dataset.key = `status:${task.id}`;
  select.setAttribute("aria-label", "Status");
  return select;
}

function editableText({ tag, className, text, key, editable }) {
  const element = createElement(tag, className, text);
  element.dataset.key = key;
  element.spellcheck = false;
  if (editable) element.contentEditable = "plaintext-only";
  return element;
}

function actionButton({ action, label, className }) {
  const button = createElement("button", `tracker-add ${className}`);
  button.type = "button";
  button.dataset.action = action;
  button.dataset.key = action;
  button.append(createElement("span", "plus", "+"), label);
  return button;
}

const activeKey = (container) => (container.contains(document.activeElement) ? document.activeElement.dataset.key ?? null : null);

function restoreFocus(container, { key, select }) {
  const element = key ? container.querySelector(`[data-key="${CSS.escape(key)}"]`) : null;
  if (!element) return;
  element.focus();
  if (!element.isContentEditable) return;
  const range = document.createRange();
  range.selectNodeContents(element);
  if (!select) range.collapse(false);
  document.getSelection().removeAllRanges();
  document.getSelection().addRange(range);
}

function wireEvents(container, handlers) {
  container.addEventListener("click", (event) => onClick(event, handlers));
  container.addEventListener("input", (event) => onTextInput(event, handlers));
  container.addEventListener("change", (event) => onFieldChange(event, handlers));
  container.addEventListener("keydown", (event) => onKeydown(event, handlers));
  wireDragging(container, handlers);
}

function onClick(event, { get, change, onSettings }) {
  const button = event.target.closest("[data-action]");
  if (!button || !get()?.editable && button.dataset.action !== "settings") return;
  const groupId = button.closest("[data-group-id]")?.dataset.groupId;
  const taskId = button.closest("[data-task-id]")?.dataset.taskId;
  const { statuses } = get();
  const actions = {
    settings: () => onSettings(),
    tick: () => change((sprint) => updateTask(sprint, { taskId, change: { done: !findTask(sprint, taskId).task.done } }), { focus: button.dataset.key }),
    collapse: () => change((sprint) => updateGroup(sprint, { groupId, change: { collapsed: !sprint.groups.find((group) => group.id === groupId).collapsed } }), { focus: button.dataset.key }),
    "add-task": () => addTaskAt({ change, statuses, groupId, index: Infinity }),
    "add-group": () => {
      const group = newGroup({ name: NEW_GROUP_NAME, counts: false });
      change((sprint) => addGroup(sprint, group), { focus: `group:${group.id}`, select: true });
    },
  };
  actions[button.dataset.action]?.();
}

function addTaskAt({ change, statuses, groupId, index }) {
  const task = newTask(statuses[0].id);
  change((sprint) => {
    const group = sprint.groups.find((candidate) => candidate.id === groupId);
    return insertTask(sprint, { groupId, index: Math.min(index, group.tasks.length), task });
  }, { focus: `title:${task.id}` });
}

const singleLine = (element) => element.textContent.replace(/\s+/g, " ").trim();

function onTextInput(event, { change }) {
  const key = event.target.dataset?.key ?? "";
  const [kind, id] = key.split(":");
  if (kind === "title" && id) change((sprint) => updateTask(sprint, { taskId: id, change: { title: singleLine(event.target) } }));
  else if (kind === "title") change((sprint) => ({ ...sprint, title: singleLine(event.target) }));
  else if (kind === "group") change((sprint) => updateGroup(sprint, { groupId: id, change: { name: singleLine(event.target) } }));
}

function onFieldChange(event, { get, change }) {
  const [kind, taskId] = (event.target.dataset?.key ?? "").split(":");
  if (kind === "status") change((sprint) => updateTask(sprint, { taskId, change: { status: event.target.value } }), { focus: event.target.dataset.key });
  if (kind !== "points") return;
  const points = parsePoints(event.target.value);
  if (points === undefined) {
    const saved = findTask(get().sprint, taskId).task.points;
    event.target.value = saved === null ? "" : `${saved}`;
    return;
  }
  // Focus may already have moved to another control, which the rebuild must keep.
  change((sprint) => updateTask(sprint, { taskId, change: { points } }), { focus: activeKey(event.currentTarget) ?? "" });
}

// Enter adds a task below in a task title; in a single-line field it just finishes editing.
function onKeydown(event, handlers) {
  if (event.isComposing) return;
  const key = event.target.dataset?.key ?? "";
  const [kind, id] = key.split(":");
  if (kind === "title" && id) {
    onTaskKeydown(event, { ...handlers, taskId: id });
    return;
  }
  if (event.key === "Enter" && (key === "title" || kind === "group" || kind === "points")) {
    event.preventDefault();
    event.target.blur();
  }
}

function onTaskKeydown(event, { get, change, taskId }) {
  const sprint = get().sprint;
  const found = findTask(sprint, taskId);
  if (event.key === "Enter") {
    event.preventDefault();
    addTaskAt({ change, statuses: get().statuses, groupId: found.group.id, index: found.index + 1 });
  } else if (event.key === "Backspace" && event.target.textContent === "") {
    event.preventDefault();
    const previous = found.group.tasks[found.index - 1];
    change((current) => removeTask(current, taskId), { focus: previous ? `title:${previous.id}` : "add-task" });
  } else if (event.altKey && (event.key === "ArrowUp" || event.key === "ArrowDown")) {
    const destination = stepTask(sprint, { taskId, step: event.key === "ArrowUp" ? -1 : 1 });
    if (!destination) return;
    event.preventDefault();
    change((current) => moveTask(current, { taskId, ...destination }), { focus: `title:${taskId}` });
  }
}

function wireDragging(container, { change }) {
  let draggedId = null;
  container.addEventListener("dragstart", (event) => {
    const row = event.target.closest?.(".task-grip") && event.target.closest(".task-row");
    if (!row) return;
    draggedId = row.dataset.taskId;
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", row.querySelector(".task-title").textContent);
    event.dataTransfer.setDragImage(row, 0, 0);
    row.classList.add("dragging");
  });
  container.addEventListener("dragover", (event) => {
    const drop = draggedId ? dropTarget(event, draggedId) : null;
    if (!drop) return;
    event.preventDefault();
    markDrop(container, drop);
  });
  container.addEventListener("drop", (event) => {
    const drop = draggedId ? dropTarget(event, draggedId) : null;
    if (!drop) return;
    event.preventDefault();
    const taskId = draggedId;
    change((sprint) => moveTask(sprint, { taskId, ...dropIndex(sprint, { taskId, drop }) }), { focus: "" });
  });
  container.addEventListener("dragend", () => {
    draggedId = null;
    clearDropMarks(container);
  });
}

function dropTarget(event, draggedId) {
  const row = event.target.closest?.(".task-row");
  if (row && row.dataset.taskId !== draggedId) {
    const box = row.getBoundingClientRect();
    return { element: row, after: event.clientY > box.top + box.height / 2, groupId: row.closest("[data-group-id]").dataset.groupId, targetId: row.dataset.taskId };
  }
  const card = event.target.closest?.(".task-card");
  if (card && !row) return { element: card, after: true, groupId: card.closest("[data-group-id]").dataset.groupId, targetId: null };
  return null;
}

function dropIndex(sprint, { taskId, drop }) {
  const tasks = sprint.groups.find((group) => group.id === drop.groupId).tasks.filter((task) => task.id !== taskId);
  if (drop.targetId === null) return { groupId: drop.groupId, index: tasks.length };
  const index = tasks.findIndex((task) => task.id === drop.targetId);
  return { groupId: drop.groupId, index: drop.after ? index + 1 : index };
}

function markDrop(container, drop) {
  clearDropMarks(container);
  drop.element.classList.add(drop.targetId === null ? "drop-into" : drop.after ? "drop-after" : "drop-before");
}

function clearDropMarks(container) {
  container.querySelectorAll(".drop-before, .drop-after, .drop-into, .dragging").forEach((element) => element.classList.remove("drop-before", "drop-after", "drop-into", "dragging"));
}
