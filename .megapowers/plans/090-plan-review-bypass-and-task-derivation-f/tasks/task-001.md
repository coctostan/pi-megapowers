---
id: 1
title: Add requirePlanApproved gate type and wire into workflow configs
status: approved
depends_on: []
no_test: false
files_to_modify:
  - extensions/megapowers/workflows/gate-evaluator.ts
  - extensions/megapowers/workflows/types.ts
  - extensions/megapowers/workflows/feature.ts
  - extensions/megapowers/workflows/bugfix.ts
  - tests/reproduce-090.test.ts
files_to_create: []
---

**Covers:** Fixed When #1, #2, #3 (phase_next blocked when planMode is draft/revise, allowed when null)
**Files:**
- Modify: `extensions/megapowers/workflows/gate-evaluator.ts`
- Modify: `extensions/megapowers/workflows/types.ts`
- Modify: `extensions/megapowers/workflows/feature.ts`
- Modify: `extensions/megapowers/workflows/bugfix.ts`
- Modify: `tests/reproduce-090.test.ts`
- Test: `tests/reproduce-090.test.ts`
**Step 1 — Write the failing tests**

Flip the Bug A assertions in `tests/reproduce-090.test.ts` from documenting buggy behavior to asserting correct behavior. These 4 `it()` blocks are the minimal set: two for the blocking cases (AC #1 draft, AC #2 revise), one for the gate-level check, and one for the allowed case (AC #3 planMode null).

```typescript
// Test 1: planMode "draft" — should block (AC #1)
it("phase_next rejects plan→implement when planMode is 'draft' (no review happened)", () => {
  setState({
    phase: "plan",
    planMode: "draft",
    planIteration: 1,
    reviewApproved: false,
  });
  writeArtifact("001-test", "plan.md", "### Task 1: Do something\n");

  const result = advancePhase(tmp);

  expect(result.ok).toBe(false); // Fixed: gate blocks advancement
});

// Test 2: planMode "revise" — should block (AC #2)
it("phase_next rejects plan→implement when planMode is 'revise' (after revise, before re-review)", () => {
  setState({
    phase: "plan",
    planMode: "revise",
    planIteration: 2,
    reviewApproved: false,
  });
  writeArtifact("001-test", "plan.md", "### Task 1: Do something\n");

  const result = advancePhase(tmp);

  expect(result.ok).toBe(false); // Fixed: gate blocks advancement
});
// Test 3: gate check — should fail when planMode is draft
it("gate check for plan→implement blocks when planMode is draft", () => {
  const store = createStore(tmp);
  const state: MegapowersState = {
    ...createInitialState(),
    activeIssue: "001-test",
    workflow: "feature",
    phase: "plan",
    planMode: "draft",
    planIteration: 1,
    reviewApproved: false,
  };
  store.ensurePlanDir("001-test");
  store.writePlanFile("001-test", "plan.md", "### Task 1: Do something\n");
  const result = checkGate(state, "implement", store, tmp);
  expect(result.pass).toBe(false); // Fixed: gate blocks
});

// Test 4: planMode null — should allow advancement (AC #3)
it("phase_next allows plan→implement when planMode is null (review completed)", () => {
  setState({
    phase: "plan",
    planMode: null,
    planIteration: 1,
    reviewApproved: false,
  });
  writeArtifact("001-test", "plan.md", "### Task 1: Do something\n");

  const result = advancePhase(tmp);

  expect(result.ok).toBe(true); // planMode null means review loop completed
  expect(result.newPhase).toBe("implement");
});
```
**Step 2 — Run test, verify it fails**
Run: `bun test tests/reproduce-090.test.ts --filter "088"`
Expected: FAIL — 3 tests fail with `expect(received).toBe(expected) // expected false, received true` for the draft, revise, and gate-check tests. Test 4 (planMode null) passes since advancement already works when planMode is null.

**Step 3 — Write minimal implementation**
1. Add `RequirePlanApprovedGate` type to `extensions/megapowers/workflows/types.ts`:
```typescript
export interface RequirePlanApprovedGate {
  type: "requirePlanApproved";
}
```
Add to the `GateConfig` union: `| RequirePlanApprovedGate`
```typescript
case "requirePlanApproved": {
  if (state.planMode !== null) {
    return { pass: false, message: `Plan review not complete (planMode: ${state.planMode}). Call plan_draft_done to submit for review.` };
  }
  return { pass: true };
}
```

3. Add the gate to both workflow configs:

`extensions/megapowers/workflows/feature.ts`:
```typescript
{ from: "plan", to: "implement", gates: [{ type: "requireArtifact", file: "plan.md" }, { type: "requirePlanApproved" }] },
```

`extensions/megapowers/workflows/bugfix.ts`:
```typescript
{ from: "plan", to: "implement", gates: [{ type: "requireArtifact", file: "plan.md" }, { type: "requirePlanApproved" }] },
```
**Step 4 — Run test, verify it passes**
Run: `bun test tests/reproduce-090.test.ts --filter "088"`
Expected: PASS — all 4 tests green
**Step 5 — Verify no regressions**
Run: `bun test`
Expected: all passing
