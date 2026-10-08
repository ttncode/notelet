export const POPUP_PATH = "notes.html?view=popup";

const POPUP_WIDTH = 420;
const POPUP_HEIGHT = 640;
const EDGE_MARGIN_PX = 16;
const TOOLBAR_OFFSET_PX = 72;

export function defaultPopupBounds(browserWindow) {
  return {
    left: Math.max(0, browserWindow.left + browserWindow.width - POPUP_WIDTH - EDGE_MARGIN_PX),
    top: Math.max(0, browserWindow.top + TOOLBAR_OFFSET_PX),
    width: POPUP_WIDTH,
    height: POPUP_HEIGHT,
  };
}
