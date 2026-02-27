# Plan Review: Agent Context & Awareness (#050)

## Per-Task Assessment

### Task 1: Add milestone and priority fields to Issue model (prerequisite for AC4) — ❌ REVISE
- **Step 2 expected failure is ambiguous.** It says failure may be either a TypeScript property error or undefined assertion failure.
- **Action:** make Step 2 deterministic with one exact expected failure message from the test run output.
- Optional granularity improvement: split default-value behavior into a separate task if you want strict one-behavior-per-task.

### Task 2: Add idle-mode branch in `buildInjectedPrompt` (AC1, AC2) — ✅ PASS
No issues.

### Task 3: Idle prompt includes base protocol section [depends: 2] — ✅ PASS
No issues.

### Task 4: Idle prompt includes open issues with id/title/milestone/priority [depends: 1, 2] — ❌ REVISE
- **Dependency annotation is incomplete.** Step 3 assumes the `buildIdlePrompt` structure introduced in Task 3 (`parts` + protocol loading).
- **Action:** update dependency to `[depends: 1, 2, 3]`.
- Granularity note: this task currently tests both “includes required issue fields” and “excludes done issues.” Split if enforcing strict one-behavior tasks.

### Task 5: Idle prompt includes slash commands [depends: 2] — ✅ PASS
No issues.

### Task 6: Idle prompt includes roadmap/milestones reference [depends: 2] — ✅ PASS
No issues.

### Task 7: Dashboard idle mode includes /triage and /mega hints — ❌ REVISE
- **Assertion is too loose for AC7.** Test checks `"/mega"` but AC requires `"/mega on|off"`.
- **Action:** change assertion to `expect(...).toContain("/mega on|off")`.

### Task 8: Dashboard idle mode includes roadmap reference + active issue regression guard [depends: 7] — ❌ REVISE
- This task combines AC8 and AC9 in one unit.
- **Action:** split into two tasks for strict granularity:
  - Task 8a: idle roadmap/milestones line (AC8)
  - Task 8b: active-issue regression guard (AC9)

### Task 9: Add `phase_back` action to `megapowers_signal` runtime + tool schema — ✅ PASS
No issues.

### Task 10: Update `megapowers-protocol.md` for `phase_back` and `learnings` [depends: 9] [no-test] — ✅ PASS
- Valid `[no-test]` prompt-template/doc task.
- Includes concrete verification (`rg` + full test run).

### Task 11: Fix `review-plan.md` numbering + After Review `phase_back` reference [depends: 9] [no-test] — ❌ REVISE
- Combines two independent prompt edits in one task.
- **Action:** split into:
  - numbering correction (AC12)
  - `phase_back` after-review guidance (AC13)

### Task 12: Tighten `implement-task.md` Execution Mode section [no-test] — ✅ PASS
No issues.

### Task 13: Update `verify.md` to use `phase_back` (remove `/phase ...`) [depends: 9] [no-test] — ✅ PASS
No issues.

### Task 14: Update `code-review.md` needs-fixes + needs-rework to use `phase_back` [depends: 9] [no-test] — ❌ REVISE
- Combines two section changes in one task.
- **Action:** split into one task for needs-fixes text and one for needs-rework text.

---

## Missing Coverage
None. All acceptance criteria (AC1–AC16) are covered by at least one task.

## Verdict
- **revise**

Plan is very close and coverage is complete, but it should be revised for:
1. deterministic expected failure output wording (Task 1 Step 2),
2. dependency correctness (Task 4),
3. assertion precision matching AC text (Task 7),
4. stricter task granularity in combined tasks (Tasks 8, 11, 14).
