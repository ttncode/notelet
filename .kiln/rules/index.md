# Project rules

Every file in this directory must appear in the table below.
**Unrouted is dead weight: route it, or do not add it.**

| Trigger — a path glob | Rule file |
|---|---|
| _(none yet)_ | — |

A trigger is a path glob and nothing else: `*` stops at a slash, `**` crosses one, `?` is
one character. `src/auth/**`, `**/*.sql`, `package.json`.

There is no "applies when the topic comes up" trigger, deliberately. That kind is matched by
the model reading a description, which is unverifiable — nothing can tell you afterwards
whether the rule was applied — and it is where every report of a rule being silently ignored
comes from.

## Adding one

`kiln rules add <file>.md --trigger "<glob>"` writes the file and the row together, refuses
a name or a glob that would not resolve, and runs the checks below. Editing this table by
hand works too — the table is the contract, not the command.

## What reads this

`kiln rules <id>` matches the globs above against the files the stage names, and prints the
rules that match. It runs twice:

- at **PLAN**, against the change preview, so a rule shapes the plan;
- at **REVIEW**, against the diff that actually happened, so a rule still reaches a file the
  plan never predicted.

What it handed over is recorded in the work's `state.json`, so *this rule applied* is a fact
rather than a hope.

## Before adding a rule

Every rule line is a token the agent pays on **every later ticket**, and the longer the rules
get the lower its compliance with each one — so adding a rule to force compliance can
backfire. Three questions before you keep one:

1. Can it merge into a rule that already exists? Prefer editing the old file to adding a new
   one.
2. Can an equivalent passage be deleted? Total volume stays flat; it does not grow once per
   incident.
3. Is it routed in the table above?

`kiln rules add` answers all three where you write the rule: it names what already covers
the same files, prints the line count before and after, and routes it.

`kiln doctor` mechanizes two of the three: it names every row that does not resolve — a
half-filled row, a rule file that is not here, a glob that matches nothing in this project —
and it compares the total against `rules.budget_lines` in `.kiln/config.json`. Whether a rule
could have merged is judgment, and stays with the reviewer.
