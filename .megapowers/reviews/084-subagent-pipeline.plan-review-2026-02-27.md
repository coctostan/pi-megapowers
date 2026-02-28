# Plan Review: Subagent Pipeline (#084)

Date: 2026-02-27

Verdict: **revise**

This review covers the implementation plan for Issue **084-subagent-pipeline** against the spec acceptance criteria and megapowers project conventions.

---

## Per-Task Assessment

### Task 1: Add `pi-subagents` dependency [no-test] — ✅ PASS
No issues.

### Task 2: Dispatcher types (`DispatchConfig`, `DispatchResult`, `Dispatcher`) [no-test] — ✅ PASS
No issues.

### Task 3: Message parsing utilities (`extractFilesChanged`, `extractTestsPassed`, `extractFinalOutput`, `extractToolCalls`) — ✅ PASS
No issues.

### Task 4: `PiSubagentsDispatcher` (runSync wrapper + config translation) — ✅ PASS
No issues in the test plan itself.

Note: later wiring assumes `pi-subagents` exports and types match the planned imports/signatures; add a typecheck verification step where real imports are introduced (see Task 18).

### Task 5: TDD auditor (`auditTddCompliance`) — ✅ PASS
No issues.

### Task 6: Pipeline context builder — ✅ PASS
No issues.

### Task 7: Pipeline log (JSONL) — ✅ PASS
No issues.

### Task 8: jj workspace manager — ✅ PASS
No issues.

### Task 9: Workspace diff helpers (`getWorkspaceDiff`) — ✅ PASS
No issues.

### Task 10: Result parser (`parseStepResult`, `parseReviewVerdict`) — ✅ PASS
No issues.

### Task 11: Pipeline runner (`runPipeline`) — ❌ REVISE
- **AC10/11 initial context not provided to implement step on cycle 0:** the plan creates the initial context but the first implement dispatch sets `context: undefined`, so implementer won’t receive plan/spec/learnings on the first cycle.
  - Fix: always pass `context: renderContextPrompt(ctx)` to the implement step, including cycle 0.
- **Retry budget semantics likely off-by-one vs AC7 (“default: 3 cycles”):** `for (cycle = 0; cycle <= maxRetries; cycle++)` yields `maxRetries + 1` cycles.
  - Fix: either (a) rename to `maxCycles` (default 3) and loop `< maxCycles`, or (b) keep `maxRetries` but clearly define it as “additional retries after the first attempt” and implement accordingly.
- **Pipeline runner unit test is not self-contained due to filesystem writes:** `writeLogEntry(projectRoot, ...)` writes to disk. The test passes `projectRoot: "/project"` which is usually unwritable/non-existent.
  - Fix: in `tests/pipeline-runner.test.ts`, use a temp dir (`mkdtempSync`) for `projectRoot` and create a real `workspaceCwd` directory beneath it.

### Task 12: Dependency validator (`validateTaskDependencies`) — ✅ PASS
No issues.

### Task 13: Pipeline resume metadata store (`pipeline-meta`) — ✅ PASS
No issues.

### Task 14: Pipeline tool handler (`pipeline`) — ❌ REVISE
- **Pipeline completion will likely fail to mark task done due to existing hard TDD gate in megapowers:** current `handleSignal(..., "task_done")` checks `state.tddTaskState` for non-`[no-test]` tasks. The new design audits subagent tool calls, but does not populate parent `tddTaskState`, so `task_done` can error and AC28 won’t be reliably met.
  - Required plan change: explicitly implement the spec’s shift to “prompt + deterministic audit + reviewer soft gate” by removing/relaxing hard TDD gating, *or* explicitly set/update the TDD state in a deterministic manner before calling `task_done` (note: this conflicts with the spec’s stated direction).
- **`extractTaskSection()` regex is incorrect / will truncate task sections:** the lookahead `(?=...|\n?$)` with `m` tends to match end-of-line, so it often captures only the header line.
  - Fix: replace with a robust parser (e.g., split on `^### Task \d+:` boundaries and select the matching section; or a lookahead for next task header or end-of-string without multiline `$` pitfalls).
- **Resume does not carry forward previous pause context/log automatically:** resume reuses workspace but resets pipeline context (only optional guidance is injected).
  - Recommendation (not strictly required by AC27, but aligns with AC12): include last pause `errorSummary` and/or last N log entries (read from log.jsonl) into the resumed initial context.

### Task 15: One-shot subagent tool handler (`subagent`) — ✅ PASS
No issues.

### Task 16: Add pipeline agents (`implementer`, `pipeline-reviewer`, `verifier`) [no-test] — ✅ PASS (minor clarification)
- If any hard TDD “write blocking” remains in satellite/subagent mode, the implementer prompt should explicitly mention calling `megapowers_signal({ action: "tests_failed" })` after the expected failing test run to unlock production writes.
- If the spec is implemented as written (audit + soft gate; no hard blocking), the prompt is fine.

### Task 17: Satellite compatibility for pi-subagents (`PI_SUBAGENT_DEPTH`) + project-root resolution — ❌ REVISE (minor)
- **Step 2 expected failure output is too vague.** Replace with concrete failing expectations (which `expect(...)` fails and what it returns).

### Task 18: Tool wiring — ❌ REVISE
- Add an explicit verification step that runs **`bunx tsc --noEmit`** after introducing real `pi-subagents` imports.
- High risk of API mismatch: the plan assumes exports/signatures for `discoverAgents` and `runSync`. Add a small test or at minimum ensure typecheck catches mismatches.

### Task 19: Clean slate replacement — ✅ PASS
No issues.

---

## Missing Coverage

No explicit acceptance-criteria gaps in the plan’s AC→Task mapping.

However, there is a **spec/implementation mismatch** that must be resolved in the plan:
- The spec’s goal says TDD enforcement moves to **audit + reviewer soft gate**.
- The current codebase still contains **hard TDD gating** that can block `task_done` and/or writes.
- The plan adds an auditor, but does **not** include tasks to remove/adjust those existing hard gates.

---

## Required Changes Before Re-Review

1. Update **Task 11** to:
   - include initial context for implement step,
   - align retry budget semantics with AC7,
   - make tests use a writable temp `projectRoot`.
2. Update **Task 14** to ensure **AC28 is achievable** under the new TDD model (address existing hard TDD gates).
3. Update **Task 14** to fix `extractTaskSection` implementation.
4. Update **Task 17 Step 2** with specific expected failure output.
5. Update **Task 18** to add `bunx tsc --noEmit` verification and validate actual `pi-subagents` API exports.
