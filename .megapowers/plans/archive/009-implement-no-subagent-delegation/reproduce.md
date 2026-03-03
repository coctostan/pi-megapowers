All 3 new tests fail as expected, confirming the bug. Here's the reproduction report:

---

# Bug Report: Implement phase never delegates tasks to subagents

## Steps to Reproduce
1. Create a feature issue with multiple independent tasks
2. Advance through brainstorm → spec → plan → review → implement
3. Observe that during the implement phase, the LLM works on each task sequentially inline
4. The LLM never invokes the `subagent` tool, even when tasks have no inter-dependencies

## Expected Behavior
The implement phase should either:
- **Auto-delegate** independent tasks to subagent workers for parallel execution, or
- Provide the LLM with **concrete subagent invocation instructions** (tool name, parameters, agent names, delegation criteria) so it can make informed delegation decisions

`buildImplementTaskVars()` should expose remaining/parallelizable task info so the prompt can guide delegation.

## Actual Behavior
Three problems prevent delegation:

1. **Prompt is vague** (`prompts/implement-task.md`): Says "You may work on this task inline or delegate to a subagent tool (if available)" but never names the tool, its schema (`{ agent: "worker", task: "..." }`), or available agents. The LLM has nothing actionable.

2. **Single-task context only** (`buildImplementTaskVars()`): Only builds vars for the current task at `currentTaskIndex`. No `remaining_tasks` or parallelization info is provided. The LLM can't see what else could run in parallel.

3. **No dependency metadata** (`PlanTask` interface): Has `{ index, description, completed, noTest }` — no `dependsOn` field. Neither the extension nor the LLM can determine which tasks are safe to parallelize.

## Environment
- pi-megapowers extension (all workflows affected during implement phase)
- Subagent extension installed separately from pi examples
- `satellite.ts` / `satellite-tdd.ts` exist but are only activated when `PI_SUBAGENT=1` is set externally

## Failing Test
**File:** `tests/prompts.test.ts` — 3 new tests in `describe("implement prompt — subagent delegation instructions")`

All 3 fail, confirming:
- The implement template lacks concrete subagent tool name / invocation format
- The template lacks delegation criteria (when to delegate vs work inline)  
- `buildImplementTaskVars()` doesn't expose `remaining_tasks` for parallelization context