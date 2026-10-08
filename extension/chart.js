import { createElement } from "./dom.js";

export function renderChart(container, points) {
  container.hidden = points === null;
  if (points === null) return;
  const summary = chartSummary(points);
  container.setAttribute("aria-label", summary);
  const children = [chartBar(points), createElement("p", "chart-numbers", summary)];
  if (points.unpointed > 0) {
    children.push(createElement("p", "chart-note", `${points.unpointed} ${points.unpointed === 1 ? "item" : "items"} without points`));
  }
  container.replaceChildren(...children);
}

function chartBar({ target, completed }) {
  const bar = createElement("div", "chart-bar");
  const done = createElement("div", "chart-done");
  const ratio = target > 0 ? Math.min(1, completed / target) : Number(completed > 0);
  done.style.width = `${ratio * 100}%`;
  bar.append(done);
  return bar;
}

function chartSummary({ target, completed, missing, over }) {
  const remainder = over > 0 ? `+${over} over` : `Missing ${missing}`;
  return `Target ${target} · Completed ${completed} · ${remainder}`;
}
