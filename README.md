# pi-megapowers

A [pi](https://github.com/mariozechner/pi-coding-agent) extension that enforces structured development workflows via a state machine. Megapowers gates every write operation, enforces TDD discipline, and keeps an auditable issue/plan trail — all without leaving the terminal.

## What it does

- **Workflow state machine** — Feature and bugfix workflows with enforced phase ordering
- **Write-policy enforcement** — Intercepts `write`/`edit` tool calls; blocks production changes until tests are written and proven failing
- **TDD signals** — Explicit `tests_failed` / `tests_passed` signals replace fragile bash command sniffing
- **Plan-review loop** — Iterative draft → review → revise cycle with structured task files; approval required before implementation
- **Subagent pipeline** — Per-task implement→verify→review in isolated git worktrees; pauses and resumes with parent-LLM guidance
- **VCS integration** — Auto branch-per-issue, WIP commits on switch, done-phase push/PR actions
- **Issue tracking** — Markdown issues with frontmatter, batch issues, priority, milestones

## Workflows

**Feature:** `brainstorm → spec → plan → implement → verify → code-review → done`

**Bugfix:** `reproduce → diagnose → plan → implement → verify → done`

Backward transitions allowed: `verify → implement`, `code-review → implement`.

## Installation

This is a pi package. Add it to your pi project:

```bash
# In your project root
npm install pi-megapowers
# or with bun
bun add pi-megapowers
```

Then reference it in your `package.json` pi config or pi config file.

## Commands

All commands are available via `/mp` or the legacy `/mega` prefix:

| Command | Description |
|---------|-------------|
| `/mp` | Show command hub (all subcommands) |
| `/mp new` | Draft a new issue with LLM assistance |
| `/mp status` | Current workflow phase and active issue |
| `/mp on` / `/mp off` | Enable/disable enforcement for the session |
| `/mp health` | Audit open issues, plan coverage, test status |
| `/mp ship` | Initiate done-phase wrap-up |
| `/mp back` | Trigger backward phase transition |
| `/mp council` | Multi-model consensus on current problem |
| `/issue new` | TUI-guided issue creation |
| `/phase next` / `/phase back` | Manual phase transitions |
| `/tdd status` | Show TDD guard state for current task |

## Custom Tools (LLM-facing)

| Tool | Description |
|------|-------------|
| `megapowers_signal` | State transitions: `task_done`, `phase_next`, `phase_back`, `tests_failed`, `tests_passed`, `plan_draft_done` |
| `megapowers_plan_task` | Create/update plan tasks during draft or revise mode |
| `megapowers_plan_review` | Submit plan review verdict (`approve` / `revise`) with per-task feedback |
| `create_issue` | Programmatically create a new issue |
| `create_batch` | Create a batch issue from multiple source issue IDs |
| `pipeline` | Run implement→verify→review in an isolated git worktree for a plan task |
| `subagent` | Dispatch a one-shot ad-hoc subagent task |

## Plan phase loop

The `plan` phase has an internal draft/review/revise cycle:

1. **Draft** — create tasks with `megapowers_plan_task`
2. **Submit** — `megapowers_signal({ action: "plan_draft_done" })` → enters review mode + new session
3. **Review** — `megapowers_plan_review({ verdict: "approve" | "revise", ... })`
   - `approve` → generates `plan.md`, advances to `implement`
   - `revise` → returns to draft mode (max 4 iterations)

## TDD enforcement

In the `implement` phase, production file writes are blocked until:

1. A test file is written
2. `megapowers_signal({ action: "tests_failed" })` is called to confirm the test is RED

After that, implementation proceeds normally. In satellite (subagent) sessions, TDD is enforced via prompt + post-hoc `auditTddCompliance` audit report fed to the reviewer.

## State

`state.json` (at `.megapowers/state.json`) stores coordination data only:

```json
{
  "activeIssue": "042-my-feature",
  "workflow": "feature",
  "phase": "implement",
  "planMode": null,
  "currentTaskIndex": 2,
  "completedTasks": [1, 2],
  "tddTaskState": "test-written",
  "megaEnabled": true,
  "branchName": "feature/042-my-feature",
  "baseBranch": "main"
}
```

Derived data (task lists, acceptance criteria) is always read on demand from artifact files — never cached in state.

## Directory layout

```
extensions/megapowers/
  index.ts              # Extension entry point
  hooks.ts              # session_start / agent_end lifecycle
  register-tools.ts     # Custom tool registration
  commands.ts           # /mega + /issue + /phase slash commands
  satellite.ts          # Subagent session detection + TDD enforcement
  prompt-inject.ts      # Phase-specific context injection
  write-policy.ts       # canWrite() — phase/TDD write matrix
  tool-overrides.ts     # write/edit interception
  state/                # state-io, state-machine, store, derived, plan-store
  workflows/            # feature.ts, bugfix.ts, gate-evaluator.ts, tool-instructions.ts
  tools/                # tool-signal, tool-plan-task, tool-plan-review, tool-create-issue
  subagent/             # pipeline-runner, pipeline-tool, oneshot-tool, tdd-auditor, workspace
  vcs/                  # branch-manager, git-ops, pr-creator
  mp/                   # /mp command hub + handler registry
  artifacts/            # version-artifact.ts
  policy/               # write-policy helpers
prompts/                # Phase-specific LLM prompt templates
agents/                 # Subagent definitions (worker, reviewer, scout)
tests/                  # Pure unit tests (no pi dependency)
.megapowers/
  state.json            # Runtime coordination state
  issues/               # Issue markdown files with frontmatter
  plans/<slug>/         # Plan tasks, spec, review artifacts
  subagents/<id>/       # Pipeline workspace (git worktrees)
```

## Development

```bash
bun test          # Run all tests
bun test --watch  # Watch mode
```

Tests are pure — no pi dependency, no git invocations, no actual subagents. 759 tests across 72 files.

## Architecture notes

- **Disk-first state** — every handler reads state fresh from disk via `readState(cwd)`; mutations persist atomically via temp-file-then-rename
- **Satellite mode** — detected via `PI_SUBAGENT_DEPTH` or `PI_SUBAGENT=1` env; skips write-blocking hooks, enforces TDD via audit
- **Git worktree isolation** — each pipeline creates `.megapowers/subagents/{id}/workspace` via `git worktree add --detach`; squash back on success via `git diff --cached HEAD | git apply`
- **Backward-compatible plan.md** — on plan approval, a legacy `plan.md` is generated alongside structured task files for downstream consumers

## Known issues

- **Pipeline context growth** — `renderContextPrompt` appends full step output verbatim across retries; could exceed context limits for long-running pipelines with many retries
- **Workspace op return types** — `squashPipelineWorkspace` / `cleanupPipelineWorkspace` return untyped `{}`, requiring `(x as any).error` casts in callers
