# Feature: Brainstorm/Spec Requirements Traceability Contract (#118)

## Summary

Replaced the `brainstorm` phase's prose-summary model with structured requirements capture, and made `spec` writing a traceable distillation of those requirements. Concrete user-stated behaviors, scope boundaries, and deferrals can no longer be silently lost between phases.

The `brainstorm` phase name is unchanged for external compatibility — the change is purely to what the phase produces and how `spec` consumes it.

---

## Problem

The old `brainstorm.md` prompt produced a freeform design summary (Approach / Key Decisions / Components / Testing Strategy). There was no requirement to track individual user-stated behaviors as discrete items, no mechanism to preserve scoped-down or deferred ideas, and no expectation that `spec` would trace back to specific brainstorm outputs. Requirements could — and often did — disappear silently between `brainstorm` and `spec`.

---

## What Changed

### `prompts/brainstorm.md` — full rewrite

| Before | After |
|--------|-------|
| Open-ended design discussion → freeform summary | Mode triage first: **Exploratory** vs **Direct requirements** |
| No requirement IDs | Explicit `R#` / `O#` / `D#` / `C#` / `Q#` buckets |
| No preservation rule for scoped-down items | "If scope is reduced, preserve the removed item explicitly as optional or deferred rather than letting it disappear" |
| Artifact sections: Approach / Key Decisions / Components / Testing Strategy | Artifact sections: Goal / Mode / Must-Have Requirements / Optional / Nice-to-Have / Explicitly Deferred / Constraints / Open Questions / Recommended Direction / Testing Implications |
| No before-saving checklist | Explicit checklist: must-haves not buried in prose, scoped-down items still preserved |

### `prompts/write-spec.md` — full rewrite

| Before | After |
|--------|-------|
| "Convert brainstorm design into acceptance criteria" | "Convert requirements artifact into testable contract **without silently losing requirements**" |
| No requirement traceability | `## Requirement Traceability` section: every `R#` must map exactly once to AC / Out of Scope / Open Question |
| No explicit no-drop rule | `## No silent drops`: no `R#` may be omitted |
| No legacy handling | `## Legacy handling`: for older prose-heavy artifacts, extract implied requirements → confirm with user → write spec |
| No reduced-scope visibility requirement | "reduced-scope items remain visible instead of disappearing" |

### `tests/prompts.test.ts` — 7 new tests

New `describe("prompt templates — #118 requirements artifacts contract", ...)` block locks both contracts against prompt drift:

- **Brainstorm (4 tests):** mode triage strings, all required section headings, scope-preservation language, R/O/D/C/Q buckets
- **Spec (3 tests):** No silent drops + Requirement Traceability + every-R# rule, legacy handling for older/unstructured artifacts, reduced-scope visibility

### `README.md` — 2 sentences

Added a note under the feature workflow explaining that `brainstorm` now acts as requirements capture and `spec` enforces traceability.

### `CHANGELOG.md` — 1 entry

Added #118 bullet to `## [Unreleased] / ### Changed`.

---

## Files Changed

```
prompts/brainstorm.md     — full rewrite (174 lines, +130/-68 net)
prompts/write-spec.md     — full rewrite (140 lines, +107/-32 net)
tests/prompts.test.ts     — +47 lines (7 new tests)
README.md                 — +3 lines (2 sentences + blank line fix)
CHANGELOG.md              — +1 line
```

No runtime code paths were changed. No schema migrations. No breaking changes.

---

## Backward Compatibility

- The external phase name `brainstorm` is unchanged everywhere (type definition, workflow breadcrumbs, README, UI).
- The `## Legacy handling` section in `write-spec.md` explicitly covers older unstructured brainstorm artifacts that predate this change — users are not required to rewrite existing artifacts.

---

## Test Results

```
bun test
923 pass, 0 fail — 93 files

bun test tests/prompts.test.ts -t "#118 requirements artifacts contract"
7 pass, 0 fail — 1 file
```
