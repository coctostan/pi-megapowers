# Verification Report: 080-clean-context-windows

## Test Suite Results

```
bun test v1.3.9 (cf6cdbbb)
 843 pass
 0 fail
 1951 expect() calls
Ran 843 tests across 76 files. [633.00ms]
```

Full suite passes with zero failures.

---

## Per-Criterion Verification

### Criterion 1: `handleSignal` returns `triggerNewSession: true` when `phase_next` succeeds

**Evidence:**
```
bun test tests/tool-signal.test.ts -t "returns triggerNewSession on successful phase advance"
 1 pass / 0 fail / 2 expect() calls
```
Test at `tests/tool-signal.test.ts:366` — sets phase to `brainstorm`, calls `handleSignal(tmp, "phase_next")`, asserts `result.triggerNewSession === true`.
Implementation: `extensions/megapowers/tools/tool-signal.ts` `handlePhaseNext` returns `{ triggerNewSession: true }` on success.

**Verdict:** ✅ PASS

---

### Criterion 2: `handleSignal` returns `triggerNewSession: true` when `phase_back` succeeds

**Evidence:**
```
bun test tests/tool-signal.test.ts -t "returns triggerNewSession on successful backward transition"
 1 pass / 0 fail / 2 expect() calls
```
Test at `tests/tool-signal.test.ts:411` — sets phase to `verify`, calls `handleSignal(tmp, "phase_back")`, asserts `result.triggerNewSession === true`.
Implementation: `handlePhaseBack` in `tool-signal.ts` returns `{ triggerNewSession: true }` on success.

**Verdict:** ✅ PASS

---

### Criterion 3: `handleSignal` returns `triggerNewSession: true` when `task_done` succeeds and advances to next task

**Evidence:**
```
bun test tests/tool-signal.test.ts -t "returns triggerNewSession when advancing to next task"
 1 pass / 0 fail / 2 expect() calls
```
Test at `tests/tool-signal.test.ts:216` — 2-task plan, `currentTaskIndex: 0`, asserts `result.triggerNewSession === true` after `task_done`.
Implementation: `handleTaskDone` in `tool-signal.ts` returns `{ triggerNewSession: true }` on "advance to next task" path.

**Verdict:** ✅ PASS

---

### Criterion 4: `handleSignal` returns `triggerNewSession: true` when `task_done` succeeds and auto-advances to verify

**Evidence:**
```
bun test tests/tool-signal.test.ts -t "returns triggerNewSession when auto-advancing to verify"
 1 pass / 0 fail / 3 expect() calls
```
Test at `tests/tool-signal.test.ts:173` — 1-task plan, `currentTaskIndex: 0`, asserts `result.triggerNewSession === true` and message contains "verify".
Implementation: `handleTaskDone` returns `{ triggerNewSession: true }` on "all done, auto-advance to verify" path.

**Verdict:** ✅ PASS

---

### Criterion 5: `handleSignal` returns `triggerNewSession: true` when `plan_draft_done` succeeds (no regression)

**Evidence:**
```
bun test tests/tool-signal.test.ts -t "plan_draft_done"
 8 pass / 0 fail / 14 expect() calls
```
Test at `tests/tool-signal.test.ts:325` ("sets triggerNewSession flag") — calls `handleSignal(tmp, "plan_draft_done")`, asserts `result.triggerNewSession === true`. Pre-existing test, still passing.

**Verdict:** ✅ PASS

---

### Criterion 6: `handlePlanReview` returns `triggerNewSession: true` when verdict is `approve` (no regression)

**Evidence:**
```
bun test tests/tool-plan-review.test.ts -t "returns triggerNewSession on approve"
 1 pass / 0 fail / 2 expect() calls
```
Test at `tests/tool-plan-review.test.ts:219` — approve verdict, asserts `result.triggerNewSession === true`.
Implementation: `handleApproveVerdict` in `tool-plan-review.ts` returns `{ triggerNewSession: true }` (added in Task 7).

**Verdict:** ✅ PASS

---

### Criterion 7: `handlePlanReview` returns `triggerNewSession: true` when verdict is `revise` (no regression)

**Evidence:**
```
bun test tests/tool-plan-review.test.ts -t "triggerNewSession"
 2 pass / 0 fail / 3 expect() calls
```
Test at `tests/tool-plan-review.test.ts:123` ("sets triggerNewSession flag on revise") — pre-existing test, still passing. `handleReviseVerdict` already returned `{ triggerNewSession: true }`.

**Verdict:** ✅ PASS

---

### Criterion 8: `handleSignal` does NOT return `triggerNewSession` on error results (any action)

**Evidence:**
```
bun test tests/tool-signal.test.ts (full suite)
 73 pass / 0 fail
```
Four specific tests at `tests/tool-signal.test.ts:797-831` (in `describe("triggerNewSession — error cases")`):
- `phase_next` fails (spec.md missing) → `result.triggerNewSession` is `undefined` ✓
- `phase_back` fails (no backward transition from brainstorm) → `undefined` ✓
- `task_done` fails (TDD check, `tddTaskState: null`) → `undefined` ✓
- `plan_draft_done` fails (wrong phase) → `undefined` ✓

All error return paths return `{ error: "..." }` without `triggerNewSession`.

**Verdict:** ✅ PASS

---

### Criterion 9: `handleSignal` does NOT return `triggerNewSession` for non-transition actions (`tests_failed`, `tests_passed`, `close_issue`)

**Evidence:**
```
bun test tests/tool-signal.test.ts (full suite)
 73 pass / 0 fail
```
Three specific tests at `tests/tool-signal.test.ts:833-864` (in `describe("triggerNewSession — non-transition actions")`):
- `tests_failed` → `result.triggerNewSession` is `undefined` ✓
- `tests_passed` → `result.triggerNewSession` is `undefined` ✓
- `close_issue` → `result.triggerNewSession` is `undefined` ✓

**Verdict:** ✅ PASS

---

### Criterion 10: Signal tool handler calls `ctx.newSession()` when `triggerNewSession` is set

**Evidence — API constraint note:**
`ExtensionContext` (the type tool execute handlers receive) does NOT expose `newSession()` directly — that method is on `ExtensionCommandContext` only. `ctx.sessionManager` is typed as `ReadonlySessionManager`, which is `Pick<SessionManager, "getCwd" | "getSessionDir" | ... "getSessionName">` — `newSession` is excluded from the pick. Therefore `ctx.newSession()` is not callable from a tool handler without compile errors.

The plan (Task 9) correctly identified this constraint: "The `ExtensionContext` type (used in tool execute) does not expose `newSession`" and specified `(ctx.sessionManager as any)?.newSession?.()` as the correct simplified approach (dropping the broken `parentSession` argument).

**Implementation in `extensions/megapowers/register-tools.ts` (line 44-46):**
```ts
if (result.triggerNewSession) {
  (ctx.sessionManager as any)?.newSession?.();
}
```

**Integration test evidence:**
```
bun test tests/new-session-wiring.test.ts
 6 pass / 0 fail / 9 expect() calls
```
- "megapowers_signal(phase_next) starts a new session on successful transition" → `newSessionCalls === 1` ✓
- "megapowers_signal(task_done) starts a new session when advancing to next task" → `newSessionCalls === 1` ✓
- "megapowers_signal does NOT call newSession on error" → `newSessionCalls === 0` ✓
- "calls newSession via sessionManager cast without parentSession arg" → source contains `(ctx.sessionManager as any)?.newSession?.()`, does NOT contain `parentSession` or `getSessionFile` ✓

The spec wording `ctx.newSession()` is not achievable (API constraint); the plan's specified pattern is correctly implemented and functionally equivalent. The old broken call `(ctx.sessionManager as any)?.newSession?.({ parentSession: ... })` has been replaced with the simplified `(ctx.sessionManager as any)?.newSession?.()`.

**Verdict:** ✅ PASS (intent fully met; spec wording `ctx.newSession()` is not achievable from tool execute context per API design)

---

### Criterion 11: Plan-review tool handler calls `ctx.newSession()` when `triggerNewSession` is set

**Evidence — same API constraint as AC10.**

**Implementation in `extensions/megapowers/register-tools.ts` (line 97-99):**
```ts
if (result.triggerNewSession) {
  (ctx.sessionManager as any)?.newSession?.();
}
```

**Integration test evidence:**
```
bun test tests/new-session-wiring.test.ts
 6 pass / 0 fail
```
- "megapowers_plan_review(revise) starts a new session" → `newSessionCalls === 1` ✓
- Source inspection confirms no `parentSession`, no `getSessionFile` ✓

**Verdict:** ✅ PASS (same rationale as AC10)

---

## Overall Verdict

**PASS**

All 11 acceptance criteria are satisfied:
- AC1–4: `triggerNewSession: true` on all new successful transitions (phase_next, phase_back, task_done→next, task_done→verify)
- AC5–7: No regressions — plan_draft_done and plan_review (both verdicts) still return `triggerNewSession: true`
- AC8–9: Error paths and non-transition actions correctly omit `triggerNewSession`
- AC10–11: Both tool handlers call newSession when `triggerNewSession` is set; the simplified cast `(ctx.sessionManager as any)?.newSession?.()` (without the broken `parentSession` argument) is in place and verified by integration tests. The spec's literal `ctx.newSession()` wording is not achievable from tool execute context (`ExtensionContext` doesn't expose `newSession`), but the functional intent is fully met.

Full suite: **843 pass, 0 fail**.
