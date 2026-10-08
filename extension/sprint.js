import { formatDayMonth } from "./format.js";
import { newNote, noteLines, noteTitle, ownText, parseHtml } from "./model.js";
import { convertTicket } from "./ticket-text.js";
import { countedTicketItems, defaultSections, ensureSprintSections, isValidSections } from "./sections.js";

const DAY_MS = 86_400_000;
const TICKET_SELECTOR = "ul.checklist > li";
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const SPRINT_WORKING_DAYS = 10;
const SATURDAY = 6;
const SUNDAY = 0;
const HALF_YEAR_DAYS = 183;
const DEFAULT_TARGET = 18;
const MAX_LABEL_LENGTH = 20;
const STATUS_ID = /^[a-z0-9-]{1,24}$/;
const HEX_COLOR = /^#[0-9a-f]{6}$/i;
const LINE_BLOCKS = "h1,h2,h3,p,pre,li,div";
const TARGET_LINE = /^Target:\s*(\d+(?:\.\d+)?)$/i;
const TITLE_RANGE = /(\d{1,2})\/(\d{1,2})\s*[-–]\s*(\d{1,2})\/(\d{1,2})/;

export const DEFAULT_STATUSES = Object.freeze([
  Object.freeze({ id: "s1", label: "Todo", color: "#8e8e93" }),
  Object.freeze({ id: "s2", label: "In Progress", color: "#0a84ff" }),
  Object.freeze({ id: "s3", label: "In Review", color: "#bf5af2" }),
  Object.freeze({ id: "s4", label: "In QC", color: "#ff9f0a" }),
  Object.freeze({ id: "s5", label: "Done", color: "#30d158" }),
]);

export const defaultSettings = () => ({ statuses: DEFAULT_STATUSES.map((status) => ({ ...status })), sections: defaultSections() });

export function normalizeSettings(settings) {
  return { statuses: settings.statuses, sections: isValidSections(settings.sections) ? settings.sections : defaultSections() };
}

export const statusFor = (statuses, id) => statuses.find((status) => status.id === id) ?? statuses[0];

export function nextStatusId(statuses, id) {
  const current = Math.max(0, statuses.findIndex((status) => status.id === id));
  return statuses[(current + 1) % statuses.length].id;
}

export const newStatusId = () => `s-${crypto.randomUUID().slice(0, 8)}`;

export function parsePoints(text) {
  const normalized = text.trim().replace(",", ".");
  if (normalized === "") return null;
  const points = Number(normalized);
  return Number.isFinite(points) && points >= 0 ? points : undefined;
}

const utcDay = (iso) => Date.parse(`${iso}T00:00:00Z`);

export function isoDate(date) {
  const pad = (number) => String(number).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export const addDays = (iso, days) => new Date(utcDay(iso) + days * DAY_MS).toISOString().slice(0, 10);

export function isIsoDate(value) {
  if (typeof value !== "string" || !ISO_DATE.test(value) || !Number.isFinite(utcDay(value))) return false;
  return addDays(value, 0) === value;
}


const isWorkingDay = (iso) => ![SATURDAY, SUNDAY].includes(new Date(utcDay(iso)).getUTCDay());

function workingDaysBetween(from, to) {
  let count = 0;
  for (let day = from; day <= to; day = addDays(day, 1)) if (isWorkingDay(day)) count += 1;
  return count;
}

const nextWorkingDay = (iso) => (isWorkingDay(iso) ? iso : nextWorkingDay(addDays(iso, 1)));

function addWorkingDays(iso, count) {
  let day = iso;
  for (let added = 0; added < count; added += 1) day = nextWorkingDay(addDays(day, 1));
  return day;
}

function sprintDatesFrom(day) {
  const start = nextWorkingDay(day);
  return { start, end: addWorkingDays(start, SPRINT_WORKING_DAYS - 1) };
}

export function sprintStats(html, { sprint, today, sections }) {
  const tickets = countedTicketItems(parseHtml(html).body, sections).map(readTicket);
  const pointed = tickets.filter((ticket) => ticket.points !== null);
  const completed = roundPoints(pointed.filter((ticket) => ticket.checked).reduce((sum, ticket) => sum + ticket.points, 0));
  const days = Math.max(1, workingDaysBetween(sprint.start, sprint.end));
  const todayIso = isoDate(today);
  const day = todayIso < sprint.start ? 0 : Math.min(days, workingDaysBetween(sprint.start, todayIso < sprint.end ? todayIso : sprint.end));
  return {
    target: sprint.target,
    completed,
    missing: Math.max(0, roundPoints(sprint.target - completed)),
    over: Math.max(0, roundPoints(completed - sprint.target)),
    unpointed: tickets.length - pointed.length,
    days,
    day,
    left: days - day,
  };
}

export function ticketSearchText(html, statuses) {
  return ticketItems(html).map((ticket) => statusFor(statuses, ticket.status).label).join(" ");
}

function ticketItems(html) {
  return [...parseHtml(html).body.querySelectorAll(TICKET_SELECTOR)].map(readTicket);
}

const readTicket = (item) => ({
  checked: item.getAttribute("data-checked") === "true",
  points: readPoints(item.getAttribute("data-points")),
  status: item.getAttribute("data-status"),
});

function readPoints(value) {
  if (value === null || value === "") return null;
  const points = Number(value);
  return Number.isFinite(points) && points >= 0 ? points : null;
}

const roundPoints = (value) => Math.round(value * 100) / 100;

export const formatShortDate = (iso) => formatDayMonth(utcDay(iso));

export const formatSprintRange = (sprint) => `${formatShortDate(sprint.start)} – ${formatShortDate(sprint.end)}`;

export function newSprint(now, notes, { statuses, sections }) {
  const latest = notes
    .filter((note) => note.sprint && note.deletedAt === null)
    .sort((a, b) => b.sprint.end.localeCompare(a.sprint.end))[0];
  const dates = sprintDatesFrom(latest ? addDays(latest.sprint.end, 1) : isoDate(new Date(now)));
  const sprint = { ...dates, target: latest?.sprint.target ?? DEFAULT_TARGET };
  const [last, current] = sections.map((section) => `<h2 data-section="${section.id}">${escapeHtml(section.label)}</h2>`);
  const firstTicket = `<li data-checked="false" data-status="${statuses[0].id}"><br></li>`;
  const html = `<h1>Sprint</h1>${last}<ul class="checklist"></ul>${current}<ul class="checklist">${firstTicket}</ul>`;
  return { ...newNote(now), html, sprint };
}

export function validateSprintSettings({ start, end, target, statuses, sections = [] }) {
  if (!isIsoDate(start) || !isIsoDate(end) || end < start) return "The end date must be on or after the start date.";
  if (!(Number.isFinite(target) && target > 0)) return "Target points must be more than 0.";
  if (statuses.length === 0) return "Keep at least one status.";
  if (statuses.some((status) => status.label.trim() === "")) return "Every status needs a label.";
  if (sections.some((section) => section.label.trim() === "")) return "Every section needs a name.";
  return null;
}

export function isValidStatus(status) {
  return typeof status === "object" && status !== null
    && typeof status.id === "string" && STATUS_ID.test(status.id)
    && typeof status.label === "string" && status.label.trim() !== "" && status.label.length <= MAX_LABEL_LENGTH
    && typeof status.color === "string" && HEX_COLOR.test(status.color);
}

export function isValidSprint(sprint) {
  return typeof sprint === "object" && sprint !== null
    && isIsoDate(sprint.start) && isIsoDate(sprint.end) && sprint.end >= sprint.start
    && Number.isFinite(sprint.target) && sprint.target > 0;
}

export function migrateTargetNote(note, statuses, today) {
  if (note.sprint) return note;
  const target = findTarget(note.html);
  if (target === null || target <= 0) return note;
  const body = parseHtml(note.html).body;
  [...body.querySelectorAll(LINE_BLOCKS)].find((block) => TARGET_LINE.test(ownText(block).trim()))?.remove();
  body.querySelectorAll(TICKET_SELECTOR).forEach((item) => convertTicket(item, statuses));
  const dates = titleDates(noteTitle(note.html), note.updatedAt) ?? defaultDates(today);
  return { ...note, html: body.innerHTML, sprint: { ...dates, target } };
}

function findTarget(html) {
  const match = noteLines(html).map((line) => line.match(TARGET_LINE)).find(Boolean);
  return match ? Number(match[1]) : null;
}

function titleDates(title, updatedAt) {
  const match = title.match(TITLE_RANGE);
  if (!match) return null;
  const [startDay, startMonth, endDay, endMonth] = match.slice(1).map(Number);
  const range = { startDay, startMonth, endDay, endMonth };
  const year = new Date(updatedAt).getFullYear();
  const dates = datesInYear(year, range);
  // A Dec–Jan range edited in January would otherwise land in the coming December.
  if (dates && dates.start > addDays(isoDate(new Date(updatedAt)), HALF_YEAR_DAYS)) return datesInYear(year - 1, range);
  return dates;
}

function datesInYear(year, { startDay, startMonth, endDay, endMonth }) {
  const start = toIso(year, startMonth, startDay);
  let end = toIso(year, endMonth, endDay);
  if (start && end && end < start) end = toIso(year + 1, endMonth, endDay);
  return start && end ? { start, end } : null;
}

function toIso(year, month, day) {
  const pad = (number) => String(number).padStart(2, "0");
  const iso = `${year}-${pad(month)}-${pad(day)}`;
  return isIsoDate(iso) ? iso : null;
}

const defaultDates = (today) => sprintDatesFrom(isoDate(today));


export function sameSettings(first, second) {
  const sameStatus = (a, b) => a.id === b.id && a.label === b.label && a.color === b.color;
  const sameSection = (a, b) => a.id === b.id && a.label === b.label && a.counts === b.counts;
  return sameList(first.statuses, second.statuses, sameStatus) && sameList(first.sections ?? [], second.sections ?? [], sameSection);
}

const sameList = (a, b, same) => a.length === b.length && a.every((item, index) => same(item, b[index]));

export function upgradeNote(note, settings, today) {
  const migrated = migrateTargetNote(note, settings.statuses, today);
  if (!migrated.sprint) return migrated;
  const html = ensureSprintSections(migrated.html, settings);
  return html === note.html && migrated === note ? note : { ...migrated, html };
}

const escapeHtml = (text) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
