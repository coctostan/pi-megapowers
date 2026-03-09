## Task 1: Verify-and-patch brainstorm prompt requirements-capture contract

Step 2 is too brittle. It uses a long chained `grep` command against `prompts/brainstorm.md`, but this repo already has focused prompt-contract tests in `tests/prompts.test.ts` under:
- `describe("prompt templates — #118 requirements artifacts contract", ...)`
- `it("brainstorm prompt includes Exploratory and Direct requirements modes", ...)`
- `it("brainstorm prompt includes required requirement sections", ...)`
- `it("brainstorm prompt preserves reduced scope instead of dropping it", ...)`
- `it("brainstorm prompt includes R/O/D/C/Q requirement ID buckets", ...)`

Replace Step 2 with the actual verification command that exercises `getPhasePromptTemplate("brainstorm")` through the real test file:

```bash
bun test tests/prompts.test.ts -t "#118 requirements artifacts contract"
```

Update the expected result text to say this focused prompt-contract test passes and validates the brainstorm prompt behavior, instead of saying only that `grep` exited 0.

Keep Step 1 as verify-and-patch on `prompts/brainstorm.md`; that part is correct.

## Task 2: Verify-and-patch write-spec prompt traceability contract

Step 2 has the same problem as Task 1: it verifies prompt content with a fragile chained `grep` instead of the real prompt-contract tests that already exist in `tests/prompts.test.ts`.

Replace Step 2 with:

```bash
bun test tests/prompts.test.ts -t "#118 requirements artifacts contract"
```

The expected result should explicitly say this command validates the `getPhasePromptTemplate("spec")` assertions for:
- `No silent drops`
- `Requirement Traceability`
- `every \`R#\` must appear exactly once`
- legacy handling for older/unstructured brainstorm artifacts
- reduced-scope visibility

Keep Step 1 as verify-and-patch on `prompts/write-spec.md`; that part is correct.

## Task 3: Verify-and-patch brainstorm prompt contract tests

This task modifies `tests/prompts.test.ts`, so `no_test: true` is not acceptable. Change the task metadata to require testing (`no_test: false`, or remove the `no_test` flag if your plan format treats absence as false).

Also rewrite the task to use a full 5-step TDD flow. The current task only has Step 1 and Step 2.

Use the actual codebase API and existing test block:
- file: `tests/prompts.test.ts`
- describe block: `describe("prompt templates — #118 requirements artifacts contract", ...)`
- API: `getPhasePromptTemplate("brainstorm")`

Be explicit that the task must patch the existing tests instead of creating duplicate names. The existing brainstorm test names are:
- `brainstorm prompt includes Exploratory and Direct requirements modes`
- `brainstorm prompt includes required requirement sections`
- `brainstorm prompt preserves reduced scope instead of dropping it`
- `brainstorm prompt includes R/O/D/C/Q requirement ID buckets`

Revise the steps to this shape:

1. **Step 1 — Add or adjust the missing brainstorm assertions in the existing `#118` block** using `getPhasePromptTemplate("brainstorm")`; do not create duplicate `it(...)` names.
2. **Step 2 — Run the focused test expecting FAIL**:
   ```bash
   bun test tests/prompts.test.ts -t "#118 requirements artifacts contract"
   ```
   The expected failure text must mention the newly added assertion(s), e.g. a Bun matcher failure such as `expect(received).toContain("Exploratory")` or the relevant regex mismatch.
3. **Step 3 — Patch the production prompt if the new assertion exposed a real gap** in `prompts/brainstorm.md`; otherwise state that no prompt patch was needed because the prompt already satisfied the contract.
4. **Step 4 — Re-run the same focused command expecting PASS**:
   ```bash
   bun test tests/prompts.test.ts -t "#118 requirements artifacts contract"
   ```
5. **Step 5 — Run the project test suite**:
   ```bash
   bun test
   ```
   Expected: all tests pass.

If current repo state already contains all four brainstorm tests, say so explicitly in Step 1 and instruct the implementer to patch only missing assertions rather than re-adding these cases.

## Task 4: Verify-and-patch spec prompt traceability contract tests

This task also modifies `tests/prompts.test.ts`, so `no_test: true` is not acceptable. Change the task metadata to require testing (`no_test: false`, or remove the `no_test` flag if your plan format treats absence as false).

Like Task 3, rewrite it to a full 5-step TDD flow. The current task only has Step 1 and Step 2.

Use the actual codebase API and existing test block:
- file: `tests/prompts.test.ts`
- same describe block: `describe("prompt templates — #118 requirements artifacts contract", ...)`
- API: `getPhasePromptTemplate("spec")`

Be explicit that this task must patch the existing spec tests instead of creating duplicates. The existing spec test names are:
- `write-spec prompt includes no-silent-drops and traceability requirements`
- `write-spec prompt includes legacy handling for older unstructured brainstorm artifacts`
- `write-spec prompt says reduced-scope items remain visible`

Revise the steps to this shape:

1. **Step 1 — Add or adjust the missing spec assertions in the existing `#118` block** using `getPhasePromptTemplate("spec")`; do not create duplicate `it(...)` names and do not create a new `describe(...)` block.
2. **Step 2 — Run the focused test expecting FAIL**:
   ```bash
   bun test tests/prompts.test.ts -t "#118 requirements artifacts contract"
   ```
   The expected failure text must mention the newly added assertion(s), e.g. missing `No silent drops`, missing `Requirement Traceability`, or the relevant regex mismatch for legacy/reduced-scope language.
3. **Step 3 — Patch `prompts/write-spec.md` if the new assertion exposed a real prompt gap**; otherwise state that no prompt patch was needed because the prompt already satisfied the contract.
4. **Step 4 — Re-run the same focused command expecting PASS**:
   ```bash
   bun test tests/prompts.test.ts -t "#118 requirements artifacts contract"
   ```
5. **Step 5 — Run the full suite**:
   ```bash
   bun test
   ```
   Expected: all tests pass.

Keep the existing dependencies:

```yaml
depends_on:
  - 2
  - 3
```

Those are correct because Task 4 depends on the spec prompt work from Task 2 and shares `tests/prompts.test.ts` with Task 3.