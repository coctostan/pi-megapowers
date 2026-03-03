# Revise Instructions — Iteration 1

These revisions are required before this plan can be approved.

## Task 4: Populate vars.revise_instructions from file when planMode is revise

### Problem 1 — AC3 is not actually tested
Your current AC3 test:
- runs in `planMode: "draft"`, but `buildInjectedPrompt()` loads `write-plan.md` in draft mode
- `write-plan.md` does **not** contain `{{revise_instructions}}`

So the test `expect(result).not.toContain("SHOULD_NOT_APPEAR")` would pass even if `vars.revise_instructions` were incorrectly populated.

### Fix — Replace the AC3 test with a readPlanFile call assertion
Add a test that asserts `buildInjectedPrompt()` does **not** attempt to read any `revise-instructions-*.md` file when `planMode === "draft"`.

Use the real store, but wrap `readPlanFile` to record calls:

```ts
it("does not read revise-instructions-* files when planMode is draft (AC3)", () => {
  setState(tmp, { phase: "plan", planMode: "draft", planIteration: 1, megaEnabled: true });
  const store = createStore(tmp);

  const calls: string[] = [];
  const original = store.readPlanFile.bind(store);
  (store as any).readPlanFile = (slug: string, filename: string) => {
    calls.push(filename);
    return original(slug, filename);
  };

  buildInjectedPrompt(tmp, store);

  expect(calls.some(f => f.startsWith("revise-instructions-"))).toBe(false);
});
```

This is a direct, reliable assertion that `vars.revise_instructions` is not populated via file-read in draft mode.

### Problem 2 — Implementation should not require `store` to clear the template var
Right now you only set `vars.revise_instructions` when `store` is present. However, `interpolatePrompt()` leaves unknown vars as the literal `{{revise_instructions}}`.

To satisfy AC2 robustly (and avoid leaking the raw template token), set an empty-string default whenever `planMode === "revise"`, then overwrite from file if the store read succeeds.

### Fix — Adjust implementation block
Replace your proposed block with this structure:

```ts
// Plan phase: inject plan_iteration and revise_instructions (AC1-4)
if (state.phase === "plan") {
  vars.plan_iteration = String(state.planIteration);

  if (state.planMode === "revise") {
    // AC2 default: ensure template var is always replaced
    vars.revise_instructions = "";

    if (store) {
      const filename = `revise-instructions-${state.planIteration - 1}.md`;
      const content = store.readPlanFile(state.activeIssue!, filename);
      vars.revise_instructions = content ?? "";
    }
  }
}
```

(Keep the iteration math explanation in the task body — it’s correct.)

## Task 5: Gate revise verdict on revise-instructions file existence in handlePlanReview

### Problem 1 — AC6 requires *full path* in the error, but the plan doesn’t include it
The acceptance criteria require the error message to include:
- the expected filename (e.g. `revise-instructions-1.md`)
- the **full path** to that file (e.g. `/tmp/.../.megapowers/plans/001-test/revise-instructions-1.md`)

Your proposed error message only includes the relative `.megapowers/plans/...` path.

### Fix — Include the computed `filepath` in the returned error
Update the gate message to include `filepath`:

```ts
if (params.verdict === "revise") {
  const filename = `revise-instructions-${state.planIteration}.md`;
  const filepath = join(cwd, ".megapowers", "plans", slug, filename);
  if (!existsSync(filepath)) {
    return {
      error:
        `Missing revise-instructions file: ${filepath}\n` +
        `Expected filename: ${filename}\n` +
        "Write it before submitting a revise verdict.",
    };
  }
}
```

### Fix — Update the new test to assert the full path
In the missing-file test, assert `filepath` (including `tmp`) appears:

```ts
const filepath = join(tmp, ".megapowers", "plans", "001-test", "revise-instructions-1.md");
expect(result.error).toContain("revise-instructions-1.md");
expect(result.error).toContain(filepath);
```

### Problem 2 — Existing revise-verdict tests will break after the gate is added
After adding the gate, **every** test that calls `handlePlanReview(... { verdict: "revise" })` must create the required file first.

In each such test (or a shared `beforeEach`), add:

```ts
const planDir = join(tmp, ".megapowers", "plans", "001-test");
mkdirSync(planDir, { recursive: true });
writeFileSync(join(planDir, `revise-instructions-${iteration}.md`), "Reviewer instructions");
```

Where `iteration` matches the `planIteration` you set in `setState()`.
