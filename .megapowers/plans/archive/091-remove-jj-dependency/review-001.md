---
type: plan-review
iteration: 1
verdict: revise
reviewed_tasks:
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
  - 11
  - 12
  - 13
  - 14
approved_tasks: []
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
  - 11
  - 12
  - 13
  - 14
---

### Per-Task Assessment

### Task 1: Remove jj fields from MegapowersState type and createInitialState — ❌ REVISE
- **TDD completeness:** Step 1 test snippet is not self-contained (missing required imports/context).
- **Step 3:** Only describes edits; does **not** include full implementation code as required.
- **Step 5:** Explicitly expects the full suite to fail (“Some tests will fail…”) which violates the workflow requirement that each task ends with `bun test` **all passing**.
- **Ordering:** Removing fields first will break many modules/tests that reference them; plan should either (a) update all usages in the same task, or (b) reorder so usages are removed before deleting the fields.

### Task 2: Remove jj fields from state-io KNOWN_KEYS — ❌ REVISE
- **Step 1 test code** is not self-contained (relies on `tmp`, `join`, `mkdirSync`, etc. without showing the full test block/imports).
- **Step 3** is descriptive, not full code.
- **Step 5:** Will not leave the repo green unless the rest of the codebase is already tolerant of missing jj fields.

### Task 3: Remove jj from task-coordinator — ❌ REVISE
- **Incorrect test strategy:** Current `tests/task-coordinator.test.ts` imports `createTaskChange` / `inspectTaskChange` and `JJ` and contains behavioral tests for them. The task plan only adds a new “no export” test; it does not remove/update the existing imports/tests, so the suite will fail.
- **Bun/ESM mismatch:** Uses `require(...)`; this repo’s tests are ESM-style (`import ...`). Use `await import(...)` or update static imports instead.
- **Step 3** lacks full implementation code.

### Task 4: Remove jj from phase-advance — ❌ REVISE
- **Step 2 is ambiguous/vague:** “Compilation error… or test will pass…” is not acceptable; Step 2 must specify a deterministic expected failure.
- **Step 3** lacks full implementation code.
- **Suite health:** If jj signatures change here, all call sites must be updated in the *same task* or earlier tasks so `bun test` is green.

### Task 5: Remove jj from tool-signal — ❌ REVISE
- **Breaks callers:** Changing `handleSignal` signature requires updating all call sites (commands/register-tools/etc.). The plan spreads that across tasks, which will break compilation between tasks.
- **Step 3** lacks full implementation code.
- **Step 5** again implies interim failures.

### Task 6: Remove jj from prompt-inject — ❌ REVISE
- Step 1 test snippet is not self-contained.
- Step 2 is speculative (“may pass”).
- Removing a parameter requires updating callers in the same task or earlier, otherwise compilation breaks between tasks.

### Task 7: Remove jj from ui.ts — ❌ REVISE
- The plan’s test snippet references `mockTheme`, but the repo’s existing ui tests use `plainTheme` and a different setup. This is not self-contained.
- It also relies on `function.length` as a signature check, which is brittle and not a strong behavioral contract.
- Requires updating existing ui tests that currently mock `jj` (`createMockJJ`) and pass `jj` into UI methods.
- Step 3 lacks full implementation code.

### Task 8: Remove jj from commands.ts and hooks.ts — ❌ REVISE
- **Granularity:** This task changes two production modules plus tests; it’s likely more than one “single test + minimal implementation”. Consider splitting by module or by AC.
- **Test quality:** Checking `"jj" in deps` is a weak proxy for “no jj logic”; better to assert on behavior (e.g., onSessionStart does not call `pi.exec("jj", ...)` and does not notify install/init messages).
- Step 3 lacks full implementation code.

### Task 9: Remove jj from register-tools.ts — ❌ REVISE
- **The proposed test is invalid for this repo:** `registerTools` currently does not require `pi.exec` for `megapowers_signal`, so throwing in `exec` doesn’t prove anything meaningful.
- Needs explicit assertions that `subagent`/`pipeline` tools invoke `pi.exec("git", ...)` (and never "jj").
- Step 3 lacks full implementation code.

### Task 10: Rewrite pipeline-workspace.ts with git worktree — ❌ REVISE
- **Critical functional gap:** `git apply` needs the patch content. The proposed implementation calls `execGit(["apply", ...])` but never provides the diff output (stdin or file). With the current `ExecGit` shape (`(args, opts) => { stdout, stderr }`), there is no stdin channel.
  - Fix options: extend `ExecGit` to accept `stdin` (and update callers/tests), or write the patch to a temp file and call `git apply <patchfile>`.
- **API stability:** The brainstorm notes say the public API stays the same. The plan removes `pipelineWorkspaceName` and changes return shape (drops `workspaceName`). That may be OK internally, but it violates the stated design intent and can break imports.
- **`--allow-empty` correctness:** Ensure the chosen flags are valid for `git apply` and match real behavior.
- This task *does* include full code blocks, but the above gaps mean it won’t work as-is.

### Task 11: Update pipeline-runner, pipeline-tool, oneshot-tool to use ExecGit — ❌ REVISE
- Depends on Task 10’s `ExecGit` design. Once Task 10 is corrected (stdin/patchfile), this task must reflect the final `ExecGit` signature.
- Step 1/3 are mostly descriptive; needs full code for each file edit.

### Task 12: Delete jj.ts and jj-messages.ts, update satellite.ts comments — ❌ REVISE
- **Test snippet likely broken:** Uses `__dirname`, which is not available in ESM tests by default. Existing `tests/satellite.test.ts` reads files by relative path from project root; follow that convention (e.g., `existsSync("extensions/megapowers/jj.ts")`).
- Also: deleting `tests/jj.test.ts` is fine, but the plan must ensure all other tests no longer import jj types.

### Task 13: Fix remaining test files that reference jj types or fields — ❌ REVISE
- Marked `[no-test]`, but it is effectively a large refactor sweep. The verification step is OK, but the task is too open-ended for “developer with zero context”.
- Suggest splitting into smaller concrete tasks (e.g., “update pipeline wiring tests”, “update index integration tests”, etc.) or at least enumerating exact edits per file.

### Task 14: Update AGENTS.md and prompt files to remove jj references — ❌ REVISE
- The verification command uses `grep` which is fine, but this task should list the exact prompt file paths that exist in this repo (or include a discovery step).
- Also, the overall protocol text still says “Version control managed automatically via jj”; update those docs as part of the change, but keep this task small and precise.

---

### Missing Coverage
No acceptance-criteria gaps found: AC 1–21 are referenced by at least one task.

---

### Verdict: **revise**

The approach is sound, but the plan is not currently executable under the workflow rules:
1) Many tasks do not include **full test code** and **full implementation code**.
2) Multiple tasks explicitly expect the suite to be **red after completion**, which violates the requirement that each task is independently verifiable with `bun test` passing.
3) The git worktree squash design (Task 10) is missing a way to feed the patch into `git apply`.
4) Several test snippets are incompatible with this repo’s existing test style (ESM/no `require`, no `__dirname`).

Recommended revision direction:
- Reorder tasks to remove jj usages/callers first, then delete jj fields/files last, so the suite stays green.
- Make each task end-to-end green, with complete code blocks.
- Fix Task 10 by introducing a patchfile or stdin-enabled executor, and keep the public API stable unless explicitly changing it.

