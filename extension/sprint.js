import { formatDayMonth } from "./format.js";
import { noteLines, noteTitle, ownText, parseHtml } from "./model.js";
import { convertTicket } from "./ticket-text.js";
import { defaultSections, extractTracker, isValidSections } from "./sections.js";
import { isValidGroups } from "./tracker.js";

const DAY_MS = 86_400_000;
const TICKET_SELECTOR = "ul.checklist > li";
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const SPRINT_WORKING_DAYS = 10;
const SATURDAY = 6;
const SUNDAY = 0;
const HALF_YEAR_DAYS = 183;
const DONE_STATUS_ID = "s5";
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

// sprintCounts and monthCounts are the status ids that count as done for a sprint and for a month.
export function defaultSettings() {
  const statuses = DEFAULT_STATUSES.map((status) => ({ ...status }));
  return { statuses, sprintCounts: defaultCounts(statuses), monthCounts: defaultCounts(statuses) };
}

// Done, or the last status when Done has been removed.
const defaultCounts = (statuses) => [(statuses.find((status) => status.id === DONE_STATUS_ID) ?? statuses.at(-1)).id];

export function normalizeSettings(settings) {
  const { statuses } = settings;
  const counts = (ids) => {
    const known = Array.isArray(ids) ? ids.filter((id) => statuses.some((status) => status.id === id)) : [];
    return known.length > 0 ? known : defaultCounts(statuses);
  };
  return { statuses, sprintCounts: counts(settings.sprintCounts), monthCounts: counts(settings.monthCounts) };
}

// Section labels and count flags were settings before each tracker had its own groups; they
// are only needed to turn an older sprint note into groups.
export const legacySections = (settings) => (isValidSections(settings?.sections) ? settings.sections : defaultSections());

export const statusFor = (statuses, id) => statuses.find((status) => status.id === id) ?? statuses[0];

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

export function workingDaysBetween(from, to) {
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

export function sprintDatesFrom(day) {
  const start = nextWorkingDay(day);
  return { start, end: addWorkingDays(start, SPRINT_WORKING_DAYS - 1) };
}


export const formatShortDate = (iso) => formatDayMonth(utcDay(iso));

export const formatSprintRange = (sprint) => `${formatShortDate(sprint.start)} – ${formatShortDate(sprint.end)}`;


// sprint is null when only the shared settings are edited.
export function validateSprintSettings({ sprint, statuses, sprintCounts, monthCounts }) {
  if (sprint && (!isIsoDate(sprint.start) || !isIsoDate(sprint.end) || sprint.end < sprint.start)) return "The end date must be on or after the start date.";
  if (sprint && !(Number.isFinite(sprint.goal) && sprint.goal > 0)) return "Goal points must be more than 0.";
  if (statuses.length === 0) return "Keep at least one status.";
  if (statuses.some((status) => status.label.trim() === "")) return "Every status needs a label.";
  if (sprintCounts.length === 0) return "Tick at least one status that counts as done for sprints.";
  if (monthCounts.length === 0) return "Tick at least one status that counts as done for months.";
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
    && Number.isFinite(sprint.target) && sprint.target > 0
    && (sprint.title === undefined || typeof sprint.title === "string")
    && (sprint.groups === undefined || isValidGroups(sprint.groups));
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
  const sameIds = (a, b) => a.length === b.length && a.every((id, index) => id === b[index]);
  return first.statuses.length === second.statuses.length && first.statuses.every((status, index) => sameStatus(status, second.statuses[index]))
    && sameIds(first.sprintCounts, second.sprintCounts) && sameIds(first.monthCounts, second.monthCounts);
}

// settings: { statuses, sections } where sections are the legacy section labels and count flags.
export function upgradeNote(note, { statuses, sections }, today) {
  const migrated = migrateTargetNote(note, statuses, today);
  if (!migrated.sprint || migrated.sprint.groups) return migrated;
  const { title, groups, html } = extractTracker(migrated.html, { sections, statuses });
  return { ...migrated, html, sprint: { ...migrated.sprint, title, groups } };
}
