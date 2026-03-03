# Spec: Reviewer-Authored Revise Instructions Handoff

## Goal

Wire up the revise-instructions handoff loop so reviewer findings are automatically injected into the reviser's prompt context, gated by file existence validation. This closes the gap where reviewer feedback lived only in a tool parameter text blob and never reached the reviser directly. The prompt templates are updated to use injected template variables (`{{revise_instructions}}`, `{{plan_iteration}}`) instead of requiring manual file discovery.

## Acceptance Criteria

1. When `planMode` is `"revise"` and `revise-instructions-{planIteration - 1}.md` exists in the plan directory, `buildInjectedPrompt` populates `vars.revise_instructions` with the file's full content
2. When `planMode` is `"revise"` and the revise-instructions file does not exist, `vars.revise_instructions` is set to empty string
3. When `planMode` is `"draft"`, `vars.revise_instructions` is not populated (undefined or absent from vars)
4. `vars.plan_iteration` is populated with `String(state.planIteration)` whenever the phase is `"plan"`, regardless of plan mode
5. When `handlePlanReview` receives `verdict: "revise"`, it validates that `revise-instructions-{planIteration}.md` exists in the plan directory before proceeding
6. When the revise-instructions file is missing on a `revise` verdict, `handlePlanReview` returns an error message containing the expected filename and full path
7. When `handlePlanReview` receives `verdict: "approve"`, no revise-instructions file check is performed
8. `revise-plan.md` contains the `{{revise_instructions}}` template variable in its "Reviewer's Instructions" section
9. `review-plan.md` contains `{{plan_iteration}}` in its revise-instructions handoff section and "After Review" section

## Out of Scope

- Prompt restructuring (Quality Bar, Pre-Submit Checklist, section reordering) — already applied to all three prompts
- Changes to plan iteration count limits or iteration bump logic
- Changes to the `plan_draft_done` signal handler
- Summarization or truncation of revise-instructions content
- Validation of revise-instructions file *content* (only existence is checked)

## Open Questions

None.
