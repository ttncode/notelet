import {
  addSprint, BACKLOG_ID, currentSprint, findSprint, findTask, insertTask, listName, monthOf, monthProgress, monthsOf, moveOpenTasks, moveTask, newTask,
  newSprint, openTasks, pointsByStatus, removeTask, setMonthGoal, sprintDays, sprintName, sprintPhase, sprintProgress, sprintsByDate, sprintsInMonth,
  tasksOf, updateTask,
} from "./board.js";
import { createElement } from "./dom.js";
import { formatMonth } from "./format.js";
import { applyShortcutTitles } from "./hotkeys.js";
import { formatShortDate, parsePoints } from "./sprint.js";

const DONUT_RADIUS = 15.9155;
const DONUT_LENGTH = 100;
const PHASE_LABELS = { active: "Active", planned: "Planned" };
const GEAR_ICON = '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>';
const NOTE_ICON = '<svg class="icon task-note-mark" viewBox="0 0 24 24" aria-label="Has a note"><path d="M6 4h9l3 3v13H6z"/><path d="M9 11h6M9 15h4"/></svg>';

// The Sprints note in three screens: a sprint (or the backlog), all sprints by month, and one
// task. The DOM is rebuilt from note.board; typing in the task title updates the data without a
// rebuild so the caret stays put, and every rebuild puts focus back on the control with the same
// data-key. The screen is per tab and starts on the current sprint. noteElement is the task
// note's editor; it is moved into the task screen rather than rebuilt, so it keeps its undo
// history and caret, and onOpenTask loads it when a task opens.
export function createBoardView({ container, noteElement, isMac, onChange, onSettings, onOpenTask }) {
  let context = null;
  let view = { screen: "list", listId: null, taskId: null, adding: false };
  const render = (next = context, { focus = activeKey(container) } = {}) => {
    context = next;
    container.hidden = next === null;
    if (next === null) return container.replaceChildren();
    view = resolveView(next, view);
    container.dataset.screen = view.screen;
    container.replaceChildren(...buildScreen(next, view, noteElement));
    applyShortcutTitles(container, isMac);
    restoreFocus(container, focus);
  };
  const change = (update, { focus = null } = {}) => {
    const board = update(context.board);
    if (board === context.board) return;
    context = { ...context, board };
    onChange(board);
    if (focus !== null) render(context, { focus });
  };
  const go = (next, focus = "") => {
    const opensTask = next.screen === "task" && next.taskId !== view.taskId;
    view = { ...view, adding: false, ...next };
    if (opensTask) onOpenTask(findTask(context.board, view.taskId).task);
    render(context, { focus });
    container.closest(".editor-scroll")?.scrollTo({ top: 0 });
  };
  const back = () => {
    if (view.screen === "list") return false;
    go({ screen: "list", taskId: null }, view.taskId ? `open:${view.taskId}` : "");
    return true;
  };
  const handlers = { get: () => context, view: () => view, change, go, back, onSettings };
  wireEvents(container, handlers);
  return {
    render,
    back,
    isEditing: () => container.contains(document.activeElement),
    screen: () => view.screen,
    viewedSprintId: () => (view.screen === "list" && view.listId !== BACKLOG_ID ? view.listId : null),
    openTaskId: () => (view.screen === "task" ? view.taskId : null),
    // A note edit saves without a rebuild, which would move the caret.
    setTaskNote: (taskId, note) => change((board) => updateTask(board, { taskId, change: { note } })),
    showAllSprints: () => go({ screen: "all", taskId: null }),
    showSprint: (sprintId) => go({ screen: "list", listId: sprintId, taskId: null }),
  };
}

function resolveView({ board, today }, view) {
  const listId = view.listId === BACKLOG_ID || findSprint(board, view.listId) ? view.listId : currentSprint(board, today)?.id ?? BACKLOG_ID;
  if (view.screen === "task" && !findTask(board, view.taskId)) return { ...view, screen: "list", listId, taskId: null };
  return { ...view, listId };
}

function buildScreen(context, view, noteElement) {
  if (view.screen === "all") return allSprintsScreen(context);
  if (view.screen === "task") return taskScreen({ ...context, noteElement }, findTask(context.board, view.taskId));
  return listScreen(context, view);
}

function listScreen(context, { listId, adding }) {
  const { board, settings, today, editable } = context;
  const sprint = findSprint(board, listId);
  const tasks = tasksOf(board, listId);
  return [
    listHeader({ title: listName(board, listId), withSettings: Boolean(sprint) }),
    createElement("p", "board-sub", sprint ? sprintSubtitle(sprint, today) : backlogSubtitle(tasks)),
    ...(sprint ? [chart({ sprint, settings })] : []),
    ...(sprint && editable ? completeBanner({ board, sprint, settings, today }) : []),
    taskList({ tasks, statuses: settings.statuses, editable, adding }),
    ...(sprint ? [monthCard({ board, sprint, settings, editable })] : []),
    otherLists({ board, listId, settings, today }),
    createElement("h2", "board-notes-label", "Notes"),
  ];
}

function listHeader({ title, withSettings }) {
  const head = createElement("div", "board-head");
  head.append(createElement("h1", "board-title", title));
  if (!withSettings) return head;
  const gear = button({ className: "icon-button", action: "settings", title: "Sprint settings ({trackerSettings})" });
  gear.setAttribute("aria-label", "Sprint settings");
  gear.innerHTML = GEAR_ICON;
  head.append(gear);
  return head;
}

function sprintSubtitle(sprint, today) {
  const { days, day, left } = sprintDays(sprint, today);
  return `${formatShortDate(sprint.start)} – ${formatShortDate(sprint.end)} · Day ${day} of ${days} · ${left} ${left === 1 ? "day" : "days"} left`;
}

const backlogSubtitle = (tasks) => `${taskCount(tasks.length)} not planned into a sprint`;

function chart({ sprint, settings }) {
  const progress = sprintProgress(sprint, settings.sprintCounts);
  const slices = pointsByStatus(sprint.tasks, settings.statuses);
  const card = createElement("div", "board-chart");
  card.setAttribute("role", "img");
  card.setAttribute("aria-label", `${progress.done} of ${progress.goal} points done`);
  card.append(donut({ slices, progress }), legend({ slices, progress }));
  return card;
}

function donut({ slices, progress }) {
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
  label.append(createElement("b", "", `${progress.done}/${progress.goal}`), createElement("span", "", "pt done"));
  wrap.append(label);
  return wrap;
}

function legend({ slices, progress }) {
  const list = createElement("div", "chart-legend");
  for (const { status, points } of slices) {
    const dot = createElement("i", "legend-dot");
    dot.style.background = status.color;
    list.append(dot, createElement("span", "", status.label), createElement("span", "legend-points", `${points} pt`));
  }
  const note = createElement("p", "chart-note", goalText(progress));
  note.classList.toggle("goal-met", progress.toGo === 0);
  if (progress.unpointed > 0) note.append(` · ${progress.unpointed} ${progress.unpointed === 1 ? "task" : "tasks"} without points`);
  list.append(note);
  return list;
}

function goalText({ toGo, over }) {
  if (over > 0) return `Goal met ✓ · ${over} pt over`;
  return toGo > 0 ? `${toGo} pt to go` : "Goal met ✓";
}

// Once a sprint is over, its unfinished tasks can move on in one step.
function completeBanner({ board, sprint, settings, today }) {
  const open = openTasks(sprint.tasks, settings.sprintCounts);
  if (sprintPhase(sprint, today) !== "closed" || open.length === 0) return [];
  const next = sprintsByDate(board).filter((other) => other.start > sprint.end).at(-1);
  const target = next ? { id: next.id, name: sprintName(next) } : { id: BACKLOG_ID, name: "Backlog" };
  const banner = createElement("div", "board-banner");
  const move = button({ className: "text-button", action: "move-open", text: `Move to ${target.name}` });
  move.dataset.listId = target.id;
  banner.append(createElement("span", "", `Sprint ended with ${open.length} open ${open.length === 1 ? "task" : "tasks"}.`), move);
  return [banner];
}

function taskList({ tasks, statuses, editable, adding }) {
  const card = createElement("div", "task-card");
  card.append(...tasks.map((task) => taskRow({ task, statuses, editable })));
  if (tasks.length === 0 && !adding) card.append(createElement("p", "task-empty", "No tasks yet"));
  if (editable) card.append(adding ? newTaskField() : addTaskButton());
  return card;
}

function taskRow({ task, statuses, editable }) {
  const row = createElement("div", "task-row");
  row.dataset.taskId = task.id;
  row.draggable = editable;
  const open = button({ className: "task-open", action: "open-task", title: "Open task (Enter) · drag or Alt+↑ / Alt+↓ to move" });
  open.dataset.key = `open:${task.id}`;
  open.append(createElement("span", "task-title", task.title || "Untitled task"));
  if (task.note) open.insertAdjacentHTML("beforeend", NOTE_ICON);
  row.append(open, pointsField({ task, editable, key: `points:${task.id}` }), statusField({ task, statuses, editable, key: `status:${task.id}` }));
  return row;
}

function addTaskButton() {
  const add = button({ className: "board-add", action: "add-task", title: "Add task" });
  add.dataset.key = "add-task";
  add.append(createElement("span", "plus", "+"), "Add Task");
  return add;
}

function newTaskField() {
  const input = createElement("input", "task-new");
  input.type = "text";
  input.placeholder = "New task, then Enter";
  input.dataset.key = "new-task";
  input.setAttribute("aria-label", "New task");
  input.title = "Enter adds it and starts the next · Esc stops";
  return input;
}

function pointsField({ task, editable, key }) {
  const input = createElement("input", "task-points");
  input.type = "text";
  input.inputMode = "decimal";
  input.placeholder = "+ pt";
  input.value = task.points === null ? "" : `${task.points}`;
  input.disabled = !editable;
  input.dataset.key = key;
  input.setAttribute("aria-label", "Points");
  return input;
}

function statusField({ task, statuses, editable, key }) {
  const select = createElement("select", "task-status");
  const current = statuses.find((status) => status.id === task.status) ?? statuses[0];
  select.append(...statuses.map((status) => option({ value: status.id, label: status.label, selected: status === current })));
  select.style.setProperty("--status-color", current.color);
  select.disabled = !editable;
  select.dataset.key = key;
  select.setAttribute("aria-label", "Status");
  return select;
}

function monthCard({ board, sprint, settings, editable }) {
  const month = monthOf(sprint);
  const progress = monthProgress(board, { month, counts: settings.monthCounts });
  const card = createElement("div", "month-card");
  const head = createElement("div", "month-head");
  head.append(createElement("b", "", formatMonth(month)), monthGoalField({ board, month, progress, editable }));
  const note = createElement("p", "month-note", `${progress.done} pt done · ${goalText(progress)} · ${progress.sprintCount} ${progress.sprintCount === 1 ? "sprint" : "sprints"}`);
  note.classList.toggle("goal-met", progress.toGo === 0);
  card.append(head, goalBar(progress), note);
  return card;
}

function monthGoalField({ board, month, progress, editable }) {
  const label = createElement("label", "month-goal", "Goal ");
  const input = createElement("input");
  input.type = "text";
  input.inputMode = "decimal";
  input.value = month in board.monthGoals ? `${board.monthGoals[month]}` : "";
  input.placeholder = `${progress.autoGoal}`;
  input.disabled = !editable;
  input.dataset.key = `month-goal:${month}`;
  input.title = "Empty uses the sprints' goals added up";
  label.append(input, " pt");
  return label;
}

function goalBar({ goal, done }) {
  const bar = createElement("div", "goal-bar");
  const fill = createElement("span");
  fill.style.width = `${goal > 0 ? Math.min(100, (done / goal) * 100) : 100}%`;
  bar.append(fill);
  return bar;
}

function otherLists({ board, listId, settings, today }) {
  const byDate = sprintsByDate(board);
  const index = byDate.findIndex((sprint) => sprint.id === listId);
  const neighbours = index === -1 ? [currentSprint(board, today)].filter(Boolean) : [byDate[index - 1], byDate[index + 1]].filter(Boolean);
  const rows = [
    ...neighbours.map((sprint) => listRow({ listId: sprint.id, label: sprintName(sprint), detail: sprintDetail({ sprint, settings, today }) })),
    ...(listId === BACKLOG_ID ? [] : [backlogRow(board)]),
    navRow({ action: "all-sprints", label: "All Sprints" }),
  ];
  const section = createElement("section", "other-lists");
  const card = createElement("div", "nav-card");
  card.append(...rows);
  section.append(createElement("h3", "board-label", "Other Lists"), card);
  return section;
}

// An open sprint shows where it stands; a finished one shows how it ended.
function sprintDetail({ sprint, settings, today }) {
  const phase = PHASE_LABELS[sprintPhase(sprint, today)];
  if (phase) return phase;
  const { done, goal, toGo } = sprintProgress(sprint, settings.sprintCounts);
  return `${done} / ${goal} pt${toGo === 0 ? " ✓" : ""}`;
}

const taskCount = (count) => `${count} ${count === 1 ? "task" : "tasks"}`;

const backlogRow = (board) => listRow({ listId: BACKLOG_ID, label: "Backlog", detail: taskCount(board.backlog.length) });

function listRow({ listId, label, detail }) {
  const row = navRow({ action: "open-list", label, detail });
  row.dataset.listId = listId;
  return row;
}

function navRow({ action, label, detail = "" }) {
  const row = button({ className: "nav-row", action });
  row.dataset.key = `${action}:${label}`;
  row.append(createElement("span", "nav-label", label), createElement("span", "nav-detail", `${detail} ›`.trim()));
  return row;
}

function allSprintsScreen({ board, settings, today, editable }) {
  const bar = navBar({ title: "All Sprints", end: editable ? button({ className: "text-button", action: "new-sprint", text: "+ New Sprint", title: "New sprint" }) : null });
  const months = monthsOf(board).map((month) => monthSection({ board, month, settings, today }));
  const empty = board.sprints.length === 0 ? [createElement("p", "task-empty", "No sprints yet. New Sprint starts one on the next working day.")] : [];
  const backlog = createElement("div", "nav-card");
  backlog.append(backlogRow(board));
  return [bar, ...empty, ...months, backlog];
}

function monthSection({ board, month, settings, today }) {
  const progress = monthProgress(board, { month, counts: settings.monthCounts });
  const section = createElement("section", "month-section");
  const head = createElement("div", "month-head");
  const summary = createElement("span", "month-summary", `${progress.done} / ${progress.goal} pt · ${goalText(progress)}`);
  summary.classList.toggle("goal-met", progress.toGo === 0);
  head.append(createElement("h3", "board-label", formatMonth(month)), summary);
  const card = createElement("div", "nav-card");
  card.append(...sprintsInMonth(board, month).map((sprint) => sprintRow({ sprint, settings, today })));
  section.append(head, card);
  return section;
}

function sprintRow({ sprint, settings, today }) {
  const progress = sprintProgress(sprint, settings.sprintCounts);
  const row = listRow({ listId: sprint.id, label: sprintName(sprint), detail: `${progress.done} / ${progress.goal} pt${progress.toGo === 0 ? " ✓" : ""}` });
  const phase = PHASE_LABELS[sprintPhase(sprint, today)];
  if (phase) row.querySelector(".nav-label").append(" ", createElement("span", `phase phase-${sprintPhase(sprint, today)}`, phase));
  row.append(goalBar(progress));
  return row;
}

function taskScreen({ board, settings, editable, noteElement }, { listId, task }) {
  const bar = navBar({ title: "Task", back: `‹ ${listName(board, listId)}` });
  const titleCard = createElement("div", "form-card");
  titleCard.append(titleField({ task, editable }));
  const fields = createElement("div", "form-card");
  fields.append(
    formRow("Points", pointsField({ task, editable, key: "detail-points" })),
    formRow("Status", statusField({ task, statuses: settings.statuses, editable, key: "detail-status" })),
    formRow("Sprint", listField({ board, listId, editable })),
  );
  const remove = createElement("div", "form-card");
  if (editable) remove.append(button({ className: "form-row form-button menu-danger", action: "delete-task", text: "Delete Task" }));
  const note = createElement("div", "form-card task-note-card");
  note.append(noteElement);
  return [bar, titleCard, fields, createElement("h3", "form-head", "Note"), note, ...(editable ? [remove] : [])];
}

function titleField({ task, editable }) {
  const input = createElement("input", "task-detail-title");
  input.type = "text";
  input.value = task.title;
  input.placeholder = "Task title";
  input.disabled = !editable;
  input.dataset.key = "detail-title";
  input.setAttribute("aria-label", "Task title");
  return input;
}

function listField({ board, listId, editable }) {
  const select = createElement("select", "task-list");
  const lists = [...sprintsByDate(board).map((sprint) => ({ id: sprint.id, name: sprintName(sprint) })), { id: BACKLOG_ID, name: "Backlog" }];
  select.append(...lists.map((list) => option({ value: list.id, label: list.name, selected: list.id === listId })));
  select.disabled = !editable;
  select.dataset.key = "detail-list";
  select.setAttribute("aria-label", "Sprint");
  return select;
}

function formRow(label, control) {
  const row = createElement("label", "form-row");
  row.append(label, control);
  return row;
}

function navBar({ title, back = "‹ Back", end = null }) {
  const bar = createElement("div", "board-nav");
  const backButton = button({ className: "text-button board-back", action: "back", text: back, title: "Back (Esc)" });
  backButton.dataset.key = "back";
  bar.append(backButton, createElement("h2", "board-nav-title", title), end ?? createElement("span"));
  return bar;
}

function button({ className, action, text = "", title = "" }) {
  const element = createElement("button", className, text);
  element.type = "button";
  element.dataset.action = action;
  if (title) element.dataset.title = title;
  return element;
}

function option({ value, label, selected }) {
  const element = createElement("option", "", label);
  element.value = value;
  element.selected = selected;
  return element;
}

const activeKey = (container) => (container.contains(document.activeElement) ? document.activeElement.dataset.key ?? null : null);

function restoreFocus(container, key) {
  if (!key) return;
  container.querySelector(`[data-key="${CSS.escape(key)}"]`)?.focus();
}

function wireEvents(container, handlers) {
  container.addEventListener("click", (event) => onClick(event, handlers));
  container.addEventListener("input", (event) => onInput(event, handlers));
  container.addEventListener("change", (event) => onFieldChange(event, handlers));
  container.addEventListener("keydown", (event) => onKeydown(event, handlers));
  wireDragging(container, handlers);
}

function onClick(event, handlers) {
  const target = event.target.closest("[data-action]");
  if (!target) return;
  const { get, view, change, go, back, onSettings } = handlers;
  const { board, settings, today, editable } = get();
  const taskId = target.closest("[data-task-id]")?.dataset.taskId;
  const actions = {
    settings: () => onSettings(view().listId),
    back,
    "open-task": () => go({ screen: "task", taskId }, "detail-title"),
    "open-list": () => go({ screen: "list", listId: target.dataset.listId, taskId: null }),
    "all-sprints": () => go({ screen: "all", taskId: null }),
    "new-sprint": () => {
      if (!editable) return;
      const sprint = newSprint(board, today);
      change((current) => addSprint(current, sprint));
      go({ screen: "list", listId: sprint.id, taskId: null });
    },
    "add-task": () => editable && go({ adding: true }, "new-task"),
    "move-open": () => editable && change((current) => moveOpenTasks(current, { sprintId: view().listId, listId: target.dataset.listId, counts: settings.sprintCounts }), { focus: "" }),
    "delete-task": () => editable && deleteTask({ board, taskId: view().taskId, change, go }),
  };
  actions[target.dataset.action]?.();
}

function deleteTask({ board, taskId, change, go }) {
  const { task } = findTask(board, taskId);
  if ((task.title || task.note) && !window.confirm(`Delete "${task.title || "this task"}"? This can't be undone.`)) return;
  change((current) => removeTask(current, taskId));
  go({ screen: "list", taskId: null });
}

function onInput(event, { view, change }) {
  if (event.target.dataset.key !== "detail-title") return;
  const title = event.target.value.replace(/\s+/g, " ").trim();
  change((board) => updateTask(board, { taskId: view().taskId, change: { title } }));
}

function onFieldChange(event, { get, view, change, go }) {
  const [kind, id] = (event.target.dataset.key ?? "").split(":");
  const taskId = id ?? view().taskId;
  const value = event.target.value;
  const keep = event.target.dataset.key;
  if (kind === "status" || kind === "detail-status") change((board) => updateTask(board, { taskId, change: { status: value } }), { focus: keep });
  else if (kind === "points" || kind === "detail-points") changePoints({ event, get, change, taskId, focus: activeKey(event.currentTarget) ?? "" });
  else if (kind === "month-goal") changeMonthGoal({ event, change, month: id });
  else if (kind === "detail-list") {
    change((board) => moveTask(board, { taskId, listId: value }));
    go({ listId: value }, keep);
  }
}

// Focus may already have moved to another control, which the rebuild must keep.
function changePoints({ event, get, change, taskId, focus }) {
  const points = parsePoints(event.target.value);
  if (points === undefined) {
    const saved = findTask(get().board, taskId).task.points;
    event.target.value = saved === null ? "" : `${saved}`;
    return;
  }
  change((board) => updateTask(board, { taskId, change: { points } }), { focus });
}

function changeMonthGoal({ event, change, month }) {
  const goal = parsePoints(event.target.value);
  if (goal === undefined) return;
  change((board) => setMonthGoal(board, { month, goal }), { focus: activeKey(event.currentTarget) ?? "" });
}

function onKeydown(event, handlers) {
  if (event.isComposing) return;
  const key = event.target.dataset?.key ?? "";
  if (key === "new-task") return onNewTaskKeydown(event, handlers);
  if (key.startsWith("open:") && event.altKey) return onTaskStepKeydown(event, { ...handlers, taskId: key.slice("open:".length) });
  if (event.key === "Enter" && event.target.matches("input")) {
    event.preventDefault();
    event.target.blur();
    return;
  }
  // An open menu takes Esc for itself.
  if (event.key === "Escape" && handlers.view().screen !== "list" && !document.querySelector(":popover-open")) {
    event.preventDefault();
    handlers.back();
  }
}

// Enter adds the task and keeps the field for the next one; Esc or an empty Enter stops.
function onNewTaskKeydown(event, { get, view, change, go }) {
  if (event.key === "Escape" || (event.key === "Enter" && event.target.value.trim() === "")) {
    event.preventDefault();
    go({ adding: false }, "add-task");
    return;
  }
  if (event.key !== "Enter") return;
  event.preventDefault();
  const task = newTask({ title: event.target.value.replace(/\s+/g, " ").trim(), status: get().settings.statuses[0].id });
  change((board) => insertTask(board, { listId: view().listId, index: Infinity, task }), { focus: "new-task" });
}

function onTaskStepKeydown(event, { get, view, change, taskId }) {
  const step = { ArrowUp: -1, ArrowDown: 1 }[event.key];
  if (!step) return;
  const { index } = findTask(get().board, taskId);
  const target = index + step;
  if (target < 0 || target >= tasksOf(get().board, view().listId).length) return;
  event.preventDefault();
  change((board) => moveTask(board, { taskId, listId: view().listId, index: target }), { focus: `open:${taskId}` });
}

// A row drags from anywhere except its fields; it drops between rows of the list or onto
// another sprint or the backlog under Other Lists.
function wireDragging(container, { change }) {
  let draggedId = null;
  container.addEventListener("pointerdown", (event) => {
    const row = event.target.closest?.(".task-row");
    if (row) row.draggable = !event.target.closest("input, select");
  });
  container.addEventListener("dragstart", (event) => {
    const row = event.target.closest?.(".task-row");
    if (!row) return;
    draggedId = row.dataset.taskId;
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", row.querySelector(".task-title").textContent);
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
    change((board) => moveTask(board, { taskId, ...dropPlace(board, { taskId, drop }) }), { focus: "" });
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
    return { element: row, after: event.clientY > box.top + box.height / 2, targetId: row.dataset.taskId, listId: null };
  }
  const list = event.target.closest?.(".nav-row[data-list-id]");
  return list ? { element: list, after: true, targetId: null, listId: list.dataset.listId } : null;
}

function dropPlace(board, { taskId, drop }) {
  if (drop.listId) return { listId: drop.listId };
  const { listId } = findTask(board, drop.targetId);
  const index = tasksOf(board, listId).filter((task) => task.id !== taskId).findIndex((task) => task.id === drop.targetId);
  return { listId, index: drop.after ? index + 1 : index };
}

function markDrop(container, drop) {
  clearDropMarks(container);
  drop.element.classList.add(drop.listId ? "drop-into" : drop.after ? "drop-after" : "drop-before");
}

function clearDropMarks(container) {
  container.querySelectorAll(".drop-before, .drop-after, .drop-into, .dragging").forEach((element) => element.classList.remove("drop-before", "drop-after", "drop-into", "dragging"));
}
