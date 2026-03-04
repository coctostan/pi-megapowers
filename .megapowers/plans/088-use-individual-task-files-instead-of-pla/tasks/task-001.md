---
id: 1
title: Add RequireTaskFilesGate type to types.ts
status: approved
depends_on: []
no_test: true
files_to_modify:
  - extensions/megapowers/workflows/types.ts
files_to_create: []
---

### Task 1: Add RequireTaskFilesGate type to types.ts [no-test]

**Justification:** Type-only change — adds a new interface and adds it to the union type. No runtime behavior change.

**Files:**
- Modify: `extensions/megapowers/workflows/types.ts`

**Step 1 — Make the change**

Add the new `RequireTaskFilesGate` interface after `AllTasksCompleteGate` and add it to the `GateConfig` union:

```typescript
// After AllTasksCompleteGate (line 28)
export interface RequireTaskFilesGate {
  type: "requireTaskFiles";
}
```

Update the `GateConfig` union to include it:

```typescript
export type GateConfig =
  | RequireArtifactGate
  | NoOpenQuestionsGate
  | RequireReviewApprovedGate
  | RequirePlanApprovedGate
  | AllTasksCompleteGate
  | RequireTaskFilesGate
  | AlwaysPassGate
  | CustomGate;
```

**Step 2 — Verify**
Run: `bunx tsc --noEmit`
Expected: No type errors — the new type compiles cleanly and doesn't break existing code.
