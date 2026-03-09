# Learnings — 077-issue-priority-archiving-list

- **Directory separation is the cleanest archive boundary.** Putting archived issues in a subdirectory (`issues/archive/`) means no explicit filter is needed in `listIssues()` — `readdirSync` is non-recursive, so `archive/` simply never appears as an `.md` file. Simpler and more robust than a status-based filter on the primary query path.

- **ID allocation must account for all historical records, not just active ones.** `createIssue` originally scanned only `issuesDir` for the max ID. After archiving issues, this would silently reuse IDs. The fix — scanning both directories before computing `maxId` — was caught in code review after the fact. Lesson: any "compute next ID from existing files" pattern should enumerate *all* persistent stores, not just the primary active one.

- **Pure sorting and grouping helpers are easy wins for testability.** `sortActiveIssues`, `buildMilestoneIssueSections`, and `formatActiveIssueListItem` are pure functions with no I/O. They were fully tested in isolation (`ui-issue-list.test.ts`) before the command-level integration test was written, which made debugging the integration test trivial.

- **`milestoneRank` only handles `M\d+` format — this is intentional but worth documenting.** Milestones not matching `/^M(\d+)$/i` sort last (MAX_SAFE_INTEGER). This matches the project's existing milestone naming convention, but if milestone formats diversify, the rank function will need updating.

- **State reset on archive-of-active-issue must preserve branch metadata.** `branchName` and `baseBranch` are session-level fields (not tied to the issue being worked), so they must survive the reset. The pattern `{ ...createInitialState(), megaEnabled, branchName, baseBranch }` is now established precedent for "reset everything except session globals."

- **`archiveIssue` has a natural two-phase failure window (write then delete).** If the process crashes between `writeFileSync(archivedPath)` and `rmSync(activePath)`, the issue exists in both places. The next `archiveIssue` call returns "already archived" while the active file still exists — an inconsistent but non-destructive state. A `renameSync` approach would make this atomic; worth revisiting if we add a recovery/repair command.

- **Defensive `status !== "archived"` filter in `buildIdlePrompt` is valuable even though directory separation already prevents archived files from reaching `listIssues()`.** The test (`prompt-inject-archived.test.ts`) deliberately writes an archived-status file into the active directory to exercise the filter independently. Defense-in-depth here costs nothing and protects against future bugs or manual state manipulation.
