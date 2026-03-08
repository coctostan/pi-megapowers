# Diagnosis

## Root Cause

Documentation drift from incremental changelog authoring. When T1 was removed (#110, #111), new "Fixed" entries were appended to `.megapowers/CHANGELOG.md` but the original "Added" entry from #092 (line 9) was not updated. Similarly, the design document `095-subagent-assisted-plan-review-decomposition.md` was never updated to reflect that the recovery slice (T1 removal) was completed — its status still reads `Proposed` and its language frames T1 removal as pending work.

This is not a code bug — it's a process gap: the done-phase `write-changelog` action appends new entries but doesn't reconcile with prior entries in the same unreleased block that describe features later reversed.

## Trace

1. **Symptom:** `.megapowers/CHANGELOG.md` line 9 describes T1 as an "Added" feature in `[Unreleased]`
2. **Same file, lines 13-14:** "Fixed" entries document T1's removal (#110, #111)
3. **Git history:** T1 added in commit `6dabbd9` (#092), removed in `0ec65b9` (#110) + `eee2a26` (#111)
4. **Root:** Commits #110 and #111 appended "Fixed" entries but did not update or remove the original line 9 "Added" entry. The changelog now both adds and removes T1 within the same `[Unreleased]` section.
5. **Design doc:** `095-subagent-assisted-plan-review-decomposition.md` was written before recovery work began. It was never revisited post-completion. Status is still `Proposed`, and language like "Remove T1 model lint" reads as pending action items.

## Affected Files

### File 1: `.megapowers/CHANGELOG.md`
- **Line 9** (`### Added`): Describes "Two-tier plan validation" including T1 as a current feature. Should be rewritten to describe only T0 (deterministic per-task lint), since T1 was removed.
- **Lines 13-14** (`### Fixed`): Correctly document T1's removal. These should stay as-is — they're accurate historical entries for the release.

### File 2: `.megapowers/docs/095-subagent-assisted-plan-review-decomposition.md`
- **Line 6:** `Status: Proposed` → should reflect that the immediate recovery slice is complete
- **9 T1 references** across problem statement, goals, non-goals, rollout map, and recommendations — all frame T1 removal as pending work rather than completed

## Pattern Analysis

### Working example: prompts/review-plan.md
Already updated in #110 to use advisory-only language. No T1/T0-authoritative claims. The `prompt-inject.test.ts` enforces this.

### Working example: AGENTS.md
No T1/T0 references. Describes plan-loop accurately.

### Broken pattern
The changelog and design doc were not part of the same update pass. The code + prompts were updated (#110, #111), but the surrounding documentation wasn't included in that scope — it was explicitly deferred to #108 (this issue).

## Risk Assessment

**Very low risk.** Both changes are documentation-only edits to markdown files:
- No code paths depend on `.megapowers/CHANGELOG.md` content
- No code paths depend on `.megapowers/docs/095-*.md` content
- No tests reference these files' content (the `prompt-inject.test.ts` tests are for `prompts/review-plan.md`, which is already clean)
- Historical bugfix summaries (`110-*`, `111-*`, `092-*`) are explicitly acceptable as-is per AC #4

## Fixed When

1. `.megapowers/CHANGELOG.md` line 9 no longer describes T1 as part of the active system — rewritten to describe T0-only validation
2. `.megapowers/docs/095-subagent-assisted-plan-review-decomposition.md` status updated and T1 references annotated to reflect completed recovery
3. No new T1 references introduced in active guidance files
4. Historical artifacts (bugfix summaries, closed issues) left untouched
