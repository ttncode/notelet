import "./dom.js";
import { test } from "node:test";
import assert from "node:assert/strict";
import { parseHtml } from "../extension/model.js";
import {
  DEFAULT_SECTIONS, countedTicketItems, ensureSprintSections, isValidSections, ticketDestination,
} from "../extension/sections.js";
import { DEFAULT_STATUSES } from "../extension/sprint.js";

const SECTIONED = '<h1>Sprint</h1>'
  + '<h2 data-section="last">Last Sprint</h2><ul class="checklist"><li data-checked="true" data-points="3">old</li></ul>'
  + '<h2 data-section="current">Current Sprint</h2><ul class="checklist"><li data-checked="true" data-points="5">a</li><li data-checked="false" data-points="8">b</li></ul>'
  + "<h2>Worklog</h2><p>free text</p>";

const texts = (items) => items.map((item) => item.textContent);
const body = (html) => parseHtml(html).body;
const sectionTexts = (html) => {
  const root = body(html);
  return ["last", "current"].map((id) => {
    const heading = root.querySelector(`h2[data-section="${id}"]`);
    return [heading?.textContent, texts([...(heading?.nextElementSibling?.children ?? [])])];
  });
};

test("only tickets in counted sections count; by default that is Current Sprint", () => {
  assert.deepEqual(texts(countedTicketItems(body(SECTIONED), DEFAULT_SECTIONS)), ["a", "b"]);
  const both = DEFAULT_SECTIONS.map((section) => ({ ...section, counts: true }));
  assert.deepEqual(texts(countedTicketItems(body(SECTIONED), both)), ["old", "a", "b"]);
});

test("a note without sections counts every ticket", () => {
  const html = '<ul class="checklist"><li>x</li><li>y</li></ul>';
  assert.deepEqual(texts(countedTicketItems(body(html), DEFAULT_SECTIONS)), ["x", "y"]);
});

test("existing Last Sprint and Current Sprint headings become the sections; a dashed Last Sprint list becomes tickets", () => {
  const html = "<h1>Weekly Plan</h1><h2>Last Sprint</h2><ul class=\"dashed\"><li>#1 Old work (5) (InQC)</li></ul>"
    + '<h2>Current Sprint</h2><ul class="checklist"><li data-checked="true" data-points="8">#2 New work</li></ul><h2>Worklog</h2><p>log</p>';
  const migrated = ensureSprintSections(html, { sections: DEFAULT_SECTIONS, statuses: DEFAULT_STATUSES });
  assert.deepEqual(sectionTexts(migrated), [["Last Sprint", ["#1 Old work"]], ["Current Sprint", ["#2 New work"]]]);
  const old = body(migrated).querySelector('h2[data-section="last"] + ul > li');
  assert.deepEqual([old.getAttribute("data-checked"), old.getAttribute("data-points"), old.getAttribute("data-status")], ["false", "5", "s4"]);
  assert.match(migrated, /<h2>Worklog<\/h2><p>log<\/p>/);
});

test("a sprint note without the headings gets an empty Last Sprint and its tickets under Current Sprint", () => {
  const html = '<h1>Sprint</h1><ul class="checklist"><li data-checked="false">t1</li></ul><p>notes</p><ul class="checklist"><li data-checked="true">t2</li></ul>';
  const migrated = ensureSprintSections(html, { sections: DEFAULT_SECTIONS, statuses: DEFAULT_STATUSES });
  assert.deepEqual(sectionTexts(migrated), [["Last Sprint", []], ["Current Sprint", ["t1", "t2"]]]);
  assert.match(migrated, /^<h1>Sprint<\/h1><h2 data-section="last"/);
  assert.match(migrated, /<p>notes<\/p>/);
});

test("making sections is idempotent", () => {
  const once = ensureSprintSections(SECTIONED, { sections: DEFAULT_SECTIONS, statuses: DEFAULT_STATUSES });
  assert.equal(ensureSprintSections(once, { sections: DEFAULT_SECTIONS, statuses: DEFAULT_STATUSES }), once);
  assert.deepEqual(sectionTexts(once), [["Last Sprint", ["old"]], ["Current Sprint", ["a", "b"]]]);
});

test("moving a ticket one step stays in its list, then crosses into the neighbouring section", () => {
  const root = body(SECTIONED);
  const [lastList, currentList] = [...root.querySelectorAll("h2[data-section] + ul.checklist")];
  const [a, b] = currentList.children;
  assert.deepEqual(ticketDestination(b, -1), { list: currentList, before: a });
  assert.deepEqual(ticketDestination(a, 1), { list: currentList, before: null });
  assert.deepEqual(ticketDestination(a, -1), { list: lastList, before: null });
  assert.deepEqual(ticketDestination(lastList.children[0], 1), { list: currentList, before: a });
  assert.equal(ticketDestination(lastList.children[0], -1), null);
  assert.equal(ticketDestination(b, 1), null);
});

test("section settings need two labelled sections with a yes/no count flag", () => {
  assert.equal(isValidSections(DEFAULT_SECTIONS), true);
  assert.equal(isValidSections([{ id: "last", label: "", counts: false }, DEFAULT_SECTIONS[1]]), false);
  assert.equal(isValidSections([DEFAULT_SECTIONS[1]]), false);
  assert.equal(isValidSections([DEFAULT_SECTIONS[0], { ...DEFAULT_SECTIONS[1], counts: "yes" }]), false);
});
