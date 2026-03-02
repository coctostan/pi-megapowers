---
type: plan-review
iteration: 3
verdict: revise
reviewed_tasks:
  - 11
  - 12
  - 13
  - 14
  - 1
  - 2
  - 3
  - 4
  - 5
  - 6
  - 7
  - 8
  - 9
  - 10
approved_tasks:
  - 11
  - 12
  - 13
  - 14
needs_revision_tasks:
  - 1
  - 2
  - 3
  - 4
  - 5
  - 6
  - 7
  - 8
  - 9
  - 10
---

### Per-Task Assessment

### Task 1: Remove task-level jj change helpers and task_done jj integration — ❌ REVISE
- **Granularity:** Step 3 replaces `extensions/megapowers/task-coordinator.ts` with a totally new file (adds `TaskInspection`, diff parsing helpers, report formatting). That’s more than “remove two exports” and risks drifting from current behavior/coverage.
  - Split into: (a) delete `createTaskChange`/`inspectTaskChange` exports + update their callers; (b) only if needed, separately refactor task report formatting.
- **Self-containment risk:** The plan says “complete file” but doesn’t prove it matches existing public API used elsewhere.
- **Step 2 failure message:** OK.

### Task 2: Remove jj automation from phase-advance — ❌ REVISE
- **Test quality:** The new test is a **string search** for implementation details (`"type JJ"`, `"squashInto("`). This is brittle and doesn’t assert functional behavior (AC8 is behavioral: no `jj describe/new/squash` during transitions).
  - Better: unit-test `advancePhase()` side effects using mocked deps/state fixtures (existing test patterns) and assert no calls to a VCS executor occur (after you remove the executor entirely).
- **Step 3 “complete file” rewrite** is risky without confirming all previous exports/behavior (gate checks, workflow targeting) match current semantics.

### Task 3: Remove unused jj parameter from prompt injection path — ❌ REVISE
- **Step 3 code snippet is not self-contained / likely incorrect:** the provided `onBeforeAgentStart` body references `prompt` but never defines it (it previously came from `buildInjectedPrompt(...)`). This would not compile.
- **Test quality:** string-based signature check is brittle; prefer importing the function and checking `.length` or (better) TypeScript compile-time expectations in a test, or at least snapshot exported function signature via `tsd`-style assertion (if available).

### Task 4: Remove jj from UI issue/triage flows and command deps — ❌ REVISE
- **Ordering:** You remove `jjChangeId` UI rendering (AC6) before state fields are removed (Task 11). That’s fine, but ensure any code that still sets `state.jjChangeId`/`taskJJChanges` is removed first; otherwise dead state fields linger until Task 11.
- **Test guidance missing specifics:** “remove createMockJJ usage from all calls” is vague; list exact call sites/describe blocks.

### Task 5: Remove session-start jj checks and notifications — ⚠️ PASS (minor tweak)
- Mostly fine and aligns with AC4.
- Minor: Step 3 snippet indentation has `const { store, ui } = deps;` missing indentation; not a functional issue but keep the snippet clean.

### Task 6: Drop jj parameter threading from signal handling and tool wiring — ⚠️ PASS (with dependency fix)
- Covers AC7 well.
- **But:** Step 3 says “Also in `extensions/megapowers/commands.ts`…” even though Task 4 already changes commands deps. Ensure tasks don’t overlap: either move all `commands.ts` `handleSignal` call updates here (and remove from Task 4) or vice-versa.

### Task 7: Switch register-tools subagent/pipeline executors from jj to git — ❌ REVISE
- **AC13 mismatch / executor contract confusion:** The note proposes keeping `{code, stdout, stderr}` in concrete executor while exporting a narrower `ExecGit` type. But your Step 3 code returns only `{ stdout, stderr }`.
- **Critical gap:** With no exit code and no throw-on-failure guarantee, downstream code cannot reliably satisfy **AC16/AC17** (“return `{ error }` when any git command fails”). Stderr is not a reliable failure indicator.
  - Fix plan: define `ExecGit` to either (a) include `code` (but AC13 forbids), or (b) **throw on non-zero exit** and let callers catch and return `{ error }`. Then tests should simulate failures by throwing.

### Task 8: Rewrite pipeline-workspace.ts to git worktree with patch-file squash — ❌ REVISE
- **AC16/AC17 error handling not implemented:** The proposed implementation checks `stderr.includes("fatal")`/`includes("error")` and never `try/catch` around `execGit` calls. If `execGit` throws (recommended), this code must catch and convert to `{ error }`.
- **AC14/AC15 command execution cwd:** `git worktree add/remove/apply` must run from the repo root. The plan omits `{ cwd: projectRoot }` for `worktree add` and `worktree remove` (and sometimes for apply).
- **AC15 requirement:** squash must do `git add -A` and `git diff --cached HEAD` **in the worktree**, then `git apply` **in main cwd**, then `git worktree remove`.
  - The plan largely follows this, but the tests don’t assert the exact `git add -A` + `git diff --cached HEAD` ordering, nor the `cwd` separation.
- **Patch file location:** writes patch into the worktree path itself. That’s OK, but ensure it doesn’t get staged/affect diff. Better to write patch under a temp dir outside the worktree or ensure it’s not inside the git tree.

### Task 9: Migrate pipeline runner/tool/oneshot to ExecGit — ⚠️ PASS (depends on Task 7/8 fixes)
- The migration steps are coherent.
- Once you change the error contract (throw vs stderr), update tests accordingly.

### Task 10: Update remaining workspace-related tests and comments for git worktrees — ❌ REVISE
- **Step 1 test is self-referential:** reading `../tests/pipeline-diff.test.ts` from within the same test file is fragile and unnecessary.
  - Prefer functional assertions: `getWorkspaceDiff()` returns combined output and uses staged diff calls (already covered in Task 8); for other tests, assert behavior rather than grep/contains.
- This task currently mixes: comment wording, multiple test updates, and bug repro updates. Consider splitting or making it strictly “update remaining tests to new ExecGit + git worktree command expectations”.

### Task 11: Remove jj fields from state-machine and state-io — ✅ PASS
- Good TDD structure.
- Explicitly meets AC2/AC3.

### Task 12: Delete jj modules and jj-specific tests — ✅ PASS
- Meets AC1/AC12.
- Step 3 uses `rm`/delete: OK.

### Task 13: Final code/test sweep for residual jj symbols — ✅ PASS
- [no-test] justification is valid and includes verification via grep + full test run.

### Task 14: Update AGENTS.md and prompt files to remove jj references — ✅ PASS
- [no-test] doc-only changes with verification command.

---

### Missing Coverage
- No acceptance criteria are completely uncovered, but **AC16/AC17** are not convincingly satisfied by the current executor/error-handling approach in Tasks 7–8.

### Key Required Revisions (summary)
1. **Define a reliable failure signal for `ExecGit`** (recommended: executor throws on non-zero exit; update tests to simulate throwing). Then update pipeline-workspace to catch and return `{ error }` while preserving worktree on squash failure.
2. Ensure **all git commands run with correct `cwd`**: worktree operations in repo root, staging/diff in worktree.
3. Replace brittle “source contains/doesn’t contain” tests with behavioral tests where feasible (especially Task 2, 3, 10).
4. Avoid “complete file” rewrites unless absolutely necessary; otherwise risk hidden regressions (Task 1, 2).

