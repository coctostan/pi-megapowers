## Task 1: Route review approval instructions through megapowers_plan_review

Two test assertions in Step 1 are broken, and Steps 4/5 are merged.

### Issue 1: `not.toContain("review_approve")` will never pass

`prompts/megapowers-protocol.md` line 15 injects this deprecation warning into ALL prompts:

```
Do **not** use `{ action: "review_approve" }` (deprecated).
```

This is correct, desired behavior (it tells the model NOT to use it). But the test assertion:

```ts
expect(result).not.toContain("review_approve");
```

will **never pass** — even after the implementation fix — because `buildInjectedPrompt()` always includes the protocol deprecation warning containing the string `review_approve`.

**Fix:** Remove this assertion entirely. It's not needed — the actual AC1/AC2 coverage comes from asserting that `megapowers_plan_review` IS present and the conflicting `phase_next`/artifact instructions are NOT present. Task 2 separately covers removing `review_approve` from the tool schema.

### Issue 2: `not.toContain('write it to ...')` is vacuously true

The actual prompt text is:

```
save the artifact by writing it to `.megapowers/plans/001-test/plan.md`
```

Note: "**writing** it to" not "**write** it to". The assertion:

```ts
expect(result).not.toContain('write it to `.megapowers/plans/001-test/plan.md`');
```

passes even BEFORE the fix (it never matches), so it doesn't contribute to Step 2's expected failure and doesn't test anything.

**Fix:** Change to the actual substring:

```ts
expect(result).not.toContain('writing it to `.megapowers/plans/001-test/plan.md`');
```

### Issue 3: Steps 4 and 5 are merged

The task has `**Step 4**` with both the targeted test run AND `bun test` combined. Add a separate `**Step 5**` header.

### Corrected Step 1

Replace the test code in Step 1 with:

```ts
  it("review mode routes approval through megapowers_plan_review instead of phase_next", () => {
    setState(tmp, { phase: "plan", planMode: "review", planIteration: 1, megaEnabled: true });
    const result = buildInjectedPrompt(tmp);

    expect(result).not.toBeNull();
    expect(result).toContain("megapowers_plan_review");
    expect(result).not.toContain('Then call `megapowers_signal` with action `"phase_next"` to advance.');
    expect(result).not.toContain('writing it to `.megapowers/plans/001-test/plan.md`');
  });
```

### Corrected Step 2

```
Run: `bun test tests/prompt-inject.test.ts -t "review mode routes approval through megapowers_plan_review instead of phase_next"`
Expected: FAIL — `expect(received).not.toContain(expected)` because the injected plan-review prompt still appends the generic derived tool instructions: `Then call \`megapowers_signal\` with action \`"phase_next"\` to advance.` and `writing it to \`.megapowers/plans/001-test/plan.md\``.
```

### Add separate Step 5

```
**Step 5 — Verify no regressions**
Run: `bun test`
Expected: all passing
```
