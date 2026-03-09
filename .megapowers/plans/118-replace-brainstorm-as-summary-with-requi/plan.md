# Plan

### Task 1: Verify-and-patch brainstorm prompt requirements-capture contract [no-test]

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

### Task 2: Verify-and-patch write-spec prompt traceability contract [no-test] [depends: 1]

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

### Task 3: Verify-and-patch brainstorm prompt contract tests [no-test] [depends: 1]

### Task 3: Verify-and-patch brainstorm prompt contract tests [no-test] [depends: 1]

**Covers:** AC 10 (prompt tests lock brainstorm contract: mode triage, required sections, `R/O/D/C/Q` ID buckets, scope-preservation language).

**Justification:** verification/patch task over pre-existing prompt-contract tests — the `#118` brainstorm assertions already exist in `tests/prompts.test.ts`, so this task verifies that coverage remains present and only patches missing assertions or prompt gaps if drift is found. No new runtime behavior is introduced.

**Files:**
- Modify: `tests/prompts.test.ts`
- Modify (only if a missing/restored assertion exposes a real gap): `prompts/brainstorm.md`

**Step 1 — Verify existing brainstorm assertions, patch only drift**
Read `tests/prompts.test.ts` and verify the existing `describe("prompt templates — #118 requirements artifacts contract", ...)` block still contains these assertions using `getPhasePromptTemplate("brainstorm")`:

```ts
it("brainstorm prompt includes Exploratory and Direct requirements modes", () => {
  const template = getPhasePromptTemplate("brainstorm");
  expect(template).toContain("Exploratory");
  expect(template).toContain("Direct requirements");
});

it("brainstorm prompt includes required requirement sections", () => {
  const template = getPhasePromptTemplate("brainstorm");
  expect(template).toContain("Must-Have Requirements");
  expect(template).toContain("Optional / Nice-to-Have");
  expect(template).toContain("Explicitly Deferred");
  expect(template).toContain("Constraints");
  expect(template).toContain("Open Questions");
});

it("brainstorm prompt preserves reduced scope instead of dropping it", () => {
  const template = getPhasePromptTemplate("brainstorm");
  expect(template).toMatch(/if scope is reduced|scoped-down items/i);
  expect(template).toMatch(/preserve|rather than letting it disappear|do not silently drop/i);
});

it("brainstorm prompt includes R/O/D/C/Q requirement ID buckets", () => {
  const template = getPhasePromptTemplate("brainstorm");
  expect(template).toContain("R#");
  expect(template).toContain("O#");
  expect(template).toContain("D#");
  expect(template).toContain("C#");
  expect(template).toContain("Q#");
});
```

If all four assertions already exist, make no test changes and record that verification passed. If any assertion is missing, add only the missing assertion(s) in that same `#118` describe block. If a restored assertion exposes a real gap in `prompts/brainstorm.md`, patch only the missing prompt language.

**Step 2 — Verify with pre-existing prompt-contract tests**
Run: `bun test tests/prompts.test.ts -t "#118 requirements artifacts contract"`
Expected: PASS — the pre-existing `#118` prompt-contract tests in `tests/prompts.test.ts` pass and validate brainstorm behavior via `getPhasePromptTemplate("brainstorm")` (mode triage, required sections, reduced-scope preservation, and `R/O/D/C/Q` buckets).

### Task 4: Verify-and-patch spec prompt traceability contract tests [no-test] [depends: 2, 3]

### Task 4: Verify-and-patch spec prompt traceability contract tests [no-test] [depends: 2, 3]

**Covers:** AC 11 (prompt tests lock spec contract: `No silent drops`, `Requirement Traceability`, every `R#` exactly once, legacy handling, reduced-scope visibility).

**Justification:** verification/patch task over pre-existing prompt-contract tests — the `#118` spec assertions already exist in `tests/prompts.test.ts`, so this task verifies that coverage remains present and only patches missing assertions or prompt gaps if drift is found. No new runtime behavior is introduced.

**Files:**
- Modify: `tests/prompts.test.ts`
- Modify (only if a missing/restored assertion exposes a real gap): `prompts/write-spec.md`

**Step 1 — Verify existing spec assertions, patch only drift**
Read `tests/prompts.test.ts` and verify the existing `describe("prompt templates — #118 requirements artifacts contract", ...)` block still contains these assertions using `getPhasePromptTemplate("spec")`:

```ts
it("write-spec prompt includes no-silent-drops and traceability requirements", () => {
  const template = getPhasePromptTemplate("spec");
  expect(template).toContain("No silent drops");
  expect(template).toContain("Requirement Traceability");
  expect(template).toContain("every `R#` must appear exactly once");
});

it("write-spec prompt includes legacy handling for older unstructured brainstorm artifacts", () => {
  const template = getPhasePromptTemplate("spec");
  expect(template).toMatch(/older brainstorm artifacts|prior artifact is unstructured/i);
  expect(template).toMatch(/R# \/ O# \/ D# \/ C# \/ Q#|extract the implied requirements/i);
});

it("write-spec prompt says reduced-scope items remain visible", () => {
  const template = getPhasePromptTemplate("spec");
  expect(template).toMatch(/reduced-scope|reduced scope/i);
  expect(template).toMatch(/remain visible|instead of disappearing|do not silently lose/i);
});
```

If all three assertions already exist, make no test changes and record that verification passed. If any assertion is missing, add only the missing assertion(s) in that same `#118` describe block. If a restored assertion exposes a real gap in `prompts/write-spec.md`, patch only the missing prompt language.

**Step 2 — Verify with pre-existing prompt-contract tests**
Run: `bun test tests/prompts.test.ts -t "#118 requirements artifacts contract"`
Expected: PASS — the pre-existing `#118` prompt-contract tests in `tests/prompts.test.ts` pass and validate `getPhasePromptTemplate("spec")` assertions for `No silent drops`, `Requirement Traceability`, `every `R#` must appear exactly once`, legacy handling for older/unstructured brainstorm artifacts, and reduced-scope visibility.

### Task 5: Verify README and add CHANGELOG entry for brainstorm-to-spec model [no-test] [depends: 1, 2, 3, 4]

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
