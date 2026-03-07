# Revise Notes

This issue's plan draft is not yet lint-clean. The task files under `.megapowers/plans/093-vcs-lifecycle-audit-clean-commit-strateg/tasks/` are the source of truth. `plan.md` is regenerated from those task files.

## Current state

- Active issue: `093-vcs-lifecycle-audit-clean-commit-strateg`
- Current artifact: `.megapowers/plans/093-vcs-lifecycle-audit-clean-commit-strateg/plan.md`
- Source task files: `.megapowers/plans/093-vcs-lifecycle-audit-clean-commit-strateg/tasks/task-*.md`
- Last successful action: task files updated and `plan.md` regenerated
- Last blocked action: `megapowers_signal({ action: "plan_draft_done" })`

## Last known lint blockers to fix next

1. **AC18 still needs stronger explicit coverage wording**
   - The reviewer wants more than a vague statement that tests exist.
   - Make it explicit in the tasks that existing VCS coverage is extended in:
     - `tests/vcs-commands.test.ts`
     - `tests/branch-manager.test.ts`
     - `tests/git-ops.test.ts`
     - `tests/pr-creator.test.ts`
     - prompt/done tests
   - The lifecycle-focused suites should be described as actually verifying activation, switch-away, finalize, push, and PR guarantees.

2. **Task 2 / Task 11 switch-away persistence story needs to be unambiguous**
   - Keep Task 2 focused on the clean-tree case only.
   - Keep Task 11 focused on the dirty-tree case only.
   - Make clear that `maybeSwitchAwayFromIssue()` delegates dirty/clean logic to existing `switchAwayCommit()` from `branch-manager.ts`.
   - Keep the dirty-tree test explicitly asserting persistence happens before new issue activation.

3. **Task 5 should explicitly cover null/empty `baseBranch`**
   - The helper already validates `branchName` null/empty/equal-to-base.
   - Add explicit coverage for missing/empty `baseBranch` too.

4. **Task 8 must explicitly say all affected `createPR` tests/call sites are updated**
   - Not just the first test.
   - Ensure all remaining tests in `tests/pr-creator.test.ts` pass the new `baseBranch` first argument.
   - Keep mock return shapes explicit with both `stdout` and `stderr`.

5. **Task 9 must clearly describe relationship to Task 7**
   - `shipAndCreatePR()` uses public `squashAndPush()`.
   - Task 7 refactors `squashAndPush()` internally to call `squashBranchToSingleCommit()`.
   - Preserve that explanation so there is no hidden dependency confusion.

6. **Task 10 / Task 18 must stay fully consistent**
   - Task 10 creates the stable CLI entrypoint and updates `prompts/done.md` to call it.
   - Task 18 only extends that file by exporting/testing `buildShipRequest()`.
   - Keep `ship-cli.ts` ownership split that way.

7. **Task 10 prompt instructions must stay concrete**
   - Replace only the existing `### push-and-pr` block through the cleanup reminder, ending before `### close-issue`.
   - Preserve the rest of `prompts/done.md` unchanged.
   - The prompt should invoke `bun extensions/megapowers/vcs/ship-cli.ts` and explain how to interpret JSON output.

8. **Task 15 integration test should explicitly assert the switch-away persistence effect**
   - If needed, add an assertion that the lifecycle produced the expected WIP commit before final shipping.
   - Keep the real git remote setup (`git init --bare`, `git remote add origin`, `git push -u origin main`) so push is meaningful.

9. **Task 16 should only record the current base branch string**
   - No automatic checkout to main.
   - No remote sync checks.
   - No pull prompt logic.
   - The helper should just read `git rev-parse --abbrev-ref HEAD` and persist that value for later shipping.

10. **Task 14 should remain independent of Task 16’s extra behavior**
   - It only exists to ensure `branchName` is not persisted on activation branch-creation failure.
   - It should not rely on more complex base-branch resolution behavior.

## Suggested next-session workflow

1. Read all task files in `.megapowers/plans/093-vcs-lifecycle-audit-clean-commit-strateg/tasks/`
2. Read `.megapowers/plans/093-vcs-lifecycle-audit-clean-commit-strateg/plan.md`
3. Fix only the tasks implicated by the blocker list above
4. Regenerate `plan.md` from the task files
5. Retry: `megapowers_signal({ action: "plan_draft_done" })`
6. If lint still fails, preserve the new blocker list back into this file before context runs out

## Important constraint

Do **not** call `phase_next` from the plan phase to work around lint/review failure. The correct gate is getting `plan_draft_done` to succeed.

## 2026-03-06 follow-up lint blockers

After updating Tasks 2, 3, 4, 5, 6, 8, 9, 10, 11, 12, 13, 15, 16, 17, and 18 and regenerating `plan.md`, `megapowers_signal({ action: "plan_draft_done" })` still fails. Latest blockers:

1. **Task 17 / AC18 still needs a stronger automated-coverage story**
   - The audit test still mainly proves suites pass.
   - Reviewer wants AC18 to read as real automated verification of activation, switch-away, finalize, push, and PR guarantees — not just a suite runner.
   - Consider making Task 17 inspect/assert dedicated lifecycle test names or otherwise prove each lifecycle phase has explicit assertions.

2. **Task 1 wording is still too vague about branchName persistence scope**
   - Step 3 says the successful activation block is the only place that persists `branchName` from `ensureBranch()`.
   - Reviewer wants that scoped more concretely inside `handleIssueCommand()` so there is no ambiguity about other references.

3. **Task 6 should explain the intentional double-status flow more explicitly**
   - First status call comes from `auditShipment()`.
   - Second plain `git status --porcelain` is intentionally after staging, to verify staged state before commit.
   - Make that two-status design explicit so it does not read like accidental duplication.

4. **Task 9 should explicitly call out squash-vs-push error propagation**
   - The implementation already returns `step: pushed.step`, but reviewer still wants the task text to say the orchestrator preserves the underlying `"squash" | "push"` step from `squashAndPush()`.

5. **Task 15 real-git setup still needs hardening**
   - Add explicit local `git config user.name` / `git config user.email` setup in `beforeEach`, because later commit calls during the test use plain `git commit`.
   - Reviewer also flagged the bare-remote assertions as potentially pipe-sensitive; if touched again, keep command output bounded and explicit.

6. **Task 16 needs a crisp decision on `baseBranch` persistence when activation fails**
   - One lint pass wanted `baseBranch` preserved on failure; the latest pass says persisting it on failure risks stale metadata.
   - Reconcile this with Task 14 and make the failure-path behavior explicit and consistent across both tasks.

7. **Task 18 still needs the Task 10 split explained even more plainly**
   - Reviewer still sees overlap between “create ship-cli entrypoint” and “export buildShipRequest”.
   - Make explicit that Task 10 creates a non-exported helper used only internally by the CLI entrypoint, and Task 18’s only behavior change is exporting that existing helper for direct unit coverage.


## 2026-03-06 second follow-up lint blockers

After another targeted revision pass (Tasks 1, 3, 4, 5, 7, 8, 10, 11, 12, 14, 15, 16, 17, 18) and regenerating `plan.md`, `plan_draft_done` still fails. New remaining blockers:

1. **AC18 still wants extensions inside existing VCS suites, not just an audit wrapper**
   - Reviewer specifically wants the plan to read as extending:
     - `tests/vcs-commands.test.ts`
     - `tests/branch-manager.test.ts`
     - `tests/git-ops.test.ts`
     - `tests/pr-creator.test.ts`
   - `tests/vcs-coverage-audit.test.ts` is still seen as supplementary, not sufficient on its own.
   - Likely fix: move more of the AC18 wording from Task 17 into the concrete earlier tasks, and possibly repurpose Task 17 away from suite-running.

2. **Task 2 wording still needs to emphasize clean-tree-only scope**
   - Lint still sees possible ambiguity around whether the test is only the clean-tree path.
   - Make the assertions and prose even more explicit that it checks:
     - `add -A`
     - `status --porcelain`
     - no `commit`
     - no dirty-tree ordering claims

3. **Task 3 denylist wording still needs a firmer contract**
   - Reviewer wants it clearer whether the listed regexes are the complete denylist for this issue.
   - Best follow-up: say explicitly that the issue-scoped denylist is exactly the hardcoded regex array in this task, with no extension mechanism in scope.

4. **Task 10 / Task 18 split is still not fully accepted**
   - Reviewer now complains that `runShipCli` arrives only in Task 18, making Task 10 feel incomplete.
   - Likely options:
     - move `runShipCli` extraction into Task 10 and repurpose/remove Task 18, or
     - ensure Task 10’s tests do not imply direct programmatic access before Task 18.

5. **Task 11 description still has wording confusion**
   - Need to cleanly state: Task 2 = clean tree, Task 11 = dirty tree ordering.
   - Remove any circular wording.

6. **Task 15 should better explain what its two-commit expectation means**
   - Reviewer wants the plan to state whether the expected two commits are:
     - base `init`
     - final shipped squash commit
   - and to avoid implying extra intermediate commits remain after shipping.

7. **Task 16 helper visibility still needs a crisp statement**
   - Clarify whether `resolveActivationBaseBranch()` is intentionally a public helper for isolated testing, even though `handleIssueCommand()` is the production caller.

8. **Task 17 should stop being vague about how it validates coverage**
   - Reviewer is still uneasy with `spawnSync(... bun test ...)` plus string checks.
   - If keeping Task 17, it likely needs to parse/assert named lifecycle tests more directly or be reframed as an audit-only supplement.

9. **Task 5 / AC11 wording mismatch is now being flagged**
   - Distinct branch/base validation errors seem acceptable, but the task should say these are the clear early-abort messages that satisfy AC11 rather than implying AC11 mandates one single string.

10. **Task 9 should explicitly say all `createPR` call sites are reconciled by dependency on Task 8**
    - Reviewer still worries about signature mismatch drift.
    - Add a sentence that Task 9 relies on Task 8’s new `createPR(execCmd, baseBranch, branchName, title, body)` signature and introduces the first production call site using it.