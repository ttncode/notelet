// Debounces saves per note, but never holds an edit longer than maxWaitMs so a long
// uninterrupted typing run still reaches storage if the tab crashes.
export function createSaveScheduler({ delayMs, maxWaitMs, save }) {
  const pending = new Map();

  function run(id) {
    clearTimeout(pending.get(id)?.timer);
    pending.delete(id);
    return save(id);
  }

  return {
    schedule(id) {
      const firstAt = pending.get(id)?.firstAt ?? Date.now();
      clearTimeout(pending.get(id)?.timer);
      const wait = Math.max(0, Math.min(delayMs, firstAt + maxWaitMs - Date.now()));
      pending.set(id, { firstAt, timer: setTimeout(() => run(id), wait) });
    },
    cancel(id) {
      clearTimeout(pending.get(id)?.timer);
      pending.delete(id);
    },
    isPending: (id) => pending.has(id),
    flush: () => Promise.all([...pending.keys()].map(run)),
  };
}
