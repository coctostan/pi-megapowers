# Plan Review: Kill Phase Transition Popup (#072) — v4

**Review Date:** 2026-02-26  
**Reviewer:** Code Review Agent  
**Plan Version:** v4

---

## Executive Summary

**Verdict: ✅ PASS**

The plan is comprehensive, well-structured, and ready for implementation. All 25 acceptance criteria are covered, dependencies are correctly mapped, and each task follows the required TDD format with clear 5-step instructions.

---

## Per-Task Assessment

### Task 1: Replace `doneMode` with `doneActions` in state types — ✅ PASS
- **AC Coverage:** AC15, AC25 (partial)
- **Dependencies:** None (root task)
- **TDD Completeness:** All 5 steps present with exact test code, run commands, and expected outputs
- **Notes:** Clean type migration pattern. Test explicitly verifies `doneMode` is undefined after change.

### Task 2: Update hooks.ts, prompt-inject.ts, ui.ts, commands.ts refs — ✅ PASS
- **AC Coverage:** AC15, AC25 (partial)
- **Dependencies:** [depends: 1]
- **TDD Completeness:** All 5 steps present
- **Notes:** Cross-cutting change across 4 files bundled logically. Step 3 includes comprehensive before/after code blocks for each file.

### Task 3: `phase_back` signal with schema registration — ✅ PASS
- **AC Coverage:** AC1, AC2, AC3, AC4, AC5, AC6, AC18 (partial)
- **Dependencies:** [depends: 1]
- **TDD Completeness:** All 5 steps present
- **Notes:** Comprehensive test suite with 10 test cases covering happy paths (review→plan, verify→implement, code-review→implement) and error paths (no backward transition, bugfix workflow rejection). Implementation correctly clears `reviewApproved` when transitioning to plan.

### Task 4: `phase_next` default target skips backward transitions — ✅ PASS
- **AC Coverage:** AC7, AC8
- **Dependencies:** [depends: 1]
- **TDD Completeness:** All 5 steps present
- **Notes:** Tests verify default resolution skips backward transitions while preserving explicit backward target capability. Gate behavior tests ensure existing functionality preserved.

### Task 5: Remove popup calls from `onAgentEnd` — ✅ PASS
- **AC Coverage:** AC9, AC10
- **Dependencies:** [depends: 2]
- **No-Test Justification:** Valid — pure deletion with behavioral verification via full test suite.
- **Notes:** Clear removal of interactive block. Includes cleanup of unused imports.

### Task 6: `getDoneChecklistItems` pure function — ✅ PASS
- **AC Coverage:** AC12
- **Dependencies:** [depends: 1]
- **TDD Completeness:** All 5 steps present
- **Notes:** Tests cover feature workflow, bugfix workflow, squash option conditional logic, and item structure validation.

### Task 7: `showChecklistUI` TUI widget — ✅ PASS
- **AC Coverage:** AC11 (infrastructure)
- **Dependencies:** [depends: 6]
- **No-Test Justification:** Valid — TUI rendering requires live terminal primitives.
- **Notes:** Includes TypeScript verification step. Code adapted from questionnaire extension pattern.

### Task 8: `showDoneChecklist` using `ctx.ui.custom()` — ✅ PASS
- **AC Coverage:** AC11, AC13, AC14
- **Dependencies:** [depends: 6, 7]
- **TDD Completeness:** All 5 steps present
- **Notes:** Tests cover submit (stores selected keys), dismiss/Escape (stores empty array), subset selection, and guards for non-done phases and missing active issues.

### Task 9: Remove dead code from `ui.ts` and update display tests — ✅ PASS
- **AC Coverage:** AC22, AC23, AC24, AC25 (partial)
- **Dependencies:** [depends: 5, 8]
- **TDD Completeness:** All 5 steps present
- **Notes:** Includes both new tests for `doneActions` display and explicit list of test blocks to remove. Commands.ts updates to use `showDoneChecklist`.

### Task 10: Done-phase prompt reads `doneActions` with `done.md` template — ✅ PASS
- **AC Coverage:** AC16, AC17
- **Dependencies:** [depends: 2, 8]
- **TDD Completeness:** All 5 steps present
- **Notes:** Creates new `prompts/done.md` template with action instructions for all 6 checklist items. Tests verify template injection with multiple actions, single action, and empty state.

### Task 11: Wire done checklist trigger from `register-tools.ts` — ✅ PASS
- **AC Coverage:** AC11 (completion), AC25 (final)
- **Dependencies:** [depends: 8, 9]
- **TDD Completeness:** All 5 steps present
- **Notes:** Includes source-code grep test to verify no `doneMode` references remain (excluding comments). Trigger placement in `phase_next` handler prevents duplicate presentation.

### Task 12: Update prompt files for `phase_back` — ✅ PASS
- **AC Coverage:** AC18, AC19, AC20, AC21
- **Dependencies:** None listed (can be done in parallel)
- **No-Test Justification:** Valid — prompt files are LLM instructions without programmatic behavior.
- **Notes:** Updates 4 prompt files with verification grep command.

---

## Coverage Analysis

### Acceptance Criteria Coverage Matrix

| AC | Task(s) | Status |
|----|---------|--------|
| AC1 | Task 3 | ✅ Covered |
| AC2 | Task 3 | ✅ Covered |
| AC3 | Task 3 | ✅ Covered |
| AC4 | Task 3 | ✅ Covered |
| AC5 | Task 3 | ✅ Covered |
| AC6 | Task 3 | ✅ Covered |
| AC7 | Task 4 | ✅ Covered |
| AC8 | Task 4 | ✅ Covered |
| AC9 | Task 5 | ✅ Covered |
| AC10 | Task 5 | ✅ Covered |
| AC11 | Tasks 7, 8, 11 | ✅ Covered |
| AC12 | Task 6 | ✅ Covered |
| AC13 | Task 8 | ✅ Covered |
| AC14 | Task 8 | ✅ Covered |
| AC15 | Tasks 1, 2 | ✅ Covered |
| AC16 | Task 10 | ✅ Covered |
| AC17 | Task 10 | ✅ Covered |
| AC18 | Tasks 3, 12 | ✅ Covered |
| AC19 | Task 12 | ✅ Covered |
| AC20 | Task 12 | ✅ Covered |
| AC21 | Task 12 | ✅ Covered |
| AC22 | Task 9 | ✅ Covered |
| AC23 | Task 9 | ✅ Covered |
| AC24 | Task 9 | ✅ Covered |
| AC25 | Tasks 1, 2, 9, 11 | ✅ Covered |

**Result:** 25/25 acceptance criteria covered (100%)

---

## Dependency Graph Validation

```
Task 1 (doneMode→doneActions state)
  ├── Task 2 ──┬── Task 5 ──┐
  ├── Task 3   │            │
  ├── Task 4   │            │
  └── Task 6 ──┴── Task 7 ──┴── Task 8 ──┬── Task 9 ──┐
                                         │            │
                                         └── Task 10 ─┴── Task 11

Task 12 (prompt files) — independent
```

**Validation:**
- ✅ No circular dependencies
- ✅ All [depends: N] annotations present and correct
- ✅ Task 11 correctly depends on both Task 8 (showDoneChecklist exists) and Task 9 (old code removed)
- ✅ Task 10 correctly depends on Task 2 (doneActions injection pattern) and Task 8 (showDoneChecklist exists)

---

## TDD Format Compliance

| Task | Step 1 (Test) | Step 2 (Run/Fail) | Step 3 (Impl) | Step 4 (Run/Pass) | Step 5 (Regress) |
|------|---------------|-------------------|---------------|-------------------|------------------|
| 1 | ✅ Full code | ✅ Command + error | ✅ Full code | ✅ Command + pass | ✅ Command |
| 2 | ✅ Full code | ✅ Command + error | ✅ Full code | ✅ Command + pass | ✅ Command |
| 3 | ✅ Full code | ✅ Command + error | ✅ Full code | ✅ Command + pass | ✅ Command |
| 4 | ✅ Full code | ✅ Command + error | ✅ Full code | ✅ Command + pass | ✅ Command |
| 5 | N/A [no-test] | ✅ Verify step | ✅ Full code | ✅ Command | ✅ Command |
| 6 | ✅ Full code | ✅ Command + error | ✅ Full code | ✅ Command + pass | ✅ Command |
| 7 | N/A [no-test] | ✅ Type check | ✅ Full code | ✅ Type check | N/A |
| 8 | ✅ Full code | ✅ Command + error | ✅ Full code | ✅ Command + pass | ✅ Command |
| 9 | ✅ Full code | ✅ Command + error | ✅ Full code | ✅ Command + pass | ✅ Command |
| 10 | ✅ Full code | ✅ Command + error | ✅ Full code | ✅ Command + pass | ✅ Command |
| 11 | ✅ Full code | ✅ Command + error | ✅ Full code | ✅ Command + pass | ✅ Command |
| 12 | N/A [no-test] | ✅ Grep verify | ✅ Full code | ✅ Grep verify | N/A |

**Result:** 12/12 tasks compliant

---

## No-Test Justification Review

| Task | Justification | Valid? |
|------|---------------|--------|
| 5 | Deletion-only change; behavior verified by full test suite | ✅ Valid |
| 7 | TUI requires live terminal primitives | ✅ Valid |
| 12 | Prompt files are LLM instructions | ✅ Valid |

---

## Potential Risks & Mitigations

| Risk | Mitigation in Plan |
|------|-------------------|
| Type errors from doneMode→doneActions migration | Task 1 and 2 explicitly handle TypeScript compile errors as expected failures |
| Old test references causing failures | Task 9 explicitly lists test blocks to remove |
| Straggler doneMode references | Task 11 includes grep test to catch remaining references |
| Duplicate checklist presentation | Task 11 trigger placed ONLY in register-tools.ts, not hooks.ts (comment explicitly warns against this) |
| Backward transition order ambiguity | Task 3 tests specify "first backward transition" resolution |

---

## Recommendations

1. **Task 2 Granularity:** While the cross-file updates in Task 2 are logically grouped, consider breaking into separate tasks if any file proves problematic during implementation.

2. **Task 11 Grep Test:** The `doneMode` reference test filters line comments (`//`) but not block comments (`/* */`). This is acceptable but worth noting if the codebase uses block comments extensively.

3. **Task 12 Parallelization:** Task 12 has no dependencies and can be started immediately while waiting for earlier tasks.

---

## Conclusion

The plan is **ready for implementation**. It demonstrates:
- Complete acceptance criteria coverage
- Proper dependency ordering
- Rigorous TDD discipline
- Appropriate no-test justifications
- Clear file paths and code examples
- Verification steps for all changes

**Approved for implementation.**
