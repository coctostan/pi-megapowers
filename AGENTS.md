# AGENTS.md

Pi extension package that enforces structured development workflows via a state machine.

## Architecture

```
extensions/megapowers/
  index.ts          — Extension entry. Hooks pi events (session_start, tool_call, message).
  state-machine.ts  — Phase graph + transitions. Two workflows: feature, bugfix.
  store.ts          — File-backed persistence (.mega/ dir). Issues, plans, state, learnings.
  gates.ts          — Precondition checks before phase transitions (e.g. spec must exist before plan).
  tdd-guard.ts      — Enforces test-before-impl during implement phase. Blocks non-test file writes until tests run.
  artifact-router.ts— Routes LLM output to files by phase (spec→spec.md, plan→plan.md, etc).
  prompts.ts        — Loads/interpolates prompt templates per phase from prompts/ dir.
  plan-parser.ts    — Extracts PlanTask[] from markdown (### Task N: headers or numbered lists).
  spec-parser.ts    — Extracts AcceptanceCriteria[] and detects open questions in specs.
  jj.ts             — Jujutsu VCS integration. Change tracking per issue/phase.
  ui.ts             — TUI rendering. Phase progress bar, status, issue selection.
```

## Workflows

**Feature:** brainstorm → spec → plan → review → implement → verify → code-review → done  
**Bugfix:** reproduce → diagnose → plan → review → implement → verify → done

Backward transitions allowed: review→plan, verify→implement, code-review→implement.

## Key concepts

- **Issue**: unit of work. Stored as markdown with frontmatter in `.mega/issues/`.
- **Phase**: current step in the workflow. Gated transitions prevent skipping.
- **TDD guard**: during `implement`, file writes to non-test files are blocked until a test file is written and test runner passes.
- **Artifact router**: LLM output is parsed per-phase and saved to `.mega/plans/{issue}/`.
- **State**: serialized to `.mega/state.json` and pi session entries (crash recovery).

## Tests

`bun test` — all in `tests/`. Each module has a corresponding `.test.ts`. Tests are pure (no pi dependency, no filesystem side effects where possible).
