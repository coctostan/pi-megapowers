---
id: 10
title: Remove the dead requireReviewApproved gate type
status: approved
depends_on: []
no_test: false
files_to_modify:
  - extensions/megapowers/workflows/types.ts
  - extensions/megapowers/workflows/gate-evaluator.ts
  - tests/gate-evaluator.test.ts
files_to_create: []
---

### Task 10: Remove the dead requireReviewApproved gate type

**Files:**
- Modify: `extensions/megapowers/workflows/types.ts`
- Modify: `extensions/megapowers/workflows/gate-evaluator.ts`
- Test: `tests/gate-evaluator.test.ts`

**Step 1 — Write the failing test**
Replace the existing `evaluateGate — requireReviewApproved` describe block in `tests/gate-evaluator.test.ts` with this dead-code removal check:

```ts
describe("dead requireReviewApproved gate removal", () => {
  it("workflow types and gate evaluator source no longer mention requireReviewApproved", () => {
    const fs = require("node:fs");
    const path = require("node:path");
    const typesSource = fs.readFileSync(
      path.join(process.cwd(), "extensions/megapowers/workflows/types.ts"),
      "utf-8",
    );
    const evaluatorSource = fs.readFileSync(
      path.join(process.cwd(), "extensions/megapowers/workflows/gate-evaluator.ts"),
      "utf-8",
    );

    expect(typesSource).not.toContain("requireReviewApproved");
    expect(evaluatorSource).not.toContain("requireReviewApproved");
    expect(evaluatorSource).not.toContain("state.reviewApproved");
  });
});
```

**Step 2 — Run test, verify it fails**
Run: `bun test tests/gate-evaluator.test.ts`
Expected: FAIL — `expect(received).not.toContain("requireReviewApproved")`

**Step 3 — Write minimal implementation**
Remove the dead gate definition from `extensions/megapowers/workflows/types.ts`:

```ts
// delete
export interface RequireReviewApprovedGate {
  type: "requireReviewApproved";
}
```

and remove it from the `GateConfig` union.

Then delete the corresponding evaluator branch from `extensions/megapowers/workflows/gate-evaluator.ts`:

```ts
    case "requireReviewApproved": {
      if (!state.reviewApproved) {
        return { pass: false, message: "Plan review not approved yet. The LLM needs to approve the plan." };
      }
      return { pass: true };
    }
```

Leave the `requirePlanApproved` gate untouched; it is still the real gate for `plan -> implement` and must continue to check `state.planMode === null`.

**Step 4 — Run test, verify it passes**
Run: `bun test tests/gate-evaluator.test.ts`
Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: all passing
