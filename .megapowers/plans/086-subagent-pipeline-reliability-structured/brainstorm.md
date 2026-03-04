# Brainstorm: Subagent Pipeline Reliability & Structured Handoff

## Approach

This is a first-principles redesign of the pipeline system's workspace isolation, step communication, and result parsing. Rather than patching individual bugs, we're rethinking how the pipeline should work as a whole.

The pipeline's job is to run plan tasks autonomously — implement, verify, review — in isolation, then bring results back to the main working directory. The current design has fundamental issues: worktrees can't see prior task output, steps communicate via raw text blobs that grow unboundedly, review verdicts are regex-parsed from free text, and workspace operations use untyped return values.

The redesigned pipeline uses **temp-commit based worktrees** so each task sees accumulated prior work, **file-copy squash** instead of fragile `git apply`, **structured TypeScript contracts** between steps with bounded context on retries, **shell-based test verification** instead of a separate LLM dispatch, and **Zod-validated frontmatter MD** for reviewer output parsing with graceful fallback. This reduces per-cycle LLM dispatches from 3 to 2 and makes context size O(1) per cycle instead of O(n).

## Key Decisions

- **Temp-commit worktrees**: Before creating a worktree, make a temporary commit of the WD (including uncommitted changes from prior tasks), create worktree from that commit, then `git reset HEAD~1`. This solves both the squash bug (#085) and the "Task 2 can't see Task 1's files" problem.
- **File-copy squash**: Replace `git diff --cached HEAD | git apply` with `git diff --cached --name-only` → file copy/delete. Can't fail on "already exists."
- **Verify as shell command**: `bun test` doesn't need an LLM — just run it and check the exit code. Cuts per-cycle dispatches from 3 to 2.
- **Structured step contracts**: TypeScript interfaces (`ImplementResult`, `VerifyResult`, `ReviewResult`) for in-memory communication. No raw text blobs between steps.
- **Bounded retry context**: On retry, pass only the relevant failure data (test output or review findings), not the full output of all prior steps. Context is O(1) per cycle.
- **Frontmatter MD for reviewer output**: The reviewer produces frontmatter with `verdict` field + prose findings in the body. Parsed with existing `parseFrontmatter` + Zod `safeParse`. Falls back gracefully — unparseable output becomes a rejection with the parse error as retry context.
- **Discriminated union return types**: All workspace ops return `{ ok: true, ... } | { ok: false, error: string }`. Eliminates 6 `(x as any).error` casts.
- **Zod schemas**: Consistent with existing `plan-schemas.ts` pattern. Used for reviewer output validation and pause/resume persistence.
- **Infrastructure vs. semantic failure distinction**: Timeouts/crashes (`exitCode !== 0`) are never confused with test failures or review rejections. Different types, different retry context.
- **Rich UI panel deferred**: The TUI panel from #074 is separable scope with different dependencies — will be a follow-up issue.

## Components

### Workspace layer (`pipeline-workspace.ts` — rewritten)
- `createPipelineWorkspace`: temp-commit → worktree → reset. Returns discriminated union.
- `squashPipelineWorkspace`: file-copy based squash. Returns discriminated union.
- `cleanupPipelineWorkspace`: worktree + branch removal. Returns discriminated union.

### Schemas (`pipeline-schemas.ts` — new)
- Zod schemas for `ImplementResult`, `VerifyResult`, `ReviewResult`, `RetryContext`
- Review frontmatter schema with `verdict` enum + optional fields
- Pause/resume persistence schema

### Step layer (`pipeline-steps.ts` — new)
- `runImplementStep(config) → ImplementResult` — dispatch + extract files changed + TDD audit
- `runVerifyStep(cwd, testCommand) → VerifyResult` — shell exec, parse exit code
- `runReviewStep(config) → ReviewResult` — dispatch + frontmatter parse + Zod validate + fallback

### Runner layer (`pipeline-runner.ts` — simplified)
- Orchestrates implement → verify → review loop
- Passes bounded `RetryContext` on retry (not raw output)
- Max 3 cycles

### Tool layer (`pipeline-tool.ts`, `oneshot-tool.ts` — cleaned up)
- Discriminated union handling (no `as any` casts)
- Same workspace improvements benefit oneshot path

### Context builder (`pipeline-context.ts` — rewritten)
- Builds implement context from: task, plan, spec, learnings + optional RetryContext
- Builds review context from: task, spec, git diff, test results, TDD audit report
- No raw output accumulation

## Testing Strategy

- **Workspace ops**: Inject `execGit` dependency. Test temp-commit → worktree → file-copy → cleanup sequence. Test error paths (temp commit fails, copy fails, worktree already exists).
- **Step result parsing**: Pure functions. Test Zod schema validation with valid, malformed, and missing frontmatter. Test fallback behavior (unparseable → rejection with error message).
- **Verify step**: Test with mock shell executor. Verify exit code → boolean mapping, test output capture.
- **Runner loop**: Inject step functions as dependencies. Test retry logic with canned results — verify context is bounded, verify correct retry context is passed per failure type.
- **Context builder**: Pure functions. Test that implement context includes RetryContext on cycle > 1 but not raw output. Test that review context includes git diff and test results.
- **Tool layer integration**: Mock dispatcher. Test discriminated union handling, error propagation, oneshot path.
