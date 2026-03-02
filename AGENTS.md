# AGENTS.md

Pi extension that enforces structured development workflows via a state machine.

## workflows

**Feature:** brainstorm → spec → plan → implement → verify → code-review → done  
**Bugfix:** reproduce → diagnose → plan → implement → verify → done

Backward transitions:
- `verify` → `implement` (feature + bugfix)
- `code-review` → `implement` (feature)

## plan phase loop (current)

Plan authoring is an internal loop inside `plan` (not a separate workflow phase):
- **Draft/Revise:** create/update tasks with `megapowers_plan_task`
- **Submit draft:** `megapowers_signal({ action: "plan_draft_done" })` → enters review mode + starts new session
- **Review verdict:** `megapowers_plan_review({ verdict: "approve" | "revise", ... })`
  - `approve`: marks tasks approved, generates backward-compatible `plan.md`, advances to `implement`
  - `revise`: returns to revise mode, increments iteration (max 4)

## state architecture

Disk-first, tool-first. Every handler reads state from disk via `readState(cwd)` (no module-level state cache). Mutations persist atomically through `writeState()`.

`state.json` stores coordination data only (e.g. `activeIssue`, `workflow`, `phase`, `planMode`, `planIteration`, `currentTaskIndex`, `completedTasks`, `tddTaskState`, `taskJJChanges`, `megaEnabled`).

Derived data is always computed on demand:
- Tasks: canonical from `.megapowers/plans/<issue>/tasks/*.md` (fallback: `plan.md`)
- Acceptance criteria: from `spec.md` (feature) or `diagnosis.md` (bugfix)

## custom tools

- **`megapowers_signal`** — state transitions/signals: `task_done`, `phase_next`, `phase_back`, `tests_failed`, `tests_passed`, `plan_draft_done` (`review_approve` is deprecated)
- **`megapowers_plan_task`** — create/update structured plan tasks during draft/revise
- **`megapowers_plan_review`** — submit plan review verdict (`approve`/`revise`) with feedback
- **`create_batch`** — create a batch issue from source issue IDs
- **`pipeline`** — run implement→verify→review in an isolated jj workspace; supports pause/resume with guidance
- **`subagent`** — one-shot ad-hoc subagent task in isolated workspace; squash on success

## enforcement

- **Write policy:** `write`/`edit` are intercepted via tool hooks; phase restrictions enforced by `canWrite()`.
- **TDD guard:** in primary sessions (`implement`/`code-review`), production writes are blocked until test is written and a failing run is acknowledged via `tests_failed`.
- **Artifact policy:** artifacts are saved directly with `write`/`edit` under `.megapowers/plans/<issue>/` (no save-artifact tool).
- **Phase gates:** transitions require required artifacts + gate conditions (including plan-loop approval completion).
- **Satellite mode:** subagent sessions (`PI_SUBAGENT=1` or `PI_SUBAGENT_DEPTH>0`) skip write-blocking hooks; TDD is enforced by prompt + post-hoc audit.

## key concepts

- **Issue:** markdown + frontmatter in `.megapowers/issues/`.
- **Batch issue:** issue with `sources` linking source issue IDs; completing batch auto-closes sources.
- **Mega off/on:** `/mega off` disables enforcement, `/mega on` re-enables; defaults to enabled on new session.
- **Bugfix aliasing:** `reproduce_content` → `brainstorm_content`, `diagnosis_content` → `spec_content` for shared prompt templates.
