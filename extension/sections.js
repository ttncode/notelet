import { parseHtml } from "./model.js";
import { convertTicket } from "./ticket-text.js";

const SECTION_IDS = ["last", "current"];
const MAX_LABEL_LENGTH = 30;
const SECTION_LIST = "h2[data-section] + ul.checklist";
const TICKET = "ul.checklist > li";

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

export function countedTicketItems(body, sections) {
  if (!body.querySelector("h2[data-section]")) return [...body.querySelectorAll(TICKET)];
  return sections
    .filter((section) => section.counts)
    .flatMap((section) => {
      const list = body.querySelector(`h2[data-section="${section.id}"]`)?.nextElementSibling;
      return list?.matches("ul.checklist") ? [...list.querySelectorAll(TICKET)] : [];
    });
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

export function ticketDestination(item, step) {
  const lists = [...item.ownerDocument.querySelectorAll(SECTION_LIST)];
  const list = item.parentElement;
  const listIndex = lists.indexOf(list);
  if (listIndex === -1) return null;
  const siblings = [...list.children];
  const index = siblings.indexOf(item);
  if (step < 0) {
    if (index > 0) return { list, before: siblings[index - 1] };
    return listIndex > 0 ? { list: lists[listIndex - 1], before: null } : null;
  }
  if (index < siblings.length - 1) return { list, before: siblings[index + 2] ?? null };
  return listIndex < lists.length - 1 ? { list: lists[listIndex + 1], before: lists[listIndex + 1].firstElementChild } : null;
}
