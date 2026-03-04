---
id: 4
title: Feature workflow plan→implement gate uses requireTaskFiles
status: approved
depends_on:
  - 1
no_test: false
files_to_modify:
  - extensions/megapowers/workflows/feature.ts
  - tests/workflow-configs.test.ts
files_to_create: []
---

### Task 4: Feature workflow plan→implement gate uses requireTaskFiles [depends: 1]

**Files:**
- Modify: `extensions/megapowers/workflows/feature.ts`
- Test: `tests/workflow-configs.test.ts`

**Step 1 — Write the failing test**

Update the existing test in `tests/workflow-configs.test.ts` that checks the plan→implement gate. Replace:

```typescript
  it("has plan → implement transition with requireArtifact + requirePlanApproved gates", () => {
    const t = featureWorkflow.transitions.find(t => t.from === "plan" && t.to === "implement");
    expect(t).toBeDefined();
    expect(t!.gates).toEqual([{ type: "requireArtifact", file: "plan.md" }, { type: "requirePlanApproved" }]);
  });
```

With:

```typescript
  it("has plan → implement transition with requireTaskFiles + requirePlanApproved gates", () => {
    const t = featureWorkflow.transitions.find(t => t.from === "plan" && t.to === "implement");
    expect(t).toBeDefined();
    expect(t!.gates).toEqual([{ type: "requireTaskFiles" }, { type: "requirePlanApproved" }]);
  });
```

**Step 2 — Run test, verify it fails**
Run: `bun test tests/workflow-configs.test.ts -t "has plan → implement transition with requireTaskFiles"`
Expected: FAIL — `Expected: [{"type": "requireTaskFiles"}, {"type": "requirePlanApproved"}]` / `Received: [{"file": "plan.md", "type": "requireArtifact"}, {"type": "requirePlanApproved"}]`

**Step 3 — Write minimal implementation**

In `extensions/megapowers/workflows/feature.ts`, change line 18 from:

```typescript
    { from: "plan", to: "implement", gates: [{ type: "requireArtifact", file: "plan.md" }, { type: "requirePlanApproved" }] },
```

To:

```typescript
    { from: "plan", to: "implement", gates: [{ type: "requireTaskFiles" }, { type: "requirePlanApproved" }] },
```

**Step 4 — Run test, verify it passes**
Run: `bun test tests/workflow-configs.test.ts -t "has plan → implement transition with requireTaskFiles"`
Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: all passing
