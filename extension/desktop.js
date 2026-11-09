// Glue between the UI and the Tauri desktop shell. Nothing here touches window.__TAURI__ at
// load time, so the tests can import it in Node.

// A stand-in for chrome.storage.local backed by one JSON file that Rust writes. The whole map
// is kept in memory and rewritten on every change; writes run one after another so an older
// map never lands on disk after a newer one.
export function createFileArea(invoke) {
  let loading = null;
  let data = null;
  let writes = Promise.resolve();
  // Each write holds the whole map, so the last write succeeding means nothing is unsaved.
  let lastWriteSucceeded = true;
  const listeners = [];
  const load = () => {
    loading ??= invoke("storage_load").then((result) => {
      data = result.data;
      return result;
    });
    return loading;
  };
  const write = async (change) => {
    await load();
    const changes = change(data);
    const snapshot = structuredClone(data);
    const done = writes.then(() => invoke("storage_save", { data: snapshot }));
    writes = done.then(() => { lastWriteSucceeded = true; }, () => { lastWriteSucceeded = false; });
    await done;
    if (Object.keys(changes).length > 0) listeners.forEach((listener) => listener(changes));
  };
  return {
    get: async (key) => {
      await load();
      if (key === null || key === undefined) return structuredClone(data);
      return Object.hasOwn(data, key) ? { [key]: structuredClone(data[key]) } : {};
    },
    set: (items) => write((map) => setItems(map, items)),
    remove: (keys) => write((map) => removeKeys(map, keys)),
    onChanged: { addListener: (listener) => listeners.push(listener) },
    isSaved: () => lastWriteSucceeded,
    recovery: async () => {
      const { recovered, damagedPath } = await load();
      return { recovered, damagedPath };
    },
  };
}

function setItems(map, items) {
  const changes = {};
  for (const [key, value] of Object.entries(items)) {
    if (JSON.stringify(map[key]) === JSON.stringify(value)) continue;
    changes[key] = { oldValue: map[key], newValue: structuredClone(value) };
    map[key] = structuredClone(value);
  }
  return changes;
}

function removeKeys(map, keys) {
  const changes = {};
  for (const key of keys.filter((candidate) => Object.hasOwn(map, candidate))) {
    changes[key] = { oldValue: map[key] };
    delete map[key];
  }
  return changes;
}

export function recoveryMessage({ recovered, damagedPath }) {
  if (recovered === "backup") return "Notelet's notes file was damaged, so the last good copy was opened. Your most recent change may be missing.";
  if (recovered === "reset") return `Notelet's notes file was damaged and was moved to ${damagedPath}. Import a backup to bring your notes back.`;
  return null;
}

// WebView2's own back/forward keys are off along with its other browser keys, so Notelet walks
// its history itself — unless one of the user's shortcuts already took the key.
export function historyKey(event) {
  if (event.defaultPrevented || !event.altKey || event.ctrlKey || event.shiftKey || event.metaKey) return null;
  return { ArrowLeft: "back", ArrowRight: "forward" }[event.code] ?? null;
}

// Runs once the window is first on screen. At login Notelet starts hidden in the tray, and a
// message shown then would time out unseen.
export function whenShown(page, window, run) {
  if (page.visibilityState === "visible") {
    run();
    return;
  }
  const done = () => {
    page.removeEventListener("visibilitychange", onVisibility);
    window.removeEventListener("focus", done);
    run();
  };
  const onVisibility = () => {
    if (page.visibilityState === "visible") done();
  };
  page.addEventListener("visibilitychange", onVisibility);
  window.addEventListener("focus", done);
}
