# Learnings — #116 Plan Review Documentation Realignment

- **Done-phase `write-changelog` appends but never reconciles.** When a feature is added and later reversed within the same `[Unreleased]` block, the append-only pattern silently creates contradictory entries. A reconciliation step — checking whether any prior "Added" entry in the same block is superseded — should be part of the changelog workflow for reversal bugfixes.

- **Documentation scope in reversal issues should be explicit.** When #110 and #111 removed T1, the scope listed code files and prompts but not the changelog "Added" entry. Explicitly listing "prior changelog entries that describe this feature" as a cleanup target in the issue scope would prevent this class of drift.

- **Design docs need a lifecycle field, not just a date.** The 095 doc had a date but its `Status: Proposed` was never updated post-implementation. A structured status field (`Proposed` → `In Progress` → `Complete`) with an update expectation in the done phase would catch this automatically.

- **Documentation-only bugfixes verify cleanly via `git diff` + grep.** For doc-only changes, the most reliable verification is: (a) `git diff` showing the exact lines changed, (b) `grep` confirming the removed term no longer appears in active files, and (c) confirming historical artifacts were not touched. No test suite changes needed.

- **Batch issues are useful for deferred documentation cleanup.** Deferring #108 from the T1 removal issues (#110, #111) to a dedicated batch issue was the right call — it kept the reversal PRs focused on code changes. But the deferred issue should be activated immediately after the source issues close, before the documentation drift compounds.
