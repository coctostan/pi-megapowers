# Plan Review Findings: Kill Phase Transition Popup (#072)

**Review Date:** 2026-02-26  
**Plan Version:** v3  
**Status:** ❌ REVISE REQUIRED

---

## Summary

The plan is comprehensive and well-structured with good AC coverage mapping. However, there are **critical issues** that must be addressed before implementation:

1. **AC2 Implementation Gap**: Clearing `reviewApproved` on `phase_back` is tested but not implemented
2. **Source-code Grepping Anti-pattern**: Multiple tasks use source-code inspection tests instead of behavioral tests
3. **Task Ordering Contradictions**: Task 2 updates code that Task 11 removes
4. **Missing Dependencies**: Task 4 won't fail as expected at Step 2
5. **Incomplete Implementation Specs**: Some implementation steps lack full code

---

## Per-Task Assessment

### Task 1: Replace `doneMode` with `doneActions` in state types — ⚠️ NEEDS MINOR FIX
**AC Coverage:** AC15, AC25 partial

| Step | Status | Issue |
|------|--------|-------|
| 1 | ✅ | Good test structure |
| 2 | ⚠️ | Expected failure message is a TypeScript error, not a test failure |
| 3 | ⚠️ | `transition()` function location not specified (line number unknown) |
| 4-5 | ✅ | Good verification steps |

**Recommendation:** In Step 2, clarify that the failure is a **compile-time TypeScript error**, not a runtime test failure. The `--filter` flag won't work if the code doesn't compile.

---

### Task 2: Update `ui.ts` `doneMode` references — ❌ REMOVE/MERGE
**AC Coverage:** AC15, AC25 partial  
**Depends:** Task 1

**Critical Issue:** This task tests and updates `handleDonePhase`, but **Task 11 removes `handleDonePhase` entirely**. This creates wasted work and confusion.

The `renderStatusText` and `renderDashboardLines` updates belong in **Task 11** (which already includes them). The `handleDonePhase` updates are throwaway work.

**Recommendation:** 
- Delete Task 2 entirely
- Move the `renderStatusText`/`renderDashboardLines` update requirements to Task 11
- Test the display behavior in Task 11's test block

---

### Task 3: Update `hooks.ts` and `prompt-inject.ts` — ⚠️ NEEDS FIX
**AC Coverage:** AC15, AC25 partial  
**Depends:** Task 1

| Step | Status | Issue |
|------|--------|-------|
| 1 | ✅ | Test uses `doneActions` correctly |
| 2 | ⚠️ | Expected failure is compile-time, not runtime |
| 3 | ❌ | **Incomplete implementation** - `doneAction` variable is used but never declared |

**Step 3 Implementation Gap:**
The pseudocode shows:
```ts
if (doneAction !== "capture-learnings") {  // ❌ doneAction is undefined
```

But `doneAction` is never extracted from the array. The actual implementation should be:
```ts
const doneAction = state.doneActions[0];
if (doneAction !== "capture-learnings") {
  writeState(ctx.cwd, { 
    ...state, 
    doneActions: state.doneActions.filter(a => a !== doneAction) 
  });
}
```

**Recommendation:** Fix Step 3 to show complete, working code.

---

### Task 4: `phase_back` — all tests — ❌ DEPENDENCY ISSUE
**AC Coverage:** AC1, AC2, AC3, AC4, AC5, AC6  
**Depends:** Task 1

| Step | Status | Issue |
|------|--------|-------|
| 1 | ✅ | Comprehensive test coverage (9 tests) |
| 2 | ❌ | **Won't fail as expected** - compile error, not "Unknown signal action" |
| 3 | ⚠️ | Missing `reviewApproved` clearing for AC2 |
| 4-5 | ✅ | Good verification |

**Step 2 Problem:** The test adds `handleSignal(tmp, "phase_back")` but the function signature doesn't include `"phase_back"` in its union type yet (that's added in Step 3). This will cause a **compile-time TypeScript error**, not a runtime "Unknown signal action" error.

**Step 3 - AC2 Gap:** The implementation does NOT clear `reviewApproved` when transitioning from review to plan:

```ts
// Current implementation (missing AC2):
const result = advancePhase(cwd, backwardTransition.to, jj);

// Should be:
let updates: Partial<MegapowersState> = {};
if (state.phase === "review" && backwardTransition.to === "plan") {
  updates.reviewApproved = false;
}
const result = advancePhase(cwd, backwardTransition.to, jj, updates);
```

**Recommendation:** 
1. Fix Step 2 expected error message to reflect TypeScript compile error
2. Add `reviewApproved` clearing to the `handlePhaseBack` implementation

---

### Task 5: `phase_next` default target skips backward — ✅ PASS
**AC Coverage:** AC7, AC8

Well-structured task with clear tests and implementation. No issues.

---

### Task 6: Register `phase_back` in tool schema — ❌ ANTI-PATTERN
**AC Coverage:** AC18 partial  
**Depends:** Task 4

| Step | Status | Issue |
|------|--------|-------|
| 1 | ❌ | **Source-code grepping tests** - not behavioral tests |

**The tests grep source code:**
```ts
const source = readFileSync(... "register-tools.ts" ...);
expect(source).toContain('Type.Literal("phase_back")');
```

This is an anti-pattern because:
1. It tests implementation details, not behavior
2. The tool registration is already implicitly tested by Task 4's tests passing
3. Brittle - breaks if formatting changes

**Recommendation:** 
- Delete Task 6 entirely, OR
- Replace with a behavioral test that verifies the tool schema accepts "phase_back"
- Move the implementation (adding `Type.Literal("phase_back")`) to **Task 4 Step 3**

---

### Task 7: Remove popup calls from `onAgentEnd` — ❌ ANTI-PATTERN
**AC Coverage:** AC9, AC10  
**Depends:** Task 2, 3

| Step | Status | Issue |
|------|--------|-------|
| 1 | ❌ | **Source-code grepping tests** |

Same issue as Task 6 - testing by grepping source code.

**Recommendation:** 
- Delete the source-code tests
- The behavioral verification is implicit: if `hooks.ts` still called these functions, other tests would fail
- Keep Step 3-5 as implementation-only

---

### Task 8: `getDoneChecklistItems` pure function — ✅ PASS
**AC Coverage:** AC12  
**Depends:** Task 1

Excellent task structure. All 5 steps present and correct.

---

### Task 9: `showChecklistUI` TUI widget — ✅ VALID NO-TEST
**AC Coverage:** None (utility)  
**Depends:** Task 8

| Aspect | Status |
|--------|--------|
| Justification | ✅ Valid - TUI rendering requires real terminal |
| Verification step | ✅ Has `bun tsc --noEmit` check |

No issues. The justification is sound and matches project conventions.

---

### Task 10: `showDoneChecklist` using `ctx.ui.custom()` — ✅ PASS
**AC Coverage:** AC11, AC13, AC14  
**Depends:** Task 8, 9

Well-structured with proper mocking of `ctx.ui.custom`. Good test coverage for submit/dismiss/subset behaviors.

---

### Task 11: Remove dead code from `ui.ts` — ⚠️ NEEDS FIX
**AC Coverage:** AC22, AC23, AC24  
**Depends:** Task 7, 10

| Step | Status | Issue |
|------|--------|-------|
| 1 | ❌ | **Source-code grepping tests** |
| 3 | ⚠️ | Contradiction with Task 2 |

**Step 3 Issue:** The implementation says:
> "Replace `handleDonePhase` doneMode assignments..."

But `handleDonePhase` shouldn't exist anymore (it's being removed in this task). The Step 3 pseudocode references replacing code that should already be gone from Task 2.

**Recommendation:**
1. Remove source-code grepping tests
2. Clarify Step 3: the `handleDonePhase` function body should be deleted entirely, not updated
3. Add the display tests from Task 2 here (for `renderStatusText` and `renderDashboardLines`)

---

### Task 12: Done-phase prompt reads `doneActions` — ✅ PASS
**AC Coverage:** AC16, AC17  
**Depends:** Task 3, 10

Well-structured. Good test coverage for prompt injection.

**Note:** Ensure `done.md` is added to `PHASE_PROMPT_MAP` in the implementation.

---

### Task 13: Wire done checklist trigger — ❌ ANTI-PATTERN
**AC Coverage:** AC11 complete, AC25 final  
**Depends:** Task 10, 11

| Step | Status | Issue |
|------|--------|-------|
| 1 | ❌ | **Source-code grepping tests** (3 tests grep source) |

Same anti-pattern as Tasks 6 and 7.

**Recommendation:**
- Remove the source-code grepping tests
- The behavioral test is implicit: when `phase_next` advances to done, the checklist appears
- Keep the implementation in Step 3

---

### Task 14: Update prompt files for `phase_back` — ✅ VALID NO-TEST
**AC Coverage:** AC18, AC19, AC20, AC21

| Aspect | Status |
|--------|--------|
| Justification | ✅ Valid - prompt files have no programmatic behavior |
| Verification step | ✅ Has grep verification |

No issues. Valid `[no-test]` task.

---

## Missing Coverage

### AC2 Gap
**AC2:** "`phase_back` from `review` transitions to `plan` and clears `reviewApproved` to `false`"

The test exists in Task 4 Step 1 (`"clears reviewApproved when going back to plan"`), but **the implementation in Task 4 Step 3 does NOT clear `reviewApproved`**.

**Fix needed:** Add `reviewApproved: false` to the state updates in `handlePhaseBack` when transitioning from review to plan.

---

## Critical Issues Summary

| Issue | Severity | Location | Fix Required |
|-------|----------|----------|--------------|
| AC2 not implemented | 🔴 High | Task 4 Step 3 | Add `reviewApproved` clearing |
| Task 2 is throwaway work | 🔴 High | Task 2 | Delete Task 2, merge into Task 11 |
| Source-code grep tests | 🟡 Medium | Tasks 6, 7, 11, 13 | Replace with behavioral tests or delete |
| Compile vs runtime error | 🟡 Medium | Tasks 1, 3, 4 | Clarify expected failure mode |
| Incomplete implementation | 🟡 Medium | Task 3 Step 3 | Add missing `doneAction` declaration |
| Task 4 dependency issue | 🟡 Medium | Task 4 Step 2 | Fix expected error message |

---

## Revised Task Dependency Graph

```
Task 1 (doneMode→doneActions state)
  ├── Task 3 (hooks.ts + inject)    ─┬─→ Task 7 (remove popups from onAgentEnd)
  ├── Task 4 (phase_back signal)     │
  ├── Task 5 (phase_next skips bwd)  │
  └── Task 8 (getDoneChecklistItems)─┼─→ Task 9 (showChecklistUI [no-test])
                                      │     └── Task 10 (showDoneChecklist)
                                      │           └── Task 11 (remove dead code + display updates)
                                      │                 └── Task 12 (done.md prompt)
                                      │                       └── Task 13 (wire checklist)
                                      └── Task 14 (prompt files [no-test])
```

**Task 2 removed** (merged into Task 11).  
**Task 6 removed** (merged into Task 4).

---

## Recommendations for Plan Revision

### 1. Delete Task 2
Move its behavioral tests (for `renderStatusText` and `renderDashboardLines`) into Task 11.

### 2. Delete Task 6
Move the schema registration into Task 4 Step 3.

### 3. Fix Task 4
- Step 2: Change expected error to compile-time TypeScript error
- Step 3: Add `reviewApproved` clearing for AC2

### 4. Remove Source-Code Grepping Tests
Replace Tasks 6, 7, 11, 13 source-code tests with:
- Behavioral tests where meaningful
- Simple verification steps otherwise

### 5. Fix Task 3 Step 3
Add the missing `const doneAction = state.doneActions[0];` declaration.

### 6. Clarify Compile-Time vs Runtime Errors
In Steps 2 of Tasks 1, 3, 4: explicitly state that the failure is a **TypeScript compile error**, not a test runtime error.

---

## Verdict

**❌ REVISE REQUIRED**

The plan has good structure and comprehensive AC coverage, but the AC2 implementation gap and source-code grepping anti-patterns must be fixed before implementation begins.

### Minimum Required Changes:
1. Add `reviewApproved` clearing to Task 4 Step 3
2. Remove or replace source-code grepping tests (Tasks 6, 7, 11, 13)
3. Delete Task 2 and merge relevant parts into Task 11
4. Fix Task 3 Step 3 incomplete implementation

After these changes, the plan will be ready for implementation.
