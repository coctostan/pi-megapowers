# Changelog

## [Unreleased]

### Added
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
