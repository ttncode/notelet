import { createElement } from "./dom.js";
import { DEFAULT_STATUSES, newStatusId, validateSprintSettings } from "./sprint.js";

const NEW_STATUS_COLOR = "#64d2ff";
const MAX_LABEL_LENGTH = 20;

// Groups are edited on a copy: ticking "count points" or removing a group only applies on Save.
export function openSprintSettings({ dialog, sprint, statuses, onSave }) {
  const field = (id) => dialog.querySelector(`#${id}`);
  const statusList = field("sprint-statuses");
  const groupList = field("sprint-groups");
  let groups = sprint.groups.map((group) => ({ ...group }));
  const renderGroups = () => groupList.replaceChildren(...groups.map((group) => groupRow(group, {
    onToggle: () => { groups = groups.map((other) => (other === group ? { ...other, counts: !other.counts } : other)); renderGroups(); },
    onRemove: () => { if (confirmRemoval(group)) { groups = groups.filter((other) => other !== group); renderGroups(); } },
  })));
  field("sprint-start").value = sprint.start;
  field("sprint-end").value = sprint.end;
  field("sprint-target").value = String(sprint.target);
  renderGroups();
  fillStatuses(statusList, statuses);
  field("sprint-error").textContent = "";
  field("sprint-add-status").onclick = () => addStatus(statusList);
  field("sprint-reset-statuses").onclick = () => fillStatuses(statusList, DEFAULT_STATUSES);
  field("sprint-cancel").onclick = () => dialog.close();
  dialog.querySelector("form").onsubmit = (event) => submit(event, { field, statusList, onSave, sprint, groups: () => groups });
  dialog.showModal();
}

function submit(event, { field, statusList, onSave, sprint, groups }) {
  const values = {
    start: field("sprint-start").value,
    end: field("sprint-end").value,
    target: parseFloat(field("sprint-target").value),
    statuses: readStatuses(statusList),
  };
  const error = validateSprintSettings(values);
  if (error) {
    event.preventDefault();
    field("sprint-error").textContent = error;
    return;
  }
  onSave({ sprint: { ...sprint, start: values.start, end: values.end, target: values.target, groups: groups() }, statuses: values.statuses });
}

function confirmRemoval(group) {
  if (group.tasks.length === 0) return true;
  const tasks = `${group.tasks.length} ${group.tasks.length === 1 ? "task" : "tasks"}`;
  return window.confirm(`Remove "${group.name || "Group"}" and its ${tasks} when you save?`);
}

function groupRow(group, { onToggle, onRemove }) {
  const item = createElement("li", "form-row group-option");
  const toggle = createElement("button", "check-option");
  toggle.type = "button";
  toggle.setAttribute("role", "checkbox");
  toggle.setAttribute("aria-checked", String(group.counts));
  toggle.append(createElement("span", "", group.name || "Group"), createElement("span", "check-mark", "✓"));
  toggle.addEventListener("click", onToggle);
  item.append(toggle, iconButton({ text: "−", name: `Remove ${group.name || "group"}`, className: "remove-button", onClick: onRemove }));
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
