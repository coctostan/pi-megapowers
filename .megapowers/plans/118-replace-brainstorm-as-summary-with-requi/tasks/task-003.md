---
id: 3
title: Verify-and-patch brainstorm prompt contract tests
status: approved
depends_on:
  - 1
no_test: true
files_to_modify:
  - tests/prompts.test.ts
  - prompts/brainstorm.md
files_to_create: []
---

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
