---
id: 9
title: Orchestrate finalize, squash, push, and PR as one shipping path
status: approved
depends_on:
  - 4
  - 5
  - 6
  - 7
  - 8
no_test: false
files_to_modify:
  - extensions/megapowers/vcs/shipping.ts
  - tests/shipping.test.ts
files_to_create: []
---

### Task 9: Orchestrate finalize, squash, push, and PR as one shipping path [depends: 4, 5, 6, 7, 8]
**Covers:** AC5, AC10, AC11, AC14, AC15, AC16

**Files:**
- Modify: `extensions/megapowers/vcs/shipping.ts`
- Test: `tests/shipping.test.ts`

**Step 1 — Write the failing tests**
In `tests/shipping.test.ts`, keep imports at the file header and update them to:

```ts
import {
  auditShipment,
  finalizeShipment,
  validateShipTarget,
  shipAndCreatePR,
} from "../extensions/megapowers/vcs/shipping.js";
import type { ExecGit } from "../extensions/megapowers/vcs/git-ops.js";
import type { ExecCmd } from "../extensions/megapowers/vcs/pr-creator.js";
```

Then append these focused tests:

```ts
it("returns a validate error before finalize, squash, push, or PR work", async () => {
  const gitCalls: string[][] = [];
  let ghCalled = false;

  const execGit: ExecGit = async (args) => {
    gitCalls.push(args);
    return { stdout: "", stderr: "" };
  };

  const execCmd: ExecCmd = async () => {
    ghCalled = true;
    return { stdout: "", stderr: "" };
  };

  const result = await shipAndCreatePR({
    execGit,
    execCmd,
    issueSlug: "093-vcs-lifecycle-audit-clean-commit-strateg",
    branchName: "main",
    baseBranch: "main",
    commitMessage: "feat: ship 093-vcs-lifecycle-audit-clean-commit-strateg",
    prTitle: "feat: ship 093-vcs-lifecycle-audit-clean-commit-strateg",
    prBody: "Resolves 093-vcs-lifecycle-audit-clean-commit-strateg",
  });

  expect(result).toEqual({
    ok: false,
    step: "validate",
    error: "Cannot ship: branchName must differ from baseBranch (main).",
    pushed: false,
  });
  expect(gitCalls).toEqual([]);
  expect(ghCalled).toBe(false);
});

it("returns the same validate short-circuit for a captured non-main base branch", async () => {
  const gitCalls: string[][] = [];
  let ghCalled = false;

  const execGit: ExecGit = async (args) => {
    gitCalls.push(args);
    return { stdout: "", stderr: "" };
  };

  const execCmd: ExecCmd = async () => {
    ghCalled = true;
    return { stdout: "", stderr: "" };
  };

  const result = await shipAndCreatePR({
    execGit,
    execCmd,
    issueSlug: "093-vcs-lifecycle-audit-clean-commit-strateg",
    branchName: "release/2026.03",
    baseBranch: "release/2026.03",
    commitMessage: "feat: ship 093-vcs-lifecycle-audit-clean-commit-strateg",
    prTitle: "feat: ship 093-vcs-lifecycle-audit-clean-commit-strateg",
    prBody: "Resolves 093-vcs-lifecycle-audit-clean-commit-strateg",
  });

  expect(result).toEqual({
    ok: false,
    step: "validate",
    error: "Cannot ship: branchName must differ from baseBranch (release/2026.03).",
    pushed: false,
  });
  expect(gitCalls).toEqual([]);
  expect(ghCalled).toBe(false);
});

it("runs finalize and push before checking gh availability for PR creation", async () => {
  const events: string[] = [];

  const execGit: ExecGit = async (args) => {
    events.push(`git ${args.join(" ")}`);
    if (args[0] === "status" && args.includes("--ignored")) return { stdout: "", stderr: "" };
    if (args[0] === "status" && !args.includes("--ignored")) return { stdout: "", stderr: "" };
    return { stdout: "", stderr: "" };
  };
  const execCmd: ExecCmd = async (cmd, args) => {
    events.push(`${cmd} ${args.join(" ")}`);
    throw new Error("command not found: gh");
  };

  const result = await shipAndCreatePR({
    execGit,
    execCmd,
    issueSlug: "093-vcs-lifecycle-audit-clean-commit-strateg",
    branchName: "feat/093-vcs-lifecycle-audit-clean-commit-strateg",
    baseBranch: "main",
    commitMessage: "feat: ship 093-vcs-lifecycle-audit-clean-commit-strateg",
    prTitle: "feat: ship 093-vcs-lifecycle-audit-clean-commit-strateg",
    prBody: "Resolves 093-vcs-lifecycle-audit-clean-commit-strateg",
  });

  expect(result).toEqual({
    ok: true,
    finalized: false,
    pushed: true,
    pr: { skipped: true, reason: "gh CLI not installed" },
  });

  expect(events).toEqual([
    "git status --porcelain --untracked-files=all --ignored",
    "git reset --soft main",
    "git status --porcelain",
    "git push origin feat/093-vcs-lifecycle-audit-clean-commit-strateg --force-with-lease",
    "gh --version",
  ]);
});

it("returns push failure and does not attempt PR creation", async () => {
  let prAttempted = false;
  const execCmd: ExecCmd = async () => {
    prAttempted = true;
    return { stdout: "", stderr: "" };
  };

  const execGit: ExecGit = async (args) => {
    if (args[0] === "status" && args.includes("--ignored")) return { stdout: "", stderr: "" };
    if (args[0] === "status" && !args.includes("--ignored")) return { stdout: "", stderr: "" };
    if (args[0] === "push") throw new Error("remote rejected");
    return { stdout: "", stderr: "" };
  };

  const result = await shipAndCreatePR({
    execGit,
    execCmd,
    issueSlug: "093-vcs-lifecycle-audit-clean-commit-strateg",
    branchName: "feat/093-vcs-lifecycle-audit-clean-commit-strateg",
    baseBranch: "main",
    commitMessage: "feat: ship 093-vcs-lifecycle-audit-clean-commit-strateg",
    prTitle: "feat: ship 093-vcs-lifecycle-audit-clean-commit-strateg",
    prBody: "Resolves 093-vcs-lifecycle-audit-clean-commit-strateg",
  });

  expect(result).toEqual({
    ok: false,
    step: "push",
    error: "remote rejected",
    pushed: false,
  });
  expect(prAttempted).toBe(false);
});
```

The two validate tests are the explicit AC11 orchestration proof: invalid targets must stop before any finalize, squash, push, or PR work begins, both for an obvious self-target (`main`) and for a captured non-main base branch such as the `release/*` branch persisted by Task 16.
Task 16 → Task 9 linkage: Task 16 persists the captured non-main `baseBranch`, and this Task 9 validate short-circuit test asserts that persisted branch cannot be shipped to itself.

**Step 2 — Run test, verify it fails**
Run:
- `bun test tests/shipping.test.ts -t "returns a validate error before finalize, squash, push, or PR work"`
- `bun test tests/shipping.test.ts -t "returns the same validate short-circuit for a captured non-main base branch"`
- `bun test tests/shipping.test.ts -t "runs finalize and push before checking gh availability for PR creation"`
- `bun test tests/shipping.test.ts -t "returns push failure and does not attempt PR creation"`

Expected: FAIL — `SyntaxError: Export named 'shipAndCreatePR' not found in module '../extensions/megapowers/vcs/shipping.js'`

**Step 3 — Write minimal implementation**
Extend `extensions/megapowers/vcs/shipping.ts` with orchestration types and keep `validateShipTarget(request.branchName, request.baseBranch)` as the **first** guard:

```ts
import { squashAndPush } from "./branch-manager.js";
import { createPR, type ExecCmd, type PRResult } from "./pr-creator.js";

export interface ShipRequest {
  execGit: ExecGit;
  execCmd: ExecCmd;
  issueSlug: string;
  branchName: string | null;
  baseBranch: string | null;
  commitMessage: string;
  prTitle: string;
  prBody: string;
}

export type ShipResult =
  | { ok: true; finalized: boolean; pushed: true; pr: PRResult }
  | { ok: false; step: "validate" | "squash" | "push"; error: string; pushed: false; blockedFiles?: string[] };

export async function shipAndCreatePR(request: ShipRequest): Promise<ShipResult> {
  const target = validateShipTarget(request.branchName, request.baseBranch);
  if (!target.ok) {
    return { ok: false, step: "validate", error: target.error, pushed: false };
  }

  const finalized = await finalizeShipment(request.execGit, request.issueSlug);
  const finalizedCommitted = finalized.ok ? finalized.committed : false;

  const pushed = await squashAndPush(
    request.execGit,
    request.branchName!,
    request.baseBranch!,
    request.commitMessage,
  );
  if (!pushed.ok) {
    return { ok: false, step: pushed.step, error: pushed.error, pushed: false };
  }

  const pr = await createPR(
    request.execCmd,
    request.baseBranch!,
    request.branchName!,
    request.prTitle,
    request.prBody,
  );

  return { ok: true, finalized: finalizedCommitted, pushed: true, pr };
}
```

This task owns AC11 orchestration enforcement: invalid target validation must happen before any call to `finalizeShipment()`, `squashAndPush()`, or `createPR()`. The captured non-main-base test is the bridge from Task 16's persisted `baseBranch` into shipping-time validation.
AC13 orchestration stop mapping: when `squashAndPush()` returns `step: "squash"`, `shipAndCreatePR()` returns immediately with `pushed: false` and does not invoke PR creation.

Task 12 adds the explicit finalization-abort branch (`step: "finalize"`), and Task 13 adds the explicit PR-failure branch (`step: "pr"`).

**Step 4 — Run test, verify it passes**
Run:
- `bun test tests/shipping.test.ts -t "returns a validate error before finalize, squash, push, or PR work"`
- `bun test tests/shipping.test.ts -t "returns the same validate short-circuit for a captured non-main base branch"`
- `bun test tests/shipping.test.ts -t "runs finalize and push before checking gh availability for PR creation"`
- `bun test tests/shipping.test.ts -t "returns push failure and does not attempt PR creation"`

Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: all passing
