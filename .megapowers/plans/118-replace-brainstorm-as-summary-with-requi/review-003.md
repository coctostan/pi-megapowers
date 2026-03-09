---
type: plan-review
iteration: 3
verdict: revise
reviewed_tasks:
  - 5
  - 1
  - 2
  - 3
  - 4
approved_tasks:
  - 5
needs_revision_tasks:
  - 1
  - 2
  - 3
  - 4
---

### Per-Task Assessment

### Task 1: Verify-and-patch brainstorm prompt requirements-capture contract — ❌ REVISE
- **Coverage:** Good. It explicitly covers AC 1, 2, 3, 4, and 12.
- **Dependencies:** Acceptable for current repo state because the `#118` prompt-contract tests already exist in `tests/prompts.test.ts`.
- **No-test validity:** Valid `[no-test]` prompt-only task with a concrete verification step.
- **Issue:** Step 2 now uses the right Bun command, but it still implies standalone verification owned by this task. It should explicitly say it is relying on the **pre-existing** `#118` contract tests in `tests/prompts.test.ts` via `getPhasePromptTemplate("brainstorm")`.

### Task 2: Verify-and-patch write-spec prompt traceability contract — ❌ REVISE
- **Coverage:** Good. It explicitly covers AC 5, 6, 7, 8, 9, and 12.
- **Dependencies:** Acceptable for current repo state because the relevant `#118` spec prompt tests already exist.
- **No-test validity:** Valid `[no-test]` prompt-only task with a concrete verification step.
- **Issue:** Same as Task 1. Step 2 should explicitly acknowledge that the verification comes from **pre-existing** `tests/prompts.test.ts` coverage using `getPhasePromptTemplate("spec")`, rather than reading like this task created its own verification.

### Task 3: Verify-and-patch brainstorm prompt contract tests — ❌ REVISE
- **Coverage:** Covers AC 10.
- **Dependencies:** The file paths and APIs are real: `tests/prompts.test.ts`, `prompts/brainstorm.md`, `getPhasePromptTemplate("brainstorm")`.
- **TDD correctness:** Improved, but still not fully executable in the repo’s current state. Step 1 correctly allows a no-op if the four brainstorm tests already exist, and they do already exist in the current `#118` describe block. But Step 2 only defines the RED path “when Step 1 added missing assertions” and never tells the implementer what to do when Step 1 is a no-op.
- **Issue:** Add an explicit no-op branch: if Step 1 made no test edits, run the focused command once to confirm PASS, then skip Steps 2–4 and continue to Step 5. Without that branch, the current task flow is internally contradictory for the actual repo state.

### Task 4: Verify-and-patch spec prompt traceability contract tests — ❌ REVISE
- **Coverage:** Covers AC 11.
- **Dependencies:** Correctly depends on Tasks 2 and 3, and the file/API references are real: `tests/prompts.test.ts`, `prompts/write-spec.md`, `getPhasePromptTemplate("spec")`.
- **TDD correctness:** Same issue as Task 3. Step 1 allows a no-op if the spec tests already exist, and they do already exist today. But Step 2 only describes the RED path after adding assertions.
- **Issue:** Add an explicit no-op branch: if Step 1 was a no-op, run the focused command once to confirm PASS, then skip Steps 2–4 and continue to Step 5. As written, the task does not fully describe what to do in the current repo state.

### Task 5: Verify README and add CHANGELOG entry for brainstorm-to-spec model — ✅ PASS
No issues.

### Missing Coverage
None.

### Verdict
**revise** — Coverage is complete, but Tasks 1 and 2 need clearer wording that their verification uses pre-existing prompt-contract tests, and Tasks 3 and 4 still need an explicit no-op path so their TDD flow is executable when the `#118` tests already exist and pass in the current repo.

