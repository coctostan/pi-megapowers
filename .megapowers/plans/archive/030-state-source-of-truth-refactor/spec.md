# Spec: State Source of Truth Refactor

## Goal

Replace megapowers' regex-based signal detection and split in-memory/disk state model with a tool-first, disk-first architecture. The LLM calls structured tools (`megapowers_signal`, `megapowers_save_artifact`) for state transitions and artifact persistence instead of the runtime parsing assistant prose with fragile regex. Built-in `write`/`edit`/`bash` tools are overridden to enforce phase-based write policies and TDD tracking. Every state mutation writes through to `state.json` immediately with no in-memory cache. Structural data (task lists, acceptance criteria, open questions) is derived on demand from artifact files, never stored in `state.json`. This resolves all 8 source issues (#006, #017, #019, #021, #023, #024, #028, #029) which trace to regex-based detection failures and in-memory/disk state drift.

## Acceptance Criteria

### State I/O

1. A `readState(cwd)` function reads `state.json` from `.megapowers/state.json`. When the file is missing, it returns a default initial state.

2. When `state.json` contains invalid JSON, `readState(cwd)` returns a default initial state rather than throwing.

3. A `writeState(cwd, state)` function writes `state.json` atomically using temp-file-then-rename so a crash mid-write never produces a corrupt file.

4. `writeState` followed by `readState` round-trips the state correctly (no data loss or mutation).

5. The extension's `index.ts` has no module-level `state` variable. Every event handler and tool handler reads state from disk via `readState` at the start of its execution.

### Thin State Schema

6. `state.json` stores only coordination and progress data: `activeIssue`, `workflow`, `phase`, `phaseHistory`, `currentTaskIndex`, `completedTasks` (array of completed task indices), `reviewApproved`, `tddTaskState`, `taskJJChanges`, `jjChangeId`, `doneMode`, and `megaEnabled`.

7. `state.json` does not contain a `planTasks` array or an `acceptanceCriteria` array. These are derived on demand from artifact files.

### Derived Data

8. When gate checks or tool handlers need the task list, they parse it from `.megapowers/plans/{issue}/plan.md` using the existing plan parser. The result is never cached in state.

9. When gate checks or prompt injection needs acceptance criteria, they parse them from `.megapowers/plans/{issue}/spec.md` (or `diagnosis.md` for bugfix workflows) using the existing spec parser. The result is never cached in state.

10. When the spec→plan gate checks for open questions, it parses them from `spec.md`. The `hasOpenQuestions()` function returns `false` for sentinel values: "None", "N/A", "No open questions", "(none)", "None." (case-insensitive, with optional leading `- ` or list markers). Only actual question items (lines starting with `- ` or numbered items containing `?`) count as open questions.

### Custom Tool: `megapowers_signal`

11. A `megapowers_signal` tool is registered with an `action` parameter accepting `"task_done"`, `"review_approve"`, or `"phase_next"`.

12. `megapowers_signal({ action: "task_done" })` reads state from disk, adds `currentTaskIndex` to `completedTasks[]`, advances `currentTaskIndex` to the next incomplete task index, writes state to disk, and returns a confirmation message with the next task's description.

13. When `task_done` is called and the current task is not marked `[no-test]`, it validates that TDD requirements are met (test file written and tests ran red) before marking complete. If not met, it returns an actionable error message.

14. When `task_done` is called for a `[no-test]` task, it succeeds without checking TDD state.

15. When `task_done` completes the final task in the plan, it automatically advances the phase to `verify` and returns a message indicating all tasks are complete and verification should begin.

16. `megapowers_signal({ action: "review_approve" })` reads state from disk, sets `reviewApproved: true`, writes state to disk, and returns a confirmation.

17. `megapowers_signal({ action: "phase_next" })` reads state from disk, determines the next phase in the workflow, checks gate conditions (artifact existence, open questions, task completion, review approval), and if all gates pass, advances the phase, writes state to disk, and returns a confirmation with the new phase name.

18. When `phase_next` gate conditions are not met, it returns an actionable error message that tells the LLM exactly what is missing and what to do (e.g., "Cannot advance to plan: spec.md has 2 open questions. Resolve them first.").

19. When `phase_next` advances to `implement`, it creates the issue-level jj change (if in a jj repo).

20. `task_done` inspects the current task's jj change diff and creates the next task's jj change (if in a jj repo). jj failures are non-fatal — the tool returns success with a warning.

21. When `phase_next` advances to `done`, task jj changes are squashed into the parent issue change (if in a jj repo). jj failures are non-fatal.

### Custom Tool: `megapowers_save_artifact`

22. A `megapowers_save_artifact` tool is registered with `phase` (string) and `content` (string) parameters.

23. `megapowers_save_artifact({ phase, content })` writes the content to `.megapowers/plans/{activeIssue}/{phase}.md`. It has no state side effects — it does not modify `state.json`.

24. When there is no active issue, `megapowers_save_artifact` returns an actionable error.

### Tool Overrides: `write` and `edit`

25. The built-in `write` tool is overridden by name. The override reads state from disk, evaluates the write policy, and either performs the write using the built-in implementation or returns a blocking error.

26. The built-in `edit` tool is overridden by name with the same policy logic as `write`.

27. The write policy blocks source code writes in brainstorm, spec, plan, review, verify, and done phases. Only `.megapowers/` paths are writable in these phases.

28. The write policy allows TDD-guarded source code writes in implement and code-review phases: test files may be written freely; non-test production files require that a test file was written and tests ran red first.

29. When a write to a test file is detected during implement or code-review, the override updates `tddTaskState` in `state.json` to record that a test file has been written.

30. The overrides preserve built-in rendering (diffs, syntax highlighting) by not providing custom `renderCall`/`renderResult` functions.

31. Allowlisted file types (`.json`, `.yml`/`.yaml`, `.toml`, `.env`, `.d.ts`, `.md`, `.config.*`) bypass TDD enforcement, same as the current allowlist.

### Tool Override: `bash`

32. The built-in `bash` tool is overridden by name. It executes the command using the built-in implementation, then post-processes the result.

33. During implement and code-review phases, when the command matches a test runner pattern (e.g., `bun test`, `npm test`, `pytest`), the override reads state from disk, records the test result (pass/fail based on exit code) in `tddTaskState`, and writes state to disk.

34. The bash override does not block any commands in any phase.

### Write Policy (Pure Function)

35. A `canWrite(phase, filePath, megaEnabled, taskIsNoTest, tddState)` pure function encodes the full write policy matrix. It returns `{ allowed: true }` or `{ allowed: false, reason: string }`.

36. `canWrite` returns `{ allowed: true }` for any file when `megaEnabled` is `false`.

37. `canWrite` returns `{ allowed: true }` for `.megapowers/` paths regardless of phase.

### `/mega off` and `/mega on`

38. `/mega off` sets `megaEnabled: false` in `state.json`. All tool overrides become pure passthrough (no policy checks), no prompt injection occurs, and custom tools (`megapowers_signal`, `megapowers_save_artifact`) are effectively hidden from the LLM.

39. `/mega on` sets `megaEnabled: true` in `state.json`, restoring full enforcement.

40. `megaEnabled` resets to `true` at session start, regardless of its persisted value.

### Prompt Architecture

41. When `megaEnabled` is true and an issue is active, a base "megapowers protocol" section is injected into every prompt describing the available tools and the error handling pattern (read error → fix → retry).

42. Phase-specific prompt sections tell the LLM exactly which tool calls to make for that phase (e.g., "When the spec is complete, call `megapowers_save_artifact` with phase 'spec'").

### Session Entries Eliminated

43. The extension makes no calls to `pi.appendEntry()`. Session recovery reads `state.json` only. If `state.json` is missing or corrupt, the system starts fresh.

### Module Lifecycle

44. `artifact-router.ts` is deleted. Its regex-based signal detection and artifact routing logic is fully replaced by the `megapowers_signal` and `megapowers_save_artifact` tools.

45. `tdd-guard.ts` is deleted. Its file classification functions (`isTestFile`, `isAllowlisted`, `isTestRunnerCommand`) and gating logic move into `write-policy.ts` and `tool-overrides.ts`.

46. `state-recovery.ts` is deleted. Its `resolveStartupState()` function is replaced by `readState()` — file state is always authoritative.

47. `satellite-tdd.ts` is deleted. Satellite (subagent) mode is handled by a mode flag in the tool overrides. Satellite TDD cycle state is kept in-memory (the one documented exception to disk-first) because subagents are short-lived and must not compete with the primary session for `state.json` writes.

### Satellite Mode

48. In satellite mode, tool overrides for `write`/`edit`/`bash` are registered with TDD enforcement using in-memory TDD state. The `megapowers_signal` and `megapowers_save_artifact` tools are not registered for satellites.

### Backward Compatibility

49. Existing slash commands (`/task done`, `/phase next`, `/review approve`) continue to work as user fallbacks. They call the same shared `advancePhase()` / signal handling logic that the tools use.

50. The `/tdd skip` command continues to work, setting `tddTaskState.skipped` in `state.json` to bypass TDD enforcement for the current task.

### Source Issue Resolution

51. Acceptance criteria are never cached in `state.json`; they are derived on demand from `spec.md`, resolving the extraction failure in #006.

52. Task completion is signaled by the LLM calling `megapowers_signal({ action: "task_done" })`, not by regex matching on assistant prose. This resolves #017 ([no-test] tasks), #019 (task not advancing), #021 (unreliable source of truth), and #029 (task state disconnect).

53. The `hasOpenQuestions()` parser recognizes "None"/"N/A" sentinels, resolving #023.

54. Review approval is signaled by the LLM calling `megapowers_signal({ action: "review_approve" })`, not by regex matching. This resolves #024.

55. All artifact persistence goes through `megapowers_save_artifact` tool calls, eliminating the prompt/runtime disconnect described in #028.

## Out of Scope

- **Custom subagent architecture**: Building a megapowers-specific subagent extension with jj-change-per-task isolation and parallel dispatch. Depends on this refactor.
- **jj-based recovery & verification**: TDD verification via `jj diff`, state reconstruction from change tree, change-based audit trail. Depends on this refactor.
- **New workflow types**: Only feature and bugfix workflows. No new workflow definitions.
- **UI redesign**: The TUI dashboard reads from disk instead of in-memory state, but no visual changes beyond a "MEGA OFF" indicator when disabled.
- **Prompt content authoring**: The prompt templates will be updated with tool instructions, but the substantive prompt content (brainstorm guidance, spec format, etc.) is unchanged.
- **Plan parser or spec parser rewrites**: Existing parsers are reused. Only `hasOpenQuestions()` is patched for sentinel handling.
- **Migration tooling**: No migration script for existing `state.json` files. The new `readState` gracefully handles old formats by merging over defaults.

## Open Questions

