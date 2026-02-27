# Changelog

## [Unreleased]

### Added
- **`megapowers_signal` actions: `tests_failed` / `tests_passed`** — Explicit LLM-driven TDD RED/GREEN signals replace implicit bash command sniffing. The LLM runs tests any way it likes (compound commands, piped, make targets), reads the output, and calls the appropriate signal. `tests_failed` transitions `tddTaskState` from `test-written` to `impl-allowed`; `tests_passed` is a no-op acknowledgment. Both valid in `implement` and `code-review` phases. Satellite sessions get a parallel `megapowers_signal` tool using in-memory `satelliteTddState`.

### Removed
- **`isTestRunnerCommand()` and `TEST_RUNNER_PATTERNS`** — Deleted from `write-policy.ts`. Bash command sniffing no longer used for TDD state transitions.
- **`processBashResult()`** — Deleted from `tool-overrides.ts`. Replaced by explicit `tests_failed` signal.
- **Satellite bash sniffing block** — Inline `isTestRunnerCommand` check on bash `tool_result` in `index.ts` removed. Satellite now uses `megapowers_signal` tool.

### Fixed
- **#020**: TDD guard rejected compound bash commands (`&&`, `|`, `;`) — sniffing replaced with explicit `tests_failed` signal; any test command now works.

---

### Added
- **Custom tools: `megapowers_signal` and `megapowers_save_artifact`** — LLM calls structured tools for state transitions and artifact persistence instead of producing regex-matchable prose
- **Disk-first state I/O** (`state-io.ts`) — `readState()` / `writeState()` with atomic temp-file-then-rename. No module-level state variable in `index.ts`
- **Thin state schema** — `state.json` stores only coordination data (`activeIssue`, `phase`, `completedTasks[]`, etc.). Task lists and acceptance criteria derived on demand from artifact files
- **Derived data module** (`derived.ts`) — `deriveTasks()` parses `plan.md`, `deriveAcceptanceCriteria()` parses `spec.md`/`diagnosis.md`, always on demand
- **Write policy** (`write-policy.ts`) — Pure `canWrite()` function encoding the full phase/TDD write policy matrix
- **Tool overrides** (`tool-overrides.ts`) — `evaluateWriteOverride()` for write/edit interception, `processBashResult()` for test runner detection
- **Phase advance** (`phase-advance.ts`) — Shared `advancePhase()` used by both tool and slash commands
- **Prompt injection** (`prompt-inject.ts`) — Megapowers protocol section + phase-specific tool instructions injected into every prompt
- **Satellite mode** (`satellite.ts`) — Subagent detection via `PI_SUBAGENT=1` env var with TDD enforcement
- **`/mega off` and `/mega on`** — Disable/enable all enforcement. Resets to enabled on session start
- **Open question sentinel detection** — `hasOpenQuestions()` recognizes "None", "N/A", "No open questions", "(none)" as empty

### Changed
- **`gates.ts`** — implement→verify gate now uses `deriveTasks()` + `completedTasks` instead of deprecated `state.planTasks`
- **`ui.ts`** — Dashboard derives tasks on demand; all state writes use atomic `writeState()`; removed deprecated `planTasks`/`acceptanceCriteria` from state construction
- **`state-machine.ts`** — Schema updated: `completedTasks[]` replaces per-task `completed` flag; deprecated fields marked `@deprecated`

### Removed
- **`artifact-router.ts`** — Regex-based signal detection replaced by `megapowers_signal` tool
- **`tdd-guard.ts`** — Logic moved to `write-policy.ts` and `tool-overrides.ts`
- **`state-recovery.ts`** — Replaced by `readState()` which returns defaults on missing/corrupt state
- **`satellite-tdd.ts`** — Replaced by satellite mode in `satellite.ts` + tool overrides

### Fixed
- **#006**: Acceptance criteria not extracted — now derived on demand from `spec.md`, never cached in state
- **#017**: `[no-test]` tasks silently fail to complete — LLM calls `megapowers_signal({ action: "task_done" })` explicitly
- **#019**: Task completion not advancing phase — tool-based signal is deterministic, auto-advances to verify on final task
- **#021**: Task source of truth unreliable — disk-first state, no in-memory/file drift
- **#023**: "None" detected as open question — sentinel pattern matching added to `hasOpenQuestions()`
- **#024**: Review approval not detected — LLM calls `megapowers_signal({ action: "review_approve" })` explicitly
- **#028**: Artifact/signal disconnect — all signals via structured tools, all artifacts via `megapowers_save_artifact`
- **#029**: Task state disconnect — tasks derived from `plan.md` on demand, never stored in `state.json`

---

### Added
- **Issue Triage & Batching**: `/triage` command to review open issues, group them, and create batch issues
- `sources` field on `Issue` type — batch issues reference source issue IDs in frontmatter (`sources: [6, 13, 17]`)
- `store.getSourceIssues(slug)` — returns full Issue objects for a batch's source IDs
- `store.getBatchForIssue(issueId)` — finds the active batch containing a given issue
- `buildSourceIssuesContext()` — formats source issues for prompt injection across all workflow phases
- `formatIssueListItem` annotates source issues with "(in batch XXX)" in issue lists
- Auto-close: completing a batch issue automatically marks all its source issues as done
- `prompts/triage.md` template for LLM-assisted issue grouping
- **Bugfix workflow**: Full reproduce → diagnose → plan → review → implement → verify → done workflow
- `reproduce-bug.md` prompt template with `{{issue_slug}}` interpolation
- `diagnose-bug.md` prompt template with `{{reproduce_content}}` and optional `## Fixed When` section
- `generate-bugfix-summary.md` prompt template for done-phase summary generation
- Phase gates: `reproduce→diagnose` (requires reproduce.md), `diagnose→plan` (requires diagnosis.md)
- Artifact routing for reproduce and diagnose phases
- `extractFixedWhenCriteria()` in spec-parser — extracts numbered acceptance criteria from diagnosis
- Bugfix-specific prompt variable aliasing: reproduce→brainstorm_content, diagnosis→spec_content for plan phase
- Bugfix done-phase menu with "Generate bugfix summary" option
- `doneMode: "generate-bugfix-summary"` state support
- Integration tests for bugfix prompt variable injection (`tests/bugfix-integration.test.ts`)

### Fixed
- Stale acceptance criteria no longer persist after diagnosis edits remove `## Fixed When` section

### Added — Subagent Pipeline (#084)
- **`pipeline` tool** — dispatches a full implement → verify → review cycle for a plan task in an isolated jj workspace. Retry budget (default 3 cycles), configurable per-step timeout (default 10 min). On exhaustion returns log + diff + error summary to the parent LLM; resumes with `{ resume: true, guidance }`.
- **`subagent` tool (rewritten)** — one-shot subagent dispatch for ad-hoc tasks; squashes workspace on success, cleans up on failure, surfaces workspace errors explicitly.
- **`PiSubagentsDispatcher`** — implements the new `Dispatcher` interface by delegating to pi-subagents' `runSync`, with injectable `RunSyncFn` for testability.
- **`auditTddCompliance`** — deterministic TDD ordering check from tool-call history. Produces `{ testWrittenFirst, testRanBeforeProduction, productionFilesBeforeTest, testRunCount }`. Report passed to reviewer as a soft gate.
- **Pipeline context carry-forward** — `renderContextPrompt()` builds structured markdown context passed to each agent; retry context includes failure reason and accumulated review findings.
- **JSONL pipeline log** — `writeLogEntry` / `readPipelineLog` for structured per-step logging under `.megapowers/subagents/{id}/log.jsonl`.
- **jj workspace manager** — `createPipelineWorkspace`, `squashPipelineWorkspace`, `cleanupPipelineWorkspace`, `getWorkspaceDiff`; all injectable for testability.
- **Agent definitions** — `.pi/agents/implementer.md` (TDD-strict, gpt-5.3-codex), `.pi/agents/verifier.md` (bun test only, haiku-4-5), `.pi/agents/reviewer.md` (structured approve/reject, sonnet-4-5).
- **`pi-subagents: ^0.11.0`** added as npm dependency.
- **`PI_SUBAGENT_DEPTH` support** in `isSatelliteMode()` and `resolveProjectRoot()` walk-up.

### Changed
- **Satellite mode** (`satellite.ts`) — `setupSatellite()` is now a no-op; subagent sessions no longer install write-blocking TDD hooks (TDD is enforced via prompts + post-hoc audit).
- **`/mega off` / `/mega on`** — tool filter updated: `pipeline` added, `subagent_status` removed.

### Removed
- **Old subagent implementation** — 9 source files (`subagent-agents.ts`, `subagent-async.ts`, `subagent-context.ts`, `subagent-errors.ts`, `subagent-runner.ts`, `subagent-status.ts`, `subagent-tools.ts`, `subagent-validate.ts`, `subagent-workspace.ts`) and 9 corresponding test files replaced wholesale.
- **`subagent_status` tool** — removed from tool registration and `/mega off` / `/mega on` filter lists.
