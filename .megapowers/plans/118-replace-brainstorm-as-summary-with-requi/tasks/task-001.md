---
id: 1
title: Verify-and-patch brainstorm prompt requirements-capture contract
status: approved
depends_on: []
no_test: true
files_to_modify:
  - prompts/brainstorm.md
files_to_create: []
---

### Task 1: Verify-and-patch brainstorm prompt requirements-capture contract [no-test]

**Covers:** AC 1 (mode triage), AC 2 (R/O/D/C/Q IDs), AC 3 (reduced-scope preserved), AC 4 (required sections), AC 12 (phase name unchanged).

**Justification:** prompt change only — verifies that the brainstorm prompt already contains the required contract and patches any missing elements. No runtime code paths change.
**Files:**
- Modify: `prompts/brainstorm.md`
**Step 1 — Verify existing content, patch only gaps**
Read `prompts/brainstorm.md` and check whether all required contract elements are already present:

- `## Start by triaging the mode` section with `Exploratory` and `Direct requirements` sub-headings
- Core rule section preserving every user-stated behavior as `R#`, `O#`, `D#`, `C#`, or `Q#`
- Language forbidding silently dropping concrete user requests
- Language saying scoped-down items must be preserved as optional (`O#`) or deferred (`D#`)
- Final-artifact structure with exactly these section headings in order: `## Goal`, `## Mode`, `## Must-Have Requirements`, `## Optional / Nice-to-Have`, `## Explicitly Deferred`, `## Constraints`, `## Open Questions`, `## Recommended Direction`, `## Testing Implications`
- Numbering rules defining `R1`, `O1`, `D1`, `C1`, `Q1` style IDs
- Before-saving checks confirming must-haves are not buried in prose and scoped-down items are preserved
- The external phase name remains `brainstorm` (no rename)

If all elements are present, make no content changes and record that verification passed. If any element is missing, add only the missing content while preserving existing structure.
**Step 2 — Verify with pre-existing prompt-contract tests**
Run: `bun test tests/prompts.test.ts -t "#118 requirements artifacts contract"`
Expected: PASS — the pre-existing `#118` prompt-contract tests in `tests/prompts.test.ts` pass and validate brainstorm behavior via `getPhasePromptTemplate("brainstorm")` (mode triage, required sections, reduced-scope preservation, and `R/O/D/C/Q` buckets).
