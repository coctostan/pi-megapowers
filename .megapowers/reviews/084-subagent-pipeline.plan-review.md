# Plan Review: Subagent Pipeline (#084)

Date: 2026-02-28

Verdict: **revise**

This review evaluates the submitted plan for Issue **084-subagent-pipeline** against the acceptance criteria (AC 1–34), repo conventions (TypeScript + `bun test`, production imports via `.js` extension), and the review rubric.

---

## Per-Task Assessment

### Task 1: Add `pi-subagents` dependency [no-test] — ✅ PASS
No issues. Config-only change with concrete verification (`bun install`, `bunx tsc --noEmit`).

### Task 2: Dispatcher types (`DispatchConfig`, `DispatchResult`, `Dispatcher`) [no-test] — ✅ PASS
No issues. Type-only file creation with typecheck verification.

### Task 3: Message parsing utilities (`extractFilesChanged`, `extractTestsPassed`, `extractFinalOutput`, `extractToolCalls`) — ✅ PASS
No rubric blockers.

Note (granularity, non-blocking): This task bundles 4 utilities into one module + test; cohesive, but larger than “one behavior per task”.

### Task 4: `PiSubagentsDispatcher` (runSync wrapper + config translation) — ✅ PASS
No blockers. Test locks in override mapping.

Minor note (non-blocking): relies on `AbortSignal.timeout(...)`; confirm support in your target Bun/Node runtime.

### Task 5: TDD auditor (`auditTddCompliance`) — ✅ PASS
No issues. Tests cover ordering + config exclusion.

### Task 6: Pipeline context builder (`buildInitialContext`, `appendStepOutput`, `setRetryContext`, `renderContextPrompt`) — ✅ PASS
No issues. Explicit test covers AC12 “accumulated findings across multiple retries”.

### Task 7: Pipeline log (`writeLogEntry`, `readPipelineLog`) — ✅ PASS
No issues.

### Task 8: jj workspace manager (create/squash/cleanup) — ✅ PASS
No issues.

### Task 9: Workspace diff helpers (`getWorkspaceDiff`) — ✅ PASS
No issues.

### Task 10: Result parser (`parseStepResult`, `parseReviewVerdict`) — ✅ PASS
No blockers.

Minor note (non-blocking): `parseReviewVerdict()` defaults to `reject` if verdict text is ambiguous; ensure the reviewer agent prompt is strict enough that this is rare.

### Task 11: Pipeline runner (`runPipeline`) — ✅ PASS
No blockers. Tests now cover:
- AC5: verify-failure output (from `tool_result`) is included in the next implement context
- AC6: review rejection triggers full retry with findings carried forward
- timeouts counting toward retry budget

### Task 12: Dependency validator (`validateTaskDependencies`) — ✅ PASS
No issues.

### Task 13: Pipeline resume metadata store (`pipeline-meta`) — ✅ PASS
No issues.

### Task 14: Pipeline tool handler (`pipeline`) — ✅ PASS (with 1 confirmation)
✅ Tests now assert paused payload includes `log + diff + errorSummary` and that resume reuses the existing workspace.

⚠️ Confirmation needed (AC25 interpretation): the plan intentionally restricts `pipeline({ taskIndex })` to the *current* task (`state.currentTaskIndex`). If AC25 is intended to allow running *any* task index whose deps are satisfied, this would need adjustment. If “current task only” is the intended safety guardrail, keep as-is.

### Task 15: One-shot subagent tool handler (`subagent`) — ✅ PASS
No blockers.

Minor note (non-blocking): consider adding a small failure-path test asserting `cleanupPipelineWorkspace()` is used when `exitCode !== 0`.

### Task 16: Add pipeline agents (`implementer`, `reviewer`, `verifier`) [no-test] — ✅ PASS
No issues. Implementer includes `megapowers_signal` in tools, aligning with the existing TDD guard requirements.

### Task 17: Satellite compatibility for pi-subagents (`PI_SUBAGENT_DEPTH`) + project-root resolution — ✅ PASS
No issues. Test is specific and change is required.

### Task 18: Tool wiring — register `pipeline`, update `subagent`, remove `subagent_status` — ✅ PASS
No blockers. Verification step (`bunx tsc --noEmit && bun test`) is appropriate given new external dependency imports.

### Task 19: Clean slate replacement — delete old subagent implementation/tests — ❌ REVISE
This task is missing required TDD/rubric steps.

- **Missing Step 3:** the plan stops after “Run test, verify it fails”. It must explicitly instruct deleting the listed old files (and any other remaining `extensions/megapowers/subagent/subagent-*.ts` + matching tests), and/or updating imports, as the actual fix step.
- **Missing Step 4:** re-run `bun test tests/clean-slate.test.ts` with expected **PASS**.
- **Missing Step 5:** run `bun test` with expected “all passing”.

Actionable fix: extend Task 19 with Step 3–5, e.g.
- Step 3 — Delete the enumerated files; ensure no remaining imports reference them.
- Step 4 — `bun test tests/clean-slate.test.ts` → PASS
- Step 5 — `bun test` → all passing

---

## Missing Coverage
None found — all AC 1–34 are mapped to tasks.

## Verdict
**revise**

Required changes before approval:
1) **Task 19:** add Steps 3–5 (delete old modules + re-run the clean-slate test + full suite).
2) **Task 14 (confirmation):** confirm whether “current task only” behavior is acceptable for AC25; if not, adjust handler/test accordingly.
