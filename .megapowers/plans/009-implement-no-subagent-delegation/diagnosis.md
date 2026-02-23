# Diagnosis

## Root Cause

The implement phase has subagent infrastructure (`satellite.ts`, `satellite-tdd.ts`) that only activates **reactively** — when an external subagent invocation sets `PI_SUBAGENT=1`. Nothing in the extension **proactively** triggers delegation. The bug has three layers:

1. **Prompt layer** (`prompts/implement-task.md`): Says "delegate to a subagent tool (if available)" but never names the tool, its schema, available agents, or when to delegate. The LLM defaults to inline every time.

2. **Context layer** (`buildImplementTaskVars()` in `prompts.ts`): Builds vars for exactly one task at `currentTaskIndex`. No `remaining_tasks` or parallelization info is exposed. The LLM can't see what else could run in parallel.

3. **Data layer** (`PlanTask` in `state-machine.ts`): Has `{ index, description, completed, noTest }` — no `dependsOn` field. The write-plan prompt asks the LLM to note dependencies in prose, but `plan-parser.ts` never parses them into structured data. Without structured dependency info, the extension can't identify parallelizable tasks.

## Affected Code

| File | Issue |
|------|-------|
| `prompts/implement-task.md` | Vague delegation mention, no concrete tool/agent/schema |
| `extensions/megapowers/prompts.ts` | `buildImplementTaskVars()` exposes only current task |
| `extensions/megapowers/state-machine.ts` | `PlanTask` lacks `dependsOn` field |
| `extensions/megapowers/plan-parser.ts` | Doesn't parse dependency annotations |
| `extensions/megapowers/artifact-router.ts` | Sequential-only task completion |

## Risk Assessment

- **Low risk**: Prompt changes and adding `remaining_tasks` var — no existing code breaks.
- **Medium risk**: Adding optional `dependsOn?: number[]` to `PlanTask` — touches core type but optional field is backward compatible. Plan parser must not break `[no-test]` annotation parsing.
- **Higher risk**: State serialization adds new field to `.megapowers/state.json` — old state files must load cleanly (optional field handles this).

## Fixed When

1. `PlanTask` includes optional `dependsOn?: number[]` field
2. `plan-parser.ts` extracts `[depends: N, M]` annotations into `dependsOn` arrays
3. Plans without dependency annotations parse identically to today
4. `buildImplementTaskVars()` includes `remaining_tasks` listing incomplete tasks with dependency status
5. `prompts/implement-task.md` has concrete subagent instructions: tool name, schema, and delegation criteria
6. Existing tests pass with no regressions