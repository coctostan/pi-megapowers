---
id: 66
type: feature
status: in-progress
created: 2026-02-24T00:21:00.000Z
milestone: M3
priority: 1
---

# Merge plan + review into a single iterative phase with draft/review/revise modes

## Problem

Plan and review are separate phases with full phase transitions between them. When review rejects, the planner starts from scratch with no structured feedback. This wastes context and produces full rewrites instead of targeted fixes. The back-and-forth is clunky — each rejection requires manual phase transitions.

## Desired Behavior

### Single "plan" phase with three modes

```
Enter plan phase
  ↓
[Draft mode] — fresh context, write-plan.md prompt
  → LLM writes plan → saves plan.md via megapowers_save_artifact
  ↓
[Review mode] — subagent with fresh context, review-plan.md prompt
  → Reads plan.md + spec.md → produces plan-review.md
  → Structured: per-task pass/fail with specific feedback
  ↓
  Pass? → advance to implement
  Fail? ↓
  ↓
[Revise mode] — fresh context, revise-plan.md prompt (NEW)
  → Reads plan.md + plan-review.md → targeted edits only
  → Saves revised plan.md (old version preserved via #041 versioning)
  ↓
  Back to Review mode, increment counter
  ↓
  Counter >= limit? → prompt user: "N iterations without passing. Continue, intervene, or force-approve?"
```

### State changes

- Remove `review` as a separate phase from the state machine
- Remove `reviewApproved` from state
- Add to state: `planMode: "draft" | "review" | "revise"`, `planIterations: number`
- Review feedback derived from artifact file (`plan-review.md`), not stored in state
- Phase flow becomes: brainstorm → spec → plan → implement → verify → code-review → done

### Structured review criteria

The review subagent evaluates against concrete, checkable criteria:

1. **Coverage** — every acceptance criterion has ≥1 task addressing it
2. **Dependencies** — satisfiable ordering, no cycles, no missing prereqs
3. **TDD completeness** — each task has all 5 steps (write test → verify fail → implement → verify pass → verify no regressions) with exact file paths
4. **Granularity** — no task is too large (heuristic: >1 test file per task = split it)
5. **Self-containment** — each task has enough context to execute independently (important for subagent delegation)

Output format for plan-review.md:
```markdown
## Verdict: PASS | REVISE | RETHINK

## Per-Task Feedback

### Task 1: [name] — ✅ PASS
No issues.

### Task 3: [name] — ❌ REVISE
- Missing error handling for empty input (AC 4)
- Test step doesn't specify expected error message

## Missing Coverage
- AC 7 (rate limiting) has no task addressing it

## Summary
[1-2 sentences: what needs to change and why]
```

### Three prompts for one phase

- `write-plan.md` — initial draft (existing prompt, being improved)
- `review-plan.md` — structured review (existing prompt, needs structured output format)
- `revise-plan.md` — **NEW**: receives plan.md + plan-review.md, makes targeted changes only. Explicit instruction: "Do NOT rewrite the plan. Fix only what the reviewer flagged."

### Iteration limit

Default: 3 iterations. After limit:
- Prompt user with options: "Continue iterating", "Intervene manually", "Force-approve and proceed to implement"
- Configurable via state or config

## Files involved

- `extensions/megapowers/state-machine.ts` — remove `review` phase, add `planMode` + `planIterations` to state, update phase graph
- `extensions/megapowers/gates.ts` — remove review gate, update plan gate for mode transitions
- `extensions/megapowers/prompt-inject.ts` — select prompt based on `planMode` instead of phase
- `extensions/megapowers/tool-signal.ts` — handle mode transitions within plan phase
- `extensions/megapowers/phase-advance.ts` — update plan→implement transition
- `extensions/megapowers/ui.ts` — update dashboard for plan modes, remove review phase display
- `prompts/write-plan.md` — existing, being improved separately
- `prompts/review-plan.md` — restructure for machine-readable output format
- `prompts/revise-plan.md` — NEW prompt

## Relationship to other issues

- **#041** (artifact versioning) — plan revisions produce versioned artifacts naturally
- **#062** (prompt audit) — plan/review prompts are being improved in parallel, this issue changes their architecture
- **Independent of #064** (jj) and **#065** (done phase)
