---
id: 5
title: Bugfix workflow plan→implement gate uses requireTaskFiles
status: approved
depends_on:
  - 1
no_test: false
files_to_modify:
  - extensions/megapowers/workflows/bugfix.ts
  - tests/workflow-configs.test.ts
files_to_create: []
---

### Task 5: Bugfix workflow plan→implement gate uses requireTaskFiles [depends: 1]

**Files:**
- Modify: `extensions/megapowers/workflows/bugfix.ts`
- Test: `tests/workflow-configs.test.ts`

**Step 1 — Write the failing test**

Add a new test in `tests/workflow-configs.test.ts` inside the `"bugfix workflow config"` describe block:

```typescript
  it("has plan → implement transition with requireTaskFiles + requirePlanApproved gates", () => {
    const t = bugfixWorkflow.transitions.find(t => t.from === "plan" && t.to === "implement");
    expect(t).toBeDefined();
    expect(t!.gates).toEqual([{ type: "requireTaskFiles" }, { type: "requirePlanApproved" }]);
  });
```

**Step 2 — Run test, verify it fails**
Run: `bun test tests/workflow-configs.test.ts -t "bugfix workflow config > has plan → implement transition with requireTaskFiles"`
Expected: FAIL — `Expected: [{"type": "requireTaskFiles"}, {"type": "requirePlanApproved"}]` / `Received: [{"file": "plan.md", "type": "requireArtifact"}, {"type": "requirePlanApproved"}]`

**Step 3 — Write minimal implementation**

In `extensions/megapowers/workflows/bugfix.ts`, change line 17 from:

```typescript
    { from: "plan", to: "implement", gates: [{ type: "requireArtifact", file: "plan.md" }, { type: "requirePlanApproved" }] },
```

To:

```typescript
    { from: "plan", to: "implement", gates: [{ type: "requireTaskFiles" }, { type: "requirePlanApproved" }] },
```

**Step 4 — Run test, verify it passes**
Run: `bun test tests/workflow-configs.test.ts -t "bugfix workflow config > has plan → implement transition with requireTaskFiles"`
Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: all passing
