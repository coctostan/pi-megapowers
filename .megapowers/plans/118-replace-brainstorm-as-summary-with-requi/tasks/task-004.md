---
id: 4
title: Verify-and-patch spec prompt traceability contract tests
status: approved
depends_on:
  - 2
  - 3
no_test: true
files_to_modify:
  - tests/prompts.test.ts
  - prompts/write-spec.md
files_to_create: []
---

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
