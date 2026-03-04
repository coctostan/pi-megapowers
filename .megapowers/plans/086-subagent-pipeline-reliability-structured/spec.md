# Spec: Subagent Pipeline Reliability & Structured Handoff

## Goal

Redesign the pipeline system's workspace isolation, inter-step communication, and result parsing to fix fundamental reliability issues: worktrees that can't see prior task output (causing squash failures on already-existing files), unbounded context growth across retry cycles, fragile regex-based review verdict parsing, and untyped workspace operation return values requiring `(as any).error` casts. The redesign introduces temp-commit-based worktrees, file-copy squash, shell-based test verification (eliminating one LLM dispatch per cycle), structured TypeScript contracts between steps, Zod-validated reviewer output, and discriminated union return types throughout.

## Acceptance Criteria

1. `createPipelineWorkspace` makes a temporary commit of all uncommitted changes in the main working directory (including untracked files) before creating the worktree, then resets the temporary commit (`git reset HEAD~1`) so the main WD is unchanged.
2. The worktree created by `createPipelineWorkspace` contains files from the temporary commit, so files added by prior tasks (but not yet committed) are present in the worktree.
3. `createPipelineWorkspace` returns `{ ok: true, workspaceName, workspacePath }` on success.
4. `createPipelineWorkspace` returns `{ ok: false, error: string }` on failure (e.g., `git worktree add` fails).
5. If the temporary commit succeeds but worktree creation fails, `createPipelineWorkspace` still resets the temporary commit before returning the error.
6. `squashPipelineWorkspace` uses `git diff --cached --name-only --diff-filter=AMCR` to identify changed files and copies them from the worktree to the main working directory (file-level copy, not `git apply`).
7. `squashPipelineWorkspace` uses `git diff --cached --name-only --diff-filter=D` to identify deleted files and removes them from the main working directory.
8. `squashPipelineWorkspace` returns `{ ok: true }` on success (including when there are no changes).
9. `squashPipelineWorkspace` returns `{ ok: false, error: string }` on failure, preserving the worktree for inspection.
10. `cleanupPipelineWorkspace` returns `{ ok: true }` on success and `{ ok: false, error: string }` on failure.
11. All callers of `createPipelineWorkspace`, `squashPipelineWorkspace`, and `cleanupPipelineWorkspace` (in `pipeline-tool.ts` and `oneshot-tool.ts`) use discriminated union checks (`result.ok`) instead of `(as any).error` casts.
12. The verify step runs `bun test` (or a configurable test command) as a direct shell command and parses the exit code, without dispatching to a verifier LLM agent.
13. The verify step captures stdout and stderr from the test command and includes them in the `VerifyResult`.
14. `VerifyResult` is a TypeScript interface with fields: `passed: boolean`, `exitCode: number`, `output: string` (captured stdout+stderr), `durationMs: number`.
15. The pipeline dispatches exactly 2 LLM agents per cycle (implementer + reviewer), down from the current 3 (implementer + verifier + reviewer).
16. `ImplementResult` is a TypeScript interface with fields: `filesChanged: string[]`, `tddReport: TddComplianceReport`, `error?: string`.
17. `ReviewResult` is a TypeScript interface with fields: `verdict: "approve" | "reject"`, `findings: string[]`, `raw: string`.
18. The reviewer is prompted to output frontmatter markdown with a `verdict` field (e.g., `---\nverdict: approve\n---\n`).
19. `parseReviewOutput` parses the reviewer's response using frontmatter extraction + Zod schema validation for the `verdict` field.
20. When `parseReviewOutput` receives unparseable output (missing or invalid frontmatter), it returns a `ReviewResult` with `verdict: "reject"` and a finding that includes the parse error message.
21. A new `pipeline-schemas.ts` file defines Zod schemas for `ReviewFrontmatter` (with `verdict` enum `"approve" | "reject"`), and optionally `PausedPipelineState` for pause/resume persistence.
22. On retry, the runner passes only the relevant failure data to the next cycle: test output for verify failures, review findings for review rejections, error message for implement failures — not the accumulated raw output of all prior steps.
23. The rendered context prompt for a retry cycle is O(1) in size relative to cycle count — it does not grow with each retry.
24. `PipelineContext` no longer accumulates a `steps: PipelineStepOutput[]` array across cycles; each cycle receives only the task description, plan, spec, learnings, and (on retry) the bounded failure context from the previous cycle.
25. The `PipelineResult` returned by `runPipeline` includes structured fields: `status`, `filesChanged`, `retryCount`, `testsPassed`, `testOutput`, `reviewVerdict`, `reviewFindings`, `errorSummary`.
26. Infrastructure failures (LLM dispatch crash, timeout) are distinguished from semantic failures (test failures, review rejections) via separate fields in the result types — infrastructure errors populate `error`, semantic failures populate domain-specific fields (`passed`, `verdict`, `findings`).
27. The `PipelineAgents` interface no longer includes a `verifier` field, since verification is done via shell command.
28. `PipelineOptions` includes a `testCommand` field (default: `"bun test"`) used by the verify step.

## Out of Scope

- **Rich TUI panel for subagent visibility** (from #074) — deferred to a follow-up issue; has different UI dependencies.
- **Structured `SubagentResult` for parent-agent decision-making** (from #074) — separable concern; partial overlap addressed by discriminated union return types but the full structured handoff protocol is deferred.
- **Changes to the `Dispatcher` interface or `pi-subagents-dispatcher.ts`** — the dispatcher contract remains unchanged; only how results are consumed changes.
- **Changes to TDD auditor logic** (`tdd-auditor.ts`) — existing audit logic is reused as-is.
- **Pipeline pause/resume persistence format changes** beyond adding Zod validation to existing `pipeline-meta.ts`.
- **Changes to `pipeline-log.ts`** — log entry format remains unchanged.

## Open Questions

*(None)*
