# Code Review: 080-clean-context-windows

## Files Reviewed

| File | Change Description |
|---|---|
| `extensions/megapowers/tools/tool-signal.ts` | Added `triggerNewSession: true` to `handlePhaseNext`, `handlePhaseBack`, two `handleTaskDone` paths; added `handleCloseIssue` + `close_issue` dispatch case |
| `extensions/megapowers/tools/tool-plan-review.ts` | Added `triggerNewSession: true` to `handleApproveVerdict` |
| `extensions/megapowers/register-tools.ts` | Added `close_issue` to tool schema; simplified both `newSession` call sites (dropped `parentSession` argument) |
| `extensions/megapowers/hooks.ts` | Removed all done-phase automatic action processing (`close-issue`, `push-and-pr`, `capture-learnings`, content-capture); retained deferred checklist + dashboard refresh |
| `extensions/megapowers/prompt-inject.ts` | Added `branch_name` and `base_branch` vars for done-phase prompt interpolation |
| `prompts/done.md` | Rewritten to LLM-driven: LLM executes all actions via tools in a single turn; new `push-and-pr` section with `bash()` calls; `close-issue` section now calls `megapowers_signal({ action: "close_issue" })` |
| `prompts/megapowers-protocol.md` | Added `close_issue` signal documentation |
| `tests/tool-signal.test.ts` | 75 tests; added `triggerNewSession` tests (AC1–9), `close_issue` signal suite, non-transition tests |
| `tests/tool-plan-review.test.ts` | Added `triggerNewSession` on approve test (AC6) |
| `tests/new-session-wiring.test.ts` | Added integration tests for `phase_next` and `task_done`; replaced `parentSession` assertion with simplified-cast assertion |
| `tests/hooks.test.ts` | Removed old done-action processing tests; added assertion that `onAgentEnd` no longer consumes actions |
| `tests/reproduce-084-batch.test.ts` | Removed `onAgentEnd` close-issue control test |
| `tests/reproduce-086-bugs.test.ts` | Removed 180+ lines of legacy done-action reproduction tests; kept Bug 3 (onContext) and Bug 5 (workspace creation) |

---

## Strengths

**Clean signal return contract** (`tool-signal.ts`): `triggerNewSession` is consistently added only to success paths — error returns are plain `{ error: ... }`. The pattern is mechanically simple and easy to audit. No ambiguity about when a new session fires.

**Correct `close_issue` placement** (`tool-signal.ts:315–334`): Moving `close-issue` logic from a hidden `onAgentEnd` hook into an explicit tool call is a significant correctness improvement. The LLM now has control and visibility; the old implicit hook was opaque and deadlock-prone (hence issues #081, #087, #090).

**`megaEnabled` preservation** (`tool-signal.ts:331`): `writeState(cwd, { ...createInitialState(), megaEnabled: state.megaEnabled })` correctly resets all state to idle while preserving the user's mega toggle. Matches the pattern used by the previous `hooks.ts` implementation.

**Simplified `newSession` call** (`register-tools.ts:44–46`): Dropping the broken `parentSession` argument (which used `getSessionFile()` — a method that doesn't exist on `ReadonlySessionManager`) is an unambiguous improvement. The simplified `(ctx.sessionManager as any)?.newSession?.()` is no more or less safe and removes dead code.

**LLM-driven done phase** (`prompts/done.md`): Replacing the multi-turn hook-driven loop with a single-turn LLM execution is architecturally sounder. The old `doneActions[0]`-per-turn loop had well-documented liveness problems; the new prompt instructs all actions in one turn, after which `close_issue` wipes state. The `{{branch_name}}`/`{{base_branch}}` interpolation in `prompt-inject.ts:137–138` is properly guarded with `?? ""` to prevent raw template-marker leakage (confirmed by test `"does not leave raw branch template vars when branch/base are null"`).

**Negative-case test coverage** (`tests/tool-signal.test.ts:792–864`): Dedicated `describe` blocks for error cases (AC8) and non-transition actions (AC9) are well-scoped. Testing that `triggerNewSession` is `undefined` (not just falsy) on error paths is the correct assertion.

**Integration test wiring** (`tests/new-session-wiring.test.ts`): The three new integration tests drive `registerTools`-level execution (not just the handler) and verify `sessionManager.newSessionCalls`, confirming the full path from tool call to `newSession` invocation.

---

## Findings

### Critical

None.

---

### Important

**1. Double blank line in `register-tools.ts` (line 47–48)**
After simplifying the `newSession` block (removing the old `parent` variable), an extra blank line was left, creating two consecutive blank lines between the `triggerNewSession` block and the `if (ctx.hasUI)` block. The TDD guard prevented fixing during review, but it should be cleaned up in a follow-up commit.

```ts
      if (result.triggerNewSession) {
        (ctx.sessionManager as any)?.newSession?.();
      }
                                           // ← extra blank line here
      if (ctx.hasUI) {
```
**Fix:** Remove one of the two blank lines.

---

### Minor

**2. Self-referential source-text test in `reproduce-086-bugs.test.ts` (line 8–13)**
The test `"does not keep legacy done-action queue reproductions in reproduce-086"` reads its own test file to assert that two old `describe` block strings are absent. This is doubly fragile: it will never fail in practice (any refactor that changes those strings also changes what the test looks for), and it tests code *organization* rather than *behavior*. The test provides no safety net for regressions.
**Recommendation:** Delete this test. The removal of legacy code is adequately covered by the behavioral tests in `hooks.test.ts` that assert `onAgentEnd` no longer processes done-actions.

**3. Source-text assertions in `hooks.test.ts` (line ~90–97) and `new-session-wiring.test.ts` (line ~190–194)**
Two tests assert specific strings must/must not appear in source files (e.g., `expect(source).not.toContain("squashAndPush")`). This pattern exists in the pre-existing codebase; it's not introduced here. It's fragile but acceptable as a guard for newly-removed code. Note for future: prefer behavioral tests where possible.

**4. Error message ambiguity in `handleCloseIssue` (`tool-signal.ts:319`)**
```ts
return { error: "close_issue can only be called during the done phase." };
```
This message fires for two conditions: `!state.activeIssue` OR `state.phase !== "done"`. If `activeIssue` is null but phase is `done` (a theoretically invalid state), the error message is misleading. In practice this combination shouldn't occur, but the message could distinguish the two cases for debugging.
**Recommendation:** `"close_issue can only be called when in done phase with an active issue."` (covers both conditions accurately).

**5. Scope expansion beyond spec**
The implementation includes a significant done-phase architecture refactor (#091 — LLM-driven action execution) alongside the core #080 `triggerNewSession` work. The refactor is coherent and addresses known liveness bugs (#081, #087, #090, #090-deadlock), but it was not in the original spec. The verification report correctly validates all 11 spec criteria; the bonus work appears sound.

**6. `squash-and-push` behavior change in done phase**
The old `hooks.ts` used `squashAndPush()` (squash-before-push semantics). The new `done.md` instructs a plain `git push origin {{branch_name}}`. If there are uncommitted or multi-commit changes on the branch, the push behavior differs. This is an intentional trade-off (simplicity over squash), but worth documenting in `CHANGELOG.md` explicitly so users are aware the squash behavior is gone.

---

## Recommendations

1. **Clean up the double blank line** in `register-tools.ts:47` — one-line change.
2. **Delete the self-referential test** in `reproduce-086-bugs.test.ts:8–13` — it adds noise without safety.
3. **CHANGELOG entry** should explicitly mention the squash-before-push behavior change (from #083's `squashAndPush` to plain `git push`) so users aren't surprised by multi-commit PRs.

---

## Assessment

**ready**

All 11 spec acceptance criteria are implemented and verified. The core changes (`triggerNewSession` propagation, `newSession` call simplification) are minimal, correct, and well-tested. The bonus #091 done-phase refactoring is coherent and addresses documented liveness bugs. Findings are two minor style issues and one minor documentation gap — none block shipping.
