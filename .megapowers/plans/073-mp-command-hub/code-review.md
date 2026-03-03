## Files Reviewed
- `extensions/megapowers/index.ts` — added `/mp` command registration and argument completions wiring.
- `extensions/megapowers/mp/mp-command.ts` — subcommand dispatch, default/fallback behavior, completions.
- `extensions/megapowers/mp/mp-handlers.ts` — typed handler registry, help rendering, `/mp new` inject flow, stubs, `/mp on|off` delegation.
- `extensions/megapowers/register-tools.ts` — `create_issue` tool registration and execution path.
- `extensions/megapowers/tools/create-issue-schema.ts` — Zod validation contract for issue creation.
- `extensions/megapowers/tools/tool-create-issue.ts` — validated create handler calling store and returning `{slug,id}`.
- `extensions/megapowers/state/store.ts` — optional `milestone`/`priority` support in create/parse/format.
- `extensions/megapowers/prompt-inject.ts` — idle prompt formatting for optional priority.
- Tests reviewed and run:
  - `tests/mp-command.test.ts`
  - `tests/mp-help.test.ts`
  - `tests/mp-new-inject.test.ts`
  - `tests/mp-on-off.test.ts`
  - `tests/mp-existing-commands.test.ts`
  - `tests/create-issue-tool-validation.test.ts`
  - `tests/create-issue-tool-success.test.ts`
  - `tests/store-milestone-priority.test.ts`
  - `tests/prompt-inject.test.ts`
  - `tests/store.test.ts`

## Strengths
- `/mp` dispatch behavior is clean and robust: default-to-help + unknown-to-help fallback is explicit (`extensions/megapowers/mp/mp-command.ts:12-17`).
- Subcommand matching is now case-insensitive (`extensions/megapowers/mp/mp-command.ts:13`), preserving prior `/mega` ergonomics and reducing user friction.
- Handler contract is clear (`tier`, `description`, `execute`) and consistently applied (`extensions/megapowers/mp/mp-handlers.ts:4-10`, `80-127`).
- `/mp new` inject prompt is specific and action-oriented, including required/optional fields and explicit `create_issue` tool call guidance (`extensions/megapowers/mp/mp-handlers.ts:49-70`, `86-99`).
- `create_issue` validation and execution split is good: schema validation in one place and store call/return mapping in one place (`extensions/megapowers/tools/create-issue-schema.ts:3-10`, `extensions/megapowers/tools/tool-create-issue.ts:11-18`).
- Store formatting for optional metadata is clean (no empty frontmatter fields) and round-trips correctly (`extensions/megapowers/state/store.ts:93-101`, `157-178`).
- Test coverage is meaningful for behavior (dispatch, help, tool validation/success, persistence formatting, compatibility).

## Findings

### Critical
None.

### Important
None.

### Minor
1. **Duplicated subcommand source-of-truth can drift**  
   - **File:line:** `extensions/megapowers/mp/mp-handlers.ts:14-28`, `extensions/megapowers/mp/mp-handlers.ts:80-127`, `extensions/megapowers/mp/mp-command.ts:37-39`  
   - **What’s wrong:** Subcommands are declared once in `MP_SUBCOMMANDS` and again as explicit registry assignments.  
   - **Why it matters:** Future additions/removals can update one list but not the other, causing completion/help/dispatch inconsistencies.  
   - **How to fix:** Move to a single declarative subcommand definition (metadata + executor), and derive both registry and completion list from it.

## Recommendations
- Keep the current architecture, but consider a single typed subcommand definition table to eliminate duplication and improve compile-time consistency.
- Optional follow-up: tighten typing around `/mp on|off` delegation by removing `any` casts once command context types are aligned.

## Assessment
ready

Feature is functionally correct, well-tested, and production-safe for the scoped acceptance criteria. No merge-blocking issues found.

### Review session fix applied
- Updated `/mp` dispatch to normalize subcommand casing (`toLowerCase`) and added regression coverage (`tests/mp-command.test.ts`) for case-insensitive dispatch.
- Full suite re-run after fix:
  - `bun test` → **730 pass, 0 fail**.
