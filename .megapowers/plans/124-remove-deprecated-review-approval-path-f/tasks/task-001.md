---
id: 1
title: Route review approval instructions through megapowers_plan_review
status: approved
depends_on: []
no_test: false
files_to_modify:
  - extensions/megapowers/prompt-inject.ts
  - tests/prompt-inject.test.ts
files_to_create: []
---

### Task 1: Route review approval instructions through megapowers_plan_review
**Covers:** AC1, AC2, AC6
**Files:**
- Modify: `extensions/megapowers/prompt-inject.ts`
- Test: `tests/prompt-inject.test.ts`
**Step 1 — Write the failing test**
Add this test inside `describe("buildInjectedPrompt — plan mode routing", () => { ... })` in `tests/prompt-inject.test.ts`:
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
**Step 2 — Run test, verify it fails**
Run: `bun test tests/prompt-inject.test.ts -t "review mode routes approval through megapowers_plan_review instead of phase_next"`
Expected: FAIL — `expect(received).not.toContain(expected)` because the injected plan-review prompt still appends the generic derived tool instructions: `Then call \`megapowers_signal\` with action \`"phase_next"\` to advance.` and `writing it to \`.megapowers/plans/001-test/plan.md\``.
**Step 3 — Write minimal implementation**
In `extensions/megapowers/prompt-inject.ts`, update the phase-specific tool-instruction block so review-mode plan prompts do not append the generic artifact/phase-next guidance:
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
This preserves the existing `prompts/review-plan.md` / `prompts/megapowers-protocol.md` guidance that already instructs approval via `megapowers_plan_review`, while removing the conflicting live `plan.md` / `phase_next` instructions from review mode.
**Step 4 — Run test, verify it passes**
Run: `bun test tests/prompt-inject.test.ts -t "review mode routes approval through megapowers_plan_review instead of phase_next"`
Expected: PASS
**Step 5 — Verify no regressions**
Run: `bun test`
Expected: all passing
