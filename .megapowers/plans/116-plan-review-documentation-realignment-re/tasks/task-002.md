---
id: 2
title: Update 095 design doc status and annotate completed T1 recovery
status: approved
depends_on: []
no_test: true
files_to_modify:
  - .megapowers/docs/095-subagent-assisted-plan-review-decomposition.md
files_to_create: []
---

**Justification:** Documentation-only change to a design document. No code behavior, no runtime paths depend on this content.

**Covers:** Fixed-When #2 (095 doc status updated and T1 references annotated), Fixed-When #3 (no new T1 references in active guidance), AC #1 (no T1 in active plan transition flow docs), AC #3 (subagent guidance framed as advisory/experimental).

**Files:**
- Modify: `.megapowers/docs/095-subagent-assisted-plan-review-decomposition.md`

**Step 1 — Make the change**

Apply these edits to `.megapowers/docs/095-subagent-assisted-plan-review-decomposition.md`:

### Edit 1: Update status (line 6)

**Current:**
```
**Status:** Proposed
```

**Replacement:**
```
**Status:** Immediate recovery complete (T1 removed via #110, #111); subagent-assisted planning shipped (#113, #114, #115)
```

### Edit 2: Annotate Problem Summary (line 12)

**Current:**
```
1. **T1 made plan review worse.** `plan_draft_done` now performs a hidden model-based lint before entering review mode. The reviewer prompt was also narrowed to assume earlier checks already handled fundamentals. In practice this creates false confidence, fail-open behavior, and muddier ownership.
```

**Replacement:**
```
1. **T1 made plan review worse.** ✅ *Resolved: T1 removed (#110), dead code deleted (#111), reviewer ownership restored.* `plan_draft_done` performed a hidden model-based lint before entering review mode. The reviewer prompt was narrowed to assume earlier checks already handled fundamentals. This created false confidence, fail-open behavior, and muddier ownership.
```

### Edit 3: Annotate Immediate recovery line (line 16)

**Current:**
```
- **Immediate recovery:** keep T0, remove T1, restore reviewer ownership.
```

**Replacement:**
```
- **Immediate recovery:** ✅ *Complete.* Kept T0, removed T1 (#110, #111), restored reviewer ownership (#096, #099, #100, #101).
```

### Edit 4: Annotate Immediate Goals (lines 22-25)

**Current:**
```
### Immediate
- Keep T0 deterministic validation in `megapowers_plan_task`
- Remove T1 model lint from `plan_draft_done`
- Restore full reviewer ownership of plan quality
- Improve plan/revise prompts to reduce context overload without hiding responsibility
```

**Replacement:**
```
### Immediate — ✅ Complete
- ✅ Keep T0 deterministic validation in `megapowers_plan_task`
- ✅ Remove T1 model lint from `plan_draft_done` (#110)
- ✅ Restore full reviewer ownership of plan quality (#110, #096)
- ✅ Improve plan/revise prompts to reduce context overload (#097, #098)
```

### Edit 5: Annotate Phase 1 header (line 64)

**Current:**
```
## Phase 1 — Immediate Recovery (Issue #094)
```

**Replacement:**
```
## Phase 1 — Immediate Recovery (Issue #094) — ✅ Complete
```

### Edit 6: Annotate rollout issue map — immediate recovery section (lines 260-267)

**Current:**
```
## Immediate recovery / prompt fixes
- **#096** — Restore full reviewer ownership in `prompts/review-plan.md`
- **#097** — Reduce plan drafting firehose in `prompts/write-plan.md`
- **#098** — Tighten `prompts/revise-plan.md` for narrow revisions + global sanity pass
- **#099** — Remove T1 model lint from `tool-signal.ts`
- **#100** — Remove T1 model wiring from `register-tools.ts`
- **#101** — Delete T1 module/prompt/tests and simplify transition coverage
- **#108** — Clean T1 references from docs/changelogs/guidance
```

**Replacement:**
```
## Immediate recovery / prompt fixes — ✅ Complete
- ✅ **#096** — Restore full reviewer ownership in `prompts/review-plan.md`
- ✅ **#097** — Reduce plan drafting firehose in `prompts/write-plan.md`
- ✅ **#098** — Tighten `prompts/revise-plan.md` for narrow revisions + global sanity pass
- ✅ **#099** — Remove T1 model lint from `tool-signal.ts` (shipped in #110)
- ✅ **#100** — Remove T1 model wiring from `register-tools.ts` (shipped in #110)
- ✅ **#101** — Delete T1 module/prompt/tests and simplify transition coverage (shipped in #111)
- ✅ **#108** — Clean T1 references from docs/changelogs/guidance (this issue)
```

### Edit 7: Annotate recommendation section (lines 302-306)

**Current:**
```
In short:
- **Keep T0**
- **Kill T1**
- **Restore reviewer responsibility**
- **Use subagents only as bounded planning advisors, never as hidden authorities**
```

**Replacement:**
```
In short (recovery actions now complete):
- ✅ **Kept T0** — deterministic per-task lint remains the only built-in pre-submit validation
- ✅ **Killed T1** — model lint gate removed (#110), dead code deleted (#111)
- ✅ **Restored reviewer responsibility** — reviewer owns the full verdict (#096, #110)
- **Use subagents only as bounded planning advisors, never as hidden authorities** — ongoing principle
```

**Step 2 — Verify**

```bash
grep -n "Status:" .megapowers/docs/095-subagent-assisted-plan-review-decomposition.md
```

Expected: Shows `Immediate recovery complete` instead of `Proposed`.

```bash
grep -c "✅" .megapowers/docs/095-subagent-assisted-plan-review-decomposition.md
```

Expected: Multiple matches showing completed annotations throughout.

Verify historical artifacts are untouched:
```bash
git diff --name-only .megapowers/docs/110-* .megapowers/docs/111-* .megapowers/docs/092-*
```

Expected: No output (no changes to historical bugfix summaries).
