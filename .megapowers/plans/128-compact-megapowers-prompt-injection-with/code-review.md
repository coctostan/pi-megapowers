## Files Reviewed

- `extensions/megapowers/context-summary.ts` — new derived context summary, compact status formatter, and default/debug context report rendering.
- `extensions/megapowers/hooks.ts` — `onBeforeAgentStart(_event: any, ctx: any, deps: Deps): Promise<any>` now derives context and updates the TUI status when hidden prompt injection occurs.
- `extensions/megapowers/commands.ts` — `/mega context` and `/mega context debug` command routing.
- `extensions/megapowers/mp/mp-handlers.ts` — `/mp context` registry entry and completion exposure.
- `tests/context-summary.test.ts` — unit coverage for summary derivation, artifact reporting, prompt omission/debug inclusion, task/TDD edge cases, and plan-mode guidance.
- `tests/hooks.test.ts` — mocked hook-context coverage for hidden injection plus compact status behavior.
- `tests/commands-context.test.ts` — mocked `/mega context` command coverage and state non-mutation check.
- `tests/mp-command.test.ts` — `/mp context` registry/dispatch coverage and completion check.
- `package.json` — dependency surface reviewed; `yaml` is used by `extensions/megapowers/state/entity-parser.ts`.
- `.pi/prompt-assembler/registry.json` — reviewed as dirty tracked tool-registry churn, not part of feature logic.

## Strengths

- `onBeforeAgentStart(_event: any, ctx: any, deps: Deps): Promise<any>` preserves hidden injection while adding non-notification status visibility: it still returns `customType: "megapowers-context"` with `display: false`, and uses `ctx.ui.setStatus("megapowers", formatCompactContextStatus(summary))` only when UI/status support exists (`extensions/megapowers/hooks.ts:71-80`).
- Context is derived on demand from disk-backed state and derived artifacts/tasks, not persisted into state: `buildContextSummary(cwd: string, store?: Store): MegapowersContextSummary` reads state and calls `deriveTaskProgress`, `deriveArtifacts`, and `deriveGuidance` without writes (`extensions/megapowers/context-summary.ts:122-133`).
- The default report is appropriately concise and safe: `renderContextReport(cwd: string, store?: Store, options?: { debug?: boolean }): string` includes workflow/phase, task/TDD state, artifacts, and tool guidance, while only adding rendered prompt text inside the explicit `options?.debug` branch (`extensions/megapowers/context-summary.ts:149-191`).
- Task/TDD reporting now avoids stale state by comparing `tddTaskState.taskIndex` with the current derived task id (`tasks[boundedIndex]?.index`) instead of assuming array position equals task id (`extensions/megapowers/context-summary.ts:74-82`).
- Plan-mode guidance avoids duplicating large tool descriptions while giving correct mode-specific direction, including `megapowers_plan_review` during plan review mode instead of generic `phase_next` guidance (`extensions/megapowers/context-summary.ts:96-119`).
- `/mega context` and `/mp context` share the same renderer, reducing behavior drift (`extensions/megapowers/commands.ts:33-36`, `extensions/megapowers/mp/mp-handlers.ts:120-125`).
- Tests exercise behavior through mocked hook/command contexts and include edge cases for state non-mutation, debug prompt inclusion, status slot signature, stale TDD state, non-contiguous task ids, and plan-review guidance (`tests/context-summary.test.ts:37-145`, `tests/hooks.test.ts:284-305`, `tests/commands-context.test.ts:37-53`, `tests/mp-command.test.ts:98-116`).

## Codex Review Findings

Adopted and fixed:

- `extensions/megapowers/hooks.ts:73` originally called `ctx.ui.setStatus(...)` with only the status text. Existing UI uses a keyed status slot, so this was fixed to `ctx.ui.setStatus("megapowers", formatCompactContextStatus(summary))` and covered by `tests/hooks.test.ts:300-304`.
- `extensions/megapowers/context-summary.ts:70-82` originally could show stale TDD state for the wrong task. This was fixed by checking the current derived task id, with regression coverage for both mismatched and non-contiguous task ids in `tests/context-summary.test.ts:69-100`.
- `extensions/megapowers/context-summary.ts:96-119` originally summarized plan review with generic plan-phase `phase_next` guidance. This was fixed with mode-specific plan summaries and regression coverage in `tests/context-summary.test.ts:102-110`.

Rejected / non-blocking:

- Final Codex review noted that `extensions/megapowers/context-summary.ts` and related tests are untracked. The files are present and reviewed in the worktree; this is a VCS inclusion/checkpoint concern, not a source-code defect. They must be included with the feature changes.
- Final Codex review noted local `.pi/prompt-assembler/registry.json` churn with machine-specific tool registry paths. I agree it should not be part of the feature commit unless intentionally regenerated, but it is unrelated to the runtime feature code reviewed here and is classified as a minor repository-hygiene item below.

## Findings

### Critical

None.

### Important

None.

### Minor

1. **`.pi/prompt-assembler/registry.json:91` and `.pi/prompt-assembler/registry.json:1134` — local generated registry churn is still dirty.**
   - **What’s wrong:** The tracked registry file contains unrelated local tool-registry changes and machine-specific paths.
   - **Why it matters:** If accidentally committed, it could add noisy, non-portable configuration unrelated to this feature.
   - **How to fix:** Exclude/revert this generated registry churn before producing the final feature commit, unless it is intentionally regenerated and all referenced prompt/tool files are meant to be tracked.

## Recommendations

- Keep `context-summary.ts` as the single shared implementation for status and command reports; this is the right seam to prevent `/mega` and `/mp` drift.
- Before final commit packaging, verify all new source/test files are included and unrelated generated `.pi`/`.codegraph` churn is excluded.
- Consider a future small enhancement to show both task position and task id when they differ, e.g. `Current task: 2/2 (id 20)`, if non-contiguous task ids become common.

## Verification

- Focused RED runs exposed the review findings before fixes:
  - `bun test tests/context-summary.test.ts tests/hooks.test.ts` failed on status-slot signature and stale TDD-state reporting.
  - `bun test tests/context-summary.test.ts` failed on non-contiguous task-id matching and plan-review guidance.
- Focused post-fix suite passed: `bun test tests/context-summary.test.ts tests/hooks.test.ts tests/commands-context.test.ts tests/mp-command.test.ts` — `24 pass`, `0 fail`, `96 expect() calls`.
- Full post-fix verification passed: `bun test && bun run tsc --noEmit` — `807 pass`, `0 fail`, `1990 expect() calls`; type check completed successfully.
- `impact` with `changeType: "signature_change"` on `buildContextSummary`, `formatCompactContextStatus`, `renderContextReport`, `onBeforeAgentStart`, `handleMegaCommand`, and `createMpRegistry` found no dependent signature-break surface requiring updates.

## Assessment

ready

The feature implementation is cohesive, on-demand, and covered by meaningful mocked hook/command tests. Two correctness issues and one misleading guidance issue found during review were fixed with regression tests. Remaining concern is minor repository hygiene around unrelated generated registry churn, not a blocker for the runtime feature code.
