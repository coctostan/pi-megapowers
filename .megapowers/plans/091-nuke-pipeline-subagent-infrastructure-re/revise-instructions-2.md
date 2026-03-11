## Task 5: Delete the legacy pipeline and one-shot execution stack

Task 5 still leaves **AC 6** and **AC 11** implicit.

### What is missing
- The task does not explicitly preserve the retained primary-session state/progression mechanism.
- The verification step does not check that state shape and sequential task execution remain based on `currentTaskIndex`, `completedTasks`, and `task_done`.

### Why this matters in this codebase
These files are the retained mechanism and should be called out explicitly:
- `extensions/megapowers/state/state-machine.ts`
  - defines `currentTaskIndex`, `completedTasks`, and `tddTaskState`
- `extensions/megapowers/state/state-io.ts`
  - `KNOWN_KEYS` is the persisted state schema gate
- `extensions/megapowers/tools/tool-signal.ts`
  - `handleTaskDone()` updates `completedTasks`, advances `currentTaskIndex`, resets `tddTaskState`, and auto-advances to `verify`
- `tests/state-io.test.ts`
- `tests/tool-signal.test.ts`
- `tests/phase-advance.test.ts`

### Required change
Expand the preservation list in Step 1 so it explicitly says these files/tests must remain unchanged because they implement and verify the retained direct primary-session flow.

Add these bullets under the existing "Preserve these files unchanged" section:

```md
- `extensions/megapowers/state/state-machine.ts` (retained state shape: `currentTaskIndex`, `completedTasks`, `tddTaskState`)
- `extensions/megapowers/state/state-io.ts` (retained persisted schema / `KNOWN_KEYS`)
- `extensions/megapowers/tools/tool-signal.ts` (retained `task_done` progression logic)
- `tests/state-io.test.ts`
- `tests/tool-signal.test.ts`
- `tests/phase-advance.test.ts`
```

Then replace Step 2 with a verification step that explicitly covers AC 6 and AC 11:

```md
**Step 2 — Verify**
Run: `grep -R -nE 'pipeline(Id|Workspace)|subagentId' extensions/megapowers/state extensions/megapowers/tools/tool-signal.ts || true; bun test tests/state-io.test.ts tests/tool-signal.test.ts tests/phase-advance.test.ts tests/focused-review.test.ts tests/focused-review-runner.test.ts tests/hooks-focused-review.test.ts && bun test`
Expected: the grep prints no legacy pipeline/subagent-only state fields in `state/` or `tool-signal.ts`; the retained sequential task-progression tests pass (`currentTaskIndex`, `completedTasks`, `task_done`); focused-review tests still pass using `pi-subagents`; and the full suite passes.
```

Do not add a new orchestration layer or new state fields.

## Task 7: Update public documentation to remove the legacy pipeline workflow

Step 2's verification command is incomplete for AC 9 and is brittle:
- it does not inspect `subagent` wording at all
- `grep ... && bun test` stops before `bun test` when there are zero matches, which is the expected success case

### Required change
Replace Step 2 with:

```md
**Step 2 — Verify**
Run: `grep -nEi '(^|[^a-z])pipeline([^a-z]|$)|satellite mode|isolated git worktree|\bsubagent(s)?\b' README.md AGENTS.md ROADMAP.md || true; bun test`
Expected: any remaining matches are only preserved `pi-subagents` references or historical context that clearly distinguishes the preserved functionality from the deleted legacy path; public docs no longer advertise the removed implement-phase pipeline / one-shot subagent workflow; and the full test suite passes.
```

This change is required because AC 9 explicitly distinguishes preserved `pi-subagents` functionality from deleted legacy `subagent` workflow, and the current grep does not surface stale `subagent` wording.

## Task 8: Update internal agent and review prompts after legacy subagent removal

Step 2's verification command is brittle for the same reason as Task 7:
- `grep -nE ... && bun test` skips `bun test` when the grep finds no matches, which is the expected success case

### Required change
Replace Step 2 with:

```md
**Step 2 — Verify**
Run: `grep -nE 'pipeline runner|If subagents implemented|Subagent completed task' .pi/agents/implementer.md prompts/code-review.md prompts/verify.md || true; bun test`
Expected: those legacy delegated-execution phrases are gone or rewritten to reflect direct primary-session implementation, any retained wording is clearly about preserved non-legacy review/advisory usage, and the full test suite passes.
```

Do not broaden this task into unrelated prompt cleanup.