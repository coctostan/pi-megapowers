### Criterion 6: Existing tests pass with no regressions

Already confirmed: 348 pass, 0 fail.

---

## Verification Report

## Test Suite Results
348 pass, 0 fail, 632 expect() calls across 15 files (89ms)

## Per-Criterion Verification

### Criterion 1: `PlanTask` includes optional `dependsOn?: number[]` field
**Evidence:** `state-machine.ts:24` — `dependsOn?: number[];` inside `PlanTask` interface
**Verdict:** pass

### Criterion 2: `plan-parser.ts` extracts `[depends: N, M]` annotations into `dependsOn` arrays
**Evidence:** `plan-parser.ts` contains `parseDependsOn()` function using regex `/\[depends:\s*([\d,\s]+)\]/i`. 5 dedicated tests pass (headers, numbered lists, case-insensitive, combined with no-test, backward compat).
**Verdict:** pass

### Criterion 3: Plans without dependency annotations parse identically to today
**Evidence:** Test "existing plans without [depends:] parse identically (backward compat)" passes — asserts exact equality `{ index, description, completed, noTest }` with no `dependsOn` key.
**Verdict:** pass

### Criterion 4: `buildImplementTaskVars()` includes `remaining_tasks` listing incomplete tasks with dependency status
**Evidence:** `prompts.ts:142` returns `remaining_tasks: buildRemainingTasksSummary(tasks, currentIndex)`. Helper at line 73 builds `[blocked — waiting on task(s) N]` or `[ready — can be delegated to subagent]` strings. 3 tests pass covering blocked, ready, and single-task cases.
**Verdict:** pass

### Criterion 5: `prompts/implement-task.md` has concrete subagent instructions: tool name, schema, and delegation criteria
**Evidence:** Template contains `subagent({ agent: "worker", task: "..." })` invocation format, "When to delegate" criteria, "Do NOT delegate" rules, and `{{remaining_tasks}}` placeholder. Tests confirm `subagent`, `agent.*worker`, and `when to delegate` patterns present.
**Verdict:** pass

### Criterion 6: Existing tests pass with no regressions
**Evidence:** 348 pass, 0 fail — identical count to pre-implementation baseline.
**Verdict:** pass

## Overall Verdict
**pass** — All 6 acceptance criteria met with evidence.