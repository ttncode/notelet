Pre-flight: no shared interfaces
Task 1: Step 2 matched (does not provide an export named createOwnSaves).
Task 1: regression proved: isOwn reduced to the latest version -> 2 fail; restored -> 13/13.
Task 1: complete (tests: node --test "tests/*.test.js" -> exit 0, 217 pass)
Ruling: recorded with --phase full, since the project has no fast phase - cost if wrong: none.
Ruling: the race test also covers the failed-save row in the same test rather than a fourth test - cost if wrong: one less-specific test name.
