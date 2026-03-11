## Coverage Summary
- Overall: covered
- Planning input: spec.md

## AC-by-AC Findings
- AC 1 — covered
  - Tasks: 1, 2
  - Finding: Task 1 removes `pipeline` tool registration and imports; Task 2 removes it from mega on/off tool lists.

- AC 2 — covered
  - Tasks: 1, 2
  - Finding: Task 1 removes legacy `subagent` tool registration and imports; Task 2 removes it from mega on/off tool lists.

- AC 3 — covered
  - Tasks: 5
  - Finding: Task 5 deletes `pipeline-runner.ts`, `pipeline-tool.ts`, and `oneshot-tool.ts` — the orchestration layer for implement → verify → review in isolated workspaces.

- AC 4 — covered
  - Tasks: 5
  - Finding: Task 5 deletes `pipeline-workspace.ts` and confirms no runtime code imports the deleted workspace/worktree helpers.

- AC 5 — covered
  - Tasks: 5
  - Finding: Task 5 deletes `pipeline-results.ts`, `pipeline-context.ts`, `pipeline-context-bounded.ts`, `pipeline-log.ts`, `tdd-auditor.ts`, and related support modules.

- AC 6 — covered
  - Tasks: 5
  - Finding: Task 5 verifies that state-machine modules (`state-io.ts`, `tool-signal.ts`) no longer reference `pipelineId`, `pipelineWorkspace`, or `subagentId` after deletion.

- AC 7 — covered
  - Tasks: 3, 6
  - Finding: Task 3 removes satellite bootstrap from `index.ts`; Task 6 deletes `satellite.ts` and all satellite-specific tests.

- AC 8 — covered
  - Tasks: 4, 8
  - Finding: Task 4 rewrites `prompts/implement-task.md` and `prompts.ts` to prohibit legacy tools; Task 8 updates `.pi/agents/implementer.md`, `prompts/code-review.md`, and `prompts/verify.md`.

- AC 9 — covered
  - Tasks: 7
  - Finding: Task 7 updates `README.md`, `AGENTS.md`, and `ROADMAP.md` to remove legacy pipeline/subagent workflow descriptions while preserving `pi-subagents` references for non-legacy review functionality.

- AC 10 — covered
  - Tasks: 5, 6
  - Finding: Task 5 deletes 23 pipeline/subagent-specific test files; Task 6 deletes 6 satellite-mode test files.

- AC 11 — covered
  - Tasks: 5
  - Finding: Task 5 preservation list explicitly retains `state-machine.ts`, `state-io.ts`, `tool-signal.ts`, and their tests for `task_done`, `currentTaskIndex`, `completedTasks` progression.

- AC 12 — covered
  - Tasks: 5
  - Finding: Task 5 preservation list explicitly excludes `extensions/megapowers/plan-review/focused-review*.ts`, `package.json` (keeps `pi-subagents` dependency), and related tests from deletion.

## Missing Coverage
- None

## Weak Coverage / Ambiguities
- None

## Notes for the Main Reviewer
- Task 5 has `status: needs_revision` (all others approved); review should verify the revision addresses the original feedback.
- Task 5 carries the heaviest load (ACs 3–6, 10–12); its preservation list is explicit and testable via grep verification in Step 2.
- The plan uses a layered dependency structure (1,2 → 3 → 4 → 5; 5 → 6,7,8) that enforces proper ordering: remove tool surface first, then internal infrastructure, then docs/prompts.
