# AGENTS.md

Pi extension that enforces structured development workflows via a state machine.

## Workflows

**Feature:** brainstorm → spec → plan → review → implement → verify → code-review → done
**Bugfix:** reproduce → diagnose → plan → review → implement → verify → done

Backward transitions: review→plan, verify→implement, code-review→implement.

## State Architecture

Disk-first, tool-first. Every handler reads state from disk via `readState(cwd)` — no module-level state variable. Mutations write through atomically via `writeState()`.

`state.json` stores only coordination data: `activeIssue`, `workflow`, `phase`, `currentTaskIndex`, `completedTasks[]`, `reviewApproved`, `tddTaskState`, `megaEnabled`. Task lists and acceptance criteria are derived on demand from artifact files (`plan.md`, `spec.md`, `diagnosis.md`).

## Custom Tools

- **`megapowers_signal`** — state transitions: `task_done`, `review_approve`, `phase_next`
- **`megapowers_save_artifact`** — persist phase artifacts to disk

## Enforcement

- **Write policy**: `write`/`edit` intercepted via `tool_call` hook. Phase-based restrictions enforced by `canWrite()`.
- **TDD guard**: during `implement`, production file writes blocked until test file written and test runner fails.
- **Phase gates**: each transition requires its artifact (e.g. spec→plan needs `spec.md` with no open questions).

## Key Concepts

- **Issue**: unit of work, stored as markdown with frontmatter in `.megapowers/issues/`.
- **Derived data**: tasks from `plan.md`, acceptance criteria from `spec.md`/`diagnosis.md` — always on demand, never cached.
- **Mega off/on**: `/mega off` disables enforcement, `/mega on` re-enables. Resets on session start.
- **Bugfix aliasing**: `reproduce_content` → `brainstorm_content`, `diagnosis_content` → `spec_content` for shared templates.

## Tests

`bun test` — 546 tests across 30 files. Each module has a corresponding `.test.ts`. Tests are pure (no pi dependency).

## Known Issues

- **AC20**: jj task change creation on `task_done` not wired — functions exist but aren't called.
- **Async jj fire-and-forget**: jj operations run as fire-and-forget — low risk given pi's sequential tool execution.
