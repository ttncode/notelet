import { createElement } from "./dom.js";
import { DEFAULT_STATUSES, newStatusId, validateSprintSettings } from "./sprint.js";

const NEW_STATUS_COLOR = "#64d2ff";
const MAX_LABEL_LENGTH = 20;

export function openSprintSettings({ dialog, sprint, statuses, onSave }) {
  const field = (id) => dialog.querySelector(`#${id}`);
  const list = field("sprint-statuses");
  field("sprint-start").value = sprint.start;
  field("sprint-end").value = sprint.end;
  field("sprint-target").value = String(sprint.target);
  fillStatuses(list, statuses);
  field("sprint-error").textContent = "";
  field("sprint-add-status").onclick = () => addStatus(list);
  field("sprint-reset-statuses").onclick = () => fillStatuses(list, DEFAULT_STATUSES);
  field("sprint-cancel").onclick = () => dialog.close();
  dialog.querySelector("form").onsubmit = (event) => submit(event, { field, list, onSave });
  dialog.showModal();
}

function submit(event, { field, list, onSave }) {
  const values = {
    start: field("sprint-start").value,
    end: field("sprint-end").value,
    target: parseFloat(field("sprint-target").value),
    statuses: readStatuses(list),
  };
  const error = validateSprintSettings(values);
  if (error) {
    event.preventDefault();
    field("sprint-error").textContent = error;
    return;
  }
  onSave({ sprint: { start: values.start, end: values.end, target: values.target }, statuses: values.statuses });
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
  const item = createElement("li", "status-item");
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
  const button = (text, name, onClick) => {
    const element = createElement("button", "small-button", text);
    element.type = "button";
    element.setAttribute("aria-label", name);
    element.addEventListener("click", () => { onClick(); refreshButtons(list); });
    return element;
  };
  return [
    button("↑", "Move up", () => item.previousElementSibling?.before(item)),
    button("↓", "Move down", () => item.nextElementSibling?.after(item)),
    button("✕", "Remove status", () => item.remove()),
  ];
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
