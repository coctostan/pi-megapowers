---
type: plan-review
iteration: 1
verdict: revise
reviewed_tasks:
  - 1
  - 2
  - 3
approved_tasks: []
needs_revision_tasks:
  - 1
  - 2
  - 3
---

### Per-Task Assessment

### Task 1: Add project plan-scout agent definition — ❌ REVISE
- Coverage is inferable, but the task does not explicitly call out which acceptance criteria it covers. Add a `Covers: AC1, AC2, AC3, AC4, AC5` line.
- The Step 1 content has the output path formatted as `` ` .megapowers/plans/<issue-slug>/context.md ` `` with surrounding spaces inside the code span. That should be written as `.megapowers/plans/<issue-slug>/context.md` exactly so the bounded output contract is unambiguous.
- Otherwise the task is reasonably scoped, the no-test justification is valid for an agent prompt file, and the verification command is realistic for this repo.

### Task 2: Document context.md handoff and planning-subagent experiment rules — ❌ REVISE
- Coverage is again only implicit. Add an explicit `Covers: AC6, AC7, AC8, AC9` line.
- The task currently tells the implementer to add a v1 rollout note saying `plan-scout` writes `.megapowers/plans/<issue-slug>/context.md` at the plan-directory root, while also keeping the existing `Artifact Layout` / `subagents/draft/context.md` guidance intact. In the current doc, that leaves two conflicting locations for `context.md` without a scoping explanation.
- Revise Step 1 so the doc either updates the layout to the root-level v1 handoff or explicitly says the root-level `context.md` is the v1 rollout and the `subagents/draft/` layout is future-facing.
- Revise Step 2 so verification checks that this contradiction is actually resolved, not just that the new rollout heading exists.

### Task 3: Clarify implement prompt guidance so planning scout is not contradicted — ❌ REVISE
- Coverage is only implicit here too. Add an explicit `Covers: AC10` line.
- The actual prompt edit is realistic and well scoped, and the test commands match the repo conventions (`bun test`, prompt-focused test files under `tests/`).
- No implementation-path issues found beyond the missing explicit AC coverage annotation.

### Missing Coverage
- No acceptance criteria are entirely uncovered, but none of the tasks explicitly state which ACs they cover. The task files should make that mapping explicit instead of forcing the reviewer to infer it.

### Verdict
- **revise** — the plan is close, but it needs explicit AC coverage annotations on each task and Task 2 must reconcile the current contradiction between root-level `context.md` guidance and the existing `subagents/draft/context.md` artifact layout.
