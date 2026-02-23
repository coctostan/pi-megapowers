# AGENTS.md

Pi extension package that enforces structured development workflows via a state machine.

## Architecture

```
extensions/megapowers/
  index.ts           — Extension entry. Hooks pi events (session_start, tool_call, tool_result, message).
                       Registers custom tools (megapowers_signal, megapowers_save_artifact).
                       Intercepts write/edit via tool_call hook, post-processes bash via tool_result hook.
                       No module-level state variable — all reads/writes go through state-io.
  state-machine.ts   — Phase graph + transitions. Two workflows: feature, bugfix. Thin state schema.
  state-io.ts        — Disk-first state I/O. readState() / writeState() with atomic temp-file-then-rename.
                       Strips unknown keys (planTasks, acceptanceCriteria) to enforce thin schema.
  store.ts           — File-backed persistence (.megapowers/ dir). Issues, plans, learnings.
  gates.ts           — Precondition checks before phase transitions. Uses deriveTasks() for task gates.
  derived.ts         — On-demand derivation of structural data from artifact files.
                       deriveTasks() parses plan.md, deriveAcceptanceCriteria() parses spec.md/diagnosis.md.
  write-policy.ts    — Pure canWrite() function encoding the full phase/TDD write policy matrix.
                       Contains isTestFile(), isAllowlisted(), isTestRunnerCommand().
  tool-overrides.ts  — evaluateWriteOverride() for write/edit interception, processBashResult() for
                       test runner detection, recordTestFileWritten() for TDD state updates.
  tool-signal.ts     — Handler for megapowers_signal tool: task_done, review_approve, phase_next.
  tool-artifact.ts   — Handler for megapowers_save_artifact tool: writes phase artifacts to disk.
  phase-advance.ts   — Shared advancePhase() used by both tool and slash commands. Gate checks + jj.
  prompt-inject.ts   — Builds injected prompt with megapowers protocol + phase-specific tool instructions.
  prompts.ts         — Loads/interpolates prompt templates per phase from prompts/ dir.
  plan-parser.ts     — Extracts PlanTask[] from markdown (### Task N: headers or numbered lists).
  spec-parser.ts     — Extracts AcceptanceCriteria[] from specs, Fixed When criteria from diagnoses.
                       hasOpenQuestions() with sentinel detection (None, N/A, etc.).
  satellite.ts       — Satellite (subagent) mode detection and read-only state loading.
  task-coordinator.ts— jj change management per task (create, inspect, squash).
  jj.ts              — Jujutsu VCS integration. Change tracking per issue/phase.
  ui.ts              — TUI rendering. Phase progress bar, status, issue selection, done-phase menus.
                       Dashboard derives tasks on demand via deriveTasks().
  tools.ts           — Batch issue creation handler.
```

## Workflows

**Feature:** brainstorm → spec → plan → review → implement → verify → code-review → done
**Bugfix:** reproduce → diagnose → plan → review → implement → verify → done

Backward transitions allowed: review→plan, verify→implement, code-review→implement.

## State Architecture

### Disk-first, tool-first

Every event handler and tool handler reads state from disk via `readState(cwd)` at the start of its execution. There is no module-level `state` variable. All mutations write through to `state.json` immediately via `writeState(cwd, state)` which uses atomic temp-file-then-rename.

### Thin state schema

`state.json` stores only coordination and progress data:
- `activeIssue`, `workflow`, `phase`, `phaseHistory`
- `currentTaskIndex`, `completedTasks[]`
- `reviewApproved`, `tddTaskState`
- `taskJJChanges`, `jjChangeId`
- `doneMode`, `megaEnabled`

Task lists and acceptance criteria are **never** stored in state. They are derived on demand from artifact files (`plan.md`, `spec.md`, `diagnosis.md`) using `deriveTasks()` and `deriveAcceptanceCriteria()`.

### Custom tools

- **`megapowers_signal`** — LLM calls this for state transitions: `task_done`, `review_approve`, `phase_next`
- **`megapowers_save_artifact`** — LLM calls this to persist phase artifacts (spec, plan, etc.)

### Tool overrides

Built-in `write`/`edit` tools are intercepted via `tool_call` hook to enforce phase-based write policies and TDD tracking. Built-in `bash` is post-processed via `tool_result` hook to detect test runner results.

## Phase gates

| Transition | Requirement |
|---|---|
| spec → plan | `spec.md` exists, no open questions (sentinels like "None"/"N/A" recognized) |
| plan → review/implement | `plan.md` exists |
| review → implement | review approved (via `megapowers_signal`) |
| implement → verify | all plan tasks completed (derived from `plan.md` + `completedTasks`) |
| verify → code-review | `verify.md` exists |
| code-review → done | `code-review.md` exists |
| reproduce → diagnose | `reproduce.md` exists |
| diagnose → plan | `diagnosis.md` exists |

## Key concepts

- **Issue**: unit of work. Stored as markdown with frontmatter in `.megapowers/issues/`.
- **Phase**: current step in the workflow. Gated transitions prevent skipping.
- **TDD guard**: during `implement`, file writes to non-test files are blocked until a test file is written and test runner fails. Enforced via `canWrite()` pure function in `write-policy.ts`.
- **Derived data**: task lists parsed from `plan.md`, acceptance criteria from `spec.md`/`diagnosis.md` — always on demand, never cached.
- **State**: serialized to `.megapowers/state.json`. File state is always authoritative. `readState()` returns defaults on missing/corrupt file.
- **Mega off/on**: `/mega off` disables all enforcement (tools become passthrough). `/mega on` re-enables. Resets to enabled on session start.
- **Bugfix variable aliasing**: In bugfix mode, `reproduce_content` aliases to `brainstorm_content` and `diagnosis_content` aliases to `spec_content` so shared templates (write-plan.md) work for both workflows.

## Tests

`bun test` — all in `tests/`. Each module has a corresponding `.test.ts`. Tests are pure (no pi dependency, no filesystem side effects where possible). 418 tests across 20 files.

## Known issues

- **AC20**: jj task change creation on `task_done` not wired — functions exist in `task-coordinator.ts` but aren't called from `handleTaskDone` in `tool-signal.ts`.
- **Satellite TDD state**: Uses disk I/O instead of spec's in-memory requirement to avoid competing writes with primary session.
- **Async jj fire-and-forget**: jj operations in `tool-signal.ts` and `phase-advance.ts` run as fire-and-forget async blocks — low risk race condition given pi's sequential tool execution.
