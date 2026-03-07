---
id: 2
title: Extract switch-away helper and cover clean working trees
status: approved
depends_on: []
no_test: false
files_to_modify:
  - extensions/megapowers/commands.ts
  - tests/vcs-commands.test.ts
files_to_create: []
---

### Task 2: Extract switch-away helper and cover clean working trees [depends: none]
**Covers:** AC3, AC4

**Files:**
- Modify: `extensions/megapowers/commands.ts`
- Test: `tests/vcs-commands.test.ts`

**Step 1 — Write the failing test**
In `tests/vcs-commands.test.ts`, update the import and add this focused coverage:

```ts
import { it, expect } from "bun:test";
import type { ExecGit } from "../extensions/megapowers/vcs/git-ops.js";
import { maybeSwitchAwayFromIssue } from "../extensions/megapowers/commands.js";

it("returns committed: false and does not commit when switching away from a clean branch", async () => {
  const calls: string[][] = [];
  const execGit: ExecGit = async (args) => {
    calls.push(args);
    if (args[0] === "add") return { stdout: "", stderr: "" };
    if (args[0] === "status") return { stdout: "", stderr: "" };
    return { stdout: "", stderr: "" };
  };

  await expect(maybeSwitchAwayFromIssue(execGit, "feat/001-old-issue")).resolves.toEqual({
    ok: true,
    committed: false,
  });
  expect(calls.some((c) => c[0] === "commit")).toBe(false);
});
```

This task keeps the production behavior unchanged and creates a testable seam for the clean switch-away path that was previously only exercised indirectly.

**Step 2 — Run test, verify it fails**
Run: `bun test tests/vcs-commands.test.ts -t "returns committed: false and does not commit when switching away from a clean branch"`
Expected: FAIL — `SyntaxError: Export named 'maybeSwitchAwayFromIssue' not found in module '../extensions/megapowers/commands.js'`

**Step 3 — Write minimal implementation**
In `extensions/megapowers/commands.ts`, keep `switchAwayCommit()` unchanged and extract a small helper around the real `WipCommitResult` contract:

```ts
export async function maybeSwitchAwayFromIssue(
  execGit: ExecGit | undefined,
  previousBranchName: string | null,
): Promise<{ ok: true; committed: boolean } | { ok: false; error: string }> {
  if (!execGit || !previousBranchName) {
    return { ok: true, committed: false };
  }

  const switchResult = await switchAwayCommit(execGit, previousBranchName);
  if ("error" in switchResult) {
    return { ok: false, error: switchResult.error };
  }

  return { ok: true, committed: switchResult.committed };
}
```

Then update the switch-away call site in `handleIssueCommand()` to use the helper:

```ts
if (prevState.branchName) {
  const switchResult = await maybeSwitchAwayFromIssue(deps.execGit, prevState.branchName);
  if (!switchResult.ok && ctx.hasUI) {
    ctx.ui.notify(`VCS: ${switchResult.error}`, "error");
  }
}
```

Do **not** introduce or reference a `{ skipped: true }` branch — the real codebase contract is `{ ok: true, committed: boolean } | { ok: false, error: string }`.

**Step 4 — Run test, verify it passes**
Run: `bun test tests/vcs-commands.test.ts -t "returns committed: false and does not commit when switching away from a clean branch"`
Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: all passing
