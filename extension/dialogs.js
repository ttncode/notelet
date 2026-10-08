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
  const rows = HOTKEYS.map((hotkey) => {
    const row = document.createElement("tr");
    row.append(createElement("td", "", hotkey.label), createElement("td", "kbd", hotkeyLabel(hotkey, isMac)));
    return row;
  });
  dialog.querySelector("tbody").replaceChildren(...rows);
  dialog.querySelector(".help-version").textContent = `Notelet ${version}`;
  dialog.showModal();
}
