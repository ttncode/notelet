
const TOAST_DURATION_MS = 5000;
const ACTION_TOAST_DURATION_MS = 15000;
let toastTimer = null;

// action, when given, is { label, run }: one button that runs and closes the toast. Such a
// toast stays longer, since it asks for a decision.
export function showToast(message, action = null) {
  const toast = document.getElementById("toast");
  toast.textContent = message;
  if (action) toast.append(" ", actionButton(toast, action));
  toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toast.hidden = true; }, action ? ACTION_TOAST_DURATION_MS : TOAST_DURATION_MS);
}

function actionButton(toast, { label, run }) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "text-button toast-action";
  button.textContent = label;
  button.addEventListener("click", () => {
    clearTimeout(toastTimer);
    toast.hidden = true;
    run();
  });
  return button;
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
