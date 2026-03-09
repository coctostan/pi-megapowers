## Task 3: Verify-and-patch brainstorm prompt contract tests

The current task is not executable as a non-`[no-test]` TDD task in the real repo state.

Why it fails now:
- `tests/prompts.test.ts` already contains the four brainstorm assertions inside `describe("prompt templates — #118 requirements artifacts contract", ...)` at lines 456-483.
- Your Step 1 explicitly allows a no-op when those tests already exist.
- That means Steps 2-4 are skipped in the current repo, so the task never performs a real RED -> GREEN cycle.
- Because frontmatter still says `no_test: false`, this violates the plan quality bar for non-`[no-test]` tasks.

Fix this by converting Task 3 into an explicit verification task that relies on pre-existing coverage.

### Required metadata change
Update the task metadata with:
- `no_test: true`
- keep `depends_on: [1]`
- keep `files_to_modify: ["tests/prompts.test.ts", "prompts/brainstorm.md"]`

Use `megapowers_plan_task({ id: 3, no_test: true, depends_on: [1], files_to_modify: ["tests/prompts.test.ts", "prompts/brainstorm.md"] })`.

### Required body change
Replace the current 5-step TDD flow with a 2-step verify-and-patch flow, parallel to Tasks 1 and 2.

Step 1 should say to verify the existing assertions in `tests/prompts.test.ts` inside the existing describe block:

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

Then say:
- if all four assertions already exist, make no test changes and record that verification passed
- if any assertion is missing, add only the missing assertion(s) in that same describe block
- if a newly restored assertion exposes a real prompt gap, patch `prompts/brainstorm.md`

Step 2 should explicitly rely on the pre-existing `#118` prompt-contract tests:

```md
**Step 2 — Verify with pre-existing prompt-contract tests**
Run: `bun test tests/prompts.test.ts -t "#118 requirements artifacts contract"`
Expected: PASS — the pre-existing `#118` prompt-contract tests in `tests/prompts.test.ts` pass and validate brainstorm behavior via `getPhasePromptTemplate("brainstorm")` (mode triage, required sections, reduced-scope preservation, and `R/O/D/C/Q` buckets).
```

Also update the task title/body to make it clear this is a verification/patch task, not a new-test TDD task.

## Task 4: Verify-and-patch spec prompt traceability contract tests

This has the same problem as Task 3.

Why it fails now:
- `tests/prompts.test.ts` already contains the three spec assertions inside `describe("prompt templates — #118 requirements artifacts contract", ...)` at lines 484-499.
- Step 1 allows a no-op when they already exist.
- In the current repo, that means no RED -> GREEN cycle occurs, but frontmatter still says `no_test: false`.

Fix this by converting Task 4 into an explicit verification task that relies on pre-existing coverage.

### Required metadata change
Update the task metadata with:
- `no_test: true`
- keep `depends_on: [2, 3]`
- keep `files_to_modify: ["tests/prompts.test.ts", "prompts/write-spec.md"]`

Use `megapowers_plan_task({ id: 4, no_test: true, depends_on: [2, 3], files_to_modify: ["tests/prompts.test.ts", "prompts/write-spec.md"] })`.

### Required body change
Replace the current 5-step TDD flow with a 2-step verify-and-patch flow.

Step 1 should say to verify these existing assertions in `tests/prompts.test.ts`:

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

Then say:
- if all three assertions already exist, make no test changes and record that verification passed
- if any assertion is missing, add only the missing assertion(s) in that same describe block
- if a restored assertion exposes a real prompt gap, patch `prompts/write-spec.md`

Step 2 should be:

```md
**Step 2 — Verify with pre-existing prompt-contract tests**
Run: `bun test tests/prompts.test.ts -t "#118 requirements artifacts contract"`
Expected: PASS — the pre-existing `#118` prompt-contract tests in `tests/prompts.test.ts` pass and validate `getPhasePromptTemplate("spec")` assertions for `No silent drops`, `Requirement Traceability`, `every `R#` must appear exactly once`, legacy handling for older/unstructured brainstorm artifacts, and reduced-scope visibility.
```

As with Task 3, make it explicit that this is a verify/patch task over pre-existing test coverage, not a fresh RED/GREEN task.

## Task 5: Verify README and add CHANGELOG entry for brainstorm-to-spec model

The current Step 2 verification command is inconsistent with Step 1 and with the actual README content.

What is wrong now:
- `README.md` currently contains this sentence at line 23:
  - `the \`brainstorm\` phase name is kept for compatibility, but it now serves as discovery + requirements gathering...`
- Your Step 2 command searches for the literal text `brainstorm phase name is kept for compatibility` without backticks, which does **not** match the current README.
- Your Step 2 command also searches for `Requirement Traceability` in `README.md`, but Step 1 only requires README to say that `spec` distills requirements into acceptance criteria with traceability. Those are not the same string.
- Result: Step 1 can conclude “no README changes needed”, but Step 2 would still fail. That makes the task internally inconsistent.

### Required metadata change
Add dependencies on the test-verification tasks before documenting the shipped model:
- `depends_on: [1, 2, 3, 4]`

Use:
`megapowers_plan_task({ id: 5, depends_on: [1, 2, 3, 4], files_to_modify: ["README.md", "CHANGELOG.md"] })`

### Required body change
Keep the existing Step 1 intent, but make Step 2 verify the same semantics that Step 1 asks for.

Replace the current Step 2 command with something that matches the actual README phrasing and the exact CHANGELOG bullet you ask the implementer to add. For example:

```md
**Step 2 — Verify**
Run: `bash -lc 'grep -Eq "phase name is kept for compatibility" README.md && grep -Eq "R#`/`O#`/`D#`/`C#`/`Q#" README.md && grep -Eq "acceptance criteria with traceability" README.md && grep -q "No silent drops" CHANGELOG.md && grep -q "Requirement Traceability" CHANGELOG.md && grep -q "older unstructured brainstorm artifacts" CHANGELOG.md && grep -q "(#118)" CHANGELOG.md'`
Expected: exits 0, confirming README describes the requirements-first brainstorm/spec model and CHANGELOG has the #118 Unreleased entry.
```

If you prefer to keep `grep -q` instead of `grep -Eq`, then update Step 1 so it explicitly requires those exact literal strings in README. Right now it does not.

Do not leave Task 5 in its current state where Step 1 can pass and Step 2 can still deterministically fail on the unchanged README.