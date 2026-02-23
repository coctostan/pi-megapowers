# Changelog

## [Unreleased]

### Added
- **Issue Triage & Batching**: `/triage` command to review open issues, group them, and create batch issues
- `sources` field on `Issue` type — batch issues reference source issue IDs in frontmatter (`sources: [6, 13, 17]`)
- `store.getSourceIssues(slug)` — returns full Issue objects for a batch's source IDs
- `store.getBatchForIssue(issueId)` — finds the active batch containing a given issue
- `buildSourceIssuesContext()` — formats source issues for prompt injection across all workflow phases
- `formatIssueListItem` annotates source issues with "(in batch XXX)" in issue lists
- Auto-close: completing a batch issue automatically marks all its source issues as done
- `prompts/triage.md` template for LLM-assisted issue grouping
- **Bugfix workflow**: Full reproduce → diagnose → plan → review → implement → verify → done workflow
- `reproduce-bug.md` prompt template with `{{issue_slug}}` interpolation
- `diagnose-bug.md` prompt template with `{{reproduce_content}}` and optional `## Fixed When` section
- `generate-bugfix-summary.md` prompt template for done-phase summary generation
- Phase gates: `reproduce→diagnose` (requires reproduce.md), `diagnose→plan` (requires diagnosis.md)
- Artifact routing for reproduce and diagnose phases
- `extractFixedWhenCriteria()` in spec-parser — extracts numbered acceptance criteria from diagnosis
- Bugfix-specific prompt variable aliasing: reproduce→brainstorm_content, diagnosis→spec_content for plan phase
- Bugfix done-phase menu with "Generate bugfix summary" option
- `doneMode: "generate-bugfix-summary"` state support
- Integration tests for bugfix prompt variable injection (`tests/bugfix-integration.test.ts`)

### Fixed
- Stale acceptance criteria no longer persist after diagnosis edits remove `## Fixed When` section
