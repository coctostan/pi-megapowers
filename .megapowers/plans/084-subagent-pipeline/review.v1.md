# Plan Review: Subagent Pipeline (#084)

Date: 2026-02-28

Verdict: **revise**

This review evaluates the current `plan.md` for Issue **084-subagent-pipeline** against the acceptance criteria (AC 1–34), repo conventions (TypeScript, `bun test`, `.js` import extensions), and the plan-review rubric.

---

## Per-Task Assessment

### Task 1: Add `pi-subagents` dependency [no-test] — ❌ REVISE
- **Self-containment:** the **Files** list only mentions `package.json`, but `bun install` will also update **`bun.lock`** (and potentially `package-lock.json` depending on repo policy). Please list the expected lockfile(s) explicitly.
- Verification commands are good (`bun install`, `bunx tsc --noEmit`).

### Task 2: Dispatcher types (`DispatchConfig`, `DispatchResult`, `Dispatcher`) [no-test] — ✅ PASS
No issues. Type-only change with concrete typecheck verification.

### Task 3: Message parsing utilities (`extractFilesChanged`, `extractTestsPassed`, `extractFinalOutput`, `extractToolCalls`) — ✅ PASS
No rubric blockers.

- Granularity note (non-blocking): this task implements/tests 4 utilities at once. It’s cohesive, but it does exceed the “one behavior per task” ideal.

### Task 4: `PiSubagentsDispatcher` (runSync wrapper + config translation) — ✅ PASS
No issues. Test validates override mapping + prompt context injection.

### Task 5: TDD auditor (`auditTddCompliance`) — ✅ PASS
No issues. Coverage includes ordering, config-file exclusion, and production-file classification.

### Task 6: Pipeline context builder (`buildInitialContext`, `appendStepOutput`, `setRetryContext`, `renderContextPrompt`) — ❌ REVISE
- **AC 12 requires accumulated review findings across retries**, but `setRetryContext()` currently overwrites `accumulatedReviewFindings`.
  - Example: a reject in cycle 1 replaces findings from cycle 0.
- Actionable fixes:
  - Change `accumulatedReviewFindings` to `string[]` and append per reject, **or**
  - Keep it as `string` but append with a clear delimiter (do not replace).
- Update the Task 6 test to call `setRetryContext()` multiple times and assert earlier findings remain present.

### Task 7: Pipeline log (`writeLogEntry`, `readPipelineLog`) — ✅ PASS
No issues. JSONL write/read is deterministic and well tested.

### Task 8: jj workspace manager (create/squash/cleanup) — ✅ PASS
No issues.

### Task 9: Workspace diff helpers (`getWorkspaceDiff`) — ✅ PASS
No issues.

- Step 2 expected failure is slightly vague (“not exported / not a function”) but still actionable.

### Task 10: Result parser (`parseStepResult`, `parseReviewVerdict`) — ✅ PASS
No issues.

- Minor note (non-blocking): `parseReviewVerdict()` defaults to `reject` if neither token appears; that’s fine, but make sure the reviewer prompt makes ambiguity unlikely.

### Task 11: Pipeline runner (`runPipeline`) — ❌ REVISE
- **AC 10/11:** the initial context is built from plan/spec/learnings, but **cycle 0 implement dispatch does not receive any context**:
  - `context: cycle === 0 ? undefined : renderContextPrompt(ctx)`
  - This means the implementer doesn’t see spec/plan/learnings on the first attempt, which is likely to cause incorrect implementations and violates the intent of AC 10/11.
- Actionable fixes:
  - Always pass `renderContextPrompt(ctx)` to the implement step, including cycle 0.
  - Update/add a test assertion that the implementer dispatch receives context containing `planSection` / `specContent` when provided.

### Task 12: Dependency validator (`validateTaskDependencies`) — ✅ PASS
No issues.

### Task 13: Pipeline resume metadata store (`pipeline-meta`) — ✅ PASS
No issues.

### Task 14: Pipeline tool handler (`pipeline`) — ✅ PASS (with one clarification)
No blocking issues found.

- **Clarification to confirm (spec alignment):** the handler rejects running `taskIndex` unless it matches the **current** plan task (`state.currentTaskIndex`). AC 25 says “for the specified plan task”, which could be read as “any plan task”.
  - If “current task only” is intended behavior, consider stating that explicitly in the plan/spec or tool description.

### Task 15: One-shot subagent tool handler (`subagent`) — ✅ PASS
No issues.

### Task 16: Add pipeline agents (`implementer`, `pipeline-reviewer`, `verifier`) [no-test] — ❌ REVISE
- The repo’s TDD guard (see `AGENTS.md`) blocks production writes until a failing test run is acknowledged via `megapowers_signal({ action: "tests_failed" })`.
- **Problem:** `.pi/agents/implementer.md` does **not** include `megapowers_signal` in its `tools:` list, so the implementer agent cannot call `tests_failed` (or `tests_passed`).
- Actionable fixes:
  - Add `megapowers_signal` to `tools:` for the implementer agent.
  - Update the implementer prompt to explicitly instruct:
    1) write test
    2) run test (expect fail)
    3) call `megapowers_signal({ action: "tests_failed" })`
    4) write production
    5) rerun tests (expect pass)
    6) call `megapowers_signal({ action: "tests_passed" })` (optional, depending on how you want to record state)

### Task 17: Satellite compatibility for pi-subagents (`PI_SUBAGENT_DEPTH`) + project-root resolution — ✅ PASS
No issues. This is necessary for subagent-spawned sessions.

- Step 2 expected failure is descriptive rather than an exact assertion failure string, but it’s still clear enough.

### Task 18: Tool wiring — register `pipeline`, update `subagent`, remove `subagent_status` — ❌ REVISE
- **TDD completeness / verification quality:** the new `tools-wiring` test only checks that strings appear in source files (readFileSync). That does **not** ensure the new imports from `pi-subagents/*` actually typecheck/resolve.
- Actionable fixes:
  - Add `bunx tsc --noEmit` to Step 5 (or Step 4) for this task, **or**
  - Add a test that actually imports the updated module(s) so Bun/TS compilation runs on the new imports.

### Task 19: Clean slate replacement — delete old subagent implementation/tests — ✅ PASS
No issues. The importability test is deterministic and matches AC 34.

---

## Missing Coverage
None found — AC 1–34 are mapped to at least one task.

---

## Verdict
**revise**

Required changes before approval:
1) **Task 6:** accumulate review findings across retries (AC 12).
2) **Task 11:** pass initial plan/spec/learnings context to the implement step on cycle 0 (AC 10/11).
3) **Task 16:** add `megapowers_signal` to implementer tools + explicitly instruct calling `tests_failed` (to work with existing TDD guard).
4) **Task 18:** add a real typecheck/import verification so `pi-subagents` imports are validated.

Confirmation requested before re-submission:
- Do you intend the `pipeline` tool to run **only the current task** (as in Task 14), or **any taskIndex** as long as dependencies are satisfied? If the latter, Task 14’s restriction should be removed/adjusted.
