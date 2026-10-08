import { newNote, parseHtml } from "./model.js";

const DAY_MS = 86_400_000;
const TICKET_SELECTOR = "ul.checklist > li";
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const SPRINT_LENGTH_DAYS = 14;
const DEFAULT_TARGET = 18;
const MAX_LABEL_LENGTH = 20;
const STATUS_ID = /^[a-z0-9-]{1,24}$/;
const HEX_COLOR = /^#[0-9a-f]{6}$/i;

export const DEFAULT_STATUSES = Object.freeze([
  Object.freeze({ id: "s1", label: "Todo", color: "#8e8e93" }),
  Object.freeze({ id: "s2", label: "In Progress", color: "#0a84ff" }),
  Object.freeze({ id: "s3", label: "In Review", color: "#bf5af2" }),
  Object.freeze({ id: "s4", label: "In QC", color: "#ff9f0a" }),
  Object.freeze({ id: "s5", label: "Done", color: "#30d158" }),
]);

export const defaultSettings = () => ({ statuses: DEFAULT_STATUSES.map((status) => ({ ...status })) });

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

const daysBetween = (from, to) => Math.round((utcDay(to) - utcDay(from)) / DAY_MS);

export function sprintStats(html, sprint, today) {
  const tickets = ticketItems(html);
  const pointed = tickets.filter((ticket) => ticket.points !== null);
  const completed = roundPoints(pointed.filter((ticket) => ticket.checked).reduce((sum, ticket) => sum + ticket.points, 0));
  const days = daysBetween(sprint.start, sprint.end) + 1;
  const day = Math.min(days, Math.max(0, daysBetween(sprint.start, isoDate(today)) + 1));
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
  return [...parseHtml(html).body.querySelectorAll(TICKET_SELECTOR)].map((item) => ({
    checked: item.getAttribute("data-checked") === "true",
    points: readPoints(item.getAttribute("data-points")),
    status: item.getAttribute("data-status"),
  }));
}

function readPoints(value) {
  if (value === null || value === "") return null;
  const points = Number(value);
  return Number.isFinite(points) && points >= 0 ? points : null;
}

const roundPoints = (value) => Math.round(value * 100) / 100;

export const formatShortDate = (iso) => new Date(utcDay(iso)).toLocaleDateString(undefined, { day: "numeric", month: "short", timeZone: "UTC" });

export const formatSprintRange = (sprint) => `${formatShortDate(sprint.start)} – ${formatShortDate(sprint.end)}`;

export function newSprint(now, notes, statuses) {
  const latest = notes
    .filter((note) => note.sprint && note.deletedAt === null)
    .sort((a, b) => b.sprint.end.localeCompare(a.sprint.end))[0];
  const start = latest ? addDays(latest.sprint.end, 1) : isoDate(new Date(now));
  const sprint = { start, end: addDays(start, SPRINT_LENGTH_DAYS - 1), target: latest?.sprint.target ?? DEFAULT_TARGET };
  const html = `<h1>Sprint</h1><ul class="checklist"><li data-checked="false" data-status="${statuses[0].id}"><br></li></ul>`;
  return { ...newNote(now), html, sprint };
}

export function validateSprintSettings({ start, end, target, statuses }) {
  if (!isIsoDate(start) || !isIsoDate(end) || end < start) return "The end date must be on or after the start date.";
  if (!(Number.isFinite(target) && target > 0)) return "Target points must be more than 0.";
  if (statuses.length === 0) return "Keep at least one status.";
  if (statuses.some((status) => status.label.trim() === "")) return "Every status needs a label.";
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
