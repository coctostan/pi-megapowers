---
type: plan-review
iteration: 1
verdict: revise
reviewed_tasks:
  - 1
  - 2
  - 3
  - 4
  - 6
  - 8
  - 10
  - 11
  - 12
  - 15
  - 5
  - 7
  - 9
  - 13
  - 14
  - 16
approved_tasks:
  - 1
  - 2
  - 3
  - 4
  - 6
  - 8
  - 10
  - 11
  - 12
  - 15
needs_revision_tasks:
  - 5
  - 7
  - 9
  - 13
  - 14
  - 16
---

### Task 1: Create pipeline-schemas.ts with ReviewFrontmatterSchema — ✅ PASS
No issues.

### Task 2: Define VerifyResult type and runVerifyStep shell function — ✅ PASS
No issues.

### Task 3: Define ImplementResult type — ✅ PASS
No issues.

### Task 4: Define ReviewResult type and parseReviewOutput with frontmatter Zod validation — ✅ PASS
No issues.

### Task 5: parseReviewOutput fallback for unparseable output — ❌ REVISE
- **Step 2 expected failure is likely incorrect**: Task 4’s `parseReviewOutput()` already returns a finding containing `"Review parse error"` for missing/invalid frontmatter (gray-matter parses missing frontmatter as `{}` → Zod failure), so the new tests will probably pass immediately.
- Scope is redundant with Task 4; if kept, it must introduce a behavior that truly fails first (e.g., stable empty-output message).

### Task 6: createPipelineWorkspace returns discriminated union — ✅ PASS
No issues.

### Task 7: createPipelineWorkspace temp-commit and reset behavior — ❌ REVISE
- Implementation **swallows temp-commit failures**, which violates AC1/AC2 (worktree may still be created at old HEAD, reintroducing the squash failure scenario).
- Real git commits commonly fail without `user.name`/`user.email`; plan must set identity explicitly (e.g., `git -c user.name=... -c user.email=... commit ...`).
- Coverage gap: needs at least one regression/integration test proving **uncommitted additions are visible in the worktree** (AC2) and main WD is restored (AC1).

### Task 8: squashPipelineWorkspace returns discriminated union — ✅ PASS
No issues as an intermediate refactor, but Task 9 must replace the apply-based behavior and update tests accordingly.

### Task 9: squashPipelineWorkspace uses file-copy instead of git apply — ❌ REVISE
- Step 1 test code is missing imports (`join` used but not imported from `node:path`).
- Task must update/remove the apply-based expectations from Task 8-era tests.
- **Suite impact not handled**: existing tests in `tests/oneshot-tool.test.ts` and `tests/pipeline-workspace.test.ts` simulate failures by throwing on `git apply`. Once apply is removed, those tests must be updated in this task (or the suite will fail at Task 9 Step 5).

### Task 10: cleanupPipelineWorkspace returns discriminated union — ✅ PASS
No issues.

### Task 11: Update oneshot-tool.ts to use discriminated union checks — ✅ PASS
No issues.

### Task 12: Update pipeline-tool.ts to use discriminated union checks — ✅ PASS
No issues.

### Task 13: Rewrite pipeline-context.ts for bounded retry context — ❌ REVISE
- As written it will break the existing runner/tests before Task 14 lands (current `tests/pipeline-runner.test.ts` asserts prompt content like `"Accumulated Review Findings"`).
- Step 5 claim (“bun test all passing”) is unlikely to be true with the proposed stubbed legacy API.
- Needs a compatibility strategy (preferred: introduce bounded-context API in a new file, then switch runner in Task 14, then delete legacy in Task 15).

### Task 14: Refactor runPipeline: shell verify, frontmatter review, bounded context, structured result — ❌ REVISE
- **AC26 not satisfied**: infrastructure failures vs semantic failures are not distinguished via separate result fields (currently everything funnels into `errorSummary`).
- Retry reason typing is a bit muddled (review execution failure mapped to `implement_failed`).
- Needs adjustments to types + tests to enforce infra/semantic separation.

### Task 15: Remove deprecated context API stubs — ✅ PASS
Justification is valid.

### Task 16: Update pipeline-tool tests for new runner interface — ❌ REVISE
- Task claims “no source code changes needed” but then requires adding an `execShell` injection point to make tests deterministic.
- Mixed scope (API change + tests) needs to be made explicit and self-contained.

### Missing Coverage
- **AC2** (worktree includes files from temp commit): no test directly proving uncommitted additions are present in the worktree.
- **AC26** (infra vs semantic failure separation): not fully represented in the proposed types/results.

### Verdict
revise

I wrote prescriptive revise guidance to:
`.megapowers/plans/086-subagent-pipeline-reliability-structured/revise-instructions-1.md`
