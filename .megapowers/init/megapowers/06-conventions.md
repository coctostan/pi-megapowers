# Phase 6: Conventions & Standards — Megapowers

> **Date:** 2026-02-25
> **Scope:** Only what the dev workflow needs. Concise.

## Injectable Convention Docs

Small, phase-specific documents loaded into prompts. Bare minimum, no fluff.

| Doc | Consumed by | Location |
|-----|------------|----------|
| `TESTING.md` | Implement subagents, verify phase, TDD enforcement | `.megapowers/TESTING.md` |
| `IMPLEMENTATION.md` | Implement subagents, code review subagent | `.megapowers/IMPLEMENTATION.md` |

Additional convention docs can be added as needed (e.g., `REVIEW.md` for code review criteria). Each must be under 1KB — these are context-eaters.

---

## Language & Runtime

- **TypeScript** (strict mode), **bun** runtime, **ESM** modules
- Target: ESNext. Module resolution: bundler.
- Imports use `.js` extensions (bun ESM convention): `import { foo } from "./bar.js"`
- No formatter/linter configured. Existing code style is consistent — follow what's there.

## Test Protocol

- **Runner:** `bun test`
- **Location:** `tests/` directory (not co-located with source)
- **Naming:** `{module-name}.test.ts` — mirrors the source file it tests
- **Framework:** `bun:test` — `describe`, `it`, `expect`, `beforeEach`, `afterEach`
- **Pattern:** Tests are pure. No pi dependency. Use temp directories (`mkdtempSync`) for file-system state. Clean up in `afterEach`.
- **Helper pattern:** `makeState(overrides)` factory for test state. Override only what the test cares about.
- **Coverage:** Every source module has a corresponding test file. Currently 30 source files, 30 test files, 546 tests.
- **Integration tests:** `index-integration.test.ts`, `bugfix-integration.test.ts` test cross-module flows without pi.

## File & Module Conventions

- **Source:** `extensions/megapowers/` (proposed: subdirectories per domain — core/, workflows/, subagent/, etc.)
- **One concern per file.** Files are small (25-290 lines). Exception: `index.ts` (870 lines) and `ui.ts` (573 lines) — both flagged for extraction.
- **Pure functions preferred.** Core logic (`gates.ts`, `write-policy.ts`, `state-machine.ts`, `derived.ts`) is pure — no I/O, no pi dependency. Testable in isolation.
- **I/O at the edges.** `state-io.ts` handles disk. `store.ts` handles file system. `jj.ts` handles shell commands. Business logic calls these, doesn't do its own I/O.

## Naming Conventions

- **Files:** kebab-case. `plan-parser.ts`, `state-machine.ts`, `subagent-workspace.ts`
- **Types/Interfaces:** PascalCase. `MegapowersState`, `PlanTask`, `WorkflowConfig`
- **Functions:** camelCase. `checkGate()`, `readState()`, `buildInjectedPrompt()`
- **Constants:** UPPER_SNAKE for sets/maps used as config. `OPEN_ENDED_PHASES`, `FEATURE_TRANSITIONS`
- **Issues:** `{3-digit-id}-{kebab-case-title}.md`. Example: `041-save-artifact-tool-reliability-overwrite.md`
- **Artifacts:** Named by phase. `brainstorm.md`, `spec.md`, `plan.md`, `verify.md`, `code-review.md`

## Issue Format

YAML frontmatter + markdown body:

```yaml
---
id: 41
type: bugfix          # bugfix | feature
status: open          # open | in-progress | done
created: 2026-02-24T00:48:02.892Z
sources: [38, 39]     # optional — parent issue IDs
milestone: M2         # roadmap milestone
priority: 1           # 1 (highest) — 5 (lowest)
---
```

Body: title (H1), description, implementation details if known.

## Commit Conventions

- **jj change descriptions:** Imperative mood, concise. `Fix subagent workspace squash`, `Extract index.ts hook handlers`.
- **One logical change per commit.** Don't mix refactoring with feature work.
- **Task-level commits during implement phase.** Each plan task = one jj change.

## Error Handling

- **Return result types, don't throw.** `checkGate()` returns `{ pass: boolean, reason?: string }`. `canWrite()` returns `{ allowed: boolean, reason: string }`.
- **Throw only for programmer errors** (invariant violations), not expected failures.
- **Surface errors to user with context.** Not just "failed" — say what failed, why, and what to do about it.

## Prompt Templates

- **Location:** `prompts/` directory
- **Format:** Markdown with mustache-style `{{variable}}` interpolation
- **Naming:** `{phase-or-action}.md`. `brainstorm.md`, `write-plan.md`, `review-plan.md`, `implement-task.md`
- **Scope:** Each prompt is focused on one phase/action. No mega-prompts.
