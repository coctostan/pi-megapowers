# Plan Review: Subagent Pipeline (#084)

Date: 2026-02-28

Verdict: **revise**

This review evaluates **Plan v5** for Issue **084-subagent-pipeline** against the provided acceptance criteria, repo conventions (TypeScript + `bun test`, `.js` import extensions), and the review rubric.

---

## Per-Task Assessment

### Task 1: Add `pi-subagents` dependency [no-test] — ✅ PASS
No issues. Justification + verification (`bun install`, `bunx tsc --noEmit`) are concrete.

### Task 2: Dispatcher types (`DispatchConfig`, `DispatchResult`, `Dispatcher`) [no-test] — ✅ PASS
No issues. Type-only change with typecheck verification.

### Task 3: Message parsing utilities (`extractFilesChanged`, `extractTestsPassed`, `extractFinalOutput`, `extractToolCalls`) — ✅ PASS
No rubric blockers.

Note (granularity): this task covers 4 utilities in one module + test file. It’s cohesive, but if you want stricter “one behavior per task” you could split later.

### Task 4: `PiSubagentsDispatcher` (runSync wrapper + config translation) — ✅ PASS
No issues. Test is specific and validates the important mapping behavior.

### Task 5: TDD auditor (`auditTddCompliance`) — ✅ PASS
No issues. Tests cover ordering + config-file exclusion.

### Task 6: Pipeline context builder (`buildInitialContext`, `appendStepOutput`, `setRetryContext`, `renderContextPrompt`) — ❌ REVISE
AC 12 requires **accumulated** review findings across retries.

- Current `setRetryContext()` overwrites `accumulatedReviewFindings` when a later cycle rejects again, so findings are not truly accumulated.
- Actionable fix:
  - Change `accumulatedReviewFindings` to an array (e.g. `string[]`) and append new findings, or
  - If you keep a string, append with a clear delimiter instead of replacing.
- Add/adjust the test in Task 6 to cover *multiple* `setRetryContext()` calls and assert earlier findings remain present.

### Task 7: Pipeline log (`writeLogEntry`, `readPipelineLog`) — ✅ PASS
No issues. JSONL write/read tests are concrete.

### Task 8: jj workspace manager (create/squash/cleanup) — ✅ PASS
No issues.

### Task 9: Workspace diff helpers (`getWorkspaceDiff`) — ✅ PASS
No issues.

### Task 10: Result parser (`parseStepResult`, `parseReviewVerdict`) — ✅ PASS
No issues.

Minor note: `parseReviewVerdict()` defaults to `reject` if neither (or both) verdict tokens appear. That’s acceptable, but consider making the reviewer prompt stricter so ambiguity is rare.

### Task 11: Pipeline runner (`runPipeline`) — ✅ PASS
No issues that block implementation.

Minor note (non-blocking): implement dispatch currently passes the task both as `task` and again inside `context` (because `renderContextPrompt()` includes `## Task`). Consider removing the duplicate if it makes prompts noisy.

### Task 12: Dependency validator (`validateTaskDependencies`) — ✅ PASS
No issues.

### Task 13: Pipeline resume metadata store (`pipeline-meta`) — ✅ PASS
No issues.

### Task 14: Pipeline tool handler (`pipeline`) — ✅ PASS
No issues.

### Task 15: One-shot subagent tool handler (`subagent`) — ✅ PASS
No issues.

### Task 16: Add pipeline agents (`implementer`, `pipeline-reviewer`, `verifier`) [no-test] — ❌ REVISE
Satellite-mode TDD enforcement requires the implementer to be able to call `megapowers_signal({ action: "tests_failed" })` (your prompt text already instructs this).

- **Problem:** `.pi/agents/implementer.md` does **not** include `megapowers_signal` in the `tools:` list, so pi-subagents will not enable the tool for that agent.
- Actionable fix:
  - Add `megapowers_signal` to the implementer’s `tools:` frontmatter list.

(Everything else in these agent files is fine as a `[no-test]` change, and `bunx tsc --noEmit` is a reasonable verification step.)

### Task 17: Satellite compatibility for pi-subagents (`PI_SUBAGENT_DEPTH`) + project-root resolution — ✅ PASS
No issues. Test is specific and change is required.

### Task 18: Commands filtering — ✅ PASS
No issues.

### Task 19: Tool registration wiring — ✅ PASS
No issues. The plan includes a `bunx tsc --noEmit` verification step, which is important for real pi-subagents export correctness.

### Task 20: Clean slate replacement — ✅ PASS
No issues. Deletion list + clean-slate importability test is deterministic.

---

## Missing Coverage
None found — all AC 1–34 are mapped to tasks.

## Verdict
**revise**

Required changes before approval:
1) **Task 6**: ensure retry context *accumulates* review findings across cycles (AC 12).
2) **Task 16**: add `megapowers_signal` to the implementer agent’s tool list so the `tests_failed` unlock is actually callable.
