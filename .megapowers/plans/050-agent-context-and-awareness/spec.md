## Goal
Improve Megapowers agent context and workflow usability by (1) relaxing write restrictions for safe/allowlisted files in every phase without weakening source-code/TDD protections, and (2) ensuring a useful Megapowers prompt is injected even when no issue is active, plus prompt guidance that prevents the agent getting stuck on type-only tasks.

## Acceptance Criteria
1. When megapowers is enabled and there is no active issue, `buildInjectedPrompt()` returns non-null injected text that includes the Megapowers protocol/tooling orientation (loaded from a dedicated `prompts/base.md` template).
2. When megapowers is disabled, `buildInjectedPrompt()` returns `null` regardless of whether an active issue exists.
3. When megapowers is enabled and an active issue is set, `buildInjectedPrompt()` injects the phase-specific prompt template for the current phase (not `prompts/base.md`).
4. `prompts/base.md` exists as a standalone template file and is the only template used by the “enabled but no active issue” injection path.
5. `canWrite()` allows writes/edits to allowlisted safe files (as determined by `isAllowlisted()`, e.g. markdown/docs/config/typings) in every workflow phase, including early phases (e.g. brainstorm/spec/plan/review) and done.
6. `canWrite()` continues to block writes/edits to non-allowlisted source code files (e.g. `.ts`/`.js` outside the allowlist) in phases where source changes are not permitted (i.e. any phase other than implement/code-review per existing policy).
7. During implement phase, `canWrite()` continues to enforce the TDD guard for non-allowlisted source files (i.e. the allowlist relaxation does not bypass the “test written + RED observed” requirement for production/source files).
8. The `prompts/write-plan.md` template contains explicit guidance that purely type-only or otherwise non-testable tasks must be marked with a `[no-test]` annotation.
9. The `prompts/implement-task.md` template contains explicit guidance that `/tdd skip` may be used as an escape hatch when a task cannot reasonably produce a failing runtime test.
10. Automated tests fail if any `{{variable}}` placeholder present in any prompt template under `prompts/` is not populated by the prompt injection logic (i.e. missing variables cannot ship unnoticed).

## Out of Scope
- Changing the TDD guard implementation to recognize type-checkers (e.g. `tsc`) as a RED signal.
- Adding new tools or slash commands (e.g. `create_issue`) or changing existing tool schemas.
- Performing an autonomous large-scale rewrite of all prompt templates without human review/approval.
- Changing workflow phase gates or the state-machine phase graph beyond what is required to support the new base prompt injection path.

## Open Questions
