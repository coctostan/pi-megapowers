## Task 5: Delete the legacy pipeline and one-shot execution stack

Task 5 still fails **self-containment** and **no-test validity** for this repo because it deletes a large mixed set of `extensions/megapowers/subagent/*.ts` files without telling the implementer how to distinguish legacy-only code from preserved `pi-subagents` review code.

### What to change

#### 1. Add an explicit pre-deletion boundary check to Step 1
Right now Step 1 only says:

```md
Delete the legacy isolated-worktree implementation stack and the tests that exist only for it.
```

That is too vague for this codebase because these files are easy to misclassify:
- `extensions/megapowers/subagent/dispatcher.ts`
- `extensions/megapowers/subagent/pi-subagents-dispatcher.ts`
- `extensions/megapowers/subagent/message-utils.ts`
- `extensions/megapowers/subagent/tdd-auditor.ts`

Add a substep before the deletion instruction that tells the implementer to prove those files are not used by preserved focused-review code.

Use this exact wording pattern in Step 1:

```md
Before deleting any `extensions/megapowers/subagent/*` module, confirm it is not imported by preserved focused-review code.
Run:
`grep -R -nE 'dispatcher|pi-subagents-dispatcher|message-utils|tdd-auditor|pipeline-(runner|workspace|results|context|context-bounded|log|meta|renderer|steps|schemas)|oneshot-tool|pipeline-tool|task-deps' extensions/megapowers/plan-review tests/focused-review.test.ts tests/focused-review-runner.test.ts tests/hooks-focused-review.test.ts || true`
Expected: no matches. If any listed file is still imported from `extensions/megapowers/plan-review/*` or the focused-review tests, do not delete it in this task; re-scope the deletion list to legacy-only files.
```

Why this is the correct repo-specific check:
- `extensions/megapowers/plan-review/focused-review.ts` uses `pi-subagents` directly, not `extensions/megapowers/subagent/*`
- `extensions/megapowers/plan-review/focused-review-runner.ts` uses `pi-subagents/agents.js` and `pi-subagents/execution.js` directly
- AC 12 requires preserving that newer non-legacy path

#### 2. Make the deletion instruction precise
After the new boundary-check substep, keep the deletion step, but make it explicit that the listed files are deleted only after the import check passes.

Use wording like:

```md
After the import check passes, delete the listed legacy `extensions/megapowers/subagent/*` modules and their dedicated tests. Do not add replacement orchestration code, new state fields, or new dispatch wrappers.
```

#### 3. Strengthen Step 2 so it verifies the files are actually unreachable/deleted
The current Step 2 only checks state/tool-signal grep plus selected tests. Keep that, but add a second grep/find check that confirms the deleted legacy modules are no longer present or referenced.

Replace Step 2 with something in this shape:

```md
**Step 2 — Verify**
Run: `grep -R -nE 'pipeline(Id|Workspace)|subagentId' extensions/megapowers/state extensions/megapowers/tools/tool-signal.ts || true; grep -R -nE 'oneshot-tool|pipeline-tool|pipeline-runner|pipeline-workspace|pipeline-results|pipeline-context|pipeline-context-bounded|pipeline-log|pipeline-meta|pipeline-renderer|pipeline-steps|task-deps|message-utils|tdd-auditor|dispatcher|pi-subagents-dispatcher|pipeline-schemas' extensions/megapowers tests || true; bun test tests/state-io.test.ts tests/tool-signal.test.ts tests/phase-advance.test.ts tests/focused-review.test.ts tests/focused-review-runner.test.ts tests/hooks-focused-review.test.ts && bun test`
Expected: the first grep prints no legacy pipeline/subagent-only state fields in `state/` or `tool-signal.ts`; the second grep shows no runtime/test references to the deleted legacy stack outside intentional historical text; the retained sequential task-progression tests pass (`currentTaskIndex`, `completedTasks`, `task_done`); focused-review tests still pass using `pi-subagents`; and the full suite passes.
```

#### 4. Keep the preservation list exactly as explicit as it is now
Do not remove the preserved-file bullets for:
- `extensions/megapowers/state/state-machine.ts`
- `extensions/megapowers/state/state-io.ts`
- `extensions/megapowers/tools/tool-signal.ts`
- `tests/state-io.test.ts`
- `tests/tool-signal.test.ts`
- `tests/phase-advance.test.ts`
- focused-review files/tests
- `package.json` with `pi-subagents`

Those bullets are now correct and should remain.
