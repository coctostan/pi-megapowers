# Feature: Subagent Robustness — Agent Optimization & jj Prerequisites (Guided Onboarding Edition)

## Summary
This feature improves subagent reliability by making `jj` prerequisites visible at session start and by returning actionable setup instructions when subagent dispatch cannot proceed. It also upgrades builtin subagent definitions (worker, scout, reviewer) with differentiated model/thinking configurations and substantially richer role-specific prompts. Finally, subagent task context now includes workflow phase and spec/diagnosis acceptance criteria to improve implementation and verification quality.

## Design Decisions
- **Pure availability check (`checkJJAvailability`)**: jj installation/repo readiness detection was extracted into a pure function in `jj.ts` for deterministic testing and clear separation of concerns.
- **Message centralization (`jj-messages.ts`)**: installation and setup guidance text is centralized to avoid drift between session-start notifications and dispatch-time errors.
- **Informational-only session behavior**: jj checks during `session_start` notify but never block startup, preserving megapowers functionality when jj is absent.
- **Role-specialized builtin agents**: worker/scout/reviewer prompts were expanded into multi-paragraph operating guidance with unique model+thinking pairs to reduce role overlap.
- **Prompt context enrichment**: `buildSubagentPrompt` now includes current phase and spec/diagnosis content to align subagent behavior with workflow stage and acceptance criteria.
- **Resolution mechanism unchanged**: project → user-home → builtin agent lookup order was preserved intentionally for compatibility and user override behavior.

## API / Interface
- **New helper API**
  - `checkJJAvailability(runVersion, runRoot): Promise<"not-installed" | "not-repo" | "ready">` in `extensions/megapowers/jj.ts`.
- **New message module**
  - `JJ_INSTALL_MESSAGE`, `JJ_INIT_MESSAGE`, and `jjDispatchErrorMessage()` in `extensions/megapowers/jj-messages.ts`.
- **Session-start behavior update**
  - `extensions/megapowers/index.ts` now runs jj availability checks and calls `ctx.ui.notify(...)` with contextual guidance.
- **Dispatch error update**
  - `handleSubagentDispatch` now returns `jjDispatchErrorMessage()` when jj is unavailable.
- **Prompt context interface update**
  - `SubagentPromptInput` now includes `phase?: string` and `specContent?: string`.
  - `buildSubagentPrompt(...)` now emits `## Current Phase` and `## Acceptance Criteria` sections when data is available.
- **Builtin agent definitions**
  - `agents/worker.md`, `agents/scout.md`, `agents/reviewer.md` now contain differentiated model/thinking settings and expanded system prompts.

## Testing
- **Full suite:** `577 pass / 0 fail` across 30 files.
- **JJ availability + messages**
  - Added tests for `checkJJAvailability` outcomes (`not-installed`, `not-repo`, `ready`) and short-circuit behavior.
  - Added assertions that install/setup guidance includes `brew install jj`, `cargo install jj-cli`, `jj git init --colocate`.
- **Session-start integration invariants**
  - Added source-level tests in `tests/index-integration.test.ts` confirming imports, notify calls, and non-blocking control flow.
- **Dispatch guidance**
  - Updated `tests/subagent-tools.test.ts` to assert actionable jj error content.
- **Prompt context coverage**
  - Added `tests/subagent-context.test.ts` cases for phase inclusion and acceptance-criteria inclusion/omission behavior.
- **Agent quality + differentiation**
  - Added tests validating minimum paragraph depth and semantic coverage for worker/scout/reviewer prompts.
  - Added uniqueness test ensuring no duplicate model+thinking pair across builtin agents.
  - Added priority-order tests confirming project → home → builtin resolution remains intact.

## Files Changed
- `extensions/megapowers/jj.ts` — added `JJAvailability` type and `checkJJAvailability` helper.
- `extensions/megapowers/jj-messages.ts` — new centralized jj install/setup/user-guidance messages.
- `extensions/megapowers/index.ts` — wired informational jj checks + UI notifications into `session_start`.
- `extensions/megapowers/subagent-tools.ts` — switched jj error return to centralized actionable message; passes phase/spec context into prompt builder.
- `extensions/megapowers/subagent-context.ts` — extended prompt input and prompt assembly with phase + acceptance criteria sections.
- `agents/worker.md` — upgraded to multi-paragraph worker guidance with TDD and completion expectations.
- `agents/scout.md` — upgraded to multi-paragraph investigation/reporting guidance.
- `agents/reviewer.md` — upgraded to multi-paragraph review severity and feedback-format guidance.
- `tests/jj.test.ts` — added jj availability and guidance-message tests.
- `tests/index-integration.test.ts` — added session-start jj-check architectural invariant tests.
- `tests/subagent-tools.test.ts` — strengthened jj unavailable error assertions.
- `tests/subagent-context.test.ts` — added phase/spec prompt-injection tests.
- `tests/subagent-agents.test.ts` — added prompt-quality, differentiation, and priority-order tests.
