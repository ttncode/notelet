import { createElement } from "./dom.js";
import { sprintName } from "./board.js";
import { DEFAULT_STATUSES, newStatusId, validateSprintSettings } from "./sprint.js";

const NEW_STATUS_COLOR = "#64d2ff";
const MAX_LABEL_LENGTH = 20;

// sprint is null when the sheet opens from the backlog; then only the shared settings show.
// Ticks in the two count lists follow the statuses as they are edited above Save.
export function openSprintSettings({ dialog, sprint, settings, onSave, onDelete }) {
  const field = (id) => dialog.querySelector(`#${id}`);
  const statusList = field("sprint-statuses");
  const counts = { sprint: new Set(settings.sprintCounts), month: new Set(settings.monthCounts) };
  const renderCounts = () => {
    const statuses = readStatuses(statusList);
    field("sprint-counts").replaceChildren(...statuses.map((status) => countRow({ status, ids: counts.sprint, onToggle: renderCounts })));
    field("month-counts").replaceChildren(...statuses.map((status) => countRow({ status, ids: counts.month, onToggle: renderCounts })));
  };
  fillSprintFields(field, sprint);
  fillStatuses(statusList, settings.statuses);
  renderCounts();
  field("sprint-error").textContent = "";
  statusList.oninput = renderCounts;
  statusList.onclick = renderCounts;
  field("sprint-add-status").onclick = () => { addStatus(statusList); renderCounts(); };
  field("sprint-reset-statuses").onclick = () => { fillStatuses(statusList, DEFAULT_STATUSES); renderCounts(); };
  field("sprint-cancel").onclick = () => dialog.close();
  field("sprint-delete").onclick = () => {
    if (!confirmDelete(sprint)) return;
    dialog.close();
    onDelete(sprint.id);
  };
  dialog.querySelector("form").onsubmit = (event) => submit(event, { field, statusList, counts, sprint, onSave });
  dialog.showModal();
}

function fillSprintFields(field, sprint) {
  field("sprint-fields").hidden = sprint === null;
  field("sprint-delete-card").hidden = sprint === null;
  field("sprint-settings-title").textContent = sprint ? "Sprint Settings" : "Settings";
  if (!sprint) return;
  field("sprint-name").value = sprint.name;
  field("sprint-name").placeholder = sprintName({ ...sprint, name: "" });
  field("sprint-start").value = sprint.start;
  field("sprint-end").value = sprint.end;
  field("sprint-goal").value = String(sprint.goal);
}

function submit(event, { field, statusList, counts, sprint, onSave }) {
  const statuses = readStatuses(statusList);
  const kept = (ids) => statuses.map((status) => status.id).filter((id) => ids.has(id));
  const values = {
    sprint: sprint && { name: field("sprint-name").value.trim(), start: field("sprint-start").value, end: field("sprint-end").value, goal: parseFloat(field("sprint-goal").value) },
    statuses,
    sprintCounts: kept(counts.sprint),
    monthCounts: kept(counts.month),
  };
  const error = validateSprintSettings(values);
  if (error) {
    event.preventDefault();
    field("sprint-error").textContent = error;
    return;
  }
  const { sprint: sprintChange, ...settings } = values;
  onSave({ sprintId: sprint?.id ?? null, sprintChange, settings });
}

function confirmDelete(sprint) {
  const tasks = sprint.tasks.length;
  if (tasks === 0) return true;
  return window.confirm(`Delete "${sprintName(sprint)}"? Its ${tasks} ${tasks === 1 ? "task moves" : "tasks move"} to the Backlog.`);
}

function countRow({ status, ids, onToggle }) {
  const item = createElement("li", "form-row");
  const toggle = createElement("button", "check-option");
  toggle.type = "button";
  toggle.setAttribute("role", "checkbox");
  toggle.setAttribute("aria-checked", String(ids.has(status.id)));
  toggle.append(createElement("span", "", status.label || "Status"), createElement("span", "check-mark", "✓"));
  toggle.addEventListener("click", () => {
    if (ids.has(status.id)) ids.delete(status.id);
    else ids.add(status.id);
    onToggle();
  });
  item.append(toggle);
  return item;
}

function readStatuses(list) {
  return [...list.children].map((item) => ({
    id: item.dataset.statusId,
    color: item.querySelector('input[type="color"]').value,
    label: item.querySelector('input[type="text"]').value.trim(),
  }));
}

function fillStatuses(list, statuses) {
  list.replaceChildren(...statuses.map((status) => statusItem(list, status)));
  refreshButtons(list);
}

function addStatus(list) {
  list.append(statusItem(list, { id: newStatusId(), label: "New status", color: NEW_STATUS_COLOR }));
  refreshButtons(list);
  list.lastElementChild.querySelector('input[type="text"]').select();
}

function statusItem(list, status) {
  const item = createElement("li", "form-row status-item");
  item.dataset.statusId = status.id;
  const color = createElement("input");
  color.type = "color";
  color.value = status.color;
  color.setAttribute("aria-label", "Colour");
  const label = createElement("input");
  label.type = "text";
  label.value = status.label;
  label.maxLength = MAX_LABEL_LENGTH;
  label.setAttribute("aria-label", "Label");
  item.append(color, label, ...moveButtons(list, item));
  return item;
}

function moveButtons(list, item) {
  const button = (text, name, change, className) => iconButton({ text, name, className, onClick: () => { change(); refreshButtons(list); } });
  return [
    button("↑", "Move up", () => item.previousElementSibling?.before(item)),
    button("↓", "Move down", () => item.nextElementSibling?.after(item)),
    button("−", "Remove status", () => item.remove(), "remove-button"),
  ];
}

function iconButton({ text, name, className = "", onClick }) {
  const element = createElement("button", `row-button ${className}`.trim(), text);
  element.type = "button";
  element.title = name;
  element.setAttribute("aria-label", name);
  element.addEventListener("click", onClick);
  return element;
}

function refreshButtons(list) {
  const items = [...list.children];
  items.forEach((item, index) => {
    const [up, down, remove] = item.querySelectorAll("button");
    up.disabled = index === 0;
    down.disabled = index === items.length - 1;
    remove.disabled = items.length <= 1;
  });
}
