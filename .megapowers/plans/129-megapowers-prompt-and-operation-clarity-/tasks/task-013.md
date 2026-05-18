---
id: 13
title: Standardize plan_draft_done feedback
status: approved
depends_on:
  - 2
no_test: false
files_to_modify:
  - extensions/megapowers/plan-orchestrator.ts
  - tests/tool-signal.test.ts
files_to_create: []
---

**Files:**
- Modify: `extensions/megapowers/plan-orchestrator.ts`
- Modify: `tests/tool-signal.test.ts`

Covers AC36, AC42. `plan_draft_done` (handled by `handlePlanDraftDone` which delegates to `transitionDraftToReview`) success message must start with a vocabulary icon, name the count of tasks saved, and state the transition to review mode.

The current message (plan-orchestrator.ts:99–101) is `📝 Draft complete: N tasks saved\n  → Transitioning to review mode.` — it already covers task count and review transition. The remaining gap vs AC36 is that `📝` is not in the shared `ICONS` vocabulary from Task 2. Updating to use `composeMessage({ icon: "info", ... })` brings it into the vocabulary.

**Step 1 — Write the failing test**

Append inside `describe("plan_draft_done signal", ...)` in `tests/tool-signal.test.ts`:

```ts
    it("plan_draft_done success message starts with a shared-vocabulary icon and names task count + review transition (AC36, AC42)", async () => {
      setState(tmp, { phase: "plan", planMode: "draft", planIteration: 1 });
      const tasksDir = join(tmp, ".megapowers", "plans", "001-test", "tasks");
      mkdirSync(tasksDir, { recursive: true });
      writeFileSync(join(tasksDir, "task-001.md"), "---\nid: 1\ntitle: T\nstatus: draft\n---\nBody.");
      writeFileSync(join(tasksDir, "task-002.md"), "---\nid: 2\ntitle: T2\nstatus: draft\n---\nBody.");
      const r = await handlePlanDraftDone(tmp);
      expect(r.error).toBeUndefined();
      // Starts with one of the shared icons (📋 info)
      expect(r.message!.startsWith("📋")).toBe(true);
      expect(r.message).toContain("2 tasks");
      expect(r.message!.toLowerCase()).toContain("review mode");
    });
```

**Step 2 — Run test, verify it fails**
Run: `bun test tests/tool-signal.test.ts -t "plan_draft_done success message starts"`
Expected: FAIL — current message starts with `📝`, not `📋`. The `startsWith("📋")` assertion fails.

**Step 3 — Write minimal implementation**

In `extensions/megapowers/plan-orchestrator.ts`:

1. Add import at the top:

```ts
import { composeMessage } from "./feedback.js";
```

2. In `transitionDraftToReview` (line 80–104), replace the existing inline `message:` string (lines 99–101):

```ts
      message: composeMessage({
        icon: "info",
        summary: `Plan draft complete — ${taskCount} task${taskCount === 1 ? "" : "s"} saved`,
        nextStep: "Transitioning to review mode. A new review session will start.",
      }),
```

Pre-existing tests that assert `toContain("2 tasks")` and `toContain("review mode")` continue to pass.

**Step 4 — Run test, verify it passes**
Run: `bun test tests/tool-signal.test.ts -t "plan_draft_done"`
Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: all passing
