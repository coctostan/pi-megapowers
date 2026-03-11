## Goal
Remove the legacy implement-phase pipeline/subagent infrastructure that runs work in isolated worktrees and auto-squashes results back into the main workspace, so implementation happens directly in the primary session under the normal TDD and workflow controls. Keep newer `pi-subagents`-based capabilities that are not part of the old pipeline path.

## Mode
Direct requirements

The desired outcome is already concrete: remove the old pipeline/subagent implementation path rather than exploring alternatives. The main clarification was scope: legacy pipeline infrastructure should go away, but `pi-subagents` remains as the newer replacement foundation.

## Must-Have Requirements
1. R1 Remove the legacy `pipeline` tool from the megapowers tool surface.
2. R2 Remove the legacy one-shot `subagent` tool from the megapowers tool surface.
3. R3 Remove the implement-phase pipeline orchestration code that performs implement → verify → review in isolated workspaces.
4. R4 Remove the legacy workspace management code used specifically by the old pipeline/oneshot flow, including create/squash/cleanup behavior for that path.
5. R5 Remove legacy pipeline result/context/auditing/dispatch infrastructure that exists only to support the old implement-phase pipeline/subagent flow.
6. R6 Remove tests that exist only for the deleted legacy pipeline/subagent infrastructure, and update any remaining tests that reference it.
7. R7 Update prompt templates to remove instructions that refer to the old `pipeline`/legacy `subagent` implementation path.
8. R8 Update user-facing documentation to stop advertising the old implement-phase pipeline/subagent workflow.
9. R9 Preserve the normal primary-session implementation path: sequential task execution in the main session, explicit TDD signaling, human oversight, and existing task progression state.
10. R10 Keep `task_done`, `currentTaskIndex`, and `completedTasks` as the mechanism for sequential implementation progress.
11. R11 Do not remove `pi-subagents` as a dependency solely because the old pipeline/subagent implementation path is being deleted.
12. R12 Preserve newer `pi-subagents`-based functionality that is not part of the legacy implement-phase pipeline/subagent infrastructure.
13. R13 Remove legacy “satellite mode” behavior and messaging that exists only to support the deleted old subagent implementation path.
14. R14 Clean up any state-machine or state-shape references that exist only for the removed pipeline/subagent path.

## Optional / Nice-to-Have
1. O1 Simplify surrounding code and comments that were written defensively around the old pipeline/subagent architecture.
2. O2 Remove now-stale roadmap or changelog phrasing that would otherwise confuse readers about the current architecture.
3. O3 Reduce conceptual overlap in naming so “subagent” clearly refers to the newer `pi-subagents` world rather than the deleted legacy implement pipeline.

## Explicitly Deferred
1. D1 Redesigning or expanding the newer `pi-subagents` architecture beyond what is needed to preserve existing replacement functionality.
2. D2 Solving long-session context management itself; this issue assumes that responsibility shifts to `pi-lcm` rather than re-implementing a parallel solution here.
3. D3 Broader workflow redesign outside the legacy implement-phase pipeline/subagent removal slice.

## Constraints
1. C1 `pi-subagents` is the replacement for the old subagent/pipeline system and must remain available for newer non-legacy uses.
2. C2 The issue should remove the old implement-phase pipeline/subagent infrastructure, not all agent-based capabilities in the repo.
3. C3 The primary session remains the authoritative place for implementation work, TDD enforcement, and human oversight.
4. C4 Existing feature and bugfix workflow phases should remain intact apart from removing the deprecated implementation path.
5. C5 Changes should favor deletion and simplification over replacing the removed path with another orchestration layer.
6. C6 Requirements and docs must clearly distinguish legacy pipeline/subagent infrastructure from newer `pi-subagents` usage to avoid accidental over-removal.
7. C7 The change should be compatible with the current git-based workspace model introduced after jj removal.

## Open Questions
None.

## Recommended Direction
Treat this as a focused deletion and simplification issue, not an architectural replacement project. The repo already contains a clear legacy boundary: the old `register-tools.ts` wiring, `extensions/megapowers/subagent/*` pipeline/oneshot/workspace stack, satellite-mode support, and docs/prompts/tests that describe or defend that flow. The cleanest direction is to remove those legacy entry points and then prune whatever internal modules become unreachable.

The main nuance is naming collision: the repo now has both legacy “subagent/pipeline” concepts and newer `pi-subagents` usage. The implementation should therefore distinguish between “delete legacy implement-phase pipeline infrastructure” and “preserve newer `pi-subagents`-based advisory/coordination functionality.” That prevents the cleanup from regressing newer work such as focused review fan-out.

This should leave the product model much simpler: implementation happens inline in the primary session, tasks advance with normal state and signals, and context-management concerns are handled outside this deleted subsystem. Documentation and prompts should then be aligned so the user and the LLM both see one authoritative implementation path instead of two competing ones.

Finally, the cleanup should be aggressive about dead references. Removing the tools alone is not enough if README text, prompts, tests, or compatibility code still imply that the legacy path exists. The resulting repo should make the old pipeline/subagent approach effectively disappear as a supported implementation mode.

## Testing Implications
- Verify the extension no longer registers `pipeline` or legacy `subagent` tools.
- Verify any tests expecting those tools are removed or updated intentionally.
- Verify primary-session implementation flow still works through existing state/task progression mechanisms.
- Verify prompt and README snapshots/content no longer advertise the deleted legacy pipeline/subagent path.
- Verify newer `pi-subagents`-based functionality that is intentionally kept still imports, wires, and behaves correctly.
- Verify removal of legacy satellite-mode support does not break primary-session behavior.
