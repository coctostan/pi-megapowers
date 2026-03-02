---
id: 88
type: bugfix
status: open
created: 2026-03-02T00:00:00.000Z
---

# phase_next during plan phase bypasses plan review gate

## Symptom

After the plan phase goes through draft → review → revise, calling `phase_next` (or the LLM calling `megapowers_signal({ action: "phase_next" })`) advances directly from plan to implement **without a second review pass**. The expected flow is:

```
draft → review → revise → draft_done → review (again) → approve → implement
```

But in practice, after revise completes, if the agent calls `phase_next` instead of `plan_draft_done`, it skips the review entirely and lands in implement.

## Observed in

pi-hashline-readmap project, issue 022-exploratory-testing-bug-fixes:
- `state.json`: `planIteration: 2`, `phase: "implement"`, `reviewApproved: false`
- `review-001.md` exists (verdict: revise), `review-002.md` does not exist
- phaseHistory shows direct `plan → implement` transition

## Root Cause

The `plan → implement` transition gate in both `bugfix.ts` and `feature.ts` only checks:

```typescript
{ from: "plan", to: "implement", gates: [{ type: "requireArtifact", file: "plan.md" }] }
```

This gate passes as soon as `plan.md` exists — it does **not** check:
- Whether `planMode` is null (meaning the plan review loop completed)
- Whether `reviewApproved` is true
- Whether the current `planMode` is still "draft" or "revise" (meaning review hasn't happened yet)

A `requireReviewApproved` gate type already exists in `gate-evaluator.ts` (line 22-27) but is **not used** in any workflow configuration.

Meanwhile, `phase_next` in `tool-signal.ts` calls `advancePhase()` which calls `checkGate()` — but since the only gate is `requireArtifact`, it passes trivially.

The proper path (draft_done → review → approve via `handleApproveVerdict`) works correctly because `handleApproveVerdict` explicitly calls `transition(state, "implement")` itself. But `phase_next` provides a bypass route.

## Impact

- Plan review can be completely skipped after a revise cycle
- The LLM in revise mode may call `phase_next` instead of `plan_draft_done`, bypassing the review
- `generateLegacyPlanMd` (called only in `handleApproveVerdict`) never runs, leaving plan.md in whatever format the LLM wrote — which may not be parseable by `extractPlanTasks` (see issue #089)

## Affected Files

| File | Issue |
|------|-------|
| `extensions/megapowers/workflows/bugfix.ts` | plan→implement gate missing planMode/review check |
| `extensions/megapowers/workflows/feature.ts` | Same |
| `extensions/megapowers/workflows/gate-evaluator.ts` | Has `requireReviewApproved` but unused; may need a `requirePlanApproved` gate that checks `planMode === null` |

## Fix Direction

Add a gate to the `plan → implement` transition that blocks unless the plan review loop has completed. Options:
1. Add `{ type: "requirePlanApproved" }` gate that checks `state.planMode === null` (set by `handleApproveVerdict` path via `transition()` line 138-139)
2. Use existing `requireReviewApproved` and ensure `handleApproveVerdict` sets `reviewApproved = true`
3. Block `phase_next` entirely during plan phase when `planMode !== null`

Option 1 is cleanest — `planMode` is already cleared when leaving plan (state-machine.ts line 138-139), and `handleApproveVerdict` is the only path that transitions out of plan after proper review.

## Prompt Audit

As part of this fix, review all plan-phase prompt templates to ensure they align with the runtime enforcement:

- `write-plan.md` (draft mode) — should instruct the agent to call `plan_draft_done` when finished, **not** `phase_next`. Verify it never suggests `phase_next` as a valid action during plan.
- `review-plan.md` (review mode) — should instruct the reviewer to call `megapowers_plan_review`, not `phase_next`. Verify.
- `revise-plan.md` (revise mode) — should instruct the agent to call `plan_draft_done` after revisions, not `phase_next`. This is likely where the bypass occurs in practice: the revise prompt may not clearly direct the agent back through `plan_draft_done` → review.
- Check all plan-phase prompts for any mention of `phase_next` or `megapowers_signal({ action: "phase_next" })` — these should not appear in plan-phase templates.
- Ensure the revise prompt explicitly states the flow: revise tasks → `plan_draft_done` → automatic review session.

The runtime gate fix (blocking `phase_next` without plan approval) is the hard enforcement, but the prompts must also guide the LLM correctly to avoid hitting the gate error repeatedly.
