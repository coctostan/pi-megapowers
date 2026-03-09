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
approved_tasks: []
needs_revision_tasks:
  - 1
  - 2
  - 3
  - 4
  - 5
---

### Per-Task Assessment

### Task 1: Update brainstorm prompt requirements-capture contract — ❌ REVISE
- **Coverage:** Targets AC 1/2/3/4/12, but AC IDs are not explicitly called out in the task text.
- **TDD / no-test:** `[no-test]` is valid for prompt-only work, and a verification step exists.
- **Self-containment / realism:** Required prompt content is already present in `prompts/brainstorm.md`; task should be rewritten as **verify-and-patch** to avoid duplicate/churn edits and false attribution of pre-existing work.

### Task 2: Update write-spec prompt traceability contract — ❌ REVISE
- **Coverage:** Targets AC 5/6/7/8/9/12, but AC IDs are not explicitly called out in the task text.
- **Dependencies:** Depends on Task 1 correctly.
- **TDD / no-test:** `[no-test]` is valid for prompt-only work, with verification command present.
- **Self-containment / realism:** Required sections/rules already exist in `prompts/write-spec.md`; rewrite as **verify-and-patch** only for missing gaps.

### Task 3: Lock brainstorm prompt contract in prompt tests — ❌ REVISE
- **Coverage:** Targets AC 10 (not explicitly mapped in task text).
- **Dependencies:** Depends on Task 1 correctly.
- **Granularity:** Single behavior family, acceptable.
- **Self-containment / realism:** The described `#118` brainstorm tests already exist in `tests/prompts.test.ts`; current wording would cause duplicate tests if executed literally. Rewrite to inspect existing tests first and patch only missing assertions.

### Task 4: Lock spec prompt traceability contract in prompt tests — ❌ REVISE
- **Coverage:** Targets AC 11 (not explicitly mapped in task text).
- **Dependencies:** **Missing prerequisite** on Task 3 while editing the same file (`tests/prompts.test.ts`). Current `depends_on: [2]` creates sequencing/concurrency risk.
- **Self-containment / realism:** Spec-contract tests already exist in the same `#118` block; task should avoid creating a second duplicate describe block and instead verify/patch existing coverage.

### Task 5: Document the brainstorm-to-spec requirements model — ❌ REVISE
- **Coverage:** Targets AC 13 (and AC 12 wording continuity), but AC IDs are not explicitly called out.
- **Dependencies:** Missing hidden prerequisite on prompt tasks. Should depend on at least Tasks 1 and 2 so docs cannot drift ahead of finalized prompt contract.
- **Self-containment / realism:** README coverage is already present; CHANGELOG entry for #118 is missing. Task should be narrowed to verify README + add missing CHANGELOG Unreleased entry.

### Missing Coverage
- No acceptance-criteria gaps detected (all ACs are represented by at least one task).

### Verdict
- **revise** — Plan is not ready for implementation due to realism collisions (tasks 1–4 describe already-completed work), missing dependency edges (task 4 on task 3; task 5 on tasks 1/2), and lack of explicit per-task AC mapping.

I wrote prescriptive, task-specific handoff instructions to:
`.megapowers/plans/118-replace-brainstorm-as-summary-with-requi/revise-instructions-1.md`
