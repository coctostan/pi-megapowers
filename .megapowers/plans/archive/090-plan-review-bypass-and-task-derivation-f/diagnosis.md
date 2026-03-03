# Diagnosis

## Root Cause

Two independent bugs with a compounding interaction:

### Bug A: `phase_next` bypasses plan review gate

The `plan → implement` transition in both workflow configs (`feature.ts` line 18, `bugfix.ts` line 17) only checks `requireArtifact("plan.md")`. This gate passes trivially once `plan.md` exists, regardless of whether the plan review loop (`draft → review → approve`) has completed.

The `requireReviewApproved` gate type exists in `gate-evaluator.ts` (lines 22-27) but is **not used** in any workflow transition config. Meanwhile, `handleApproveVerdict` (the correct path) calls `transition(state, "implement")` directly — but `phase_next` provides an unguarded bypass.

Additionally, the `revise-plan.md` prompt template does **not** instruct the agent to call `plan_draft_done` after completing revisions, making it likely the agent calls `phase_next` instead, triggering the bypass.

### Bug B: `deriveTasks` ignores task files

`deriveTasks()` in `state/derived.ts` (lines 13-18) only reads `plan.md` via `extractPlanTasks()`. It never reads task files from the `tasks/` directory (`listPlanTasks` from `plan-store.ts`). When `handleApproveVerdict` runs (happy path), it calls `generateLegacyPlanMd(tasks)` which writes `plan.md` in the exact `### Task N:` format the parser expects. But when `phase_next` bypasses approval, `generateLegacyPlanMd` never runs, and `plan.md` contains whatever format the LLM wrote — which the strict parser rejects.

`extractPlanTasks` in `plan-parser.ts` (line 71) uses pattern `/^###\s+Task\s+(\d+):\s*(.+)$/gm` — only matches `### Task N:` (triple hash + colon). Rejects `## Task N:`, `### Task N —`, `## Task N —`.

## Trace

### Bug A trace:
1. **Symptom**: `phase_next` during plan phase advances to implement without review
2. `handlePhaseNext` (tool-signal.ts:286) → `advancePhase` (phase-advance.ts:16)
3. `advancePhase` finds forward transition `plan → implement`, calls `checkGate` (phase-advance.ts:49)
4. `checkGate` (gates.ts:12) looks up transition config, iterates gates
5. Only gate: `{ type: "requireArtifact", file: "plan.md" }` — passes when file exists
6. No check for `state.planMode`, `state.reviewApproved`, or plan review completion
7. `transition()` called (state-machine.ts:110), which clears `planMode` to null (line 138-139)
8. **Root**: workflow configs missing a plan-approval gate

### Bug B trace:
1. **Symptom**: implement phase has 0 tasks
2. `deriveTasks` (derived.ts:13) reads `plan.md`, calls `extractPlanTasks`
3. `extractPlanTasks` (plan-parser.ts:22) tries `extractTaskHeaders` first
4. `extractTaskHeaders` (plan-parser.ts:69) uses strict pattern `/^###\s+Task\s+(\d+):\s*(.+)$/gm`
5. LLM-written `plan.md` uses `## Task N —` format → no matches → falls through to `extractNumberedItems`
6. If no numbered list items either → returns `[]`
7. Task files in `tasks/` directory are never consulted
8. **Root**: `deriveTasks` is a legacy function that predates the plan-store system

## Affected Code

| File | Function | Lines | Issue |
|------|----------|-------|-------|
| `extensions/megapowers/workflows/feature.ts` | transition config | 18 | `plan→implement` gate missing plan-approval check |
| `extensions/megapowers/workflows/bugfix.ts` | transition config | 17 | Same |
| `extensions/megapowers/workflows/gate-evaluator.ts` | `evaluateGate` | 22-27 | `requireReviewApproved` exists but unused |
| `extensions/megapowers/state/derived.ts` | `deriveTasks` | 13-18 | Only reads `plan.md`, ignores task files |
| `extensions/megapowers/plan-parser.ts` | `extractTaskHeaders` | 69-78 | Strict `### Task N:` pattern |
| `extensions/megapowers/tools/tool-plan-review.ts` | `handleApproveVerdict` | 88-116 | Correct path — generates legacy plan.md |
| `extensions/megapowers/policy/phase-advance.ts` | `advancePhase` | 16-93 | Executes bypass (no fault here — just evaluates gates) |
| `prompts/revise-plan.md` | — | end of file | Missing `plan_draft_done` instruction |

## Pattern Analysis

### Working example: `spec → plan` transition
```typescript
{ from: "spec", to: "plan", gates: [
  { type: "requireArtifact", file: "spec.md" },
  { type: "noOpenQuestions", file: "spec.md" }
]}
```
Two gates — artifact existence AND content validation. The `plan → implement` transition only has artifact existence.

### Working example: `handleApproveVerdict` (correct plan→implement path)
1. Reads task files via `listPlanTasks`
2. Updates task statuses
3. Generates `plan.md` via `generateLegacyPlanMd` (correct format)
4. Calls `transition(state, "implement", derivedTasks)` directly
5. Result: `plan.md` always in parseable format, review always completed

### Broken path: `phase_next` (bypass)
1. Calls `advancePhase` → `checkGate` → only checks `requireArtifact`
2. `generateLegacyPlanMd` never called
3. `plan.md` in whatever LLM format → `deriveTasks` returns `[]`

### Working example: `write-plan.md` prompt
Contains: `After all tasks are saved, call megapowers_signal({ action: "plan_draft_done" }) to submit for review.`

### Broken: `revise-plan.md` prompt
Ends after revision instructions — no `plan_draft_done` call instruction, no "next step" guidance.

## Risk Assessment

### Bug A fix (adding plan-approval gate):
- **Low risk**: Adding a new gate to workflow configs is additive. The `handleApproveVerdict` path already bypasses `advancePhase` entirely (calls `transition` directly), so it won't be affected.
- **Edge case**: If `planMode` is somehow null during plan phase without proper approval, the gate would incorrectly allow passage. But `planMode` is set to `"draft"` on plan entry (state-machine.ts:133) and only cleared on exit (line 138-139).
- **Dependents**: `advancePhase`, `handlePhaseNext`, `handlePhaseBack` all use `checkGate`. Backward transitions skip gates (gates.ts:27-29), so no impact there.

### Bug B fix (deriveTasks reading task files):
- **Medium risk**: `deriveTasks` is called from:
  - `gate-evaluator.ts` (`allTasksComplete` gate) — would now find tasks where it previously found 0
  - `tool-signal.ts` (`handleTaskDone`, `handlePhaseNext`) — same
  - `prompt-inject.ts` (`buildInjectedPrompt`) — would populate task vars correctly
  - `phase-advance.ts` (`advancePhase`) — passes tasks to `transition` for `currentTaskIndex`
- **Format concern**: Task files use frontmatter (`PlanTask` schema via `plan-store.ts`), while `plan.md` parsing returns `PlanTask` from markdown headers. Need to ensure the returned `PlanTask` shape is compatible.
- **Fallback behavior**: Must preserve `plan.md` fallback for repos that don't use task files.

### Bug B fix (lenient parser):
- **Low risk**: Making `extractPlanTasks` more lenient is purely additive — it would match more formats, not fewer.
- **Secondary priority**: If `deriveTasks` reads task files first, the parser leniency is defense-in-depth only.

## Fixed When

1. `phase_next` during plan phase with `planMode: "draft"` returns an error (does not advance to implement)
2. `phase_next` during plan phase with `planMode: "revise"` returns an error (does not advance to implement)
3. `phase_next` during plan phase with `planMode: null` (after proper approval via `handleApproveVerdict`) succeeds — though this path is unlikely since `handleApproveVerdict` transitions directly
4. `deriveTasks` returns tasks from task files when they exist in the `tasks/` directory
5. `deriveTasks` falls back to `plan.md` parsing when no task files exist (backward compatibility)
6. `extractPlanTasks` accepts `##` and `###` headers with `:`, `—`, or `-` separators
7. `revise-plan.md` prompt includes explicit instruction to call `plan_draft_done` after completing revisions
8. No plan-phase prompt template mentions `phase_next` as a valid action
9. Existing tests in `tests/reproduce-090.test.ts` assertions flip (currently assert buggy behavior)
