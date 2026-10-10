import { createElement } from "./dom.js";
import { HOTKEYS, hotkeyLabel } from "./hotkeys.js";

const TOAST_DURATION_MS = 5000;
const URL_REVOKE_DELAY_MS = 1000;
let toastTimer = null;

export function showToast(message) {
  const toast = document.getElementById("toast");
  toast.textContent = message;
  toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toast.hidden = true; }, TOAST_DURATION_MS);
}

export function downloadFile(text, fileName) {
  const url = URL.createObjectURL(new Blob([text], { type: "application/json" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), URL_REVOKE_DELAY_MS);
}

export function pickTextFile(accept) {
  return new Promise((resolve, reject) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = accept;
    input.addEventListener("change", () => {
      const [file] = input.files;
      if (file) file.text().then(resolve, reject);
      else resolve(null);
    });
    input.addEventListener("cancel", () => resolve(null));
    input.click();
  });
}

export function openHelp({ dialog, isMac, version }) {
  const sections = new Map();
  for (const hotkey of HOTKEYS) sections.set(hotkey.group, [...(sections.get(hotkey.group) ?? []), hotkey]);
  const parts = [...sections].flatMap(([group, hotkeys]) => {
    const rows = hotkeys.map((hotkey) => {
      const row = document.createElement("tr");
      row.append(createElement("td", "", hotkey.label), createElement("td", "kbd", hotkeyLabel(hotkey, isMac)));
      return row;
    });
    const body = createElement("tbody", "");
    const table = createElement("table", "");
    const card = createElement("div", "form-card");
    body.append(...rows);
    table.append(body);
    card.append(table);
    return [createElement("h3", "form-head", group), card];
  });
  dialog.querySelector(".help-groups").replaceChildren(...parts);
  dialog.querySelector(".help-version").textContent = `Notelet ${version}`;
  dialog.showModal();
}

export function isPointOutside(rect, { x, y }) {
  return x < rect.left || x > rect.right || y < rect.top || y > rect.bottom;
}

// Only a press that both starts and ends outside the box closes it, so selecting text in a
// field and releasing the mouse over the backdrop does not throw the dialog away.
export function closeOnOutsideClick(dialog) {
  let pressedOutside = false;
  const outside = (event) => event.target === dialog && isPointOutside(dialog.getBoundingClientRect(), { x: event.clientX, y: event.clientY });
  dialog.addEventListener("pointerdown", (event) => { pressedOutside = outside(event); });
  dialog.addEventListener("click", (event) => {
    if (pressedOutside && outside(event)) dialog.close();
    pressedOutside = false;
  });
}
