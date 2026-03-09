# Feature: Issue Priority, Archiving, and List UI (077)

## Summary

Adds a focused V1 backlog UX layer to the megapowers issue system: priority- and milestone-aware active issue listing, a first-class `/issue archive` operation, and a separate `/issue archived` view. The underlying markdown-based issue store is unchanged — the feature works entirely through directory separation and frontmatter conventions.

## What Was Built

### Store layer (`extensions/megapowers/state/store.ts`)

- **`IssueStatus`** extended to include `"archived"` as a valid value (parsed from frontmatter without error).
- **`readIssuesFromDir(dir)`** — internal helper that reads all `.md` files from a directory and hydrates `Issue` objects; used by both active and archive queries.
- **`listArchivedIssues()`** — reads from `.megapowers/issues/archive/`.
- **`archiveIssue(slug)`** — moves an issue file from `issues/` to `issues/archive/`, rewrites its `status` to `archived`, and stamps an `archived:` ISO timestamp in frontmatter. Returns `{ ok: true, archivedIssue }` or `{ ok: false, error }`.
- **`createIssue` ID allocation** — fixed to scan both the active and archive directories when computing the next ID, preventing ID reuse after archiving.
- `ensureRoot()` now creates the `archive/` directory on init.

### UI layer (`extensions/megapowers/ui.ts`)

- **`sortActiveIssues(issues)`** — pure sort: milestone (`M\d+` rank), then numeric priority (ascending), then `createdAt` (oldest first).
- **`buildMilestoneIssueSections(issues)`** — groups a pre-sorted issue list into `{ milestone, issues }` sections.
- **`formatActiveIssueListItem(issue, batchSlug?)`** — renders `#001 [P1] Title [status]` format.
- **`formatMilestoneHeader(milestone, issues)`** — renders `M1: (3 issues)` section headers.
- **`formatArchivedIssueList(issues)`** — renders a newline-joined list of archived items.
- **`filterTriageableIssues`** — updated to also exclude `archived` issues.
- **`/issue list`** — now sorts, groups by milestone, and renders headers above each group before showing the selection prompt.
- **`/issue archived`** — new subcommand; lists archived issues via notify (read-only, no selection).
- **`/issue archive <slug>`** — new subcommand; archives the named issue. If it is the currently active issue, resets workflow state (preserving `megaEnabled`, `branchName`, `baseBranch`).

### Prompt injection (`extensions/megapowers/prompt-inject.ts`)

- Idle prompt open-issues list now filters `status !== "archived"` in addition to `status !== "done"`.

## Why

As the issue backlog grows, a flat unsorted list with no archiving mechanism becomes hard to manage. This feature makes the most important work surface to the top (milestone → priority → age), keeps the list readable by hiding completed/irrelevant work in an archive, and preserves an auditable history of all archived issues in a dedicated directory.

## Testing

7 new test files cover all 30 acceptance criteria:

| File | Coverage |
|------|----------|
| `tests/store-archive-listing.test.ts` | AC1–AC3 (archived status type, directory separation) |
| `tests/store-archive-operation.test.ts` | AC14–AC22 + ID-uniqueness regression |
| `tests/store-archive-errors.test.ts` | AC23–AC24 (error paths) |
| `tests/ui-issue-list.test.ts` | AC4–AC13 (sort, group, format, filter helpers) |
| `tests/ui-issue-command-list.test.ts` | AC7–AC12, AC28, AC30 (command-level list + archived view) |
| `tests/ui-issue-archive-command.test.ts` | AC25–AC27 (archive subcommand + state reset) |
| `tests/prompt-inject-archived.test.ts` | AC29 (idle prompt filter) |

## Out of Scope

Interactive reprioritization, automatic archiving on completion, archive restore/unarchive, batch-specific archive workflows.
