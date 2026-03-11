---
id: 100
type: bugfix
status: closed
created: 2026-03-07T14:57:10.132Z
sources: [94]
milestone: M3
priority: 1
---
# Remove T1 model-wiring from extensions/megapowers/register-tools.ts
## Problem

`extensions/megapowers/register-tools.ts` currently builds a T1 lint completion function and passes it into `handlePlanDraftDone()`. This hardcodes an extra model-dependent plan gate into tool registration.

## Scope

Remove the T1 wiring path from `register-tools.ts`.

Desired changes:
- delete `buildLintCompleteFn()`
- remove `complete` / `CompleteFn` imports used only for T1
- have `megapowers_signal` call `handlePlanDraftDone(ctx.cwd)` directly for `plan_draft_done`

## Acceptance criteria

1. `register-tools.ts` no longer constructs or passes a lint completion function for `plan_draft_done`.
2. Imports used only by T1 are removed.
3. `megapowers_signal` still creates a new session after a successful `plan_draft_done` transition.
4. Tool registration tests are updated if needed.
