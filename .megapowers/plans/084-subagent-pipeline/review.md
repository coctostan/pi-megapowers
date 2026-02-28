# Plan Review: Subagent Pipeline (#084)

Date: 2026-02-28

Verdict: **revise**

This review evaluates `.megapowers/plans/084-subagent-pipeline/plan.md` against the acceptance criteria (AC 1–34) and repo conventions (TypeScript, `bun test`, production imports using `.js` extensions).

---

## Per-Task Assessment

### Task 1: Add `pi-subagents` dependency [no-test] — ✅ PASS
No issues. Config-only change with concrete verification steps (`bun install`, `bunx tsc --noEmit`).

### Task 2: Dispatcher types (`DispatchConfig`, `DispatchResult`, `Dispatcher`) [no-test] — ✅ PASS
No issues. Type-only artifact with typecheck verification.

### Task 3: Message parsing utilities (`extractFilesChanged`, `extractTestsPassed`, `extractFinalOutput`, `extractToolCalls`) — ✅ PASS
No blockers. Tests are concrete and cover the intended extraction behavior.

### Task 4: `PiSubagentsDispatcher` (runSync wrapper + config translation) — ✅ PASS
No blockers. Test validates override mapping and context injection.

Non-blocking note: `AbortSignal.timeout()` is assumed to exist in the Bun/Node runtime used by pi-subagents. If it’s not available in the target runtime, you’ll need a small polyfill or alternative timeout mechanism.

### Task 5: TDD auditor (`auditTddCompliance`) — ✅ PASS
No issues. Deterministic, path-pattern based ordering audit matches AC 13–15.

### Task 6: Pipeline context builder (`buildInitialContext`, `appendStepOutput`, `setRetryContext`, `renderContextPrompt`) — ✅ PASS
No issues. Accumulation of review findings across retries is explicitly tested (AC12).

### Task 7: Pipeline log (`writeLogEntry`, `readPipelineLog`) — ✅ PASS
No issues. JSONL behavior is deterministic and fully test-covered.

### Task 8: jj workspace manager (create/squash/cleanup) (injectable `execJJ`) — ✅ PASS
No blockers.

Non-blocking note: consider consistently passing `{ cwd: projectRoot }` for non-workspace-scoped jj operations (e.g., `squash`, `workspace forget`) to reduce the risk of accidentally running those commands from inside a workspace.

### Task 9: Workspace diff helpers (`getWorkspaceDiff`) [depends: 8] — ✅ PASS
No issues.

### Task 10: Result parser (`parseStepResult`, `parseReviewVerdict`) [depends: 3] — ✅ PASS
No issues.

### Task 11: Pipeline runner (`runPipeline`) [depends: 3, 5, 6, 7, 9, 10] — ✅ PASS
No blockers. Tests cover:
- happy path
- verify-failure retry + pause budget
- timeout error handling

### Task 12: Dependency validator (`validateTaskDependencies`) [depends: none] — ✅ PASS
No issues.

### Task 13: Pipeline resume metadata store (`pipeline-meta`) [depends: none] — ✅ PASS
No issues.

### Task 14: Pipeline tool handler (`pipeline`) [depends: 8, 11, 12, 13] — ❌ REVISE
Two spec-alignment blockers:

- **AC32 (agent definitions) + tool alignment:** this handler dispatches the reviewer as `"pipeline-reviewer"`, but the spec’s AC32 requires that a **`reviewer`** agent definition exists (exact name). Either:
  - rename/define the agent as `reviewer` (recommended), and have the pipeline tool use that name, **or**
  - update the spec/AC text to explicitly accept `pipeline-reviewer` as the reviewer agent name.

- **AC27 (resume input shape):** AC27 describes resume as `{ taskIndex, resume: true, guidance: string }`.
  - In this plan, `guidance` is optional in the tool input type.
  - Make `guidance` required when `resume: true` (validation-level), or update AC27 to allow an empty/omitted guidance string.

Clarification (potential AC25 mismatch, confirm intent): the handler restricts execution to the **current** plan task (`state.currentTaskIndex`). AC25/AC26 read as “any taskIndex that exists + deps satisfied.” If “current task only” is intended, call that out explicitly in the tool description and/or spec.

### Task 15: One-shot subagent tool handler (`subagent`) — single dispatch in workspace — ✅ PASS
No blockers.

Ordering note (non-blocking): this task relies on the workspace manager from Task 8; consider adding `[depends: 8]` for plan clarity.

### Task 16: Add pipeline agents (`implementer`, `pipeline-reviewer`, `verifier`) [no-test] — ❌ REVISE
- **AC32 naming mismatch (blocking):** the spec requires an agent definition named **`reviewer`**, but this task creates `pipeline-reviewer` instead.
  - Fix by creating `.pi/agents/reviewer.md` (and update references), or revise AC32 to match the new name.

Everything else in these prompts looks consistent with repo enforcement (implementer includes `megapowers_signal` and explicit RED/GREEN instructions).

### Task 17: Satellite compatibility for pi-subagents (`PI_SUBAGENT_DEPTH`) + project-root resolution — ✅ PASS
No issues. This is necessary for pi-subagents-spawned satellite sessions.

### Task 18: Tool wiring — register `pipeline`, update `subagent`, remove `subagent_status` — ✅ PASS
No blockers.

Non-blocking note: when constructing tool handlers, consider using `resolveProjectRoot(ctx.cwd, process.env)` (or equivalent) before reading state, to make tool execution robust even if invoked from a workspace cwd.

### Task 19: Clean slate replacement — delete old subagent implementation/tests — ✅ PASS
No issues.

---

## Missing Coverage
None found — AC 1–34 are mapped to at least one task.

---

## Verdict
**revise**

Required changes before approval:
1) **AC32 naming compliance:** introduce a `reviewer` agent definition (or change AC32) and update pipeline runner/tool wiring accordingly (Tasks 14 & 16).
2) **Resume contract (AC27):** require `guidance` when `resume: true` (or update AC27 to allow it to be optional).
3) Confirm whether `pipeline` should be **current-task only** or **any taskIndex with deps satisfied**, and align Task 14 + tool description + AC wording accordingly.
