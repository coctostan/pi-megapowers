---
id: 2
title: Add shared feedback vocabulary module
status: approved
depends_on: []
no_test: false
files_to_modify: []
files_to_create:
  - extensions/megapowers/feedback.ts
  - tests/feedback.test.ts
---

**Files:**
- Create: `extensions/megapowers/feedback.ts`
- Create: `tests/feedback.test.ts`

Single source of truth for the leading status icons/verbs and a `composeMessage()` helper that assembles "status — what changed → artifact path → next step" strings. Consumed by all tool feedback updates in later tasks.

**Step 1 — Write the failing test**

Create `tests/feedback.test.ts`:

```ts
import { describe, it, expect } from "bun:test";
import { ICONS, composeMessage } from "../extensions/megapowers/feedback.js";

describe("feedback vocabulary", () => {
  it("exposes a status icon vocabulary", () => {
    expect(ICONS.success).toBe("✅");
    expect(ICONS.info).toBe("📋");
    expect(ICONS.warn).toBe("⚠️");
    expect(ICONS.error).toBe("❌");
    expect(ICONS.note).toBe("📝");
  });

  it("composeMessage prepends the requested status icon", () => {
    const out = composeMessage({ icon: "success", summary: "saved" });
    expect(out.startsWith("✅ saved")).toBe(true);
  });

  it("composeMessage includes artifact path line when provided", () => {
    const out = composeMessage({
      icon: "success",
      summary: "Task 1 saved",
      artifactPath: ".megapowers/plans/001-test/tasks/task-001.md",
      nextStep: "continue with task 2",
    });
    expect(out).toContain("→ .megapowers/plans/001-test/tasks/task-001.md");
    expect(out).toContain("Next: continue with task 2");
  });

  it("composeMessage omits artifact and next-step lines when not provided", () => {
    const out = composeMessage({ icon: "info", summary: "noop" });
    expect(out).toBe("📋 noop");
    expect(out).not.toContain("→");
    expect(out).not.toContain("Next:");
  });
});
```

**Step 2 — Run test, verify it fails**
Run: `bun test tests/feedback.test.ts`
Expected: FAIL — `error: Cannot find module '../extensions/megapowers/feedback.js'`

**Step 3 — Write minimal implementation**

Create `extensions/megapowers/feedback.ts`:

```ts
// extensions/megapowers/feedback.ts
//
// Shared status vocabulary and result-message composer.
// Used by handleSignal, handlePlanTask, handlePlanReview, handlePlanDraftDone, handleCloseIssue.

export const ICONS = {
  success: "✅",
  info: "📋",
  warn: "⚠️",
  error: "❌",
  note: "📝",
} as const;

export type IconKey = keyof typeof ICONS;

export interface ComposeArgs {
  icon: IconKey;
  /** First-line summary after the icon. */
  summary: string;
  /** Optional bullets describing what changed. */
  changes?: string[];
  /** Optional saved artifact path under .megapowers/plans/<slug>/. */
  artifactPath?: string;
  /** Optional explicit next-step phrase. */
  nextStep?: string;
}

export function composeMessage(args: ComposeArgs): string {
  const lines: string[] = [`${ICONS[args.icon]} ${args.summary}`];
  if (args.changes) {
    for (const c of args.changes) lines.push(`  • ${c}`);
  }
  if (args.artifactPath) lines.push(`  → ${args.artifactPath}`);
  if (args.nextStep) lines.push(`  Next: ${args.nextStep}`);
  return lines.join("\n");
}
```

**Step 4 — Run test, verify it passes**
Run: `bun test tests/feedback.test.ts`
Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: all passing
