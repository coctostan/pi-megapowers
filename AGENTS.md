# AGENTS.md

Pi extension that enforces structured development workflows via a state machine.

## workflows

**Feature:** brainstorm → spec → plan → review → implement → verify → code-review → done
**Bugfix:** reproduce → diagnose → plan → review → implement → verify → done

Backward transitions: review→plan, verify→implement, code-review→implement.

## state architecture

Disk-first, tool-first. Every handler reads state from disk via `readState(cwd)` — no module-level state variable. Mutations write through atomically via `writeState()`.

`state.json` stores only coordination data: `activeIssue`, `workflow`, `phase`, `currentTaskIndex`, `completedTasks[]`, `reviewApproved`, `tddTaskState`, `megaEnabled`. Task lists and acceptance criteria are derived on demand from artifact files (`plan.md`, `spec.md`, `diagnosis.md`).

## custom tools

- **`megapowers_signal`** — state transitions: `task_done`, `review_approve`, `phase_next`, `phase_back`, `tests_failed`, `tests_passed`
- **`pipeline`** — dispatch implement→verify→review pipeline for a plan task in an isolated jj workspace; supports pause/resume with guidance
- **`subagent`** — one-shot subagent dispatch for ad-hoc tasks; squashes changes back on success

## enforcement

- **Write policy**: `write`/`edit` intercepted via `tool_call` hook. Phase-based restrictions enforced by `canWrite()`.
- **TDD guard**: during `implement` (primary session), production file writes blocked until test file written and test runner fails. Subagent sessions use prompt-based TDD + deterministic post-hoc audit instead.
- **Phase gates**: each transition requires its artifact (e.g. spec→plan needs `spec.md` with no open questions).

## key concepts

- **Issue**: unit of work, stored as markdown with frontmatter in `.megapowers/issues/`.
- **Derived data**: tasks from `plan.md`, acceptance criteria from `spec.md`/`diagnosis.md` — always on demand, never cached.
- **Mega off/on**: `/mega off` disables enforcement, `/mega on` re-enables. Resets on session start.
- **Bugfix aliasing**: `reproduce_content` → `brainstorm_content`, `diagnosis_content` → `spec_content` for shared templates.
- **Pipeline**: `pipeline` tool runs implement→verify→review in an isolated jj workspace per task. On pause, parent LLM can resume with `{ resume: true, guidance }`. On completion, workspace is squashed and task marked done.
- **Satellite mode**: subagent sessions (`PI_SUBAGENT=1` or `PI_SUBAGENT_DEPTH>0`) don't install write-blocking hooks; TDD is enforced via prompts + `auditTddCompliance` + reviewer.

## tests

`bun test` — tests across 48+ files. Each module has a corresponding `.test.ts`. Tests are pure (no pi dependency).

## known issues

- **Async jj fire-and-forget**: jj operations run as fire-and-forget — low risk given pi's sequential tool execution.
- **Pipeline context growth**: `renderContextPrompt` appends full step output verbatim across retries — could exceed context limits for long-running pipelines with many retries.
- **Workspace op return types**: `squashPipelineWorkspace` / `cleanupPipelineWorkspace` return untyped `{} | { error: string }`, requiring `(x as any).error` casts in callers.
