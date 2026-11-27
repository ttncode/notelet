import { test } from "node:test";
import assert from "node:assert/strict";
import { isStraightQuote, smartQuote, substitutionBefore } from "../app/typography.js";

test("arrows, the ellipsis and the em dash replace what was typed", () => {
  const replaced = (text) => substitutionBefore(text)?.replacement ?? null;
  assert.equal(replaced("C2 ->"), "→");
  assert.equal(replaced("C2->"), "→");
  assert.equal(replaced("back <-"), "←");
  assert.equal(replaced("A <->"), "↔");
  assert.equal(replaced("then -->"), "⟶");
  assert.equal(replaced("from <--"), "⟵");
  assert.equal(replaced("so ==>"), "⇒");
  assert.equal(replaced("from <=="), "⇐");
  assert.equal(replaced("so ===>"), "⟹");
  assert.equal(replaced("from <==="), "⟸");
  assert.equal(replaced("A <=>"), "⇔");
  assert.equal(replaced("A <==>"), "⟺");
  assert.equal(replaced("A <-->"), "⟷");
  assert.equal(replaced("a !="), "≠");
  assert.equal(replaced("a <="), "≤");
  assert.equal(replaced("a >="), "≥");
  assert.equal(replaced("a =>"), "≥");
  assert.equal(replaced("wait..."), "…");
  assert.equal(replaced("word --"), "—");
});

test("the substitution reports the typed text it replaces", () => {
  assert.deepEqual(substitutionBefore("A <->"), { typed: "<->", replacement: "↔" });
});

test("longer runs of the same characters stay as typed", () => {
  for (const text of ["--->", "<--->", "<===>", "<<=>", "....", "---", "<---", "====>", "<====", ">=>", "<<=", "!!=", "!==", "plain", ""]) assert.equal(substitutionBefore(text), null, text);
});

test("a quote opens at a line start or after a space or bracket, and closes elsewhere", () => {
  assert.equal(smartQuote('"', undefined), "“");
  assert.equal(smartQuote('"', " "), "“");
  assert.equal(smartQuote('"', "("), "“");
  assert.equal(smartQuote('"', "d"), "”");
  assert.equal(smartQuote("'", "n"), "’");
  assert.equal(smartQuote("'", " "), "‘");
});

test("only the two straight quotes are smart-quoted", () => {
  assert.equal(isStraightQuote('"'), true);
  assert.equal(isStraightQuote("'"), true);
  assert.equal(isStraightQuote("`"), false);
});
