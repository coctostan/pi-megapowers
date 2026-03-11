## Dependency Summary
- Overall ordering: risky

## Task-to-Task Findings

- Task 5 → Tasks 6, 7, 8
  - Type: sequencing-hazard
  - Finding: Task 5 has status `needs_revision` but is a critical bottleneck blocking three downstream tasks (6, 7, 8) that collectively handle satellite cleanup and all documentation updates.
  - Suggested fix: Resolve Task 5's revision requirements before starting implementation, or re-scope Tasks 6-8 to work around partial Task 5 completion if feasible.

- Task 4 → Task 3
  - Type: unnecessary-dependency
  - Finding: Task 4 (update implement prompts) depends on Task 3 (remove satellite bootstrap), but implement prompts modification doesn't require satellite entrypoint changes—both could proceed after Task 1 independently.
  - Suggested fix: Remove Task 3 from Task 4's `depends_on` unless there is specific prompt content that directly references satellite bootstrap mechanics.

- Task 8 → Task 4
  - Type: unnecessary-dependency
  - Finding: Task 8 (update implementer/code-review/verify prompts) depends on Task 4 (update implement-task prompts), but they modify disjoint prompt files and could execute in parallel after their shared prerequisites (Tasks 1, 5, 6).
  - Suggested fix: Replace Task 4 dependency in Task 8 with just Tasks 1, 5, 6, allowing Task 8 to start as soon as code deletion (5, 6) completes without waiting for Task 4.

- Task 2 and Task 3 → Task 1
  - Type: sequencing-hazard
  - Finding: Tasks 2 and 3 both have Task 1 as prerequisite, but Task 3 also depends on Task 2 (mega on/off cleanup), forcing strict serialization when Task 2 and Task 3 could likely run in parallel after Task 1.
  - Suggested fix: Verify whether Task 3 (satellite bootstrap removal in index.ts) truly requires Task 2's command.ts changes, or if this is conservative chaining that unnecessarily lengthens the critical path.

## Missing Prerequisites

- Task 1 assumes `handlePlanDraftDone` is already wired in `register-tools.ts` and safe to call directly without the removed pipeline/subagent handlers. The test suite checks this, but there's no task ensuring the refactored state-machine handlers (e.g., in `tool-signal.ts`) are ready for the post-pipeline world before Task 1 removes the tool surface.

- Task 5's preservation list includes `state-machine.ts`, `state-io.ts`, `tool-signal.ts` with retained fields (`currentTaskIndex`, `completedTasks`, `tddTaskState`), but there's no prior task that verifies these handlers work correctly without the deleted pipeline orchestration. This is implicitly tested by existing test retention, but sequencing makes it a hidden prerequisite.

## Unnecessary Dependencies

- Task 4 → Task 3: Implement prompt updates don't need satellite bootstrap removal first unless prompts explicitly reference satellite mode execution (not evident from task description).

- Task 8 → Task 4: Internal agent/review prompt updates don't need implement-task prompt updates first; both modify different files and share only Tasks 5, 6 as true prerequisites.

- Task 3 → Task 2: Satellite bootstrap removal from index.ts doesn't clearly require mega command tool-list changes first. Both could proceed after Task 1 if index.ts doesn't depend on command.ts tool filtering.

## Notes for the Main Reviewer

- The `needs_revision` status on Task 5 is the plan's single highest-risk item—it gates all documentation and satellite cleanup. Recommend resolving Task 5's revision before approval to avoid implement-phase surprises.

- Three pairs of tasks appear over-coupled (2→3, 4→3, 8→4). Relaxing these dependencies could shorten the critical path from 8 serial steps to ~5 if Tasks 2/3, or 4/8 can run in parallel.

- Task 5's grep-based preservation check is a runtime guard (good), but the lack of a test-first task for "retained state fields still drive task progression without pipeline" means TDD compliance depends on implicit coverage rather than new red-green cycles.
