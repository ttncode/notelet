import { clipboardText } from "./clipboard.js";
import { CODE_LANGUAGES, codeBlockLines, languageOf } from "./code-block.js";
import { showToast } from "./dialogs.js";
import { caretElement } from "./selection.js";

const INSET_PX = 6;
const COPY_ICON = '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V6a2 2 0 0 1 2-2h9"/></svg>';

// Notion's code block toolbar: the language menu and a copy button in the block's top-right
// corner, shown while the pointer is over the block or the caret is in it. It sits in the
// editor's scroll area, outside the note text, so it is never saved with the note.
export function createCodeToolbar({ editorElement, onPickLanguage }) {
  const toolbar = createToolbarElement();
  const [select, copyButton] = toolbar.children;
  const scroller = editorElement.parentElement;
  let hoveredBlock = null;
  let shownBlock = null;

  select.addEventListener("change", () => onPickLanguage(shownBlock, select.value));
  copyButton.addEventListener("click", () => copyCode(shownBlock));
  scroller.addEventListener("pointerover", (event) => {
    if (toolbar.contains(event.target)) return;
    hoveredBlock = editorElement.contains(event.target) ? event.target.closest("pre") : null;
    update();
  });
  scroller.addEventListener("pointerleave", () => {
    hoveredBlock = null;
    update();
  });
  window.addEventListener("resize", update);
  editorElement.after(toolbar);

  function update() {
    // An open language menu keeps the toolbar where it is, wherever the pointer goes.
    if (document.activeElement === select && shownBlock?.isConnected) return;
    const hovered = hoveredBlock?.isConnected ? hoveredBlock : null;
    shownBlock = editorElement.isContentEditable ? hovered ?? caretElement(editorElement)?.closest("pre") ?? null : null;
    toolbar.hidden = !shownBlock;
    if (!shownBlock) return;
    const lines = codeBlockLines(shownBlock);
    select.value = languageOf(lines);
    placeOver(lines[0]);
  }

  function placeOver(firstLine) {
    const line = firstLine.getBoundingClientRect();
    const area = scroller.getBoundingClientRect();
    toolbar.style.top = `${line.top - area.top + scroller.scrollTop + INSET_PX}px`;
    toolbar.style.left = `${line.right - area.left + scroller.scrollLeft - toolbar.offsetWidth - INSET_PX}px`;
  }

  return { update };
}

function createToolbarElement() {
  const toolbar = document.createElement("div");
  toolbar.className = "code-toolbar";
  toolbar.hidden = true;
  const select = document.createElement("select");
  select.setAttribute("aria-label", "Code language");
  select.append(...CODE_LANGUAGES.map(([id, name]) => new Option(name, id)));
  const copyButton = document.createElement("button");
  copyButton.type = "button";
  copyButton.title = "Copy code";
  copyButton.setAttribute("aria-label", "Copy code");
  copyButton.innerHTML = COPY_ICON;
  toolbar.append(select, copyButton);
  return toolbar;
}

// The whole block as bare code, without Markdown fences, ready for a terminal.
async function copyCode(block) {
  const holder = block.ownerDocument.createElement("div");
  holder.append(...codeBlockLines(block).map((line) => line.cloneNode(true)));
  try {
    await navigator.clipboard.writeText(clipboardText(holder));
    showToast("Code copied");
  } catch (error) {
    showToast(`Couldn't copy the code: ${error.message}`);
  }
}
