# Bugfix: Plan Review Bypass and Task Derivation

**Issue:** #090 (batch: #088, #089)
**Type:** bugfix
**Date:** 2026-03-02

## Root Cause

Two independent bugs with a compounding interaction:

### Bug A — `phase_next` bypasses plan review gate (#088)

The `plan → implement` transition in both `feature.ts` and `bugfix.ts` only checked `requireArtifact("plan.md")`. This gate passed trivially once `plan.md` existed, regardless of whether the plan review loop (draft → review → approve) had completed. A `requireReviewApproved` gate existed in `gate-evaluator.ts` but was never wired into any workflow config.

Result: calling `phase_next` during the plan phase advanced to implement without review — bypassing `handleApproveVerdict`, which is the only path that calls `generateLegacyPlanMd`.

### Bug B — `deriveTasks` ignores task files (#089)

`deriveTasks()` in `state/derived.ts` only read `plan.md` via `extractPlanTasks()`. It never consulted task files in the `tasks/` directory (managed by `plan-store.ts`). Combined with Bug A (bypass skips `generateLegacyPlanMd`), `plan.md` would be in whatever format the LLM wrote — typically `## Task N — Description` (double hash, em-dash), which the strict `### Task N:` parser rejected. Result: implement phase showed 0 tasks.

## Fix

### 1. Added `requirePlanApproved` gate

Added `RequirePlanApprovedGate` to `extensions/megapowers/workflows/types.ts` and implemented it in `gate-evaluator.ts`:

```typescript
case "requirePlanApproved": {
  if (state.planMode !== null) {
    return { pass: false, message: `Plan review not complete (planMode: ${state.planMode}). Call plan_draft_done to submit for review.` };
  }
  return { pass: true };
}
```

Wired it into the `plan → implement` transition in both `feature.ts` and `bugfix.ts`:

```typescript
{ from: "plan", to: "implement", gates: [
  { type: "requireArtifact", file: "plan.md" },
  { type: "requirePlanApproved" }
]}
```

### 2. Made `deriveTasks` prefer task files

Updated `state/derived.ts` to call `listPlanTasks()` first and fall back to `plan.md` parsing only when no task files exist:

```typescript
const taskDocs = listPlanTasks(cwd, issueSlug);
if (taskDocs.length > 0) {
  return taskDocs.map((doc) => ({ index: doc.data.id, description: doc.data.title, ... }));
}
// fallback: plan.md parsing
```

### 3. Made `extractPlanTasks` pattern more lenient

Changed `extractTaskHeaders` pattern from `/^###\s+Task\s+(\d+):\s*(.+)$/gm` to `/^#{2,3}\s+Task\s+(\d+)\s*[:—–-]\s*(.+)$/gm`, accepting `##`/`###` headers and `:`, `—`, `–`, or `-` separators.

### 4. Fixed `revise-plan.md` prompt

Added explicit "When Done" section instructing the agent to call `plan_draft_done` (not `phase_next`) after completing revisions.

## Files Changed

| File | Change |
|------|--------|
| `extensions/megapowers/workflows/types.ts` | Added `RequirePlanApprovedGate` type |
| `extensions/megapowers/workflows/gate-evaluator.ts` | Implemented `requirePlanApproved` case |
| `extensions/megapowers/workflows/feature.ts` | Added gate to `plan→implement` transition |
| `extensions/megapowers/workflows/bugfix.ts` | Added gate to `plan→implement` transition |
| `extensions/megapowers/state/derived.ts` | `deriveTasks` now reads task files first |
| `extensions/megapowers/plan-parser.ts` | Lenient `#{2,3}` and `[:—–-]` pattern |
| `prompts/revise-plan.md` | Added `plan_draft_done` "When Done" section |
| `tests/reproduce-090.test.ts` | 9 regression tests (assertions flipped from buggy behavior) |

## Verification

```
bun test tests/reproduce-090.test.ts
 9 pass, 0 fail

bun test
 688 pass, 0 fail
```

All 9 acceptance criteria pass. See `.megapowers/plans/090-plan-review-bypass-and-task-derivation-f/verify.md` for full per-criterion evidence.
