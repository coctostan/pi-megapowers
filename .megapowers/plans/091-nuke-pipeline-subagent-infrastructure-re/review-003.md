---
type: plan-review
iteration: 3
verdict: revise
reviewed_tasks:
  - 1
  - 2
  - 3
  - 4
  - 6
  - 7
  - 8
  - 5
approved_tasks:
  - 1
  - 2
  - 3
  - 4
  - 6
  - 7
  - 8
needs_revision_tasks:
  - 5
---

### Per-Task Assessment

### Task 1: Remove legacy pipeline and subagent tool registration — ✅ PASS
No issues. Covers AC 1 and AC 2 with executable TDD steps against the real `registerTools()` API in `extensions/megapowers/register-tools.ts`.

### Task 2: Remove legacy tool names from mega on/off activation lists — ✅ PASS
No issues. Dependencies are correct, the test and implementation target the real `handleMegaCommand()` logic in `extensions/megapowers/commands.ts`, and the run commands are realistic for this Bun test suite.

### Task 3: Remove satellite bootstrap from the extension entrypoint — ✅ PASS
No issues. Covers AC 7 with correct imports and runtime shape from `extensions/megapowers/index.ts`.

### Task 4: Remove legacy delegation wording from implement prompts — ✅ PASS
No issues. Covers AC 8 and part of AC 11 with concrete prompt/test updates using the real `buildImplementTaskVars()` and `getPhasePromptTemplate()` APIs.

### Task 5: Delete the legacy pipeline and one-shot execution stack — ❌ REVISE
- Step 1 is still not self-contained enough for this repo. It tells the implementer to delete a large mixed set of `extensions/megapowers/subagent/*.ts` files, but it does not require a boundary check proving those files are not imported by preserved focused-review code.
- This matters specifically for `dispatcher.ts`, `pi-subagents-dispatcher.ts`, `message-utils.ts`, and `tdd-auditor.ts`, which are easy to misclassify during a large deletion.
- Step 2 now covers AC 6 and AC 11 much better, but it still does not explicitly verify that the listed legacy modules are no longer referenced after deletion.
- Because this is a large `[no-test]` deletion task, it needs a more explicit repo-specific pre-deletion inspection step and a stronger post-deletion reachability/reference check.

### Task 6: Delete satellite-mode helpers and tests — ✅ PASS
No issues. Acceptable `[no-test]` deletion task with concrete files and a verification step that fits the repo.

### Task 7: Update public documentation to remove the legacy pipeline workflow — ✅ PASS
Revision addressed. Step 2 now includes `subagent` wording and uses `|| true; bun test`, which fixes the brittle command behavior and better covers AC 9.

### Task 8: Update internal agent and review prompts after legacy subagent removal — ✅ PASS
Revision addressed. Step 2 now always runs `bun test` and correctly targets the legacy delegated-execution phrases relevant to AC 8.

### Missing Coverage
None. Every acceptance criterion is covered by at least one task. AC 11 is covered by Tasks 4 and 5; Task 5 just needs clearer execution guidance before the plan is safe to implement.

### Verdict
revise

Only Task 5 needs another revision. See `revise-instructions-3.md` for the exact changes required.
