// Sprint notes before task tracking kept their tickets in two fixed sections of the note text:
// <h2 data-section="last|current"> followed by a checklist. This module only reads that layout
// so older notes and backups can be turned into tracker groups.
import { EMPTY_BODY_HTML, ownText, parseHtml } from "./model.js";
import { convertTicket } from "./ticket-text.js";
import { newGroup } from "./tracker.js";

const SECTION_IDS = ["last", "current"];
const MAX_LABEL_LENGTH = 30;
const STATUS_ID = /^[a-z0-9-]{1,24}$/;

export const DEFAULT_SECTIONS = Object.freeze([
  Object.freeze({ id: "last", label: "Last Sprint", counts: false }),
  Object.freeze({ id: "current", label: "Current Sprint", counts: true }),
]);

export const defaultSections = () => DEFAULT_SECTIONS.map((section) => ({ ...section }));

export function isValidSections(sections) {
  return Array.isArray(sections) && sections.length === SECTION_IDS.length
    && sections.every((section, index) => section?.id === SECTION_IDS[index]
      && typeof section.label === "string" && section.label.trim() !== "" && section.label.length <= MAX_LABEL_LENGTH
      && typeof section.counts === "boolean");
}

// Each section becomes a group of the same name; the title line becomes the tracker title and
// whatever else the note held stays as its free text.
export function extractTracker(html, { sections, statuses }) {
  const body = parseHtml(ensureSprintSections(html, { sections, statuses })).body;
  const titleLine = titleOf(body);
  const title = titleLine ? titleLine.textContent.trim() : "";
  titleLine?.remove();
  const groups = sections.map((section) => takeSectionGroup(body, { section, statuses }));
  return { title, groups, html: body.innerHTML.trim() === "" ? EMPTY_BODY_HTML : body.innerHTML };
}

function takeSectionGroup(body, { section, statuses }) {
  const heading = body.querySelector(`h2[data-section="${section.id}"]`);
  const list = heading.nextElementSibling;
  const tasks = [...list.querySelectorAll("li")].map((item) => readTask(item, statuses)).filter((task) => task.title !== "");
  heading.remove();
  list.remove();
  return { ...newGroup({ name: section.label, counts: section.counts }), tasks };
}

function readTask(item, statuses) {
  const status = item.getAttribute("data-status");
  return {
    id: crypto.randomUUID(),
    title: ownText(item).replace(/\s+/g, " ").trim(),
    points: readPoints(item.getAttribute("data-points")),
    status: status !== null && STATUS_ID.test(status) ? status : statuses[0].id,
    done: item.getAttribute("data-checked") === "true",
  };
}

function readPoints(value) {
  if (value === null || value === "") return null;
  const points = Number(value);
  return Number.isFinite(points) && points >= 0 ? points : null;
}

export function ensureSprintSections(html, { sections, statuses }) {
  const body = parseHtml(html).body;
  markNamedHeadings(body, sections);
  const lastList = ensureSection(body, { section: sections[0], statuses, after: titleOf(body) });
  const currentList = ensureSection(body, { section: sections[1], statuses, after: lastList });
  adoptOrphanTickets(body, [lastList, currentList]);
  return body.innerHTML;
}

function markNamedHeadings(body, sections) {
  const normalize = (text) => text.trim().toLowerCase();
  sections.forEach((section, index) => {
    if (body.querySelector(`h2[data-section="${section.id}"]`)) return;
    const names = new Set([normalize(section.label), normalize(DEFAULT_SECTIONS[index].label)]);
    const heading = [...body.querySelectorAll("h2:not([data-section])")].find((h2) => names.has(normalize(h2.textContent)));
    heading?.setAttribute("data-section", section.id);
  });
}

const titleOf = (body) => (body.firstElementChild?.tagName === "H1" ? body.firstElementChild : null);

function ensureSection(body, { section, statuses, after }) {
  const heading = body.querySelector(`h2[data-section="${section.id}"]`);
  return heading ? ensureChecklistAfter(heading, statuses) : addSection(body, { section, after });
}

// A section that did not exist starts empty; whatever list followed the insertion point
// belongs to the note, not to the new section.
function addSection(body, { section, after }) {
  const document = body.ownerDocument;
  const heading = document.createElement("h2");
  heading.setAttribute("data-section", section.id);
  heading.textContent = section.label;
  const list = document.createElement("ul");
  list.setAttribute("class", "checklist");
  if (after) after.after(heading, list);
  else body.prepend(heading, list);
  return list;
}

function ensureChecklistAfter(heading, statuses) {
  const next = heading.nextElementSibling;
  if (next?.matches("ul.checklist")) return next;
  const list = heading.ownerDocument.createElement("ul");
  list.setAttribute("class", "checklist");
  if (next && (next.tagName === "UL" || next.tagName === "OL")) {
    list.append(...[...next.children].map((item) => toTicket(item, statuses)));
    next.replaceWith(list);
  } else {
    heading.after(list);
  }
  return list;
}

function toTicket(item, statuses) {
  convertTicket(item, statuses);
  item.setAttribute("data-checked", "false");
  return item;
}

function adoptOrphanTickets(body, sectionLists) {
  const orphanLists = [...body.querySelectorAll("ul.checklist")].filter((list) => !sectionLists.some((section) => section === list || section.contains(list)));
  for (const list of orphanLists) {
    sectionLists[1].append(...list.children);
    list.remove();
  }
}
