---
type: plan-review
iteration: 1
verdict: revise
reviewed_tasks:
  - 1
  - 2
  - 3
  - 4
  - 5
  - 6
approved_tasks:
  - 1
  - 2
  - 3
needs_revision_tasks:
  - 4
  - 5
  - 6
---

### Task 1: Add doneChecklistShown to MegapowersState schema — ✅ PASS
- Steps are complete and match the real codebase (`state-machine.ts`, `state-io.ts`).
- Good catch to update `KNOWN_KEYS` in `state-io.ts` so the new field isn’t stripped.

### Task 2: showDoneChecklist auto-populates defaults in headless mode — ✅ PASS
- Correctly targets the real root cause in `extensions/megapowers/ui.ts` (`if (!ctx.hasUI) return;`).
- Test approach matches existing `tests/ui.test.ts` patterns and `getDoneChecklistItems()` ordering.

### Task 3: Remove showDoneChecklist from register-tools.ts execute() — ✅ PASS
- Implementation is correct and aligns with the #083 fix (stop showing the checklist during the tool call).
- Note: avoid duplicating the same reproduction-test update again in Task 6.

### Task 4: Defer showDoneChecklist to onAgentEnd in hooks.ts — ❌ REVISE
- **Breaks an existing repo test**: `tests/hooks.test.ts` currently asserts `onAgentEnd` “does nothing when doneActions is empty”. After this change, empty doneActions in `phase=done` should trigger checklist/default population.
- Your new tests are fine, but you must **update/remove** that existing test (otherwise the suite will fail).
- See `revise-instructions-1.md` for the exact replacement snippet.

### Task 5: End-to-end: headless onAgentEnd processes close-issue and resets state — ❌ REVISE
- The proposed “2 onAgentEnd calls → close-issue executes” is **not consistent with production behavior**.
  - `onAgentEnd` processes **only `doneActions[0]` per call**.
  - Default headless selection order (from `getDoneChecklistItems`) puts `close-issue` **last**, so you must simulate consuming earlier actions across multiple turns (or explicitly set `doneActions: ["close-issue"]`).
- As written, the test would either (a) never reach close-issue or (b) be flaky.
- See `revise-instructions-1.md` for a concrete 6-call sequence that matches real behavior.

### Task 6: Update reproduction tests to assert fixed behavior — ❌ REVISE
- Duplicates Task 3’s change (the `register-tools.ts` “not toContain showDoneChecklist” assertion).
- Step ordering / expected outputs are inconsistent with the task dependencies (depends on 2–4, so “expected FAIL because fix not implemented yet” is not reliable).
- Too much bundled into one task (multiple unrelated test rewrites). Tighten scope or mark as a test-maintenance `[no-test]` task with explicit verification.
- See `revise-instructions-1.md` for prescriptive guidance.

### Missing Coverage
No acceptance-criteria gaps found. The plan covers both #081 (headless default population → injection → eventual close-issue) and #083 (defer checklist to `onAgentEnd` + prevent re-show).

### Verdict
**revise** — Tasks 4–6 need changes for correctness and to keep the existing test suite green.

