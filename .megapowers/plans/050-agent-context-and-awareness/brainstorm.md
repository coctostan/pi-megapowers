# Brainstorm: Agent Context and Awareness (#050)

## Approach

This batch improves agent context and awareness across four areas. The write policy in `canWrite()` is restructured so allowlisted files (`.md`, config, `.d.ts`, etc.) pass through in all phases — not just implement/code-review — while source code remains blocked outside those phases. This unlocks done-phase doc generation and brainstorm-phase project management writes without weakening TDD enforcement.

A new `prompts/base.md` template is created for the "no active issue" state. `buildInjectedPrompt()` is restructured with three tiers: return `null` when mega is off, return `base.md` when enabled but no issue is active, return full phase prompt when an issue is active. This gives the agent orientation on available commands and tools even before a workflow starts.

The TDD type-only task problem is solved entirely through prompt improvements — `write-plan.md` gains guidance on annotating type-only tasks with `[no-test]`, and `implement-task.md` surfaces the `/tdd skip` escape hatch. No guard code changes needed. Finally, all 15 prompt templates get a full audit covering both behavioral fixes (unpopulated variables, missing tool guidance) and a consistency/tone pass — but the prompt audit is a **collaborative task** where the agent proposes each edit and the user approves before writing, since prompt wording directly shapes LLM behavior in every future session.

## Key Decisions

- **Allowlisted files writable in all phases** — reorder `canWrite()` to check `isAllowlisted()` before `BLOCKING_PHASES`. Source code still blocked outside implement/code-review.
- **`base.md` for no-issue state** — separate prompt file, not bolted onto `megapowers-protocol.md`. Named for extensibility as new processes are added.
- **TDD type-only fix is prompt-only** — `[no-test]` and `/tdd skip` already work; the LLM just doesn't know about them.
- **`tests_failed`/`tests_passed` stay in `implement-task.md` only** — keeps base protocol lean.
- **Prompt audit is collaborative** — agent proposes edits, user approves before writing. Not autonomous batch rewrite. Task description encodes this process, no new tooling.
- **Full audit scope** — both behavior fixes (unpopulated vars, missing guidance) and consistency/tone in one pass.

## Components

- **`write-policy.ts`** — reorder `canWrite()` so `isAllowlisted()` is checked before phase blocking
- **`prompt-inject.ts`** — three-tier injection: null (mega off) → base.md (no issue) → full phase prompt (active issue)
- **`prompts/base.md`** — new template for no-active-issue orientation
- **All 15 existing prompt templates** — collaborative audit and revision
- **`prompts/write-plan.md`** — add `[no-test]` annotation guidance for type-only tasks
- **`prompts/implement-task.md`** — add `/tdd skip` awareness
- **Tests** — `canWrite()` tests for allowlisted-in-all-phases, `buildInjectedPrompt()` tests for base.md injection path

## Testing Strategy

- **`write-policy.ts`**: verify `.md` files pass `canWrite()` in all phases; verify `.ts`/`.js` still blocked in non-implement phases; verify TDD guard still enforced for source files during implement
- **`prompt-inject.ts`**: verify `base.md` returned when `megaEnabled && !activeIssue`; verify `null` when `!megaEnabled`; verify full phase prompt when issue active; verify template variable interpolation
- **Template variable validation**: unit tests checking all `{{var}}` placeholders in each template have corresponding population logic — prevents regression
- **Prompt audit**: no automated tests — collaborative content work validated by human review during the task
- **Regression**: full `bun test` suite to confirm no breakage from `canWrite()` reordering

## Source Issues Addressed

- #040 — Review all injected prompts for accuracy and completeness
- #044 — Write policy too strict in done/early phases
- #047 — TDD guard blocks type-only tasks
- #048 — No megapowers context without active issue
