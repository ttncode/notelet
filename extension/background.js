import { defaultPopupBounds, POPUP_PATH } from "./popup-window.js";

const POPUP_URL = chrome.runtime.getURL(POPUP_PATH);
const BOUNDS_KEY = "popupBounds";

chrome.action.onClicked.addListener(() => {
  openPopup().catch((error) => console.error("Notelet: could not open the popup window", error));
});

chrome.windows.onBoundsChanged.addListener((browserWindow) => {
  rememberBounds(browserWindow).catch((error) => console.error("Notelet: could not remember the popup size", error));
});

async function openPopup() {
  const existing = await popupContext();
  if (existing) {
    await chrome.windows.update(existing.windowId, { focused: true });
    return;
  }
  const { [BOUNDS_KEY]: saved } = await chrome.storage.local.get(BOUNDS_KEY);
  const bounds = saved ?? defaultPopupBounds(await chrome.windows.getLastFocused());
  await chrome.windows.create({ url: POPUP_URL, type: "popup", focused: true, ...bounds });
}

async function popupContext() {
  const [context] = await chrome.runtime.getContexts({ contextTypes: ["TAB"], documentUrls: [POPUP_URL] });
  return context ?? null;
}

async function rememberBounds(browserWindow) {
  const popup = await popupContext();
  if (popup?.windowId !== browserWindow.id) return;
  const { left, top, width, height } = browserWindow;
  await chrome.storage.local.set({ [BOUNDS_KEY]: { left, top, width, height } });
}
