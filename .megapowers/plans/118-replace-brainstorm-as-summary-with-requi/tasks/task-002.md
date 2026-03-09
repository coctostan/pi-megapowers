---
id: 2
title: Verify-and-patch write-spec prompt traceability contract
status: approved
depends_on:
  - 1
no_test: true
files_to_modify:
  - prompts/write-spec.md
files_to_create: []
---

### Task 2: Verify-and-patch write-spec prompt traceability contract [no-test] [depends: 1]

**Covers:** AC 5 (Requirement Traceability section), AC 6 (no silent drops rule), AC 7 (O#/D#/C# in traceability), AC 8 (legacy handling), AC 9 (reduced-scope visibility), AC 12 (phase name unchanged).

**Justification:** prompt change only — verifies that the write-spec prompt already contains the required traceability contract and patches any missing elements. No runtime code paths change.
**Files:**
- Modify: `prompts/write-spec.md`
**Step 1 — Verify existing content, patch only gaps**
Read `prompts/write-spec.md` and check whether all required contract elements are already present:

- `## No silent drops` section stating every must-have requirement maps to exactly one of: Acceptance Criterion, Out of Scope, or Open Question
- Language that if a requirement does not become an acceptance criterion, the prompt shows exactly where it went
- Language that optional, deferred, and constraint items remain visible when they materially affect scope
- `## Legacy handling` section for older brainstorm artifacts that are prose-heavy/unstructured
- Legacy instructions: extract implied requirements first, present extraction to user for confirmation, then write spec
- `## Requirement Traceability` section with example mappings (`R1 -> AC 1`, `R3 -> Out of Scope`, etc.)
- Rules: every `R#` must appear exactly once, no `R#` may be omitted
- Before-saving checks saying reduced-scope items remain visible instead of disappearing
- Workflow wording uses `brainstorm` (not renamed)

If all elements are present, make no content changes and record that verification passed. If any element is missing, add only the missing content while preserving existing structure.
**Step 2 — Verify with pre-existing prompt-contract tests**
Run: `bun test tests/prompts.test.ts -t "#118 requirements artifacts contract"`
Expected: PASS — the pre-existing `#118` prompt-contract tests in `tests/prompts.test.ts` pass and validate `getPhasePromptTemplate("spec")` assertions for `No silent drops`, `Requirement Traceability`, `every \`R#\` must appear exactly once`, legacy handling for older/unstructured brainstorm artifacts, and reduced-scope visibility.
