# Spec: Issue Triage & Batching

## Goal

Add a `/triage` command that lets users review all open issues, discuss groupings with the LLM, and create batch issues — regular issues with a `sources` frontmatter field referencing the individual issues they consolidate. Batch issues go through the standard bugfix or feature workflow as a unit, with source issue content injected into phase prompts. When a batch issue completes, all its source issues are auto-closed. The issue list annotates source issues that belong to an active batch.

## Acceptance Criteria

1. Issue frontmatter supports an optional `sources` field containing a list of issue IDs (e.g., `sources: [6, 13, 17]`).
2. `parseIssueFrontmatter` parses the `sources` field into an array of numbers on the `Issue` type. Issues without `sources` have an empty array.
3. `store.getSourceIssues(slug)` returns the full `Issue` objects for each ID in the batch issue's `sources` field.
4. `store.getSourceIssues(slug)` returns an empty array for non-batch issues (no `sources` field).
5. `store.getBatchForIssue(issueId)` returns the slug of the first open/in-progress batch issue whose `sources` contains that ID, or `null` if none.
6. The `/triage` command reads all open issues from the store and formats them as context for a triage prompt.
7. The `/triage` command creates a new issue with `type` set to `bugfix` or `feature`, a `sources` field referencing the grouped issue IDs, and a description summarizing the source issues.
8. The `/triage` command activates the newly created batch issue and enters its first workflow phase (brainstorm for features, reproduce for bugfixes).
9. When the active issue has a non-empty `sources` field, the `before_agent_start` prompt injection includes the full text of each source issue as additional context.
10. Source issue content injection applies to all phases of the workflow (brainstorm, spec, reproduce, diagnose, plan, review, implement, verify, code-review).
11. `formatIssueListItem` appends "(in batch XXX)" to the display string when the issue is a source in an active batch.
12. When a batch issue's done phase "Close issue" action runs, all source issues are also marked `status: done`.
13. When a batch issue's done phase "Close issue" action runs, the batch issue itself is also marked `status: done` (existing behavior).
14. A triage prompt template (`prompts/triage.md`) exists and instructs the LLM to review open issues and propose groupings by type and code affinity.
15. `createIssue` accepts an optional `sources` parameter and writes it to the issue frontmatter.
16. The `Issue` type includes a `sources: number[]` field.

## Out of Scope

- Automated/algorithmic issue clustering — triage is conversational, driven by LLM + user.
- New issue status types — source issues stay `open` until batch completes.
- Separate batch storage directory — batches live in `.megapowers/issues/` alongside all issues.
- Preventing users from starting individual workflows on issues that are in a batch — annotation is informational only.
- Nested batches (a batch referencing another batch as a source).

## Open Questions

