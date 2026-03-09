---
type: plan-review
iteration: 3
verdict: revise
reviewed_tasks:
  - 1
  - 2
  - 3
  - 6
  - 7
  - 4
  - 5
approved_tasks:
  - 1
  - 2
  - 3
  - 6
  - 7
needs_revision_tasks:
  - 4
  - 5
---

### Per-Task Assessment

### Task 1: Add archived status parsing and separate active/archive issue queries — ✅ PASS
No issues.
- Coverage: AC1-AC3 are covered.
- Dependencies: none required.
- TDD: failing test, realistic failure, implementation matches `extensions/megapowers/state/store.ts`, and commands use this repo’s `bun test` runner.
- Self-containment: signatures and paths are correct.

### Task 2: Add store archive operation for successful moves and metadata — ✅ PASS
No issues.
- Coverage: AC14-AC22 are covered.
- Dependencies: correctly depends on Task 1 for archived status + archive listing support.
- TDD: realistic red/green cycle; implementation uses real store APIs and extends `formatIssueFile()` consistently.
- Self-containment: `archiveIssue(slug)` return shape is explicit and usable by later UI tasks.

### Task 3: Return clear archive errors for missing and already archived issues — ✅ PASS
No issues.
- Coverage: AC23-AC24 are covered.
- Dependencies: correctly depends on Task 2.
- TDD: failure message is specific and matches the expected pre-fix behavior.
- Self-containment: guard ordering is correct (`archivedPath` before `activePath`).

### Task 4: Add pure active-issue sorting grouping and triage filtering helpers — ❌ REVISE
- Step 3 references `aPriority` without defining it in `sortActiveIssues()`. As written, the comparator will throw at runtime.
- Step 3 is also missing the final `createdAt` fallback required for AC6 when milestone and priority are equal/absent.
- Coverage is otherwise present for AC4-AC13, but the provided implementation code will not actually pass Step 4.
- Dependencies are fine (`[depends: 1]` is sufficient).

### Task 5: Use grouped active issues in issue list and add archived view subcommand — ❌ REVISE
- Step 3’s replacement `if (subcommand === "list")` block is incomplete: it uses `choice` without the `await ctx.ui.select(...)` call.
- The same block uses `firstPhase` without defining `const firstPhase = getFirstPhase(selected.type);` before `newState`.
- In the actual codebase, `extensions/megapowers/ui.ts` already imports `getFirstPhase`, so the issue is not a missing import; it is missing lines inside the replacement block.
- The archived formatter appends ` [archived]` to a formatter that already includes status, which would duplicate the archived marker. Not fatal for coverage, but should be cleaned up while revising.
- Coverage remains sound for AC7-AC12, AC28, and AC30 once those implementation gaps are fixed.

### Task 6: Add issue archive subcommand with active-state reset behavior — ✅ PASS
No issues.
- Coverage: AC25-AC27 are covered.
- Dependencies: valid as written; Task 5 dependency is stronger than necessary but not incorrect.
- TDD: failure is realistic; implementation uses real `createInitialState()` / `writeState()` APIs and preserves durable branch flags when resetting.
- Self-containment: command behavior is fully specified.

### Task 7: Exclude archived issues from idle prompt open-issues summary — ✅ PASS
No issues.
- Coverage: AC29 is covered.
- Dependencies: correctly depends on Task 1.
- TDD: test exercises the idle prompt path through `buildInjectedPrompt()` and the expected failure is realistic.
- Self-containment: implementation matches actual `buildIdlePrompt()` structure in `extensions/megapowers/prompt-inject.ts`.

### Missing Coverage
None. All acceptance criteria AC1-AC30 are covered by at least one task.

### Verdict
revise

The plan is close, but Tasks 4 and 5 still contain concrete Step 3 code defects that would prevent the stated red/green flow from succeeding as written. I wrote prescriptive fixes to `.megapowers/plans/077-issue-priority-archiving-list/revise-instructions-3.md`.
