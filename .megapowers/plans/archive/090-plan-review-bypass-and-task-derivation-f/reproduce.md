# Reproduction: Plan review bypass and task derivation failures

## Bug A — Issue #088: phase_next bypasses plan review gate

### Steps to Reproduce
1. Set state: `phase: "plan"`, `planMode: "draft"`, `planIteration: 1`, `reviewApproved: false`
2. Create a `plan.md` artifact with valid task headers
3. Call `advancePhase(cwd)` (i.e., `phase_next`)
4. Observe: advances to `implement` without any review

### Expected Behavior
`advancePhase` should **reject** the transition because `planMode` is still `"draft"` (no review has happened). The plan review loop (`draft → review → approve → implement`) must complete before advancing.

### Actual Behavior
`advancePhase` succeeds — returns `{ ok: true, newPhase: "implement" }`. The only gate on the `plan → implement` transition is `requireArtifact(plan.md)`, which passes trivially once `plan.md` exists.

### Evidence

**Workflow configs** (`feature.ts` line 18, `bugfix.ts` line 17):
```typescript
{ from: "plan", to: "implement", gates: [{ type: "requireArtifact", file: "plan.md" }] }
```

Only `requireArtifact` — no check for `planMode`, `reviewApproved`, or plan review completion.

**`requireReviewApproved` gate exists** in `gate-evaluator.ts` (lines 22-27) but is **not used** in any workflow transition config.

**`handleApproveVerdict`** in `tool-plan-review.ts` is the correct path — it calls `transition(state, "implement")` directly after approval, bypassing `advancePhase`. But `phase_next` provides an alternative route that skips this.

**Prompt gap**: `revise-plan.md` does NOT instruct the agent to call `plan_draft_done` after completing revisions. The prompt ends without a clear "next step" instruction, making it likely the agent calls `phase_next` instead.

In contrast, `write-plan.md` correctly says:
```
After all tasks are saved, call `megapowers_signal({ action: "plan_draft_done" })` to submit for review.
```

### Variant: planMode "revise" (after failed review)
Same bug — when `planMode: "revise"`, `planIteration: 2`, calling `phase_next` still advances to implement, skipping the second review entirely.

---

## Bug B — Issue #089: deriveTasks ignores task files

### Steps to Reproduce
1. Create task files in `.megapowers/plans/<slug>/tasks/task-001.md`, `task-002.md` (the new canonical format via `writePlanTask`)
2. Write a `plan.md` that either: (a) has no parseable tasks, (b) uses `## Task N —` format instead of `### Task N:`
3. Call `deriveTasks(cwd, slug)`
4. Observe: returns `[]`

### Expected Behavior
`deriveTasks` should find tasks from task files (the canonical source in the new plan system), falling back to `plan.md` parsing only when no task files exist.

### Actual Behavior
`deriveTasks` only reads `plan.md` and passes it through `extractPlanTasks()`. Task files are completely ignored.

### Evidence

**`deriveTasks`** in `state/derived.ts` (lines 13-18):
```typescript
export function deriveTasks(cwd: string, issueSlug: string): PlanTask[] {
  const planPath = join(cwd, ".megapowers", "plans", issueSlug, "plan.md");
  if (!existsSync(planPath)) return [];
  const content = readFileSync(planPath, "utf-8");
  return extractPlanTasks(content);
}
```
No reference to `listPlanTasks` or the `tasks/` directory.

**`extractPlanTasks`** in `plan-parser.ts` (line 71):
```typescript
const pattern = /^###\s+Task\s+(\d+):\s*(.+)$/gm;
```
Only matches `### Task N:` — rejects `## Task N:`, `### Task N —`, `## Task N —`.

**Compounding with #088**: When `handleApproveVerdict` runs (the correct path), it calls `generateLegacyPlanMd(tasks)` which produces `plan.md` in the exact `### Task N:` format that `extractPlanTasks` expects. But when `phase_next` bypasses the approval path, `generateLegacyPlanMd` never runs, and `plan.md` contains whatever format the LLM wrote during draft.

### Sub-issue: extractPlanTasks format strictness

Tested formats:
| Format | Matched? |
|--------|----------|
| `### Task 1: Description` | ✅ Yes |
| `## Task 1: Description` | ❌ No |
| `### Task 1 — Description` | ❌ No |
| `## Task 1 — Description` | ❌ No |

---

## Environment
- Runtime: Bun
- Test framework: bun:test
- Project: pi-megapowers

## Failing Test
`tests/reproduce-090.test.ts` — 7 tests, all passing (asserting buggy behavior):

**Bug #088 tests:**
- `phase_next advances plan→implement even when planMode is 'draft'` — confirms bypass
- `phase_next advances plan→implement even when planMode is 'revise'` — confirms bypass after revise
- `gate check for plan→implement only checks requireArtifact` — confirms missing gate

**Bug #089 tests:**
- `deriveTasks returns [] when plan.md uses ## Task N — format` — confirms format rejection
- `extractPlanTasks rejects ## headers (requires ###)` — confirms strict heading level
- `extractPlanTasks rejects em-dash separator (requires colon)` — confirms strict separator
- `deriveTasks ignores task files even when they exist` — confirms task files ignored

Tests assert current (buggy) behavior. When bugs are fixed, these assertions should flip:
- `expect(result.ok).toBe(true)` → should become `false`
- `expect(tasks.length).toBe(0)` → should become `> 0`

## Reproducibility
Always — both bugs are deterministic and reproducible via unit tests.
