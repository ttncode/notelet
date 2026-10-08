const NOTES_URL = chrome.runtime.getURL("notes.html");

chrome.action.onClicked.addListener(() => {
  openNotes().catch((error) => console.error("Notelet: could not open the notes tab", error));
});

async function openNotes() {
  const [existing] = await chrome.runtime.getContexts({ contextTypes: ["TAB"], documentUrls: [NOTES_URL] });
  if (!existing) {
    await chrome.tabs.create({ url: NOTES_URL });
    return;
  }
  await chrome.tabs.update(existing.tabId, { active: true });
  await chrome.windows.update(existing.windowId, { focused: true });
}
