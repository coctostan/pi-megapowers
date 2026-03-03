# Code Review: 083-comprehensive-vcs-integration

## Files Reviewed

- `extensions/megapowers/vcs/git-ops.ts` — New: low-level git primitives with injected ExecGit
- `extensions/megapowers/vcs/branch-manager.ts` — New: higher-level VCS orchestration (ensureBranch, switchAwayCommit, squashAndPush)
- `extensions/megapowers/vcs/pr-creator.ts` — New: gh CLI wrapper for PR creation
- `extensions/megapowers/commands.ts` — Modified: VCS branch lifecycle on issue activation/switch
- `extensions/megapowers/hooks.ts` — Modified: push-and-pr done action handler
- `extensions/megapowers/state/state-machine.ts` — Modified: branchName + baseBranch fields added to MegapowersState
- `extensions/megapowers/state/state-io.ts` — Modified: branchName + baseBranch added to KNOWN_KEYS
- `extensions/megapowers/ui.ts` — Modified: push-and-pr checklist item added to getDoneChecklistItems
- `extensions/megapowers/index.ts` — **Fixed during review**: execGit/execCmd wired into runtimeDeps
- `tests/git-ops.test.ts` — New: 15 tests for git-ops functions
- `tests/branch-manager.test.ts` — New: 10 tests for branch-manager functions
- `tests/pr-creator.test.ts` — New: 3 tests for createPR
- `tests/vcs-commands.test.ts` — New: 7 tests for VCS in handleIssueCommand (1 test added during review)
- `tests/hooks.test.ts` — Modified: 6 new push-and-pr tests

---

## Strengths

- **Clean injection pattern** (`git-ops.ts`): All git functions accept `ExecGit` as first param, enabling 100% mockable unit tests with no real git repos. Consistent and idiomatic.
- **Structured error returns** (`git-ops.ts`): Every function wraps in try/catch and returns `{ ok: false, error }` rather than throwing — errors propagate cleanly to callers.
- **Graceful degradation** (`commands.ts:65`, `hooks.ts:121`): All VCS guards check `deps.execGit` presence before attempting operations; failures surface via `notify` without blocking workflow.
- **Step identification on failure** (`branch-manager.ts:53`, `hooks.ts:145`): `squashAndPush` returns `{ step: "squash" | "push" }` on failure, enabling targeted user messages.
- **Retry semantics for push** (`hooks.ts:141-145`): Push/squash failures leave `doneActions` intact so the user can retry — correct and important for resilience.
- **Clean state schema extension** (`state-machine.ts:55-57`): `branchName` and `baseBranch` both `string | null` with defaults of `null` — safe for old state files.
- **Tests are meaningful**: Tests verify call sequences (not just return values), distinguishing e.g. `checkout -b` vs plain `checkout`, `--force-with-lease` presence, WIP message format.

---

## Findings

### Critical

**`execGit`/`execCmd` never wired into `runtimeDeps` in `index.ts`**
- **File:** `extensions/megapowers/index.ts:28` (pre-fix)
- **What:** `runtimeDeps` was initialized as `{}`, so `execGit` and `execCmd` were always `undefined`. Every VCS guard (`if (deps.execGit && ...)`) would short-circuit, making all branch creation, WIP commits, squash, push, and PR creation silently inert in production.
- **Why it matters:** The entire feature shipped as dead code. No git operations would ever run at runtime.
- **Fix applied:** `index.ts` now initializes `execGit` and `execCmd` using `pi.exec`, matching the same pattern used by the pipeline/subagent tools in `register-tools.ts`.

### Important

**`baseBranch` captured from current HEAD on issue switch — wrong value**
- **File:** `extensions/megapowers/commands.ts:74-79` (pre-fix)
- **What:** When switching from issue A (on `feat/001`) to issue B, the code captured `baseBranch` by calling `rev-parse --abbrev-ref HEAD`, which returns `feat/001`. This stored `feat/001` as the `baseBranch` for issue B. At done-time, `squashOnto(execGit, "feat/001", ...)` would soft-reset `feat/002` onto `feat/001` and then force-push — squashing onto the wrong branch entirely.
- **Why it matters:** Squash would target the old feature branch rather than the true base (e.g., `main`), corrupting commit history intent. PR would also target the wrong branch.
- **Fix applied:** When `prevState.branchName` is set (i.e., we're switching issues), `baseBranch` is now propagated from `prevState.baseBranch` (which holds the true original base, e.g., `main`). Only on fresh activation (no prior branch tracked) does the code capture the current HEAD. Test added to `tests/vcs-commands.test.ts` to lock this behaviour.

### Minor

**`gh pr create` omits `--base` flag**
- **File:** `extensions/megapowers/vcs/pr-creator.ts:26-35`
- **What:** `createPR` doesn't pass `--base ${baseBranch}` to `gh pr create`. The PR will target the repository's default branch, which may differ from the tracked `baseBranch` if the project has a non-default base.
- **Why it matters:** Low risk for typical repos (default branch is `main`/`master`). Could be surprising in repos with custom default branches. Not a data-loss risk.
- **Recommendation:** Pass `--base` explicitly when `baseBranch` is available. Deferred — acceptable for initial implementation.

**AC15 test doesn't assert `baseBranch` after issue switch**
- **File:** `tests/vcs-commands.test.ts:154-157` (original)
- **What:** The existing test for "calls switchAwayCommit with previous branchName" verifies `branchName` is correct but doesn't check `baseBranch`, missing the regression that was found.
- **Fix applied:** Added a separate, dedicated test that explicitly verifies `baseBranch` propagation from `prevState` on issue switch.

---

## Fixes Implemented

1. **`extensions/megapowers/index.ts`**: Initialized `runtimeDeps.execGit` and `runtimeDeps.execCmd` using `pi.exec`, identical in structure to the inline executors in `register-tools.ts`.
2. **`extensions/megapowers/commands.ts`**: On issue switch (when `prevState.branchName` is set), use `prevState.baseBranch` instead of capturing from the current HEAD.
3. **`tests/vcs-commands.test.ts`**: Added regression test "propagates prevState.baseBranch (not current HEAD) as baseBranch on issue switch".

All 711 tests pass after fixes.

---

## Recommendations

- Consider passing `--base ${baseBranch}` to `gh pr create` in a follow-up — low effort, increases correctness for non-standard repos.
- The `wipCommit` function runs `git add -A` before checking status. This is safe but wastes an index write on clean trees. Reversing order (status check → conditional add+commit) would be slightly more efficient, though unlikely to matter in practice.

---

## Assessment

**ready**

Two bugs found and fixed during review:
1. **Critical** — `execGit`/`execCmd` not wired in `index.ts` (feature was dead in production)
2. **Important** — `baseBranch` set to old feature branch on issue switch (wrong squash target)

Both fixes are minimal, targeted, and verified by tests. Architecture of the VCS modules is sound: clean injection, structured error returns, graceful degradation throughout. All 711 tests pass.
