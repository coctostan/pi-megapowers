# VCS Lifecycle Audit — Clean Commit Strategy (#093)

## What Was Built

A single, testable VCS shipping pipeline that covers the full active-issue lifecycle: branch activation, switch-away persistence, done-phase finalization, squash, push, and PR creation.

Previously, `push-and-pr` was a free-form multi-step instruction to the LLM (raw `git push` → `gh pr create`). That approach could silently omit uncommitted local work, ship debug/env files, produce messy intermediate commit history on the remote, and fail opaquely if GitHub CLI was absent.

This feature replaces that with a code-owned pipeline (`shipping.ts` + `ship-cli.ts`) that the done-phase prompt delegates to entirely.

---

## Key Components

### `extensions/megapowers/vcs/shipping.ts` (new)

The core orchestrator. Four public functions:

| Function | Role |
|---|---|
| `auditShipment(execGit)` | Single `git status --porcelain --untracked-files=all --ignored` call; classifies output into tracked, includedUntracked, ignoredUntracked, blockedUntracked |
| `finalizeShipment(execGit, issueSlug)` | Blocks shipment if denylist files present; stages + commits remaining dirty work; no-ops on clean trees |
| `validateShipTarget(branchName, baseBranch)` | Rejects null/empty/equal branch targets before any git work begins |
| `shipAndCreatePR(request)` | Orchestrates the full pipeline: validate → finalize → squash → push → PR |

**Denylist** (`DENYLIST: RegExp[]`): `.DS_Store`, `Thumbs.db`, `npm-debug.log`, `yarn-error.log`, and all `.env*` variants. Matched against basename so nested paths like `apps/web/.env.local` are correctly blocked.

**`ShipResult` discriminated union**: four branches keyed by `step: "validate" | "finalize" | "squash" | "push" | "pr"` plus the success branch. Downstream consumers can identify exactly where a failure occurred without string-parsing.

### `extensions/megapowers/vcs/ship-cli.ts` (new)

Thin CLI entrypoint. `buildShipRequest(state)` derives the `ShipRequest` fields from current state; `runShipCli(state, deps)` injects executors and calls `shipAndCreatePR`. The `import.meta.main` path spawns real git/gh processes and logs JSON to stdout.

The `done.md` prompt now says:
```bash
bun extensions/megapowers/vcs/ship-cli.ts
```
and instructs the LLM to interpret the JSON result — no more raw `git push` or `gh pr create` commands.

### `extensions/megapowers/vcs/branch-manager.ts` (modified)

`squashBranchToSingleCommit(execGit, baseBranch, commitMessage)` extracted as a testable intermediate step. `squashAndPush` delegates to it. This gives the squash step its own `SquashStepResult` type and makes squash-failure paths independently testable.

### `extensions/megapowers/vcs/pr-creator.ts` (modified)

`createPR` gains an explicit `baseBranch` parameter. The `gh pr create` invocation now passes `--base` before `--head`, removing reliance on `gh` inferring the base from the current HEAD (which may not be predictable after a squash+force-push sequence).

### `extensions/megapowers/commands.ts` (modified)

Two helpers extracted and exported:

- **`maybeSwitchAwayFromIssue(execGit, previousBranchName)`** — wraps `switchAwayCommit`; skip-safe when `execGit` or branch name is absent; used at issue-switch time.
- **`resolveActivationBaseBranch(execGit)`** — detects and remedies stale `feat/*`/`fix/*` HEAD at activation time; records non-main base branches (e.g. `release/2026.03`) for later shipping.

Both were previously inline in `handleIssueCommand`; extraction makes them independently unit-testable.

---

## Lifecycle Guarantees

| Scenario | Behavior |
|---|---|
| Dirty tree at finalization | Tracked changes staged with `add -u`; safe untracked files staged with `add --` |
| Ignored files at finalization | Never staged (classified by `!!` porcelain code) |
| Denylist files at finalization | Ship aborts with `blocked files: [...]`; no push attempted |
| Invalid branch target | Ship aborts at validate step; no git operations run |
| Squash fails | Returns `step: "squash"` error; no push attempted |
| Push fails | Returns `step: "push"` error; no PR attempted |
| `gh` not installed | Returns `{ skipped: true, reason: "gh CLI not installed" }` instead of opaque crash |
| PR creation fails | Returns `step: "pr"` error while preserving `pushed: true` |
| Switch away, dirty tree | WIP commit made before activating next issue |
| Switch away, clean tree | No commit created |

---

## Test Coverage

37 new/expanded tests across 8 files:

| File | Tests | What it covers |
|---|---|---|
| `tests/shipping.test.ts` | 11 | audit, finalize, validate, full orchestration |
| `tests/vcs-lifecycle-integration.test.ts` | 1 | End-to-end real-git: one clean squash commit on remote, no WIP history, correct file content |
| `tests/vcs-base-branch-activation.test.ts` | 1 | Non-feature base branch capture at activation |
| `tests/vcs-commands.test.ts` | 14 | Activation, switch-away, stale branch detection, remote sync |
| `tests/branch-manager.test.ts` | 10 | ensureBranch, switchAwayCommit, squashAndPush, squashBranchToSingleCommit |
| `tests/ship-cli.test.ts` | 1 | CLI runner contract |
| `tests/done-prompt.test.ts` | 1 | done-phase prompt routes through ship-cli |
| `tests/git-ops.test.ts` | 13 | wipCommit, squashOnto, pushBranch helpers |

All 900 tests pass.

---

## Files Changed

- `extensions/megapowers/vcs/shipping.ts` — new
- `extensions/megapowers/vcs/ship-cli.ts` — new
- `extensions/megapowers/vcs/branch-manager.ts` — squashBranchToSingleCommit extracted
- `extensions/megapowers/vcs/pr-creator.ts` — baseBranch param added
- `extensions/megapowers/commands.ts` — maybeSwitchAwayFromIssue + resolveActivationBaseBranch extracted
- `prompts/done.md` — push-and-pr section replaced with ship-cli delegation
- 8 test files (new + extended)
