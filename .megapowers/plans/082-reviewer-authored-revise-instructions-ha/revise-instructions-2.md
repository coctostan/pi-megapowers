# Revise Instructions (Iteration 2)

These instructions are only for tasks that need revision.

## Task 4: Populate vars.revise_instructions from file when planMode is revise

### Step 2 (RED) is not specific enough
Your Step 2 currently describes *why* it fails, but it must include the **exact assertion failure text** Bun prints.

Update Step 2 to be concrete, e.g.:

```text
Run: bun test tests/prompt-inject.test.ts --filter "revise_instructions"
Expected: FAIL — expect(received).toContain(expected)
  Expected substring: "## Task 3: Fix test"
  Received string contains literal "{{revise_instructions}}" instead
```

(Depending on which assertion fires first, it may also be the negated assertion; that’s fine, but write the exact expect() failure form, not a narrative.)

### Step 1 (tests) — strengthen the AC2 assertion so it proves the empty-string fallback
Right now AC2 only asserts the token is gone, but doesn’t prove it was replaced with the empty string *in the expected location*.

After Task 1 lands, `prompts/revise-plan.md` will contain:

```md
## Reviewer's Instructions
{{revise_instructions}}

## Quality Bar
```

So when the file is missing, the rendered prompt should contain **the section header followed immediately by the next section**.

Update the AC2 test to assert this exact adjacency (this is stable given the prompt structure):

```ts
expect(result).toContain("## Reviewer's Instructions\n\n## Quality Bar");
expect(result).not.toContain("{{revise_instructions}}");
```

### Step 3 (implementation) — avoid non-null assertion and use the already-narrowed activeIssue
Inside `buildInjectedPrompt`, `state.activeIssue` is already narrowed to `string` after the early return.

Prefer:

```ts
const content = store.readPlanFile(state.activeIssue, filename);
```

instead of `state.activeIssue!`.

## Task 5: Gate revise verdict on revise-instructions file existence in handlePlanReview

### Step 2 (RED) is not specific enough
Like Task 4, Step 2 needs the exact failure form.

Before implementation, the new “missing file” test will fail because `result.error` is `undefined`.

Update Step 2 to something like:

```text
Run: bun test tests/tool-plan-review.test.ts --filter "revise-instructions file gate"
Expected: FAIL — expect(received).toBeDefined()
  Received: undefined
```

### Step 1 — be explicit about updating ALL existing revise-verdict tests
After adding the gate, every existing test that calls `handlePlanReview(... { verdict: "revise" })` must create the required file first, otherwise it will fail for the wrong reason.

In `tests/tool-plan-review.test.ts`, in the existing `describe("handlePlanReview — revise verdict", ...)` block, add this snippet **before** each call to `handlePlanReview` with `verdict: "revise"`:

```ts
const planDir = join(tmp, ".megapowers", "plans", "001-test");
mkdirSync(planDir, { recursive: true });
writeFileSync(join(planDir, `revise-instructions-${iteration}.md`), "Reviewer instructions");
```

- For the normal revise tests, `iteration = 1`.
- For the iteration-cap test, `iteration = 4`.

This ensures the tests stay focused on their original behavior (mode bump, status updates, cap error) rather than failing at the new gate.
