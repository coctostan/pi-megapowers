# Feature: Subagent Pipeline Reliability & Structured Handoff (#086)

## Summary

Redesigns the pipeline system's workspace isolation, inter-step communication, and result parsing to fix fundamental reliability issues that caused multi-task pipeline runs to fail unpredictably.

**Issues addressed:** #085 (pipeline squash fails on already-existing files), #074 (unstructured subagent results, partial)

---

## Problem

### Root Bug (#085): Pipeline squash fails mid-chain

In multi-task pipeline runs, each task runs in its own git worktree. The worktree was created at HEAD via `git worktree add --detach`, which does not include uncommitted files from the main working directory. When Task 1 created new files (e.g., `git-ops.ts`) and they were squashed to the main WD (uncommitted), Task 2's worktree didn't have those files. If Task 2's subagent also wrote those files, `git diff --cached HEAD` showed them as "new files", and `git apply` in the main WD failed with:

```
error: extensions/megapowers/vcs/git-ops.ts: already exists in working directory
```

### Secondary issues

- **Unbounded context growth**: The runner accumulated full step output from all prior cycles into `renderContextPrompt`. On long runs with many retries, this could exceed context limits.
- **Fragile review parsing**: `parseReviewVerdict` used regex (`/verdict\s*[:\-]?\s*approve/i`) — easily fooled, no structural guarantees.
- **Untyped workspace returns**: `createPipelineWorkspace`, `squashPipelineWorkspace`, and `cleanupPipelineWorkspace` returned `{} | { error: string }`, forcing callers to use `(x as any).error` casts throughout.
- **Three LLM dispatches per cycle**: implementer + verifier + reviewer. The verifier was a full LLM agent just to run `bun test` and parse the output — expensive and unnecessary.

---

## Solution

### 1. Temp-commit worktree isolation (`pipeline-workspace.ts`)

`createPipelineWorkspace` now:
1. Runs `git add -A` to stage all changes (including untracked files)
2. Creates a temporary commit (`--allow-empty --no-gpg-sign -m "temp-pipeline-commit"`)
3. Creates the worktree — which now inherits all uncommitted files from main WD
4. Resets the temp commit (`git reset HEAD~1`) so the main WD state is unchanged

The worktree sees the correct baseline regardless of how many prior tasks have added uncommitted files.

### 2. File-copy squash (`pipeline-workspace.ts`)

`squashPipelineWorkspace` replaces `git diff | git apply` with direct file I/O:

- `git diff --cached --name-only --diff-filter=AMCR` → `copyFileSync(src, dest)` for each file
- `git diff --cached --name-only --diff-filter=D` → `unlinkSync(dest)` for each file
- `git diff --cached --name-status --diff-filter=R` → deletes old path for renamed files

Cannot fail on "already exists" because it always overwrites.

### 3. Discriminated union return types (`pipeline-workspace.ts`)

All three workspace functions now return typed discriminated unions:

```typescript
type CreateWorkspaceResult = { ok: true; workspaceName: string; workspacePath: string } | { ok: false; error: string };
type SquashWorkspaceResult  = { ok: true } | { ok: false; error: string };
type CleanupWorkspaceResult = { ok: true } | { ok: false; error: string };
```

Callers use `if (!ws.ok) return { error: ws.error }` — no `(as any)` casts anywhere.

### 4. Shell-based verification (`pipeline-steps.ts`)

`runVerifyStep` runs `bun test` (or any configurable `testCommand`) as a direct shell command via `child_process.exec`. Exit code is the pass/fail signal. Captured stdout+stderr are returned in `VerifyResult.output`.

**Cycle cost drops from 3 LLM dispatches to 2** (implementer + reviewer). The verifier agent is eliminated.

### 5. Bounded retry context (`pipeline-context-bounded.ts`)

`BoundedPipelineContext` stores a single `retryContext` slot. `withRetryContext` replaces (not appends) on each retry. The rendered prompt for cycle N is the same size as cycle 1 — O(1) in cycle count.

Each failure type passes only the relevant data:
- Implement failure → `{ reason: "implement_failed", detail: errorMessage }`
- Verify failure → `{ reason: "verify_failed", detail: testOutput }`
- Review rejection → `{ reason: "review_rejected", detail: findings.join("\n") }`

### 6. Zod-validated frontmatter review parsing (`pipeline-results.ts`, `pipeline-schemas.ts`)

The reviewer is prompted to output:
```
---
verdict: approve
---
```

`parseReviewOutput` extracts frontmatter via `gray-matter`, validates the `verdict` field with `ReviewFrontmatterSchema` (Zod), and extracts bullet findings from the body. On invalid/missing frontmatter, it returns `{ verdict: "reject", findings: ["Review parse error: ..."] }` — never silently defaults to approve.

### 7. Structured `PipelineResult` with infra/semantic separation

```typescript
interface PipelineResult {
  status: "completed" | "paused";
  filesChanged: string[];
  testsPassed?: boolean;
  testOutput?: string;
  reviewVerdict?: "approve" | "reject";
  reviewFindings?: string[];
  retryCount: number;
  errorSummary?: string;
  infrastructureError?: string;  // LLM timeout, spawn failure
}
```

Infrastructure failures (dispatch crash, shell spawn error) populate `infrastructureError` and leave domain fields (`testsPassed`, `reviewVerdict`) undefined. Semantic failures (test failures, review rejections) populate domain fields only.

---

## Files Changed

| File | Change |
|------|--------|
| `extensions/megapowers/subagent/pipeline-workspace.ts` | Temp-commit isolation; file-copy squash; discriminated union return types |
| `extensions/megapowers/subagent/pipeline-steps.ts` | **New** — `VerifyResult`, `runVerifyStep` shell executor |
| `extensions/megapowers/subagent/pipeline-schemas.ts` | **New** — `ReviewFrontmatterSchema` (Zod) |
| `extensions/megapowers/subagent/pipeline-context-bounded.ts` | **New** — `BoundedPipelineContext`, O(1) `withRetryContext` |
| `extensions/megapowers/subagent/pipeline-results.ts` | Added `ImplementResult`, `ReviewResult`, `parseReviewOutput`; deprecated `parseReviewVerdict` |
| `extensions/megapowers/subagent/pipeline-runner.ts` | 2-agent cycle; shell verify; frontmatter review; bounded context; structured result |
| `extensions/megapowers/subagent/pipeline-tool.ts` | Discriminated union `.ok` checks; removed verifier agent |
| `extensions/megapowers/subagent/oneshot-tool.ts` | Discriminated union `.ok` checks throughout |
| `extensions/megapowers/subagent/pipeline-context.ts` | `@deprecated` annotation added |

---

## Test Coverage

784 tests pass across 75 files. Pipeline-specific coverage (46 tests, 6 files):

- `tests/pipeline-workspace.test.ts` — temp-commit order, integration test (real git repo), file-copy, rename handling, discriminated unions, failure preservation
- `tests/pipeline-results.test.ts` — `ImplementResult` contract, `ReviewResult`, `parseReviewOutput` (valid/invalid/empty frontmatter)
- `tests/pipeline-runner.test.ts` — 2-agent happy path, bounded retry context, review rejection cycle, infra vs semantic failure separation
- `tests/pipeline-tool.test.ts` — AC15 (exactly 2 agents), discriminated union source scan
- `tests/pipeline-context-bounded.test.ts` — O(1) size assertion over 10 simulated retries
- `tests/pipeline-schemas-review.test.ts` — Zod schema validation

---

## Backward Compatibility

- `pipeline-context.ts` (legacy unbounded context) is retained and marked `@deprecated`. Its tests pass unchanged.
- `parseReviewVerdict` / `ReviewVerdict` are retained and marked `@deprecated` — existing test coverage continues.
- The `pipeline-tool.ts` public API (`handlePipelineTool`) gains an optional `execShell` parameter — no breaking change for existing callers.
