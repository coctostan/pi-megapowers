---
id: 1
title: Rewrite CHANGELOG line 9 to describe T0-only validation
status: approved
depends_on: []
no_test: true
files_to_modify:
  - .megapowers/CHANGELOG.md
files_to_create: []
---

**Justification:** Documentation-only change to a changelog file. No code behavior, no runtime paths depend on this content.

**Covers:** Fixed-When #1 (CHANGELOG line 9 no longer describes T1), Fixed-When #2 (T0 described as only validation layer), AC #1 (no T1 in active plan transition flow docs), AC #2 (T0 as only built-in pre-submit layer).

**Files:**
- Modify: `.megapowers/CHANGELOG.md`

**Step 1 — Make the change**

Replace line 9 in `.megapowers/CHANGELOG.md`:

**Current (line 9):**
```
- Two-tier plan validation: deterministic per-task lint (T0) in `megapowers_plan_task` catches empty titles, short descriptions, missing file targets, invalid `depends_on` refs, and duplicate `files_to_create` paths before saving; fast-model whole-plan lint (T1) in `plan_draft_done` checks spec coverage, dependency coherence, description quality, and file path plausibility before transitioning to review — both tiers fire before the expensive T2 deep-review session break (#092)
```

**Replacement:**
```
- Deterministic per-task plan validation in `megapowers_plan_task`: catches empty titles, short descriptions, missing file targets, invalid `depends_on` refs, and duplicate `files_to_create` paths before saving — the only built-in pre-submit validation layer (#092)
```

This removes all T1 and T2 references and describes only what currently ships (T0 deterministic lint). Lines 13-14 (the "Fixed" entries documenting T1 removal) are left unchanged — they're accurate historical entries for the release.

**Step 2 — Verify**

```bash
grep -n "T1" .megapowers/CHANGELOG.md
```

Expected: Only lines 13 and 14 match (the "Fixed" entries). Line 9 no longer matches. No other lines in the `[Unreleased]` `### Added` section reference T1.

```bash
grep -c "two-tier\|Two-tier" .megapowers/CHANGELOG.md
```

Expected: 0 matches (the "two-tier" framing is removed).
