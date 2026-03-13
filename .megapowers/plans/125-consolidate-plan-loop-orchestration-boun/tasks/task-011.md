---
id: 11
title: Initialize plan loop through the orchestrator and drop reviewApproved
  from state-machine
status: approved
depends_on:
  - 2
no_test: false
files_to_modify:
  - extensions/megapowers/state/state-machine.ts
  - tests/state-machine.test.ts
  - tests/phase-advance.test.ts
files_to_create: []
---

### Task 11: Initialize plan loop through the orchestrator and drop reviewApproved from state-machine [depends: 2]

**Files:**
- Modify: `extensions/megapowers/state/state-machine.ts`
- Test: `tests/state-machine.test.ts`
- Test: `tests/phase-advance.test.ts`

**Step 1 — Write the failing test**
Update `tests/state-machine.test.ts` and `tests/phase-advance.test.ts` with these assertions:

```ts
// tests/state-machine.test.ts
it("createInitialState no longer includes reviewApproved", () => {
  const state = createInitialState();
  expect("reviewApproved" in state).toBe(false);
});

it("state-machine delegates plan entry initialization to plan-orchestrator", () => {
  const source = require("node:fs").readFileSync(
    require("node:path").join(process.cwd(), "extensions/megapowers/state/state-machine.ts"),
    "utf-8",
  );

  expect(source).toContain('from "../plan-orchestrator.js"');
  expect(source).toContain("initializePlanLoopState");
});
```

```ts
// tests/phase-advance.test.ts
it("spec→plan still initializes draft mode without reviewApproved bookkeeping", () => {
  setState({ phase: "spec" });
  writeArtifact("001-test", "spec.md", "# Spec\n\n## Acceptance Criteria\n1. Works\n\n## Open Questions\nNone\n");
  const result = advancePhase(tmp);
  expect(result.ok).toBe(true);
  const next = readState(tmp);
  expect(next.planMode).toBe("draft");
  expect(next.planIteration).toBe(1);
  expect((next as any).reviewApproved).toBeUndefined();
});
```

Remove the old tests that explicitly expect `reviewApproved` to reset when entering plan.

**Step 2 — Run test, verify it fails**
Run: `bun test tests/state-machine.test.ts tests/phase-advance.test.ts`
Expected: FAIL — `expect(received).toContain("initializePlanLoopState")`

**Step 3 — Write minimal implementation**
Edit `extensions/megapowers/state/state-machine.ts`:

1. add the helper import:

```ts
import { initializePlanLoopState } from "../plan-orchestrator.js";
```

2. remove `reviewApproved` from `MegapowersState`
3. remove `reviewApproved: false` from `createInitialState()`
4. replace the plan-entry branch in `transition(...)` with:

```ts
  if (to === "plan") {
    Object.assign(next, initializePlanLoopState(next));
  }
```

5. keep the existing non-plan behavior, `planMode` clearing on plan exit, implement-task index initialization, and done-action resets intact.

**Step 4 — Run test, verify it passes**
Run: `bun test tests/state-machine.test.ts tests/phase-advance.test.ts`
Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: all passing
