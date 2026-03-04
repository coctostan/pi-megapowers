# Brainstorm: Use Individual Task Files Instead of plan.md

## Approach

This is a small, focused refactoring that completes the migration to individual task files as the sole runtime source of truth. The system already writes tasks as individual files (`tasks/task-001.md` etc.) during plan approval and `deriveTasks()` already prefers them. However, two key consumers still read the monolithic `plan.md`: the pipeline tool (to get task content for the implementer prompt) and the plan→implement gate (to verify a plan exists). Both need to be rewired to use task files directly.

The pipeline tool currently reads `plan.md`, then calls `extractTaskSection()` to find the section for the current task — a round-trip through an intermediate format that loses frontmatter metadata. Instead, it will call `readPlanTask()` which returns the full `EntityDoc<PlanTask>` with both structured frontmatter and rich markdown body. The body content (`.content`) becomes the `planSection` passed to `runPipeline`.

The plan→implement gate will use a new `requireTaskFiles` gate type that checks whether any task files exist, replacing `requireArtifact("plan.md")`. `plan.md` continues to be generated as a human-readable convenience artifact, but nothing depends on it at runtime.

## Key Decisions

- **Task file body is the `planSection`** — no header reconstruction needed; the implementer already gets task title/index via `taskDescription`
- **New `requireTaskFiles` gate type** — clean, self-documenting; doesn't stretch `requireArtifact` semantics to handle directories
- **Keep `plan.md` generation** — `legacy-plan-bridge.ts` still produces it during approval as a read-only summary; zero runtime cost, useful for human inspection
- **Remove `extractTaskSection` dependency from pipeline** — the round-trip through `plan.md` parsing is eliminated entirely

## Components

1. **`pipeline-tool.ts`** — Replace `plan.md` read + `extractTaskSection()` with `readPlanTask(cwd, slug, taskIndex).content`
2. **`feature.ts` / `bugfix.ts`** — Replace `requireArtifact("plan.md")` gate with `requireTaskFiles` in plan→implement gates
3. **`gate-evaluator.ts` + `types.ts`** — Add `RequireTaskFilesGate` type and evaluation logic (`listPlanTasks().length > 0`)
4. **`tool-signal.ts` / `task-deps.ts`** — Update error messages from "plan.md" to reference task files

## Testing Strategy

- **Gate evaluator**: test `requireTaskFiles` gate passes when task files exist, fails when empty/missing
- **Pipeline tool**: test that `planSection` is sourced from task file body, not `plan.md`; mock `readPlanTask` to return known content and verify it reaches `runPipeline`
- **Workflow configs**: test that feature/bugfix transition configs use `requireTaskFiles` gate (snapshot or structural assertion)
- **Error messages**: verify updated error strings reference task files
