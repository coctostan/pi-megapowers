# Code Review — 086-subagent-pipeline-reliability-structured

## Files Reviewed

| File | Description |
|------|-------------|
| `extensions/megapowers/subagent/pipeline-workspace.ts` | Core workspace lifecycle: temp-commit, worktree creation, file-copy squash, cleanup; discriminated union return types |
| `extensions/megapowers/subagent/pipeline-steps.ts` | New file — `VerifyResult` interface and `runVerifyStep` shell executor |
| `extensions/megapowers/subagent/pipeline-schemas.ts` | New file — Zod `ReviewFrontmatterSchema` |
| `extensions/megapowers/subagent/pipeline-context-bounded.ts` | New file — `BoundedPipelineContext`, O(1) `withRetryContext` (replace semantics) |
| `extensions/megapowers/subagent/pipeline-results.ts` | Added `ImplementResult`, `ReviewResult`, `parseReviewOutput` (frontmatter + Zod); `parseReviewVerdict` retained but now marked deprecated |
| `extensions/megapowers/subagent/pipeline-runner.ts` | Full redesign: 2-agent cycle (implementer + shell verify + reviewer), bounded retry context, structured `PipelineResult`, infra vs semantic error separation |
| `extensions/megapowers/subagent/pipeline-tool.ts` | Updated to use discriminated union `.ok` checks, fixed stale comment |
| `extensions/megapowers/subagent/oneshot-tool.ts` | Updated to use discriminated union `.ok` checks throughout |
| `extensions/megapowers/subagent/pipeline-context.ts` | Annotated `@deprecated`; no production callers |
| `tests/pipeline-workspace.test.ts` | Extended with integration test (real git repo), rename handling, discriminated union coverage |
| `tests/pipeline-results.test.ts` | Extended with `ImplementResult`, `ReviewResult`, `parseReviewOutput` type and parse tests |
| `tests/pipeline-runner.test.ts` | New tests: 2-agent assertion, bounded retry context, infra vs semantic failures |
| `tests/pipeline-tool.test.ts` | Extended with AC15 (no verifier), discriminated union source scan |
| `tests/pipeline-context-bounded.test.ts` | New file — O(1) size assertion over 10 simulated retries |
| `tests/pipeline-schemas-review.test.ts` | New file — Zod schema validation tests |
| `tests/pipeline-steps.test.ts` | New file — `runVerifyStep` pass/fail coverage |

---

## Strengths

**Workspace isolation fix** (`pipeline-workspace.ts:44–86`): The temp-commit-before-worktree pattern elegantly solves the root bug. Creating the worktree after the temp commit ensures the worktree baseline matches the main WD state at that moment. The `finally` block correctly unstages when commit fails (`stagedAll && !tempCommitted`), and the unconditional post-try `reset HEAD~1` on success covers the worktree-creation-fails path. Edge cases are all handled correctly.

**File-copy squash** (`pipeline-workspace.ts:104–151`): The AMCR/D/R triple-query approach handles the full rename case correctly — new path is copied via `--diff-filter=AMCR`, old path is deleted via the rename status query. This is more robust than the original `git apply` approach and cannot fail on "already exists."

**O(1) retry context** (`pipeline-context-bounded.ts:34–38`): `withRetryContext` does `return { ...ctx, retryContext: retry }` — replaces, not appends. Elegant and safe from context-window growth. The 10-retry O(1) size test at `tests/pipeline-context-bounded.test.ts:51` is a good regression guard.

**Frontmatter + Zod parsing** (`pipeline-results.ts:55–93`): Three distinct error cases (empty, invalid frontmatter, parse exception) each produce a stable, descriptive `ReviewResult` with `verdict: "reject"`. The explicit `matter(text)` + `ReviewFrontmatterSchema.safeParse` separation is clean and easy to extend.

**Discriminated union returns** (`pipeline-workspace.ts:21–23`, `95`, `168`): Callers in `pipeline-tool.ts` and `oneshot-tool.ts` now use `.ok` checks uniformly with no `(as any)` casts. The types are minimal — just what the discriminant requires.

**Integration test** (`pipeline-workspace.test.ts:126–162`): Uses a real git repo (`execSync`) to verify AC2 end-to-end. This tests the actual mechanism, not a mock of it, and is the highest-confidence evidence for the core bug fix.

**Infra vs semantic failure separation** (`pipeline-runner.ts:31–47`): `infrastructureError` vs `testsPassed`/`reviewVerdict`/`reviewFindings` split makes programmatic downstream handling unambiguous. Tests at `pipeline-runner.test.ts:210` and `247` confirm each field is populated exclusively in its domain.

---

## Findings

### Critical
None.

### Important
None.

### Minor

**1. Stale "verifier" comment** — `pipeline-tool.ts:128` *(fixed in this review)*
The comment read "gated by verifier + reviewer". With the verifier LLM agent removed, this was inaccurate. Fixed to "gated by shell test command + reviewer".

**2. Misleading post-loop fallthrough** — `pipeline-runner.ts:292` *(fixed in this review)*
The post-loop `return { errorSummary: "Unexpected pipeline exit" }` appeared to be dead code because every loop iteration at `cycle = maxRetries` returns before the loop exits naturally. However it *is* reachable when `maxRetries < 0` (no iterations). Added comment: `// Safety net: only reachable if maxRetries < 0 (no iterations ran)` and updated `errorSummary` to `"Pipeline exited without completing (maxRetries < 0?)"` to make the intent clear.

**3. `parseReviewVerdict` / `ReviewVerdict` not marked deprecated** — `pipeline-results.ts:29–46` *(fixed in this review)*
The old regex-based parser and its associated interface remain in the production file but are no longer used by any production code — only by `tests/pipeline-results.test.ts`. Added `@deprecated` JSDoc pointing to the replacements (`parseReviewOutput`, `ReviewResult`) so future readers don't accidentally pick up the old function.

**4. `ImplementResult` is a spec artifact, not a production type** — `pipeline-results.ts:7–11`
The interface satisfies AC16 and is tested as a type contract, but no production function returns it — `parseStepResult` returns `StepResult`, and `tddReport` is populated separately in the runner. This is a YAGNI concern but low risk: the type is correct as documented and won't cause bugs. No change made; noting for a future cleanup pass.

**5. Double `getWorkspaceDiff` call on review-rejection at max retries** — `pipeline-runner.ts:205,274`
On the review-reject-at-max-retries path, `getWorkspaceDiff` is called twice (once to build the reviewer context at line 205, once for the paused-result `diff` field at line 274). The second result is identical to the first. Not harmful — `git add -A` is idempotent — but a small I/O waste. Could cache `reviewDiff` and reuse it. Deferred; not worth the added variable lifetime.

---

## Fixes Applied

The following were changed during this review session:

1. **`pipeline-tool.ts:128`** — Updated stale comment from "verifier + reviewer" to "shell test command + reviewer".
2. **`pipeline-runner.ts:292–300`** — Added explanatory comment and updated `errorSummary` to make the edge case explicit (`maxRetries < 0`).
3. **`pipeline-results.ts:29–36`** — Added `@deprecated` JSDoc to `ReviewVerdict` interface and `parseReviewVerdict` function pointing to `ReviewResult` / `parseReviewOutput`.

Post-fix test run: **784 pass, 0 fail** (no regressions).

---

## Recommendations

- **Delete `pipeline-context.ts`** in a follow-up — the `@deprecated` annotation is in place and there are no production callers; the file can be removed once `tests/pipeline-context.test.ts` is updated or removed.
- **Consolidate `ImplementResult` into the runner** — if the type never leaves the module, consider either making it an inline object type in the runner or wiring it up as the actual return value of a dedicated `runImplementStep` function (analogous to `runVerifyStep`). Would make the step boundary symmetrical.
- **Add input validation for `maxRetries`** — a guard like `if (maxRetries < 0) throw new RangeError(...)` would eliminate the post-loop safety-net path entirely and make the function's contract explicit.

---

## Assessment

**ready**

All 28 acceptance criteria are satisfied and verified. The core fix (temp-commit + file-copy squash) correctly solves the root bug. The architectural improvements — bounded context, 2-agent cycle, discriminated unions, Zod-validated parsing — are clean and well-tested. Three minor issues were fixed inline during this review; the remaining minor findings are deferred cleanup candidates with no correctness impact.
