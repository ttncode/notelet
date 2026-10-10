import { createElement } from "./dom.js";
import { HOTKEYS, comboOf, defaultHotkey, hotkeyLabel, isEditable, isModifierOnly, reservedReason, sameCombo } from "./hotkeys.js";

// The Keyboard Shortcuts sheet, grouped as in HOTKEYS. Clicking a key records the next key
// combination for it; Esc cancels and Backspace removes the key. A key another shortcut uses
// asks before taking it over. Every change goes straight to onChange(keys) with the full set
// of changed keys, so Done only closes the sheet.
export function openShortcuts({ dialog, isMac, version, keys, onChange }) {
  let current = { ...keys };
  let recording = null;
  let message = null;
  const update = (next) => {
    current = next;
    onChange(current);
  };
  const render = () => renderGroups(dialog, { isMac, keys: current, recording, message });
  const stopRecording = (nextMessage = null) => {
    recording = null;
    message = nextMessage;
    render();
  };
  dialog.querySelector(".help-groups").onclick = (event) => {
    const target = event.target.closest("[data-shortcut-action]");
    if (!target) return;
    const id = target.closest("[data-hotkey-id]").dataset.hotkeyId;
    const actions = {
      record: () => { recording = id; message = null; render(); },
      reset: () => { update(withoutKey(current, id)); stopRecording(); },
      replace: () => { update({ ...withKey(current, message.id, message.combo), [message.otherId]: null }); stopRecording(); },
      cancel: () => stopRecording(),
    };
    actions[target.dataset.shortcutAction]();
    dialog.querySelector(`[data-hotkey-id="${id}"] .key-button`)?.focus();
  };
  dialog.onkeydown = (event) => {
    if (recording === null) return;
    event.preventDefault();
    event.stopPropagation();
    const result = recordKey(event, { id: recording, keys: current, isMac });
    if (result.keys) update(result.keys);
    if (result.wait) return;
    stopRecording(result.message);
  };
  dialog.querySelector("#reset-shortcuts").onclick = () => {
    if (Object.keys(current).length === 0 || !window.confirm("Reset every shortcut to its default?")) return;
    update({});
    stopRecording();
  };
  dialog.onclose = () => { recording = null; message = null; };
  dialog.querySelector(".help-version").textContent = `Notelet ${version}`;
  render();
  dialog.showModal();
}

// Returns the new keys, a message to show, or wait: true while only modifiers are held.
function recordKey(event, { id, keys, isMac }) {
  if (isModifierOnly(event)) return { wait: true };
  if (event.key === "Escape") return {};
  if (event.key === "Backspace" || event.key === "Delete") return { keys: { ...keys, [id]: null } };
  const combo = comboOf(event, isMac);
  const reason = reservedReason(combo, isMac);
  if (reason) return { message: { id, text: reason } };
  const other = hotkeysWith(keys).find((hotkey) => hotkey.id !== id && sameCombo(hotkey, combo));
  if (other && !isEditable(other)) return { message: { id, text: `${hotkeyLabel(combo, isMac)} is ${other.label}, which Chrome handles.` } };
  if (other) return { message: { id, combo, otherId: other.id, text: `${hotkeyLabel(combo, isMac)} is used by ${other.label}.` } };
  return { keys: withKey(keys, id, combo) };
}

// A key set back to the default is dropped, so only real changes are stored.
function withKey(keys, id, combo) {
  return sameCombo(defaultHotkey(id), combo) ? withoutKey(keys, id) : { ...keys, [id]: combo };
}

const withoutKey = (keys, id) => Object.fromEntries(Object.entries(keys).filter(([key]) => key !== id));

function renderGroups(dialog, { isMac, keys, recording, message }) {
  const groups = new Map();
  for (const hotkey of hotkeysWith(keys)) groups.set(hotkey.group, [...(groups.get(hotkey.group) ?? []), hotkey]);
  const parts = [...groups].flatMap(([group, hotkeys]) => {
    const body = createElement("tbody", "");
    body.append(...hotkeys.flatMap((hotkey) => shortcutRows(hotkey, { isMac, changed: Object.hasOwn(keys, hotkey.id), recording, message })));
    const table = createElement("table", "");
    const card = createElement("div", "form-card");
    table.append(body);
    card.append(table);
    return [createElement("h3", "form-head", group), card];
  });
  dialog.querySelector(".help-groups").replaceChildren(...parts);
  dialog.querySelector("#reset-shortcuts").disabled = Object.keys(keys).length === 0;
}

function hotkeysWith(keys) {
  return HOTKEYS.map((hotkey) => {
    if (!Object.hasOwn(keys, hotkey.id)) return hotkey;
    return { ...hotkey, mod: false, alt: false, shift: false, ...(keys[hotkey.id] ?? { code: null }) };
  });
}

function shortcutRows(hotkey, { isMac, changed, recording, message }) {
  const row = createElement("tr");
  row.dataset.hotkeyId = hotkey.id;
  row.append(createElement("td", "", hotkey.label), keyCell(hotkey, { isMac, changed, isRecording: recording === hotkey.id }));
  if (message?.id !== hotkey.id) return [row];
  return [row, messageRow(hotkey.id, message)];
}

function keyCell(hotkey, { isMac, changed, isRecording }) {
  const cell = createElement("td", "kbd");
  const label = hotkeyLabel(hotkey, isMac) || "None";
  if (!isEditable(hotkey)) {
    cell.append(createElement("span", "key-fixed", label));
    cell.title = "Chrome handles this key";
    return cell;
  }
  const key = actionButton({ className: `key-button${changed ? " key-changed" : ""}${isRecording ? " key-recording" : ""}`, action: "record", text: isRecording ? "Press keys…" : label });
  key.title = isRecording ? "Esc cancels · Backspace removes the key" : "Change the key";
  cell.append(key);
  if (changed) {
    const reset = actionButton({ className: "key-reset", action: "reset", text: "↺" });
    reset.title = `Reset to ${hotkeyLabel(defaultHotkey(hotkey.id), isMac)}`;
    reset.setAttribute("aria-label", reset.title);
    cell.prepend(reset);
  }
  return cell;
}

function messageRow(id, message) {
  const row = createElement("tr", "key-message");
  row.dataset.hotkeyId = id;
  const cell = createElement("td", "", message.text);
  cell.colSpan = 2;
  if (message.otherId) cell.append(" ", actionButton({ className: "text-button", action: "replace", text: "Replace" }), actionButton({ className: "text-button", action: "cancel", text: "Cancel" }));
  row.append(cell);
  return row;
}

function actionButton({ className, action, text }) {
  const button = createElement("button", className, text);
  button.type = "button";
  button.dataset.shortcutAction = action;
  return button;
}
