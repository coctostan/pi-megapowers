---
id: 10
title: Verify legacy plan.md generation remains unchanged
status: approved
depends_on:
  - 1
  - 2
  - 3
  - 4
  - 5
  - 6
  - 7
  - 8
  - 9
no_test: true
files_to_modify: []
files_to_create: []
---

### Task 10: Verify legacy plan.md generation remains unchanged [depends: 1, 2, 3, 4, 5, 6, 7, 8, 9] [no-test]

**Justification:** Verification-only task. AC11 requires confirming no regression in legacy `plan.md` generation, and this behavior is already covered by existing tests. No production code changes are needed.

**Files:**
- Modify: *(none)*
- Verify: `tests/tool-plan-review.test.ts`
- Verify: `tests/legacy-plan-bridge.test.ts`

**Step 1 — Make the change**
Do not modify `legacy-plan-bridge.ts`, `tool-plan-review.ts`, or any plan-approval code paths in this task. This task is explicit regression verification that legacy `plan.md` generation remains intact after Tasks 1–9.

**Step 2 — Verify**
Run: `bun test tests/tool-plan-review.test.ts -t "generates plan.md file"`
Expected: PASS — approval flow still writes `.megapowers/plans/<issue>/plan.md`.

Run: `bun test tests/legacy-plan-bridge.test.ts`
Expected: PASS — legacy bridge still generates parseable `plan.md` output.
