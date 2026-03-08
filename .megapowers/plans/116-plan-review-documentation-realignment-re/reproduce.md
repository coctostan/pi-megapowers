# Reproduction: T1 references persist in active documentation after T1 removal

## Steps to Reproduce
1. Read `.megapowers/CHANGELOG.md` — the `[Unreleased]` section
2. Read `.megapowers/docs/095-subagent-assisted-plan-review-decomposition.md` — the active design document
3. Search all `.md` files for `T1` references

## Expected Behavior
Per acceptance criteria:
1. User-facing docs should not describe T1 as part of the active plan transition flow
2. Docs should consistently describe T0 as the only built-in pre-submit validation layer
3. Subagent-assisted planning guidance should be framed as advisory/experimental, not a hidden gate
4. Historical shipped docs can stay as historical artifacts

## Actual Behavior
Two active documentation files still contain stale T1 references that describe it as part of the current system:

### 1. `.megapowers/CHANGELOG.md` line 9 — T1 described as an active "Added" feature

Under `## [Unreleased] / ### Added`:
```
- Two-tier plan validation: deterministic per-task lint (T0) in `megapowers_plan_task` catches empty titles, short descriptions, missing file targets, invalid `depends_on` refs, and duplicate `files_to_create` paths before saving; fast-model whole-plan lint (T1) in `plan_draft_done` checks spec coverage, dependency coherence, description quality, and file path plausibility before transitioning to review — both tiers fire before the expensive T2 deep-review session break (#092)
```

This line presents T1 as a currently-shipped feature. The same `[Unreleased]` section later documents T1's removal under `### Fixed` (lines 13-14), creating a contradictory narrative within the same release block. A reader sees T1 described as "Added" and then "Removed" in the same unreleased version.

Lines 13-14 (the removal entries) are correct historical records and should stay:
```
- Restore full reviewer ownership: removed T1 model lint gate from `handlePlanDraftDone()` (#110)
- Remove T1 dead code: deleted `plan-lint-model.ts`, `lint-plan-prompt.md`, and `plan-lint-model.test.ts` (#111)
```

### 2. `.megapowers/docs/095-subagent-assisted-plan-review-decomposition.md` — Active design doc with 9 T1 references

This document has `Status: Proposed` and is referenced by 16 other files as active design guidance. It contains 9 T1 references across:
- Problem description (line 12): "T1 made plan review worse"
- Recovery guidance (line 16): "keep T0, remove T1, restore reviewer ownership"
- Goals (line 23): "Remove T1 model lint from `plan_draft_done`"
- Non-goals (line 37): "No hidden model gate replacing T1 with a different name"
- Rollout issue map (lines 264-267): T1-related issues listed
- Recommendation (line 304): "Kill T1"

While this document was written before T1 was removed, it still reads as if T1 removal is a pending action. It should be updated to reflect that the recovery slice is complete.

## Files That Are Clean (No Action Needed)
- `README.md` — no T1/T0 references ✓
- `CHANGELOG.md` (root) — no T1/T0 references ✓
- `AGENTS.md` — clean ✓
- `prompts/review-plan.md` — already uses advisory-only language ✓
- All other prompt templates — clean ✓
- `.megapowers/init/megapowers/06-conventions.md` — false positive (date string `T00:48:02`) ✓

## Files That Are Historical Artifacts (Acceptable per AC #4)
- `.megapowers/docs/110-plan-review-recovery-disable-t1-authorit.md` — bugfix summary (14 T1 refs)
- `.megapowers/docs/092-two-tier-plan-validation-deterministic-l.md` — bugfix summary (8 T1 refs)
- `.megapowers/docs/111-plan-review-recovery-remove-t1-dead-code.md` — bugfix summary (4 T1 refs)
- `.megapowers/issues/094-*`, `099-*`, `100-*`, `101-*`, `108-*` — issue files (historical)

## Evidence

### grep for T1 in active docs
```
$ grep -n "T1" .megapowers/CHANGELOG.md
9:- Two-tier plan validation: ...fast-model whole-plan lint (T1)...
13:- Restore full reviewer ownership: removed T1 model lint gate...
14:- Remove T1 dead code: deleted `plan-lint-model.ts`...
```

```
$ grep -c "T1" .megapowers/docs/095-subagent-assisted-plan-review-decomposition.md
9
```

### Total scope: 100 matches across 26 .md files
Most are in historical artifacts (issue files, bugfix summaries). Only 2 files need correction:
1. `.megapowers/CHANGELOG.md` — line 9 (rewrite to reflect current state: T0 only)
2. `.megapowers/docs/095-subagent-assisted-plan-review-decomposition.md` — update status and T1 references to reflect completed recovery

## Environment
- Project: pi-megapowers
- Test runner: `bun test`
- All 823+ tests passing (no code changes needed — this is purely a documentation issue)

## Failing Test
Not feasible — this is a documentation-only bug. There are no code paths to test. The existing `prompt-inject.test.ts` already asserts that the review-plan prompt uses advisory-only wording and doesn't contain T0/T1-authoritative claims — that test passes because the prompt was already fixed.

## Reproducibility
Always — the stale text is present on disk and visible to any reader.
