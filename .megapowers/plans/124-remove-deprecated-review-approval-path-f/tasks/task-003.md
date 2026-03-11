---
id: 3
title: Remove the deprecated /review approve command surface
status: approved
depends_on: []
no_test: false
files_to_modify:
  - extensions/megapowers/index.ts
  - extensions/megapowers/commands.ts
  - tests/mp-existing-commands.test.ts
files_to_create: []
---

### Task 3: Remove the deprecated /review approve command surface

**Files:**
- Modify: `extensions/megapowers/index.ts`
- Modify: `extensions/megapowers/commands.ts`
- Test: `tests/mp-existing-commands.test.ts`

**Step 1 — Write the failing test**
Replace the contents of `tests/mp-existing-commands.test.ts` with:
```ts
import { describe, it, expect } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("/mp registration compatibility", () => {
  it("keeps active standalone commands while removing deprecated /review", () => {
    const indexSource = readFileSync(join(process.cwd(), "extensions", "megapowers", "index.ts"), "utf-8");
    const commandsSource = readFileSync(join(process.cwd(), "extensions", "megapowers", "commands.ts"), "utf-8");

    expect(indexSource).toContain('pi.registerCommand("mp"');

    for (const cmd of ["mega", "issue", "triage", "phase", "done", "learn", "tdd", "task"]) {
      expect(indexSource).toContain(`pi.registerCommand("${cmd}"`);
    }

    expect(indexSource).not.toContain('pi.registerCommand("review"');
    expect(indexSource).not.toContain("handleReviewCommand");
    expect(commandsSource).not.toContain("export async function handleReviewCommand");
    expect(commandsSource).not.toContain('handleSignal(ctx.cwd, "review_approve")');
  });
});
```

**Step 2 — Run test, verify it fails**
Run: `bun test tests/mp-existing-commands.test.ts -t "keeps active standalone commands while removing deprecated /review"`
Expected: FAIL — `expect(received).not.toContain(expected)` because `extensions/megapowers/index.ts` still registers `pi.registerCommand("review")` and `extensions/megapowers/commands.ts` still exports `handleReviewCommand` that calls `handleSignal(ctx.cwd, "review_approve")`.

**Step 3 — Write minimal implementation**
In `extensions/megapowers/index.ts`, remove `handleReviewCommand` from the command-handler import and delete the entire `/review` registration block so the import section becomes:
```ts
import {
  ensureDeps,
  handleMegaCommand, handleIssueCommand, handleTriageCommand,
  handlePhaseCommand, handleDoneCommand, handleLearnCommand,
  handleTddCommand, handleTaskCommand,
  type RuntimeDeps,
} from "./commands.js";
```

Keep the rest of the file unchanged, with the last command registration now being `/task`.

In `extensions/megapowers/commands.ts`, delete the entire deprecated handler at the end of the file:
```ts
export async function handleReviewCommand(args: string, ctx: any, deps: Deps): Promise<void> {
  const sub = args.trim();

  if (sub === "approve") {
    const result = handleSignal(ctx.cwd, "review_approve");
    if (result.error) {
      if (ctx.hasUI) ctx.ui.notify(result.error, "error");
    } else {
      if (ctx.hasUI) ctx.ui.notify(result.message ?? "Review approved.", "info");
    }
    return;
  }

  if (ctx.hasUI) ctx.ui.notify("Usage: /review approve", "info");
}
```
Do not replace it with another command; this issue removes the deprecated command surface entirely.

**Step 4 — Run test, verify it passes**
Run: `bun test tests/mp-existing-commands.test.ts -t "keeps active standalone commands while removing deprecated /review"`
Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: all passing
