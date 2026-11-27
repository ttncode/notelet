const MIN_SIDEBAR_PX = 200;
const MAX_SIDEBAR_PX = 480;
const KEYBOARD_STEP_PX = 16;

export function setupLayout({ resizer, ui, onUiChange }) {
  const resize = (width) => {
    applySidebarWidth(width);
    onUiChange({ sidebarWidth: width });
  };
  applySidebarWidth(ui.sidebarWidth);
  document.body.classList.toggle("sidebar-hidden", ui.sidebarHidden);
  wireResizer(resizer, resize);
  const toggleSidebar = () => onUiChange({ sidebarHidden: document.body.classList.toggle("sidebar-hidden") });
  return {
    toggleSidebar,
    showEditor: () => document.body.classList.add("show-editor"),
    // A narrow screen shows either the list or the note; this puts back one taken from history.
    setPane: (pane) => document.body.classList.toggle("show-editor", pane === "note"),
    showList: () => {
      document.body.classList.remove("show-editor");
      if (document.body.classList.contains("sidebar-hidden")) toggleSidebar();
    },
  };
}

function wireResizer(resizer, resize) {
  resizer.addEventListener("pointerdown", (event) => {
    resizer.setPointerCapture(event.pointerId);
    const move = (moveEvent) => resize(clampWidth(moveEvent.clientX));
    resizer.addEventListener("pointermove", move);
    resizer.addEventListener("pointerup", () => resizer.removeEventListener("pointermove", move), { once: true });
  });
  resizer.addEventListener("keydown", (event) => {
    const step = { ArrowLeft: -KEYBOARD_STEP_PX, ArrowRight: KEYBOARD_STEP_PX }[event.key];
    if (!step) return;
    event.preventDefault();
    resize(clampWidth(currentSidebarWidth() + step));
  });
}

const clampWidth = (width) => Math.round(Math.min(MAX_SIDEBAR_PX, Math.max(MIN_SIDEBAR_PX, width)));
const currentSidebarWidth = () => parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--sidebar-width"));
const applySidebarWidth = (width) => document.documentElement.style.setProperty("--sidebar-width", `${width}px`);
