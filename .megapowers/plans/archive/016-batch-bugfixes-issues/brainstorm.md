# Brainstorm: Batch Bugfixes/Issues

## Problem
Working issues one-at-a-time through full workflows is too slow when the backlog has many small/related bugs and features. No mechanism exists to triage the backlog, group related issues, and process them efficiently.

## Approach
Issue triage and batching is implemented as a `/triage` command that sits outside the two main workflows (feature and bugfix) but produces issues that feed directly into them. The command reads all open issues, presents them to the LLM and user in a conversational brainstorm, and outputs batch issues — regular issues with a `sources` frontmatter field listing the IDs of the individual issues they address.

Batch issues are normal issues that live alongside everything else in `.megapowers/issues/`. They have `type: bugfix` or `type: feature` and go through their respective standard workflow. The only difference is the `sources` field, which tells the system to inject source issue content into phase prompts and to auto-close source issues when the batch completes. A batch of bugs goes through reproduce → diagnose → plan → implement → verify → done, addressing all its source bugs as a unit. A batch of features goes through brainstorm → spec → plan → ... → done.

The triage process itself is conversational — the LLM reviews all open issues, proposes groupings by code affinity and relatedness, and the user adjusts before committing. Issues can always be worked individually by skipping triage entirely. The issue list UI annotates source issues that belong to an active batch (e.g., "006 - open (in batch 019)") so they aren't accidentally double-worked.

## Key Decisions

- **No new workflow types** — batch issues use existing bugfix or feature workflows unchanged. The `sources` field is the only data model addition.
- **No separate batch storage** — batches are issues in the same `.megapowers/issues/` directory, distinguishable by the presence of `sources` in frontmatter.
- **Triage is conversational, not automated** — the `/triage` command opens a brainstorm-style discussion where the LLM proposes groupings and the user finalizes. No algorithmic clustering.
- **Markdown as source of truth** — source issue content is injected into prompts by reading the actual `.md` files. The LLM handles validation, overlap, and grouping quality naturally by reading files. Only auto-close and UI annotation are mechanically enforced.
- **No new issue statuses** — source issues stay `open` until their batch completes, then go to `done`. The "in batch X" annotation is a UI display concern computed by scanning for `sources` references, not a stored status.

## Components

- **`/triage` command** — Registered in `index.ts`. Reads all open issues via store, formats them into a triage prompt, creates a brainstorm-style conversation. When the user finalizes groups, creates batch issues with `sources` field and appropriate `type`.
- **`sources` field support in store** — `store.ts` gets a helper to read source issues for a batch issue (`getSourceIssues(issueSlug)`) and a reverse lookup (`getBatchForIssue(issueId)`) for the UI annotation.
- **Prompt injection for batch issues** — `prompts.ts` detects when the active issue has `sources`, reads those issue files, and injects their content as additional context into phase prompts (reproduce, diagnose, brainstorm, spec, plan).
- **Done-phase auto-close** — When a batch issue reaches `done` and has `sources`, the done phase marks all source issues as `status: done`. Changelog/PR text references both the batch ID and source IDs.
- **Issue list annotation in UI** — `ui.ts` issue display checks whether each issue is referenced as a source by any open batch issue, and appends "(in batch XXX)" if so.
- **Triage prompt template** — A new `prompts/triage.md` template that presents open issues and instructs the LLM to propose groupings by type, code affinity, and relatedness.

## Testing Strategy

- **Store tests** — `getSourceIssues()` and `getBatchForIssue()` are pure data lookups on markdown files with frontmatter. Test with fixture issues.
- **Prompt injection tests** — Verify batch issues get source content injected; non-batch issues don't.
- **Done-phase auto-close tests** — Mock store, verify source issues get closed when batch completes.
- **UI annotation tests** — Verify "(in batch XXX)" annotations appear correctly.
- **Triage command tests** — Verify open issues are read, prompt formatted, batch issues created with proper frontmatter.
