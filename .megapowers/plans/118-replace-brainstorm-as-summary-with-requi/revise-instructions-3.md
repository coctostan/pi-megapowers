## Task 1: Verify-and-patch brainstorm prompt requirements-capture contract

Step 2 now uses the correct test command, but the task still reads like it owns that verification coverage. In this repo, the coverage already exists in `tests/prompts.test.ts` under:
- `describe("prompt templates — #118 requirements artifacts contract", ...)`
- `getPhasePromptTemplate("brainstorm")`

Make Step 2 explicitly acknowledge that it is relying on **pre-existing prompt-contract tests** in `tests/prompts.test.ts`, not tests created by this task.

Replace the current Step 2 sentence with wording like:

```md
**Step 2 — Verify with pre-existing prompt-contract tests**
Run: `bun test tests/prompts.test.ts -t "#118 requirements artifacts contract"`
Expected: PASS — the pre-existing `#118` prompt-contract tests in `tests/prompts.test.ts` pass and validate brainstorm behavior via `getPhasePromptTemplate("brainstorm")` (mode triage, required sections, reduced-scope preservation, and `R/O/D/C/Q` buckets).
```

That fixes the current ambiguity about where the verification coverage comes from.

## Task 2: Verify-and-patch write-spec prompt traceability contract

Same issue as Task 1. Step 2 uses the correct Bun command, but it should explicitly say it depends on **pre-existing** `#118` prompt-contract coverage in `tests/prompts.test.ts` through `getPhasePromptTemplate("spec")`.

Replace the current Step 2 with wording like:

```md
**Step 2 — Verify with pre-existing prompt-contract tests**
Run: `bun test tests/prompts.test.ts -t "#118 requirements artifacts contract"`
Expected: PASS — the pre-existing `#118` prompt-contract tests in `tests/prompts.test.ts` pass and validate `getPhasePromptTemplate("spec")` assertions for `No silent drops`, `Requirement Traceability`, `every \`R#\` must appear exactly once`, legacy handling for older/unstructured brainstorm artifacts, and reduced-scope visibility.
```

## Task 3: Verify-and-patch brainstorm prompt contract tests

The task still has a broken control flow for the real current repo state.

Right now Step 1 says:
- if all four tests already exist, record that Step 1 was a no-op

But Step 2 still assumes a RED run after adding assertions. In the current repo, those four tests already exist in `tests/prompts.test.ts`, so the task needs an explicit no-op branch.

Add this branch immediately after the Step 1 code block:

```md
If all four tests already exist as above, record that Step 1 was a no-op, run `bun test tests/prompts.test.ts -t "#118 requirements artifacts contract"` once to confirm the existing coverage still passes, then skip Steps 2–4 and continue to Step 5.
```

Then make Steps 2–4 explicitly conditional on Step 1 adding or changing assertions. Use wording like:

```md
**Step 2 — Run focused test (RED only when Step 1 added or changed assertions)**
Run: `bun test tests/prompts.test.ts -t "#118 requirements artifacts contract"`
Expected (only when Step 1 added or changed assertions): FAIL with Bun matcher output naming the new assertion, e.g.:

```text
expect(received).toContain(expected)
Expected to contain: "Exploratory"
```
```

And in Step 3 add:

```md
If Step 1 was a no-op and the confirmation run already passed, do not modify `prompts/brainstorm.md`; proceed directly to Step 5.
```

And in Step 4 add:

```md
Skip this step when Step 1 was a no-op.
```

This keeps the task executable in both cases:
- current repo state: tests already exist → no-op path
- future drift state: assertions missing → real RED/GREEN path

## Task 4: Verify-and-patch spec prompt traceability contract tests

This has the same control-flow bug as Task 3.

Right now Step 1 allows a no-op when the three spec tests already exist, but Step 2 still assumes a RED run. In the current repo, those spec tests already exist in `tests/prompts.test.ts`, so the task needs the same explicit no-op branch.

Add this branch immediately after the Step 1 code block:

```md
If all three tests already exist as above, record that Step 1 was a no-op, run `bun test tests/prompts.test.ts -t "#118 requirements artifacts contract"` once to confirm the existing coverage still passes, then skip Steps 2–4 and continue to Step 5.
```

Then make Steps 2–4 explicitly conditional on Step 1 adding or changing assertions. Use wording like:

```md
**Step 2 — Run focused test (RED only when Step 1 added or changed assertions)**
Run: `bun test tests/prompts.test.ts -t "#118 requirements artifacts contract"`
Expected (only when Step 1 added or changed assertions): FAIL with Bun matcher output naming the new assertion, e.g.:

```text
expect(received).toContain(expected)
Expected to contain: "Requirement Traceability"
```
```

And in Step 3 add:

```md
If Step 1 was a no-op and the confirmation run already passed, do not modify `prompts/write-spec.md`; proceed directly to Step 5.
```

And in Step 4 add:

```md
Skip this step when Step 1 was a no-op.
```

Keep the real codebase references as-is:
- `tests/prompts.test.ts`
- `getPhasePromptTemplate("spec")`
- `prompts/write-spec.md`
- existing `describe("prompt templates — #118 requirements artifacts contract", ...)` block
