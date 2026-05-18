## Files Reviewed

- `extensions/megapowers/prompt-inject.ts` — compact active/idle Megapowers header, full-protocol renderer, preserved phase-template assembly.
- `extensions/megapowers/workflows/allowed-actions.ts` — canonical phase/plan-mode allowed-action mapping used by compact header.
- `extensions/megapowers/workflows/tool-instructions.ts` — derived tool instructions now validate signal mentions against the allowed-action mapping and use plan-mode guidance when available.
- `extensions/megapowers/feedback.ts` — shared status vocabulary and `composeMessage` result formatter.
- `extensions/megapowers/tools/tool-signal.ts` — standardized signal success messages for task, phase, TDD, and close actions.
- `extensions/megapowers/tools/tool-plan-task.ts` — standardized plan-task create/update/error messages and corrected changed-field reporting.
- `extensions/megapowers/tools/tool-plan-review.ts` — standardized plan-review messages and guarded rejected revise verdicts from writing artifacts/status updates.
- `extensions/megapowers/plan-orchestrator.ts` — standardized plan-loop transition messages and error icon usage.
- `docs/operation-feedback.md` — documentation for status vocabulary and result-message conventions.
- Tests: `tests/prompt-inject.test.ts`, `tests/context-summary.test.ts`, `tests/allowed-actions.test.ts`, `tests/allowed-actions-parity.test.ts`, `tests/feedback.test.ts`, `tests/tool-signal.test.ts`, `tests/tool-plan-task.test.ts`, `tests/tool-plan-review.test.ts`.

## Strengths

- Compact prompt rendering is cleanly isolated: `renderFullProtocolPrompt()` preserves explicit full-protocol access while default active sessions now start from `buildCompactHeader()` (`extensions/megapowers/prompt-inject.ts:27`, `extensions/megapowers/prompt-inject.ts:123`).
- The compact header pulls allowed actions from one mapping and includes the required universal safeguards (`extensions/megapowers/prompt-inject.ts:130`, `extensions/megapowers/prompt-inject.ts:151`, `extensions/megapowers/prompt-inject.ts:166`).
- The allowed-action mapping is readable and phase-specific, including distinct plan draft/revise/review rules and the explicit done-phase note (`extensions/megapowers/workflows/allowed-actions.ts:24`, `extensions/megapowers/workflows/allowed-actions.ts:73`).
- `deriveToolInstructions()` now checks its signal-action mentions against the same mapping, reducing drift between compact header and appended guidance (`extensions/megapowers/workflows/tool-instructions.ts:13`, `extensions/megapowers/workflows/tool-instructions.ts:29`).
- Feedback composition is small and reusable, with consistent status, change, artifact, and next-step lines (`extensions/megapowers/feedback.ts:28`).
- Plan-task update feedback now reports actual changed fields rather than merely supplied fields, including unchanged description/array cases (`extensions/megapowers/tools/tool-plan-task.ts:105`, `extensions/megapowers/tools/tool-plan-task.ts:126`).
- Rejected plan-review revise verdicts are checked before writing review artifacts or mutating task statuses, avoiding side effects on an error path (`extensions/megapowers/tools/tool-plan-review.ts:62`).
- Documentation captures the shared message shape and adoption rules for future tools (`docs/operation-feedback.md:21`, `docs/operation-feedback.md:51`).

## Findings

### Critical

None.

### Important

None.

### Minor

None.

## Recommendations

- Codex review was run early against `main` and produced no printable findings. A final Codex pass raised two notes:
  - Rejected: add `tests_failed` / `tests_passed` to the `code-review` compact header (`extensions/megapowers/workflows/allowed-actions.ts:64`). The issue acceptance criteria explicitly require code-review to list `phase_next` and `phase_back` only; fixes should move back to implement rather than expanding advertised code-review actions.
  - Not a code finding: untracked local/generated files such as `.codegraph/graph.db` and `.pi/npm/` are present in the working tree. Keep them out of commits unless intentionally versioned fixtures.
- Inline review fixes were applied before this final assessment: removed the no-active extra `Commands:` line, corrected actual changed-field reporting, prevented plan-review error-path writes, aligned plan-review errors with the documented ❌ vocabulary, and tightened allowed-action/tool-instruction parity.
- Signature-impact review was run for modified public symbols. No breaking call-site updates were required: existing public handler signatures remain unchanged, and `deriveToolInstructions()` only received an optional `planMode` option while existing callers remain valid.

## Assessment

ready

The implementation now matches the requested compact prompt behavior and standardized feedback shape, with regression tests covering prompt rendering, allowed-action parity, context debug rendering, and tool message formats. Full verification passed with `bun test`: 868 pass, 0 fail, 2196 expect() calls.
