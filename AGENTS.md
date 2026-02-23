# AGENTS.md

Pi extension package that enforces structured development workflows via a state machine.

## Architecture

```
extensions/megapowers/
  index.ts           — Extension entry. Hooks pi events (session_start, tool_call, message).
  state-machine.ts   — Phase graph + transitions. Two workflows: feature, bugfix.
  store.ts           — File-backed persistence (.megapowers/ dir). Issues, plans, state, learnings.
  gates.ts           — Precondition checks before phase transitions (e.g. spec must exist before plan).
  tdd-guard.ts       — Enforces test-before-impl during implement phase. Blocks non-test file writes until tests run.
  artifact-router.ts — Routes LLM output to files by phase (spec→spec.md, plan→plan.md, reproduce→reproduce.md, etc).
  prompts.ts         — Loads/interpolates prompt templates per phase from prompts/ dir.
  plan-parser.ts     — Extracts PlanTask[] from markdown (### Task N: headers or numbered lists).
  spec-parser.ts     — Extracts AcceptanceCriteria[] from specs and Fixed When criteria from diagnoses.
  state-recovery.ts  — Resolves startup state: file state is authoritative when active, session entries for crash recovery.
  jj.ts              — Jujutsu VCS integration. Change tracking per issue/phase.
  ui.ts              — TUI rendering. Phase progress bar, status, issue selection, done-phase menus.
```

## Workflows

**Feature:** brainstorm → spec → plan → review → implement → verify → code-review → done
**Bugfix:** reproduce → diagnose → plan → review → implement → verify → done

Backward transitions allowed: review→plan, verify→implement, code-review→implement.

## Phase gates

| Transition | Requirement |
|---|---|
| spec → plan | `spec.md` exists, no open questions |
| plan → review/implement | `plan.md` exists |
| review → implement | review approved |
| implement → verify | all plan tasks completed |
| verify → code-review | `verify.md` exists |
| code-review → done | `code-review.md` exists |
| reproduce → diagnose | `reproduce.md` exists |
| diagnose → plan | `diagnosis.md` exists |

## Key concepts

- **Issue**: unit of work. Stored as markdown with frontmatter in `.megapowers/issues/`.
- **Phase**: current step in the workflow. Gated transitions prevent skipping.
- **TDD guard**: during `implement`, file writes to non-test files are blocked until a test file is written and test runner passes.
- **Artifact router**: LLM output is parsed per-phase and saved to `.megapowers/plans/{issue}/`.
- **State**: serialized to `.megapowers/state.json`. File state is authoritative when an issue is active; session entries used only for crash recovery.
- **Bugfix variable aliasing**: In bugfix mode, `reproduce_content` aliases to `brainstorm_content` and `diagnosis_content` aliases to `spec_content` so shared templates (write-plan.md) work for both workflows.

## Tests

`bun test` — all in `tests/`. Each module has a corresponding `.test.ts`. Tests are pure (no pi dependency, no filesystem side effects where possible).

## Known issues

- **session_shutdown overwrite** (issue 004): The `session_shutdown` handler can overwrite a more-advanced file state with stale in-memory state. A phase-ordering guard mitigates this but is a heuristic, not a full fix.
- **implement resume** (issue 003): When all implement tasks are done and a session resumes, there's no mechanism to auto-advance to verify.
