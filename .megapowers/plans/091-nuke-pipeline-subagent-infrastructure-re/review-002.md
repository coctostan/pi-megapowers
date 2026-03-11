---
type: plan-review
iteration: 2
verdict: revise
reviewed_tasks:
  - 1
  - 2
  - 3
  - 4
  - 6
  - 5
  - 7
  - 8
approved_tasks:
  - 1
  - 2
  - 3
  - 4
  - 6
needs_revision_tasks:
  - 5
  - 7
  - 8
---

### Per-Task Assessment
### Task 1: Remove legacy pipeline and subagent tool registration — ✅ PASS
No issues.

### Task 2: Remove legacy tool names from mega on/off activation lists — ✅ PASS
No issues.

### Task 3: Remove satellite bootstrap from the extension entrypoint — ✅ PASS
No issues.

### Task 4: Remove legacy delegation wording from implement prompts — ✅ PASS
The prior coverage regression in Step 1 is fixed. The replacement `describe(...)` block now preserves the 4 non-legacy tests in addition to the 4 new direct-execution tests.

### Task 5: Delete the legacy pipeline and one-shot execution stack — ❌ REVISE
- Coverage gap: AC 6 and AC 11 are still only implicit. This task deletes the legacy stack, but it does not explicitly preserve or verify the retained direct primary-session state/progression mechanism.
- Concretely, the task should call out the retained files/tests that implement and verify `currentTaskIndex`, `completedTasks`, `tddTaskState`, and `task_done` behavior: `extensions/megapowers/state/state-machine.ts`, `extensions/megapowers/state/state-io.ts`, `extensions/megapowers/tools/tool-signal.ts`, `tests/state-io.test.ts`, `tests/tool-signal.test.ts`, and `tests/phase-advance.test.ts`.
- Step 2 verification is too narrow. It checks focused-review preservation, but it does not verify that no legacy pipeline/subagent-only state fields remain or that sequential task execution still runs through the retained `task_done` / `currentTaskIndex` / `completedTasks` path.

### Task 6: Delete satellite-mode helpers and tests — ✅ PASS
No issues.

### Task 7: Update public documentation to remove the legacy pipeline workflow — ❌ REVISE
- Step 2 verification is incomplete for AC 9 because it does not inspect `subagent` wording at all, even though the task explicitly distinguishes preserved `pi-subagents` references from deleted legacy `subagent` workflow.
- Step 2's command is also brittle: `grep ... && bun test` will skip `bun test` when grep returns no matches, which is the expected success case.

### Task 8: Update internal agent and review prompts after legacy subagent removal — ❌ REVISE
- Step 2 has the same command problem as Task 7: `grep -nE ... && bun test` prevents the test suite from running when grep finds zero matches, which is the desired end state.
- The verification step should be rewritten so it still surfaces stale legacy phrases but always runs `bun test`.

### Missing Coverage
- AC 6 — not explicitly covered by the current task set. The plan needs an explicit preservation/verification step for the retained state shape so reviewers can confirm no legacy pipeline/subagent-only runtime state remains.
- AC 11 — not explicitly covered by the current task set. Existing code/tests already demonstrate the retained sequential task progression path, but the plan must explicitly preserve and verify that mechanism during this cleanup.

### Verdict
- **revise** — Tasks 5, 7, and 8 need adjustment. See `revise-instructions-2.md` for the exact required changes.
