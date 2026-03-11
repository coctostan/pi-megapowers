## Goal
Remove the legacy implement-phase pipeline and one-shot subagent infrastructure so implementation happens directly in the primary session under the existing TDD and workflow controls, while preserving newer `pi-subagents`-based functionality that is outside the deleted legacy path.

## Acceptance Criteria
1. The megapowers extension no longer registers or exposes a `pipeline` tool in its tool surface.

2. The megapowers extension no longer registers or exposes the legacy one-shot `subagent` tool in its tool surface.

3. Code that orchestrates implement → verify → review work in isolated workspaces/worktrees for the legacy implement-phase pipeline path is deleted and no longer reachable.

4. Workspace/worktree helper code that exists specifically to create, squash, or clean up legacy pipeline or legacy one-shot subagent workspaces is deleted and no longer referenced by runtime code.

5. Legacy pipeline-only result handling, context accumulation, auditing, dispatch, and related support code is deleted when it exists only for the removed implement-phase pipeline or legacy one-shot subagent path.

6. State-machine logic, state-shape fields, and transition handling that exist only for the removed legacy pipeline/subagent path are deleted or updated so no runtime state depends on that path.

7. Legacy “satellite mode” behavior, guards, and user-facing messaging that exist only to support the removed legacy subagent implementation path are deleted.

8. Prompt templates and other LLM-facing instruction files no longer describe or direct the model to use the removed legacy `pipeline` or legacy one-shot `subagent` implementation path.

9. User-facing documentation no longer advertises the removed legacy implement-phase pipeline/subagent workflow, and any retained mentions clearly distinguish preserved `pi-subagents` functionality from the deleted legacy path.

10. Tests that exist only for the deleted legacy pipeline/subagent infrastructure are removed, and any remaining tests that referenced that infrastructure are updated to reflect the direct primary-session implementation model.

11. The primary-session implementation flow continues to use sequential task execution in the main session with explicit TDD signaling, human oversight, and existing task progression state; specifically, `task_done`, `currentTaskIndex`, and `completedTasks` remain the mechanism for sequential implementation progress.

12. Newer `pi-subagents`-based functionality that is not part of the deleted legacy implement-phase pipeline/subagent infrastructure remains present, wired, and usable, and `pi-subagents` is not removed solely as part of this cleanup.

## Out of Scope
- Redesigning, expanding, or replacing the preserved `pi-subagents` architecture beyond the minimum needed to keep non-legacy functionality working.
- Introducing a new orchestration layer to replace the deleted legacy pipeline/subagent path.
- Solving long-session context management within megapowers; that responsibility remains outside this issue.
- Broader workflow redesign beyond removing the deprecated implementation path.
- Opportunistic simplification, naming cleanup, roadmap cleanup, or comment cleanup unless it is necessary to satisfy the acceptance criteria above.

## Open Questions
None.

## Requirement Traceability
- R1 -> AC 1
- R2 -> AC 2
- R3 -> AC 3
- R4 -> AC 4
- R5 -> AC 5
- R6 -> AC 10
- R7 -> AC 8
- R8 -> AC 9
- R9 -> AC 11
- R10 -> AC 11
- R11 -> AC 12
- R12 -> AC 12
- R13 -> AC 7
- R14 -> AC 6
- O1 -> Out of Scope
- O2 -> Out of Scope
- O3 -> Out of Scope
- D1 -> Out of Scope
- D2 -> Out of Scope
- D3 -> Out of Scope
- C1 -> AC 12
- C2 -> AC 12
- C3 -> AC 11
- C4 -> AC 11
- C5 -> AC 3, AC 4, AC 5
- C6 -> AC 9, AC 12
- C7 -> AC 4
