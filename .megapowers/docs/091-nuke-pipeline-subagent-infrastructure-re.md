# Feature: Remove Legacy Pipeline and Subagent Infrastructure (#091)

**Date:** 2026-03-10  
**Workflow:** feature  
**Issue:** `091-nuke-pipeline-subagent-infrastructure-re`

---

## Summary

Deleted the legacy implement-phase pipeline and one-shot subagent infrastructure from the megapowers extension. Implementation now happens directly in the primary session under the existing TDD write-policy and workflow controls. Newer `pi-subagents`-based functionality (focused plan-review fan-out) is preserved and untouched.

---

## What Was Built

### Removed: Legacy tool registrations (`register-tools.ts`)

The `pipeline` and `subagent` tools were unregistered from the megapowers extension's tool surface. The extension now exposes exactly five tools: `megapowers_signal`, `megapowers_plan_task`, `megapowers_plan_review`, `create_issue`, and `create_batch`.

All imports of legacy orchestration handlers (`handleOneshotTool`, `handlePipelineTool`, `PiSubagentsDispatcher`, `renderPipelineCall`, `renderPipelineResult`) were removed from `register-tools.ts`.

### Removed: Legacy execution stack (`extensions/megapowers/subagent/`)

Seventeen runtime modules that orchestrated the isolated-worktree implement→verify→review pipeline were deleted:

- `oneshot-tool.ts`, `pipeline-tool.ts`, `pipeline-runner.ts`
- `pipeline-workspace.ts`, `pipeline-results.ts`, `pipeline-context.ts`
- `pipeline-context-bounded.ts`, `pipeline-log.ts`, `pipeline-meta.ts`
- `pipeline-renderer.ts`, `pipeline-steps.ts`, `pipeline-schemas.ts`
- `task-deps.ts`, `message-utils.ts`, `tdd-auditor.ts`
- `dispatcher.ts`, `pi-subagents-dispatcher.ts`

### Removed: Satellite mode bootstrap (`satellite.ts`, `index.ts`)

The extension entry point no longer detects or branches on satellite mode. The `isSatelliteMode` / `setupSatellite` helpers and the conditional `if (satellite) { return; }` block were removed from `index.ts`. `satellite.ts` itself was deleted.

### Updated: `/mega on|off` tool toggling (`commands.ts`)

The `/mega off` and `/mega on` handlers previously filtered and restored `pipeline` and `subagent` from the active tool list alongside `megapowers_signal`. Those references are gone — only `megapowers_signal` is toggled.

### Updated: Implement-phase prompts and wording

- `prompts/implement-task.md` — added explicit prohibition: _"Do NOT use `pipeline` or `subagent` tools for implementation work in this session."_ Specifies direct inline session execution.
- `extensions/megapowers/prompts.ts` — `buildRemainingTasksSummary` changed from `"ready — can be delegated to subagent"` to `"ready — can be implemented now"`.
- `prompts/megapowers-protocol.md` — removed "Pipeline/subagent worktrees are also managed automatically."
- `prompts/verify.md` — updated verification evidence table and red-flags list to remove subagent-specific trust language.
- `prompts/code-review.md` — generalized advisory review language from "if subagents implemented tasks" to "if advisory output was used."
- `.pi/agents/implementer.md` — removed reference to pipeline-runner TDD audit pass-through.

### Updated: Documentation (`README.md`, `AGENTS.md`, `ROADMAP.md`)

All user-facing and developer-facing documentation was updated to reflect:
- Direct primary-session implementation as the supported execution model
- Preserved `pi-subagents` focused review fan-out as clearly distinct from the deleted legacy path
- Removal of pipeline/satellite-mode entries from tool tables, architecture bullets, and directory layout

### Retained: `pi-subagents` focused review fan-out

`extensions/megapowers/plan-review/focused-review-runner.ts` continues to import from `pi-subagents/agents.js` and `pi-subagents/execution.js` for advisory specialist fan-out during plan review. This is the preserved non-legacy usage. Tests `focused-review.test.ts`, `focused-review-runner.test.ts`, and `hooks-focused-review.test.ts` all pass.

---

## Why

The legacy pipeline delegated implementation to isolated git worktrees per task, with the LLM orchestrating a multi-step implement→verify→review cycle across subagent sessions. This introduced:

- Complex workspace lifecycle management (create, squash, cleanup) prone to failure
- Satellite-mode branching in the extension entry point — an invisible second execution context
- Context growth problems across retries (every step's full output appended verbatim)
- A large surface of testable but mostly-orchestration code that wasn't providing value above the simpler direct path

The direct primary-session model gives the same TDD enforcement via the existing write-policy and signal flow with far less complexity.

---

## Tests Changed

- **Deleted:** 21 legacy pipeline/satellite/subagent test files
- **Added:** `tests/legacy-subagent-stack-removed.test.ts` — verifies absence of legacy runtime modules and absence of legacy state fields
- **Updated:** `tests/register-tools.test.ts`, `tests/commands-tools-filter.test.ts`, `tests/mp-on-off.test.ts`, `tests/prompts.test.ts`, `tests/index-integration.test.ts`, `tests/tool-signal.test.ts`

**Final suite:** 796 pass, 0 fail (76 files)
