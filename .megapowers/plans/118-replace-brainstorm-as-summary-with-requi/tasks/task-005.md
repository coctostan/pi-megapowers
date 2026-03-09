---
id: 5
title: Verify README and add CHANGELOG entry for brainstorm-to-spec model
status: approved
depends_on:
  - 1
  - 2
  - 3
  - 4
no_test: true
files_to_modify:
  - README.md
  - CHANGELOG.md
files_to_create: []
---

### Task 5: Verify README and add CHANGELOG entry for brainstorm-to-spec model [no-test] [depends: 1, 2, 3, 4]

**Covers:** AC 13 (README and CHANGELOG reflect the updated model), AC 12 (phase name unchanged — wording consistency).

**Justification:** documentation-only change — verifies existing README coverage and adds a missing CHANGELOG entry. No executable runtime behavior changes.

**Files:**
- Modify: `README.md`
- Modify: `CHANGELOG.md`

**Step 1 — Verify README, add CHANGELOG entry**

**README.md:** Read the file and verify it already contains:
- the `brainstorm` phase name is kept for compatibility
- explicit `R#`/`O#`/`D#`/`C#`/`Q#` requirement buckets
- `spec` distills requirements into acceptance criteria with traceability

If all elements are present, make no README changes. If any element is missing, patch only the gap.

**CHANGELOG.md:** Under the existing `## [Unreleased]` section, add a bullet under `### Changed` (or create that subsection if it doesn't exist for the current unreleased block):

```md
- **Brainstorm/spec requirements traceability contract** — Updated prompts and prompt-contract tests so `brainstorm` remains the external phase name while acting as structured requirements capture (`R#`/`O#`/`D#`/`C#`/`Q#`). `spec` now enforces `Requirement Traceability` + `No silent drops` (every `R#` mapped exactly once), including legacy handling for older unstructured brainstorm artifacts. (#118)
```

**Step 2 — Verify**
Run: `bash -lc 'grep -Fq "phase name is kept for compatibility" README.md && grep -Fq "preserve explicit requirements" README.md && grep -Fq "acceptance criteria with traceability" README.md && grep -Fq "No silent drops" CHANGELOG.md && grep -Fq "Requirement Traceability" CHANGELOG.md && grep -Fq "older unstructured brainstorm artifacts" CHANGELOG.md && grep -Fq "(#118)" CHANGELOG.md'`
Expected: exits 0, confirming README describes the requirements-first brainstorm/spec model and CHANGELOG has the #118 Unreleased entry.
