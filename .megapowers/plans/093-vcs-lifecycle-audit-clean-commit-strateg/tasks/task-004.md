---
id: 4
title: Abort finalization on suspicious untracked files before push
status: approved
depends_on:
  - 3
no_test: false
files_to_modify:
  - extensions/megapowers/vcs/shipping.ts
  - tests/shipping.test.ts
files_to_create: []
---

### Task 4: Abort finalization on suspicious untracked files before push [depends: 3]

**Files:**
- Modify: `extensions/megapowers/vcs/shipping.ts`
- Test: `tests/shipping.test.ts`

**Step 1 — Write the failing test**
In `tests/shipping.test.ts`, update the existing header import from Task 3:

```ts
import { auditShipment, finalizeShipment } from "../extensions/megapowers/vcs/shipping.js";
import type { ExecGit } from "../extensions/megapowers/vcs/git-ops.js";
```

Then append this test:

```ts
it("blocks suspicious untracked files, returns the blocked file list, and never stages or pushes", async () => {
  const calls: string[][] = [];
  const execGit: ExecGit = async (args) => {
    calls.push(args);
    if (args[0] === "status") {
      return {
        stdout: [
          "?? .env.prod",
          "?? extensions/megapowers/vcs/shipping.ts",
        ].join("\n"),
        stderr: "",
      };
    }
    return { stdout: "", stderr: "" };
  };

  const result = await finalizeShipment(execGit, "093-vcs-lifecycle-audit-clean-commit-strateg");

  expect(result).toEqual({
    ok: false,
    error: "Blocked suspicious untracked files: .env.prod",
    blockedFiles: [".env.prod"],
  });
  expect(calls.some((c) => c[0] === "add")).toBe(false);
  expect(calls.some((c) => c[0] === "push")).toBe(false);
  expect(calls.some((c) => c[0] === "commit")).toBe(false);
});
```

**Step 2 — Run test, verify it fails**
Run: `bun test tests/shipping.test.ts -t "blocks suspicious untracked files, returns the blocked file list, and never stages or pushes"`
Expected: FAIL — `SyntaxError: Export named 'finalizeShipment' not found in module '../extensions/megapowers/vcs/shipping.js'`

**Step 3 — Write minimal implementation**
Reuse Task 3’s `auditShipment(execGit)` helper (single combined `git status --porcelain --untracked-files=all --ignored` call) instead of duplicating status parsing.
In `extensions/megapowers/vcs/shipping.ts`, add:

```ts
export type FinalizeShipmentResult =
  | { ok: true; committed: boolean; audit: ShipmentAudit }
  | { ok: false; error: string; blockedFiles?: string[] };

export async function finalizeShipment(
  execGit: ExecGit,
  issueSlug: string,
): Promise<FinalizeShipmentResult> {
  const audit = await auditShipment(execGit);

  if (audit.blockedUntracked.length > 0) {
    return {
      ok: false,
      error: `Blocked suspicious untracked files: ${audit.blockedUntracked.join(", ")}`,
      blockedFiles: audit.blockedUntracked,
    };
  }

  const hasTracked = audit.tracked.length > 0;
  const hasIncludedUntracked = audit.includedUntracked.length > 0;
  if (!hasTracked && !hasIncludedUntracked) {
    return { ok: true, committed: false, audit };
  }

  // staging + commit path added in Task 6
  return { ok: true, committed: false, audit };
}
```

**Step 4 — Run test, verify it passes**
Run: `bun test tests/shipping.test.ts -t "blocks suspicious untracked files, returns the blocked file list, and never stages or pushes"`
Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: all passing
