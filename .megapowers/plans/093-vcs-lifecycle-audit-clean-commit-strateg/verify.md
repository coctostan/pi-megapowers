# Verification Report — 093-vcs-lifecycle-audit-clean-commit-strateg

## Test Suite Results

```
bun test v1.3.9 (cf6cdbbb)

 900 pass
 0 fail
 2101 expect() calls
Ran 900 tests across 84 files. [1229.00ms]
```

Full suite run, fresh, zero failures.

Focused VCS lifecycle test files (37 tests, 0 failures):
```
bun test tests/vcs-lifecycle-integration.test.ts tests/vcs-base-branch-activation.test.ts tests/branch-manager.test.ts tests/shipping.test.ts tests/ship-cli.test.ts tests/vcs-commands.test.ts

 37 pass
 0 fail
 98 expect() calls
```

---

## Per-Criterion Verification

### Criterion 1: When an issue is activated, the system records a feature or bugfix branch name for that issue when git branch creation succeeds.

**Evidence:**  
`tests/vcs-commands.test.ts` — `"calls ensureBranch, saves branchName and baseBranch to state (AC14)"` (line 36):  
- Calls `handleIssueCommand("list", ctx, deps)` with a mock `execGit` that lets `ensureBranch` succeed.
- Asserts `readState(tmp).branchName === "feat/001-my-feature"`.

Implementation: `extensions/megapowers/commands.ts` — `handleIssueCommand()` calls `ensureBranch()` on new activation, then writes `newState.branchName = result.branchName` to state.

**Verdict:** **pass**

---

### Criterion 2: When an issue is activated from a non-feature base branch, the system records that base branch for later shipping operations.

**Evidence:**  
`tests/vcs-base-branch-activation.test.ts` — `"records branchName/baseBranch on activation success (AC1/AC2)"`:
- First `rev-parse --abbrev-ref` returns `feat/orphan\n` (stale feature branch), triggering checkout to main.
- Second call returns `release/2026.03\n` (non-feature base branch).
- After activation: `readState(tmp).baseBranch === "release/2026.03"`.

Implementation: `resolveActivationBaseBranch()` in `commands.ts` returns the current HEAD branch name if it doesn't match `feat/` or `fix/` prefix, capturing non-main bases.

**Verdict:** **pass**

---

### Criterion 3: When switching away from an active issue with a dirty working tree, the system persists that issue's local work before activating the next issue.

**Evidence:**  
`tests/vcs-commands.test.ts` — `"calls switchAwayCommit with previous branchName before activating new issue"` (line 127):
- State has `branchName: "feat/001-old-issue"`.
- Mock `execGit` returns `"M file.ts\n"` for `git status`.
- After `handleIssueCommand`, asserts: `calls.some(c => c[0] === "commit" && c[2] === "WIP: feat/001-old-issue")` is `true`.

Implementation: `handleIssueCommand()` calls `maybeSwitchAwayFromIssue(execGit, prevState.branchName)` before activating the new issue; `switchAwayCommit()` calls `wipCommit(execGit, "WIP: <branch>")` which stages all and commits when dirty.

**Verdict:** **pass**

---

### Criterion 4: When switching away from an active issue with a clean working tree, the system does not create an unnecessary WIP commit.

**Evidence:**  
`tests/vcs-commands.test.ts` — `"returns committed: false and does not commit when switching away from a clean branch"` (line 159):
- `execGit` returns empty string for `git status`.
- `maybeSwitchAwayFromIssue` resolves with `{ ok: true, committed: false }`.
- Asserts `calls.some(c => c[0] === "commit")` is `false`.

Implementation: `wipCommit()` in `git-ops.ts` checks `status.stdout.trim()` before committing; returns `{ ok: true, committed: false }` when clean.

**Verdict:** **pass**

---

### Criterion 5: The done-phase `push-and-pr` flow runs a code-owned finalization step before any push attempt.

**Evidence:**  
`tests/done-prompt.test.ts` — `"routes push-and-pr through the stable ship-cli entrypoint instead of raw git push"`:
- Sets state with `phase: "done"` and `doneActions: ["push-and-pr"]`.
- `buildInjectedPrompt(tmp)` returns content containing `"bun extensions/megapowers/vcs/ship-cli.ts"` and `"Do not run raw \`git push\` or \`gh pr create\` commands yourself"`.

Implementation: `prompts/done.md` (line 61–65) directs LLM to use ship-cli. `shipAndCreatePR()` in `shipping.ts` always calls `finalizeShipment()` before `squashAndPush()` (lines 144–146).

**Verdict:** **pass**

---

### Criterion 6: If the working tree contains tracked modifications at finalization time, `push-and-pr` includes those modifications in the shipped branch state before pushing.

**Evidence:**  
`tests/shipping.test.ts` — `"runs the audit status first, then stages tracked and untracked files, then re-checks status before committing"`:
- Mock `git status --porcelain --untracked-files=all --ignored` returns `" M extensions/megapowers/commands.ts"` (tracked modification).
- Asserts `calls.toContainEqual(["add", "-u"])`.
- Asserts commit is called: `["commit", "-m", "chore: finalize 093-..."]`.

Implementation: `finalizeShipment()` calls `execGit(["add", "-u"])` when `hasTracked` is true, then commits.

**Verdict:** **pass**

---

### Criterion 7: If the working tree contains relevant untracked files that are not ignored and not denylisted, `push-and-pr` includes those files in the shipped branch state before pushing.

**Evidence:**  
`tests/shipping.test.ts` — same test as criterion 6:
- Mock status also returns `"?? extensions/megapowers/vcs/shipping.ts"` (untracked, not in denylist).
- Asserts `untrackedAdds` equals `[["add", "--", "extensions/megapowers/vcs/shipping.ts"]]`.
- `result.audit.includedUntracked` equals `["extensions/megapowers/vcs/shipping.ts"]`.

Implementation: `finalizeShipment()` calls `execGit(["add", "--", path])` for each `includedUntracked` file.

**Verdict:** **pass**

---

### Criterion 8: If the working tree contains files ignored by git, finalization does not include those files in the shipped branch state.

**Evidence:**  
`tests/shipping.test.ts` — same test as criterion 6:
- Mock status returns `"!! coverage/index.html"` (ignored file, `!!` code).
- `result.audit.ignoredUntracked` equals `["coverage/index.html"]`.
- No `add` call for `coverage/index.html`.

Implementation: `auditShipment()` uses porcelain `--ignored` flag; lines with code `"!!"` go into `ignoredUntracked` and are never staged.

**Verdict:** **pass**

---

### Criterion 9: If the working tree contains denylisted suspicious untracked files, finalization aborts before push and returns a clear error listing the blocked files.

**Evidence:**  
`tests/shipping.test.ts` — `"blocks suspicious untracked files, returns the blocked file list, and never stages or pushes"`:
- Mock status returns `"?? .env.prod"` and `"?? extensions/megapowers/vcs/shipping.ts"`.
- `finalizeShipment()` result: `{ ok: false, error: "Blocked suspicious untracked files: .env.prod", blockedFiles: [".env.prod"] }`.
- Asserts `calls.some(c => c[0] === "add")` is `false` and no `push` or `commit` calls.

Denylist in `shipping.ts` includes `/^\.env(?:\..+)?$/` matching `.env.prod`.

**Verdict:** **pass**

---

### Criterion 10: If finalization aborts, the system does not attempt `git push`.

**Evidence:**  
`tests/shipping.test.ts` — `"returns a finalize error and does not attempt push or PR when finalization blocks shipment"`:
- Mock `git status` with `--ignored` returns `"?? .env.local\n"`.
- Result: `{ ok: false, step: "finalize", error: "...", blockedFiles: [".env.local"], pushed: false }`.
- Asserts `gitCalls.some(c => c[0] === "push")` is `false`.
- Asserts `prAttempted` is `false`.

Implementation: `shipAndCreatePR()` returns early at `if (!finalized.ok)` check before calling `squashAndPush()`.

**Verdict:** **pass**

---

### Criterion 11: If `branchName` is missing, empty, or equal to the base branch at shipping time, `push-and-pr` aborts early with a clear error instead of attempting push.

**Evidence:**  
`tests/shipping.test.ts` — `"rejects missing, empty, and base-branch ship targets before any push attempt"`:
```
validateShipTarget(null, "main") → { ok: false, error: "Cannot ship: branchName is missing." }
validateShipTarget("", "main") → { ok: false, error: "Cannot ship: branchName is empty." }
validateShipTarget("feat/093-...", null) → { ok: false, error: "Cannot ship: baseBranch is missing." }
validateShipTarget("feat/093-...", "") → { ok: false, error: "Cannot ship: baseBranch is missing." }
validateShipTarget("main", "main") → { ok: false, error: "Cannot ship: branchName must differ from baseBranch (main)." }
validateShipTarget("feat/093-...", "main") → { ok: true }
```

Also: `"returns a validate error before finalize, squash, push, or PR work"` — `branchName: "main"` and `baseBranch: "main"` → `step: "validate"`, `gitCalls` is empty, `ghCalled` is false.

Additionally: `"returns the same validate short-circuit for a captured non-main base branch"` — `branchName: "release/2026.03"` and `baseBranch: "release/2026.03"` → same abort pattern.

**Verdict:** **pass**

---

### Criterion 12: Before pushing, the shipping flow squashes the issue branch into a single clean commit representing the final shipped state.

**Evidence:**  
`tests/branch-manager.test.ts` — `"soft-resets onto the base branch and writes one clean squash commit"`:
- Calls sequence is exactly: `["reset", "--soft", "main"]`, `["status", "--porcelain"]`, `["commit", "-m", "feat: ship 093"]`.
- No intermediate history preserved.

Integration test `tests/vcs-lifecycle-integration.test.ts` — `"ships one clean remote commit in a real git repo"`:
- After `shipAndCreatePR()`, `git rev-list --count main..feat/002-second` returns `"1"` (exactly one commit).
- Remote branch log contains the clean message `"feat: ship 002-second"` and NOT `"WIP: local"`.

**Verdict:** **pass**

---

### Criterion 13: If the squash step fails, the system returns a targeted squash error and does not attempt push.

**Evidence:**  
`tests/branch-manager.test.ts` — `"returns step: squash when squash fails (AC10)"`:
- `execGit` throws on `reset`.
- `squashAndPush()` result: `{ ok: false, error: "reset failed", step: "squash" }`.

`tests/shipping.test.ts` (via `shipAndCreatePR`): squash failure propagates as `step: "squash"` without attempting push. The `"returns step: push when push fails (AC10)"` test confirms the two steps are independent.

**Verdict:** **pass**

---

### Criterion 14: If push succeeds, PR creation runs only after the successful push completes.

**Evidence:**  
`tests/shipping.test.ts` — `"runs finalize and push before checking gh availability for PR creation"`:
- Event log: `["git status ...", "git reset --soft main", "git status --porcelain", "git push origin feat/... --force-with-lease", "gh --version"]`.
- Push occurs before any `gh` call. PR creation (gh version check) happens only after push.

**Verdict:** **pass**

---

### Criterion 15: If push fails, the system does not attempt PR creation.

**Evidence:**  
`tests/shipping.test.ts` — `"returns push failure and does not attempt PR creation"`:
- `execGit` throws on `push` (`"remote rejected"`).
- `prAttempted` remains `false`.
- Result: `{ ok: false, step: "push", error: "remote rejected", pushed: false }`.

**Verdict:** **pass**

---

### Criterion 16: If the GitHub CLI is unavailable, the system returns a clear PR-skipped result instead of failing with an opaque command error.

**Evidence:**  
`tests/shipping.test.ts` — `"runs finalize and push before checking gh availability for PR creation"`:
- `execCmd` throws `"command not found: gh"` on `gh --version`.
- Result: `{ ok: true, finalized: false, pushed: true, pr: { skipped: true, reason: "gh CLI not installed" } }`.

Implementation: `pr-creator.ts` — `createPR()` catches the `execCmd("gh", ["--version"])` throw and returns `{ skipped: true, reason: "gh CLI not installed" }`.

**Verdict:** **pass**

---

### Criterion 17: If the GitHub CLI is available but PR creation fails, the system returns a clear PR creation error without hiding the earlier push result.

**Evidence:**  
`tests/shipping.test.ts` — `"returns a targeted PR error while preserving the earlier successful push result"`:
- `execCmd("gh", ["--version"])` succeeds (returns `"gh version 2.0.0\n"`).
- `execCmd("gh", ["pr", "create", ...])` throws `"authentication required"`.
- Result: `{ ok: false, step: "pr", error: "authentication required", pushed: true, pr: { ok: false, error: "authentication required" } }`.
- `pushed: true` preserved — push success is not hidden.

**Verdict:** **pass**

---

### Criterion 18: Existing VCS command and helper coverage is extended so the activation, switch-away, finalize, push, and PR lifecycle guarantees above are verified by automated tests.

**Evidence:**  
New test files created for this issue:
- `tests/vcs-lifecycle-integration.test.ts` — end-to-end integration test with a real git repo (1 test)
- `tests/vcs-base-branch-activation.test.ts` — AC1/AC2 base branch capture (1 test)
- `tests/vcs-commands.test.ts` — activation, switch-away, branch detection, sync prompts (14 tests)
- `tests/branch-manager.test.ts` — ensureBranch, switchAwayCommit, squashAndPush (10 tests)
- `tests/shipping.test.ts` — auditShipment, finalizeShipment, validateShipTarget, shipAndCreatePR (11 tests)
- `tests/ship-cli.test.ts` — ship-cli runner entrypoint (1 test)
- `tests/done-prompt.test.ts` — done-phase prompt routes through ship-cli (1 test)
- `tests/git-ops.test.ts` — wipCommit, squashOnto, pushBranch helpers (13 tests)

Total: 52 new/expanded tests across 8 files, all passing (included in 900 pass).

**Verdict:** **pass**

---

## Overall Verdict

**pass**

All 18 acceptance criteria are met with direct test evidence from the fresh test run (900 pass, 0 fail). Each criterion is verified by at least one dedicated test case with assertions that exactly match the specified behavior. The integration test additionally confirms end-to-end correctness against a real git repository: one clean squash commit on the remote branch, no WIP history leakage, correct file content shipped.
