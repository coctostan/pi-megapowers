# Plan overview — #130

## Decision

Preserve the current Pi session on all Megapowers transitions. This is a targeted compatibility repair, not an automatic handoff redesign. Workflow state, gates, TDD enforcement, result formatting, task completion, and plan-review artifacts stay intact. Context is refreshed from disk at the next agent start; no promise of prompt reinjection inside the existing run.

## Canonical task sequence

1. Preserve transition tool transcripts — adopt the existing failing reproduction, replace the unsafe wiring tests with a 56-fixture persistence matrix, remove both raw resets.
2. Remove signal session-reset instructions — depends on 1.
3. Remove review session-reset instructions — depends on 1.
4. Describe session-preserving transitions — depends on 1.
5. Document the current session policy — docs only, depends on 1–4.
6. Document compatibility smoke checks — docs only, depends on 1–5.

Structured tasks in tasks/task-001.md through task-006.md are canonical. Do not author an alternative plan.md during draft; review approval generates the compatible plan.md.

## Fixed When coverage

| Criterion | Tasks / verification |
| --- | --- |
| 1: no unsafe session-manager mutation/replacement | 1 removes both consumers; 2–3 remove obsolete producers; review and source search ensure no relocation |
| 2: every affected success path retains pairing | 1 matrix covers forward/backward phase changes, next/final task, draft/revise submissions, review approve/revise |
| 3: workflow behavior remains correct | 1 state/artifact/TDD/status assertions; 2–3 preserve handler logic; full existing domain/gate/artifact suites |
| 4: mixed batches and nested outer pairing | 1 direct, sibling-first, transition-first, nested layouts |
| 5: errors/non-reset tools keep behavior | 1 gate/TDD/review failures and tests_failed/tests_passed/close_issue controls; registration assertions and existing create-issue/batch/plan-task tests |
| 6: reproduction green and host smoke | 1 adopts reproduction unchanged; 2–3 replace obsolete flag expectations; 6 installed-manager smoke |
| 7: truthful context policy | 1 next-agent-start context assertion; 2–3 correct orchestrator tool-result next steps and assert current-session messages; 4 descriptions; 5 policy docs |
| 8: no restart after supported transitions | 6 isolated real-host/provider checks, recorded separately during verify |

## Grounding and probes performed

- Read all existing files scheduled for modification. Read actual registration/handler/interface/hook signatures, contracts, and artifact-versioning functions.
- Signature impact on SignalResult/PlanReviewResult had no indexed call edges; explicit search identified producer, wrapper, and related tests. Task 1 removes consumers before contract cleanup.
- Existing reproduction: both cases fail at expect(orphanedResults).toEqual([]).
- Metadata probes: actual signal and review results fail .not.toHaveProperty("triggerNewSession") with Received value: true.
- Description probe: expected preservation phrase is absent.
- All 56 matrix fixtures pass when only the fixture's storage reset is suppressed; production code was not changed.
- Documented real-installed-manager smoke was executed against current code and fails exactly with sessionIdChanged true and orphaned ["call_compatibility_smoke"], then Error: Session compatibility smoke failed.
- Full baseline: bun test reports 868 pass, 2 fail; the only failures are the two reproduction regressions. No unrelated baseline failure is being hidden.

## Pre-submit checklist

- [x] All eight Fixed When criteria mapped.
- [x] Task 1 adopts the existing reproduction rather than replacing its invariant.
- [x] Runtime tasks have complete test code and five TDD steps.
- [x] Expected failures were probed with actual Bun/handlers.
- [x] Implementation blocks are complete bodies copied from verified symbols with only planned changes.
- [x] Run commands match between RED and GREEN; every runtime task runs bun test for regressions.
- [x] All task paths exist except the explicitly new compatibility document.
- [x] Each task touches at most three files and depends only on earlier tasks.
- [x] No-test tasks are documentation-only with explicit verification.
- [x] No production code was changed during planning.

## Self-hosting checkpoints

Before the fix is loaded, plan_draft_done and plan-review verdicts themselves execute the known-broken live session-reset path. There is no inspected slash-command equivalent for draft submission; /phase next must not be used to bypass plan review. Preserve the plan artifacts, submit through the normal tool, and warn the user that a /new/restart may be needed afterward to recover the transcript. Review still must run and approve before implementation.

After implementing Task 1, ask the user to /reload BEFORE calling its first live task_done. Editing local source alone does not replace loaded callbacks. Once the fresh runtime has the corrected wrapper, subsequent transitions should preserve session history.

Live provider tests use disposable fixtures, never this issue workspace. Record unavailable credentials or provider/transport setup honestly rather than claiming provider PASS from offline checks.
