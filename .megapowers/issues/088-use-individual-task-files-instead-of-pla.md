---
id: 88
type: feature
status: closed
created: 2026-03-04T03:40:23.633Z
priority: 2
milestone: M3
---
# Use individual task files instead of plan.md in implement and later phases
## Problem

`pipeline-tool.ts` (line 99) reads the monolithic `plan.md` to extract task sections for the implementer prompt. The plan gate in `feature.ts` also checks for `plan.md` existence. Meanwhile, individual task files (`tasks/task-001.md` etc.) with Zod frontmatter already exist and contain the full task description — `deriveTasks()` already prefers them.

## Proposed Solution

1. **pipeline-tool.ts**: Replace `store.readPlanFile(slug, "plan.md")` with reading the individual task file body directly (e.g., `readPlanTask(cwd, slug, taskIndex)`). The task file body already contains the full task description including files, steps, and code blocks.

2. **feature.ts plan gate**: Change `requireArtifact, file: "plan.md"` to check that at least one task file exists in the `tasks/` directory instead.

3. **prompt-inject.ts**: Already uses `deriveTasks()` which prefers task files — no changes needed.

4. **plan.md generation**: Keep generating `plan.md` as a backward-compatible summary (it's useful for human reading), but nothing in the pipeline should depend on parsing it.

## Scope

- Modify `pipeline-tool.ts` to read task files directly
- Update plan gate in `feature.ts` 
- Ensure `prompt-inject.ts` task injection still works (it should — it already uses `deriveTasks()`)
- Keep `plan.md` generation for human readability but remove it as a runtime dependency
