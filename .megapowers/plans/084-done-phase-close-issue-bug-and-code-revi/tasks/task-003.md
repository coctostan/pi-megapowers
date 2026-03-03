---
id: 3
title: Remove showDoneChecklist from register-tools.ts execute()
status: approved
depends_on:
  - 1
no_test: false
files_to_modify:
  - extensions/megapowers/register-tools.ts
files_to_create: []
---

### Task 3: Remove showDoneChecklist from register-tools.ts execute() [depends: 1]

**Files:**
- Modify: `extensions/megapowers/register-tools.ts`
- Test: `tests/reproduce-084-batch.test.ts`

This fixes the #083 timing issue — `showDoneChecklist` is no longer called synchronously inside the `megapowers_signal` tool's `execute()` function. The checklist will be deferred to `onAgentEnd` (Task 4).

**Step 1 — Write the failing test**

In `tests/reproduce-084-batch.test.ts`, update the existing test `"UX-ISSUE: showDoneChecklist fires synchronously inside tool execute (timing concern)"` to assert the fix:

```typescript
  it("FIX: showDoneChecklist is NOT called inside megapowers_signal execute (#083)", () => {
    const source = readFileSync(
      join(process.cwd(), "extensions/megapowers/register-tools.ts"),
      "utf-8",
    );

    // After fix: showDoneChecklist should NOT appear in register-tools.ts at all
    expect(source).not.toContain("showDoneChecklist");
  });
```

**Step 2 — Run test, verify it fails**

Run: `bun test tests/reproduce-084-batch.test.ts -t "FIX: showDoneChecklist is NOT called inside megapowers_signal execute"`

Expected: FAIL — `expect(received).not.toContain(expected) // Expected not to contain: "showDoneChecklist"` — because `showDoneChecklist` is still imported and called in register-tools.ts.

**Step 3 — Write minimal implementation**

In `extensions/megapowers/register-tools.ts`:

1. Remove the import of `showDoneChecklist` (line 7):
   ```
   // DELETE: import { showDoneChecklist } from "./ui.js";
   ```

2. Remove lines 47-54 (the `AC11` block inside `execute()`):
   ```
   // DELETE the entire block:
   // // AC11: Show done checklist when phase_next advances to done
   // // Trigger is here ONLY — not in hooks.ts — to prevent duplicate presentation
   // if (params.action === "phase_next") {
   //   const currentState = readState(ctx.cwd);
   //   if (currentState.phase === "done") {
   //     await showDoneChecklist(ctx, ctx.cwd);
   //   }
   // }
   ```

The `readState` import on line 6 remains because it's used on line 57 for `ui.renderDashboard`.

**Step 4 — Run test, verify it passes**

Run: `bun test tests/reproduce-084-batch.test.ts -t "FIX: showDoneChecklist is NOT called inside megapowers_signal execute"`

Expected: PASS

**Step 5 — Verify no regressions**

Run: `bun test`

Expected: all passing
