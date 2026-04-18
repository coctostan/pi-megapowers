## Goal
Add inline, phase-specific tool guidance to the eleven affected workflow prompt templates so each step points to the most appropriate concrete tool or slash command when it is needed, while keeping the existing prompt-injection architecture intact, preserving prompt size discipline, and documenting the prompt-to-tool mapping for inspection and drift checks.

## Acceptance Criteria
1. `prompts/brainstorm.md` adds inline guidance in `## Read first` for: structural-map `read` on unfamiliar files; `symbol_graph` for named functions/classes/modules; `symbol_graph` with `include: ["contract"]` when a proposed change touches an existing symbol; `grep` versus `ast_search` for text versus structural searches; and `bash` `git log --oneline -20 -- <path>` when recent churn or prior attempts matter.

2. `prompts/write-spec.md` adds inline guidance under `## Purpose` telling the agent to use `symbol_graph` to confirm existing symbols named by acceptance criteria and to use `symbol_graph` with `include: ["contract"]` when the criterion depends on current guards, throws, or invariants; `## Legacy handling` adds a bullet telling the agent to verify every prose-named symbol exists before extracting it as an implied requirement.

3. `prompts/write-plan.md` adds inline guidance at the top of `## Read the Codebase First` for batching many lookups through `code_execution` in a single script; in that same section it adds guidance for `symbol_graph`, `symbol_graph` with `include: ["contract"]`, `ast_search`, `impact` with `changeType: "signature_change"`, `trace`, and `read` with `symbol: "<name>"`; the task template adds the required Step 1, Step 2, and Step 3 hints; and `## Pre-Submit Checklist` adds the `grep`-based acceptance-criterion coverage verification hint.

4. `prompts/review-plan.md` adds inline guidance to criterion 1 for mechanical AC coverage checks via `grep`, to criterion 2 for dependency/order validation via `symbol_graph` or `grep`, to criterion 3 for verifying Step 3 APIs/signatures via `symbol_graph` and `read`, and to criterion 6 for codebase-realism checks via `symbol_graph` and `ast_search`.

5. `prompts/revise-plan.md` adds inline guidance between `## Instructions` items 3 and 4 for `symbol_graph`, `read` with `symbol: "<name>"`, and `ast_search`; adds a missing-coverage bullet using `grep` and a signature-change bullet using `impact` to `## Most Common Revision Failures`; and adds the coverage re-check item to `## Pre-Submit Checklist`.

6. `prompts/implement-task.md` adds inline guidance in RED step 1 for `read` with `symbol: "<name>"` or `symbol_graph` with `include: ["source"]`, in GREEN step 1 for re-reading current source and using hashline anchors with `edit`, in GREEN step 5 for `impact`-based regression discovery, and in `## When Stuck` a row covering drift between the plan and current file state.

7. `prompts/verify.md` adds inline guidance in Step 1 for using `impact` to enumerate downstream dependents before treating the full test suite as sufficient regression coverage; in Step 2 it adds a code-inspection proof hint using `symbol_graph`/`read` or `ast_search` and a user-observable proof hint using `trace`; and `## What Actually Proves a Claim` adds the new row stating that `trace` from the real entry point is required evidence that new behavior is actually reached.

8. `prompts/code-review.md` adds inline guidance at the top of `## Instructions` to run `/codex-review --base <ref>` early and, for high-stakes changes, `/codex-adversarial-review --base <ref>` with focus text; it adds a correctness hint using `symbol_graph` with `include: ["contract"]`, a breaking-change hint using `impact` with `changeType: "signature_change"`, tightens the realism rule to prefer `symbol_graph` and `read` with `symbol: "<name>"`, and adds `needs-fixes` guidance to re-read anchored source and re-run `impact` for any signature changes made during review.

9. `prompts/reproduce-bug.md` adds inline guidance in Step 1 for `symbol_graph` with `include: ["source"]` and anchored `read`, in Step 2 for `bash` `git log --oneline -20 -- <path>` and `git diff <suspect-commit>`, in Step 4 for `trace` across the real execution path, and in Step 5 for `read` with `symbol: "<name>"` before writing the failing test.

10. `prompts/diagnose-bug.md` adds inline guidance in Phase 1 for `trace` and `symbol_graph` caller inspection, in Phase 2 step 4 for `symbol_graph` with `include: ["contract"]` plus `impact`, and after diagnosis for `impact`-based risk assessment tied to the root-cause function.

11. `prompts/done.md` adds inline guidance inside `### generate-docs` to pull real API signatures from `symbol_graph` or `read` with `symbol: "<name>"`, and inside `### generate-bugfix-summary` to confirm symbol names and locations with `symbol_graph` before writing the summary.

12. All new tool guidance is step-local and concrete: it is inline at the action it governs, uses the approved imperative micro-patterns, backticks the named tool/command, avoids re-explaining global routing-table or per-tool-registry content, and does not conditionalize on pi-maintained tool availability. When a required placement compares alternative tools or contrasts text versus structural lookup, it may be rendered as adjacent inline single-tool sentences or bullets at the same step so long as every required tool-purpose mapping is preserved.

13. `docs/phase-tools.md` is added as descriptive documentation that lists, for each prompt file touched by this issue, each inline-referenced tool/command, the section/step where it is referenced, and the rationale for that reference; prompt markdown remains the authoritative source of truth.

14. The implementation stays within the current prompt-injection architecture: no new assembly layer, overlay system, `tools:` config source, or separate prompt-guidance data store is introduced; the guidance appears as plain text in assembled prompts through the existing injector; and prompt edits integrate hints by tightening or replacing nearby prose rather than appending standalone tool-guidance blocks, so injected context does not materially grow.

15. Automated tests fail if any required prompt hint or tool reference from criteria 1-11 is missing, if `docs/phase-tools.md` and the prompt contents drift out of sync in either direction, or if assembled prompt snapshots lose the inline guidance; existing prompt-injection behavior outside these intentional text changes remains green.

## Out of Scope
- A TUI or session-level warning when a prompt references a pi-maintained tool that is not registered in the current session.
- A required reverse tool×prompt summary table format for `docs/phase-tools.md`.
- A style-linter that enforces the approved hint micro-patterns.
- Any capability-tag-to-tool resolver, `tools:` field on phase/workflow config, or other parallel source of truth for prompt tool guidance.
- Presence-aware or project-specific tool overlays, or dynamic hint selection based on session activity.
- Multi-tool orchestration guidance beyond the single `code_execution` batching hint in `prompts/write-plan.md`.
- `/codex-review` or `/codex-adversarial-review` guidance outside `prompts/code-review.md`.
- Step-2 bash-probe hints in reviewer prompts, or the deferred Phase 2 `ast_search` pattern-analysis hint in `prompts/diagnose-bug.md`.
- Reframing prompt guidance around non-pi-authored third-party tools.

## Open Questions
None.

## Requirement Traceability
- `R1 -> AC 1, AC 2, AC 3, AC 4, AC 5, AC 6, AC 7, AC 8, AC 9, AC 10, AC 11, AC 12, AC 14`
- `R2 -> AC 12`
- `R3 -> AC 1, AC 2, AC 3, AC 4, AC 5, AC 6, AC 7, AC 8, AC 9, AC 10, AC 11, AC 12`
- `R4 -> AC 12`
- `R5 -> AC 12`
- `R6 -> AC 13`
- `R7 -> AC 14`
- `R8 -> AC 1, AC 2, AC 3, AC 4, AC 5, AC 6, AC 7, AC 8, AC 9, AC 10, AC 11`
- `O1 -> Out of Scope`
- `O2 -> Out of Scope`
- `O3 -> Out of Scope`
- `D1 -> Out of Scope`
- `D2 -> Out of Scope`
- `D3 -> Out of Scope`
- `D4 -> Out of Scope`
- `D5 -> Out of Scope`
- `D6 -> Out of Scope`
- `D7 -> Out of Scope`
- `D8 -> Out of Scope`
- `D9 -> Out of Scope`
- `C1 -> AC 14`
- `C2 -> AC 12`
- `C3 -> AC 13, AC 14`
- `C4 -> AC 12, AC 14`
- `C5 -> AC 14, AC 15`
- `C6 -> AC 12`
- `C7 -> AC 12`
- `Q1 -> Out of Scope`
