## Approach

This issue should ship a focused V1 of issue-management UX rather than a broad backlog workflow rewrite. The codebase already has most of the foundation: issue markdown files live under `.megapowers/issues/`, `priority` and `milestone` already exist in frontmatter, and there is already an `.megapowers/issues/archive/` directory. What is missing is a usable active list, a first-class archive operation, and a clean way to view archived issues. The recommended approach is to build on the existing store/UI split: keep markdown files as the source of truth, add explicit archive semantics to the store layer, and add pure sorting/grouping/render helpers that the UI layer consumes.

For V1, active issue lists should group by milestone and sort by milestone → priority → created date. Active views should clearly show status and priority so the backlog becomes scannable at a glance. Archiving should be an explicit operation that moves an issue into `.megapowers/issues/archive/`, rewrites its frontmatter to `status: archived`, and records archive metadata. Archived issues should not appear in the default active backlog view, but they should remain accessible through an explicit archived listing.

Interactive reprioritization (`/mp triage`) should be deferred. It adds a surprising amount of UI state, renumbering behavior, and mutation rules without solving the core current pain. V1 should instead focus on the highest-value, most testable improvements: readable active lists, real archive support, and a distinct archived view.

## Key Decisions

- **Use a hybrid archive model** — archive means both moving the file into `.megapowers/issues/archive/` and marking frontmatter `status: archived`; this keeps browsing simple while preserving an explicit semantic signal.
- **Keep markdown issues as the source of truth** — no new database or cache layer; this matches existing repo architecture and minimizes risk.
- **Defer interactive reprioritization** — list readability and archive behavior solve the immediate usability problem with much lower complexity.
- **Allow archiving from any prior status** — `open`, `in-progress`, and `done` issues may all be archived, because sometimes work is abandoned or intentionally dropped.
- **Allow archiving the active issue** — if the currently active issue is archived, workflow state should reset automatically so state does not point at a missing active issue.
- **Keep active and archived views separate** — default list stays focused on current work; archived issues are shown only through an explicit archived view.
- **Prefer pure helpers for list logic** — sorting, grouping, and formatting rules should live in deterministic functions between store and UI rather than being scattered through interactive handlers.
- **Use milestone-local priority display** — priority remains meaningful within milestone grouping; list order should reflect milestone first, then priority.
- **Archive metadata should be auditable** — record at least an archive timestamp, and optionally archive reason if it can be added without complicating V1 too much.

## Components

- **Store/archive extension (`extensions/megapowers/state/store.ts`)**
  - Extend issue status handling to include `archived`.
  - Add archive-aware read/list behavior for active vs archived issues.
  - Add an archive operation that validates an issue, rewrites frontmatter, writes the archived copy, removes the active copy, and preserves issue identity fields.

- **Pure issue-list helpers (`extensions/megapowers/ui.ts` or adjacent helper module)**
  - Sort issues by milestone → priority → created date.
  - Group issues by milestone with summary/header lines.
  - Format list rows with clear status and priority badges.
  - Exclude archived issues from active views and triageable sets.

- **Command/UI integration**
  - Update issue-list display to use the grouped/sorted active view.
  - Add an explicit archived view rather than mixing archived issues into the default list.
  - Add archive command support that targets an issue by id/slug and reports the result clearly.
  - If archiving the active issue, reset active workflow state automatically and surface that reset clearly in the UI.

- **State integration**
  - Ensure active-session state is cleaned up when the active issue is archived.
  - Keep batch/source issue behavior predictable; archive changes should not silently corrupt batch lookups or selection flows.

## Testing Strategy

Testing should emphasize deterministic seams first and only use integration coverage where state coordination matters.

- **Pure unit tests for list logic**
  - milestone grouping order
  - priority sorting within milestone
  - created-date fallback ordering
  - rendering of priority/status badges
  - exclusion of archived issues from active lists
  - archived issues appearing only in archived listings

- **Store tests for archive behavior**
  - archiving moves an issue from `.megapowers/issues/` to `.megapowers/issues/archive/`
  - archived file frontmatter is rewritten to `status: archived`
  - archive metadata is recorded
  - id/slug/title are preserved
  - archived issues no longer appear in active queries
  - already-archived / missing issue paths fail clearly

- **Integration tests for session behavior**
  - archiving a non-active issue leaves workflow state alone
  - archiving the active issue resets workflow state cleanly
  - issue selection/list UI does not surface archived issues in active flows
  - archived view shows archived entries without reintroducing them into triage or active selection

- **Regression tests around existing commands**
  - current `/issue list` and related flows continue to work
  - batch/source issue lookup behavior remains stable
  - prompt injection and idle issue summaries do not incorrectly treat archived issues as open backlog items

This scope keeps V1 tightly aligned with the current pain: making the backlog readable, archivable, and navigable without taking on the larger design problem of interactive reprioritization.