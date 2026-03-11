## Task 1: Route review approval instructions through megapowers_plan_review

The current task targets the inactive `needsReviewApproval` branch in `extensions/megapowers/workflows/tool-instructions.ts`. That branch is not used by either workflow: `extensions/megapowers/workflows/feature.ts` and `extensions/megapowers/workflows/bugfix.ts` define the `plan` phase with `artifact: "plan.md"` and do not set `needsReviewApproval: true`.

The live review prompt is built in `extensions/megapowers/prompt-inject.ts`, which currently unconditionally appends `deriveToolInstructions(...)` at the end of prompt assembly. In `plan` + `review` mode, that means the active prompt still appends the generic plan artifact instruction:

- `When the plan is complete, save the artifact by writing it to ".megapowers/plans/<issue>/plan.md" ...`
- `Then call megapowers_signal with action "phase_next" to advance.`

That is the active surface that must be fixed for AC1/AC2/AC6.

Replace Step 1 with a regression in `tests/prompt-inject.test.ts` inside `describe("buildInjectedPrompt — plan mode routing", ...)`:

```ts
  it("review mode routes approval through megapowers_plan_review instead of phase_next", () => {
    setState(tmp, { phase: "plan", planMode: "review", planIteration: 1, megaEnabled: true });
    const result = buildInjectedPrompt(tmp);

    expect(result).not.toBeNull();
    expect(result).toContain("megapowers_plan_review");
    expect(result).not.toContain("review_approve");
    expect(result).not.toContain('Then call `megapowers_signal` with action `"phase_next"` to advance.');
    expect(result).not.toContain('write it to `.megapowers/plans/001-test/plan.md`');
  });
```

Update Step 2 so the expected failure matches the real problem:

```text
Run: bun test tests/prompt-inject.test.ts -t "review mode routes approval through megapowers_plan_review instead of phase_next"
Expected: FAIL — the injected review prompt still contains the generic `plan.md` / `phase_next` instruction appended from `deriveToolInstructions()`.
```

Replace Step 3 implementation. Do not rely on `needsReviewApproval`. Instead, suppress derived artifact instructions when the active prompt is `plan` review mode. In `extensions/megapowers/prompt-inject.ts`, change the tool-instruction append block to:

```ts
  // Phase-specific tool instructions derived from config (AC42)
  const suppressDerivedToolInstructions =
    state.phase === "plan" && state.planMode === "review";

  if (!suppressDerivedToolInstructions && state.workflow && state.phase) {
    const config = getWorkflowConfig(state.workflow);
    const phaseConfig = config.phases.find(p => p.name === state.phase);
    if (phaseConfig) {
      const isTerminal = config.phases[config.phases.length - 1].name === state.phase;
      const toolInstructions = deriveToolInstructions(phaseConfig, state.activeIssue, { isTerminal });
      if (toolInstructions) parts.push(toolInstructions.trim());
    }
  }
```

The existing `prompts/review-plan.md` template and `prompts/megapowers-protocol.md` already contain the correct `megapowers_plan_review` guidance. The fix is to stop appending the conflicting generic `plan.md` / `phase_next` instructions during review mode.

Add an explicit coverage line to the task body, for example:

```md
**Covers:** AC1, AC2, AC6
```

If you also choose to update the dormant `needsReviewApproval` branch in `extensions/megapowers/workflows/tool-instructions.ts` to mention `megapowers_plan_review`, treat that as secondary hardening. It does not replace fixing the live `buildInjectedPrompt()` path above.
