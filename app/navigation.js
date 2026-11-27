// Back and forward — the browser's buttons, a mouse's side buttons, Alt+← / Alt+→ — walk the
// same steps as Notelet's own back buttons: the notes list, a note, then a sprint's screens.
// Each step is a history entry holding the view, so the browser keeps the list and the mouse
// buttons work with no handling of their own. Steps slide like iPhone Notes.
const REDUCED_MOTION = matchMedia("(prefers-reduced-motion: reduce)");

// readView returns what is on screen; showView puts a view from history back on screen.
export function createNavigation({ readView, showView }) {
  let depth = 0;
  let busy = false;
  const run = (update) => {
    busy = true;
    try {
      update();
    } finally {
      busy = false;
    }
  };
  const push = () => {
    const view = readView();
    if (JSON.stringify(view) === JSON.stringify(history.state?.view)) return;
    depth += 1;
    history.pushState({ depth, view }, "");
  };
  const replace = () => history.replaceState({ depth, view: readView() }, "");
  const step = (direction, update, after) => animate(direction, () => {
    run(update);
    after();
  });
  replace();
  addEventListener("popstate", ({ state }) => {
    if (!state?.view) return;
    const direction = state.depth < depth ? "back" : "forward";
    depth = state.depth;
    animate(direction, () => run(() => showView(state.view)));
  });
  return {
    // One step deeper: update changes the screen, which slides in and becomes a history entry.
    forward: (update) => step("forward", update, push),
    // A new step that slides the given way, such as Alt+1 going to the list from a note.
    jump: (direction, update) => step(direction, update, push),
    // Back through history when there is a step to go back to; otherwise fallback shows the way back.
    back: (fallback) => {
      if (depth > 0) history.back();
      else step("back", fallback, replace);
    },
    // The screen changed without a new step, such as picking another note beside the list.
    replace: () => {
      if (!busy) replace();
    },
  };
}

// The update runs inside a view transition, so it happens after this returns; anything that must
// follow it, such as moving focus, belongs inside the update.
function animate(direction, update) {
  if (!document.startViewTransition || REDUCED_MOTION.matches) return update();
  const root = document.documentElement;
  root.dataset.nav = direction;
  const transition = document.startViewTransition(update);
  const clear = () => {
    if (root.dataset.nav === direction) delete root.dataset.nav;
  };
  transition.updateCallbackDone.catch((error) => console.error("Notelet: could not change the screen", error));
  transition.finished.then(clear, clear);
}
