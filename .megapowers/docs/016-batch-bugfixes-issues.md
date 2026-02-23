# Feature: Issue Triage & Batching

## Summary

The `/triage` command enables users to review open issues, group related ones, and create batch issues that consolidate multiple individual issues into a single workflow unit. Batch issues carry a `sources` field in their frontmatter referencing the source issue IDs they address.

## Key Concepts

- **Batch Issue:** A regular issue with a `sources: [id1, id2, ...]` field in its frontmatter. It goes through the standard bugfix or feature workflow as a single unit.
- **Source Issue:** An individual issue referenced by a batch issue's `sources` field. Annotated in the issue list as "(in batch XXX)" when part of an active batch.
- **Triage:** The process of reviewing open issues, grouping them by affinity, and creating batch issues.

## Commands

### `/triage`
Interactive command that:
1. Lists all open non-batch issues
2. Prompts for batch title, type (bugfix/feature), source issue IDs, and description
3. Creates a new batch issue with the specified sources
4. Activates the batch issue and enters its first workflow phase

## Store API

| Method | Description |
|--------|-------------|
| `createIssue(title, type, desc, sources?)` | Creates an issue; optional `sources` array writes `sources: [...]` to frontmatter |
| `getSourceIssues(slug)` | Returns full `Issue` objects for each ID in the batch's `sources` field |
| `getBatchForIssue(issueId)` | Returns the slug of the first open/in-progress batch containing that issue ID, or `null` |

## Workflow Integration

- **Prompt injection:** When the active issue has sources, `buildSourceIssuesContext()` formats all source issues and appends them to every phase prompt via `before_agent_start`.
- **Issue list annotation:** `formatIssueListItem` appends "(in batch XXX)" for issues that are sources in an active batch.
- **Auto-close on done:** When a batch issue is closed (via "Close issue" or "Done"), all source issues are automatically marked `status: done`.

## Files Changed

| File | Changes |
|------|---------|
| `extensions/megapowers/store.ts` | `sources` field on `Issue`, parsing in frontmatter, `getSourceIssues`, `getBatchForIssue`, `createIssue` sources param |
| `extensions/megapowers/ui.ts` | `formatIssueListItem` batch annotation, `closeSourceIssues` helper, `handleTriageCommand` |
| `extensions/megapowers/index.ts` | `/triage` command registration, source issue prompt injection |
| `extensions/megapowers/prompts.ts` | `buildSourceIssuesContext` function |
| `prompts/triage.md` | Triage prompt template |

## Limitations

- No automated issue clustering — triage is conversational
- No prevention of starting individual workflows on batched issues (annotation is informational)
- No nested batches (batch referencing another batch)
