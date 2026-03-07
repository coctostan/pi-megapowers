# Plan

### Task 1: Document AC1 activation branch-recording coverage mapping [no-test]

### Task 1: Document AC1 activation branch-recording coverage mapping [depends: none] [no-test]

**Covers:** AC1

**Justification:** Plan-coverage clarification only. AC1 behavior (record branch name on successful activation) is tested in Task 16 and existing `tests/vcs-commands.test.ts`; this task makes the mapping explicit.

**Files:**
- Modify: `.megapowers/plans/093-vcs-lifecycle-audit-clean-commit-strateg/tasks/task-016.md`

**Step 1 — Add explicit AC1 mapping note**
In Task 16 text, explicitly state the assertion that activation success persists `branchName`.

**Step 2 — Verification command**
Run: `read .megapowers/plans/093-vcs-lifecycle-audit-clean-commit-strateg/tasks/task-016.md`
Expected: AC1 mapping note present and references persisted `branchName` assertion.

### Task 2: Extract switch-away helper and cover clean working trees

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

### Task 3: Add shipment audit for tracked, untracked, and ignored files [depends: 2]

### Task 3: Add shipment audit for tracked, untracked, and ignored files [depends: 2]
**Covers:** AC7, AC8, AC9

**Files:**
- Create: `extensions/megapowers/vcs/shipping.ts`
- Test: `tests/shipping.test.ts`

**Step 1 — Write the failing test**
Create `tests/shipping.test.ts` with this first test:

```ts
import { describe, it, expect } from "bun:test";
import { auditShipment } from "../extensions/megapowers/vcs/shipping.js";
import type { ExecGit } from "../extensions/megapowers/vcs/git-ops.js";

describe("auditShipment", () => {
  it("calls one combined porcelain status audit and classifies tracked, untracked, and ignored files", async () => {
    const calls: string[][] = [];
    const execGit: ExecGit = async (args) => {
      calls.push(args);
      if (args[0] === "status" && args[1] === "--porcelain" && args[2] === "--untracked-files=all" && args[3] === "--ignored") {
        return {
          stdout: [
            " M extensions/megapowers/commands.ts",
            "?? extensions/megapowers/vcs/shipping.ts",
            "?? apps/web/.env.local",
            "!! coverage/index.html",
          ].join("\n"),
          stderr: "",
        };
      }
      return { stdout: "", stderr: "" };
    };

    const result = await auditShipment(execGit);

    expect(calls).toEqual([["status", "--porcelain", "--untracked-files=all", "--ignored"]]);
    expect(result).toEqual({
      tracked: ["extensions/megapowers/commands.ts"],
      includedUntracked: ["extensions/megapowers/vcs/shipping.ts"],
      ignoredUntracked: ["coverage/index.html"],
      blockedUntracked: ["apps/web/.env.local"],
    });
  });
});
```

The modified-file line intentionally uses the porcelain code `" M"`; this task treats any status code other than `"??"` and `"!!"` as tracked work that must be shipped. The nested `.env.local` fixture proves the denylist must classify suspicious files by basename, not only when they appear at the repo root.

**Step 2 — Run test, verify it fails**
Run: `bun test tests/shipping.test.ts -t "calls one combined porcelain status audit and classifies tracked, untracked, and ignored files"`
Expected: FAIL — `error: Cannot find module '../extensions/megapowers/vcs/shipping.js' from 'tests/shipping.test.ts'`

**Step 3 — Write minimal implementation**
Create `extensions/megapowers/vcs/shipping.ts`:

```ts
import type { ExecGit } from "./git-ops.js";

export type { ExecGit } from "./git-ops.js";

export interface ShipmentAudit {
  tracked: string[];
  includedUntracked: string[];
  ignoredUntracked: string[];
  blockedUntracked: string[];
}

// Explicit denylist for obviously suspicious junk that should never ship by default:
// secret env files, OS cruft, and crash/debug logs.
const DENYLIST: RegExp[] = [
  /^\.DS_Store$/,
  /^Thumbs\.db$/,
  /^npm-debug\.log$/,
  /^yarn-error\.log$/,
  /^\.env(?:\..+)?$/,
];
// `^\.env(?:\..+)?$` intentionally matches `.env`, `.env.local`, `.env.prod`, and `.env.*.local` variants.

function parsePorcelainLine(line: string): { code: string; path: string } | null {
  if (!line.trim()) return null;
  const code = line.slice(0, 2);
  const path = line.slice(3).trim();
  if (!path) return null;
  return { code, path };
}

function basename(path: string): string {
  return path.split("/").pop() ?? path;
}

export async function auditShipment(execGit: ExecGit): Promise<ShipmentAudit> {
  const status = await execGit(["status", "--porcelain", "--untracked-files=all", "--ignored"]);
  const tracked: string[] = [];
  const includedUntracked: string[] = [];
  const ignoredUntracked: string[] = [];
  const blockedUntracked: string[] = [];

  for (const rawLine of status.stdout.split("\n")) {
    const parsed = parsePorcelainLine(rawLine);
    if (!parsed) continue;

    if (parsed.code === "!!") {
      ignoredUntracked.push(parsed.path);
      continue;
    }

    if (parsed.code === "??") {
      const name = basename(parsed.path);
      if (DENYLIST.some((pattern) => pattern.test(name))) blockedUntracked.push(parsed.path);
      else includedUntracked.push(parsed.path);
      continue;
    }

    tracked.push(parsed.path);
  }

  return { tracked, includedUntracked, ignoredUntracked, blockedUntracked };
}
```

The denylist is intentionally small and code-owned: it covers “obvious junk” from the brainstorm (`.env*`, OS cruft, debug/error logs) without inventing a user-config system in this issue. Matching against the basename ensures nested junk like `apps/web/.env.local` is still blocked.

**Step 4 — Run test, verify it passes**
Run: `bun test tests/shipping.test.ts -t "calls one combined porcelain status audit and classifies tracked, untracked, and ignored files"`
Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: all passing

### Task 4: Abort finalization on suspicious untracked files before push [depends: 3]

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

### Task 5: Reject invalid shipping branch targets before squashing or pushing [depends: 3, 4]

### Task 5: Reject invalid shipping branch targets before squashing or pushing [depends: 3, 4]

**Covers:** AC11
Dependency note: this task depends on Task 3 for shipment data model continuity and Task 4 for finalization pipeline context, but `validateShipTarget()` itself is intentionally independent of finalization internals and must run first in orchestration.

**Files:**
- Modify: `extensions/megapowers/vcs/shipping.ts`
- Test: `tests/shipping.test.ts`

**Step 1 — Write the failing test**
In `tests/shipping.test.ts`, update the existing header import:

```ts
import {
  auditShipment,
  finalizeShipment,
  validateShipTarget,
  type ExecGit,
} from "../extensions/megapowers/vcs/shipping.js";
```

Then append this test:

```ts
it("rejects missing, empty, and base-branch ship targets before any push attempt", () => {
  expect(validateShipTarget(null, "main")).toEqual({ ok: false, error: "Cannot ship: branchName is missing." });
  expect(validateShipTarget("", "main")).toEqual({ ok: false, error: "Cannot ship: branchName is empty." });
  expect(validateShipTarget("feat/093-vcs-lifecycle-audit-clean-commit-strateg", null)).toEqual({ ok: false, error: "Cannot ship: baseBranch is missing." });
  expect(validateShipTarget("feat/093-vcs-lifecycle-audit-clean-commit-strateg", "")).toEqual({ ok: false, error: "Cannot ship: baseBranch is missing." });
  expect(validateShipTarget("main", "main")).toEqual({ ok: false, error: "Cannot ship: branchName must differ from baseBranch (main)." });
  expect(validateShipTarget("feat/093-vcs-lifecycle-audit-clean-commit-strateg", "main")).toEqual({ ok: true });
});
```

**Step 2 — Run test, verify it fails**
Run: `bun test tests/shipping.test.ts -t "rejects missing, empty, and base-branch ship targets before any push attempt"`
Expected: FAIL — `SyntaxError: Export named 'validateShipTarget' not found in module '../extensions/megapowers/vcs/shipping.js'`

**Step 3 — Write minimal implementation**
This task defines the validator contract; Task 9 wires it into `shipAndCreatePR()` so invalid targets abort at `step: "validate"` before any squash/push/PR operations.
Add this helper to `extensions/megapowers/vcs/shipping.ts`:

```ts
export type ShipTargetResult = { ok: true } | { ok: false; error: string };

export function validateShipTarget(branchName: string | null, baseBranch: string | null): ShipTargetResult {
  if (branchName === null) return { ok: false, error: "Cannot ship: branchName is missing." };
  if (branchName.trim() === "") return { ok: false, error: "Cannot ship: branchName is empty." };
  if (!baseBranch || baseBranch.trim() === "") return { ok: false, error: "Cannot ship: baseBranch is missing." };
  if (branchName === baseBranch) {
    return { ok: false, error: `Cannot ship: branchName must differ from baseBranch (${baseBranch}).` };
  }
  return { ok: true };
// Exporting `ShipTargetResult` keeps the orchestration contract explicit for downstream callers/tests.
}
```
Error-format note: validation errors are clear and step-specific (`Cannot ship: ...`). Other steps may use equally clear step-specific phrasing (e.g., blocked files, PR failure) without requiring identical prefixes.

**Step 4 — Run test, verify it passes**
Run: `bun test tests/shipping.test.ts -t "rejects missing, empty, and base-branch ship targets before any push attempt"`
Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: all passing

### Task 6: Commit allowed dirty work during shipment finalization [depends: 3, 4, 5]

### Task 6: Commit allowed dirty work during shipment finalization [depends: 3, 4, 5]

**Files:**
- Modify: `extensions/megapowers/vcs/shipping.ts`
- Test: `tests/shipping.test.ts`

**Step 1 — Write the failing test**
Append this test to `tests/shipping.test.ts`:

```ts
it("runs the audit status first, then stages tracked and untracked files, then re-checks status before committing", async () => {
  const calls: string[][] = [];
  const execGit: ExecGit = async (args) => {
    calls.push(args);
    if (args.join(" ") === "status --porcelain --untracked-files=all --ignored") {
      return {
        stdout: [
          " M extensions/megapowers/commands.ts",
          "?? extensions/megapowers/vcs/shipping.ts",
          "!! coverage/index.html",
        ].join("\n"),
        stderr: "",
      };
    }
    if (args.join(" ") === "status --porcelain") {
      return {
        stdout: [
          "M  extensions/megapowers/commands.ts",
          "A  extensions/megapowers/vcs/shipping.ts",
        ].join("\n"),
        stderr: "",
      };
    }
    return { stdout: "", stderr: "" };
  };

  const result = await finalizeShipment(execGit, "093-vcs-lifecycle-audit-clean-commit-strateg");

  expect(result).toEqual({
    ok: true,
    committed: true,
    audit: {
      tracked: ["extensions/megapowers/commands.ts"],
      includedUntracked: ["extensions/megapowers/vcs/shipping.ts"],
      ignoredUntracked: ["coverage/index.html"],
      blockedUntracked: [],
    },
  });

  expect(calls[0]).toEqual(["status", "--porcelain", "--untracked-files=all", "--ignored"]);
  expect(calls).toContainEqual(["add", "-u"]);
  const untrackedAdds = calls.filter((c) => c[0] === "add" && c[1] === "--");
  expect(untrackedAdds).toEqual([["add", "--", "extensions/megapowers/vcs/shipping.ts"]]);
  expect(calls).toContainEqual(["status", "--porcelain"]);
  expect(calls).toContainEqual(["commit", "-m", "chore: finalize 093-vcs-lifecycle-audit-clean-commit-strateg"]);

});
```
This mock intentionally differentiates the two status phases (`--ignored` audit vs post-stage plain porcelain) so the test proves the second status check occurs before commit.
The second mock status output uses staged porcelain codes (`M  ...`, `A  ...`), explicitly proving tracked modifications were staged into the commit candidate before `commit` runs.
The first audit snapshot intentionally uses unstaged form (` M ...`) to represent pre-finalization dirty state; the second snapshot uses staged form (`M  ...`) to prove stage/recheck sequencing.

**Step 2 — Run test, verify it fails**
Run: `bun test tests/shipping.test.ts -t "runs the audit status first, then stages tracked and untracked files, then re-checks status before committing"`
Expected: FAIL — `expect(received).toEqual(expected)` showing missing `add`/`commit` calls because Task 4 currently returns early on dirty trees.

**Step 3 — Write minimal implementation**
`audit.includedUntracked` is already filtered by Task 3 classification and Task 4 blocked-file rejection; this task stages only the pre-approved untracked set.
Retain Task 4’s blocked-file guard unchanged:

```ts
if (audit.blockedUntracked.length > 0) {
  return {
    ok: false,
    error: `Blocked suspicious untracked files: ${audit.blockedUntracked.join(", ")}`,
    blockedFiles: audit.blockedUntracked,
  };
}
```
Keep Task 4’s initial `const audit = await auditShipment(execGit);` call and reuse that same `audit` result for staging; this task adds only the stage/recheck/commit path.
Update the dirty-tree path in `finalizeShipment()` inside `extensions/megapowers/vcs/shipping.ts`:
`ExecGit` in this codebase throws on non-zero exit; therefore `await execGit(["commit", ...])` is the success check. If it returns, commit succeeded and `committed: true` is valid.

```ts
const hasTracked = audit.tracked.length > 0;
const hasIncludedUntracked = audit.includedUntracked.length > 0;
if (!hasTracked && !hasIncludedUntracked) {
  return { ok: true, committed: false, audit };
}

await execGit(["add", "-u"]);
for (const path of audit.includedUntracked) {
  await execGit(["add", "--", path]);
}

const status = await execGit(["status", "--porcelain"]);
if (!status.stdout.trim()) {
  return { ok: true, committed: false, audit };
}

await execGit(["commit", "-m", `chore: finalize ${issueSlug}`]);
return { ok: true, committed: true, audit };
`chore: finalize ${issueSlug}` is intentionally an intermediate local finalization commit. Task 9/15 squash-and-push rewrites branch history into the final shipped `feat: ship ...` commit.
```

**Step 4 — Run test, verify it passes**
Run: `bun test tests/shipping.test.ts -t "runs the audit status first, then stages tracked and untracked files, then re-checks status before committing"`
Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: all passing

### Task 7: Extract squash-only shipping step and stop on squash failures [depends: 4, 5, 6]

### Task 7: Extract squash-only shipping step and stop on squash failures [depends: 4, 5, 6]
**Covers:** AC12, AC13

**Files:**
- Modify: `extensions/megapowers/vcs/branch-manager.ts`
- Test: `tests/branch-manager.test.ts`

**Step 1 — Write the failing test**
In `tests/branch-manager.test.ts`, update the existing header import:

```ts
import {
  ensureBranch,
  switchAwayCommit,
  squashAndPush,
  squashBranchToSingleCommit,
} from "../extensions/megapowers/vcs/branch-manager.js";
```

Then append this test:

```ts
it("soft-resets onto the base branch and writes one clean squash commit", async () => {
  const calls: string[][] = [];
  const execGit: ExecGit = async (args) => {
    calls.push(args);
    if (args[0] === "status") return { stdout: "M file.ts\n", stderr: "" };
    return { stdout: "", stderr: "" };
  };

  const result = await squashBranchToSingleCommit(execGit, "main", "feat: ship 093");

  expect(result).toEqual({ ok: true, committed: true });
  expect(calls).toEqual([
    ["reset", "--soft", "main"],
    ["status", "--porcelain"],
    ["commit", "-m", "feat: ship 093"],
  ]);
});
```

The existing `returns step: squash when squash fails` test stays in place and continues to cover the stop-on-squash-failure path.

**Step 2 — Run test, verify it fails**
Run: `bun test tests/branch-manager.test.ts -t "soft-resets onto the base branch and writes one clean squash commit"`
Expected: FAIL — `SyntaxError: Export named 'squashBranchToSingleCommit' not found in module '../extensions/megapowers/vcs/branch-manager.js'`

**Step 3 — Write minimal implementation**
In `extensions/megapowers/vcs/branch-manager.ts`, preserve the existing import because `ensureBranch()` and `switchAwayCommit()` still need `createBranch`, `checkoutBranch`, and `wipCommit`:

```ts
import { createBranch, checkoutBranch, wipCommit, squashOnto, pushBranch, type ExecGit, type WipCommitResult } from "./git-ops.js";
```

Keep the existing `SquashAndPushResult` declaration, add a new squash-only result type, and refactor the existing `squashAndPush()` to call the new helper instead of duplicating or redefining the public API:

```ts
export type SquashStepResult =
  | { ok: true; committed: boolean }
  | { ok: false; error: string; step: "squash" };

export async function squashBranchToSingleCommit(
  execGit: ExecGit,
  baseBranch: string,
  commitMessage: string,
): Promise<SquashStepResult> {
  const squashResult = await squashOnto(execGit, baseBranch, commitMessage);
  if (!squashResult.ok) {
    return { ok: false, error: squashResult.error, step: "squash" };
  }

  return { ok: true, committed: squashResult.committed };
}

export async function squashAndPush(
  execGit: ExecGit,
  branchName: string,
  baseBranch: string,
  commitMessage: string,
): Promise<SquashAndPushResult> {
  const squashResult = await squashBranchToSingleCommit(execGit, baseBranch, commitMessage);
  if (!squashResult.ok) {
    return { ok: false, error: squashResult.error, step: "squash" };
  }

  const pushResult = await pushBranch(execGit, branchName, true);
  if (!pushResult.ok) {
    return { ok: false, error: pushResult.error, step: "push" };
  }

  return { ok: true };
}
```

AC12 mapping: `squashBranchToSingleCommit()` is the explicit one-clean-commit seam before push.
AC13 mapping: a squash failure returns `step: "squash"` and exits before `pushBranch()` is attempted.

**Step 4 — Run test, verify it passes**
Run: `bun test tests/branch-manager.test.ts -t "soft-resets onto the base branch and writes one clean squash commit"`
Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: all passing

### Task 8: Pass base branch into PR creation and preserve clear skip/error results [depends: 5, 7]

### Task 8: Pass base branch into PR creation and preserve clear skip/error results [depends: 5, 7]

**Files:**
- Modify: `extensions/megapowers/vcs/pr-creator.ts`
- Test: `tests/pr-creator.test.ts`

**Step 1 — Write the failing test**
`tests/pr-creator.test.ts` is an existing suite in this repository and should be updated in place.
Preserve all other existing test cases in that file; only replace the named test and update the other createPR call sites in the same suite to include the new base-branch argument.
In `tests/pr-creator.test.ts`, replace the existing test named `it("creates PR with correct gh arguments and returns URL (AC12)", ...)` with:
That named test already exists in the current `tests/pr-creator.test.ts`; replace it in place (do not add a duplicate).

```ts
it("checks gh availability, passes explicit base/head arguments, and returns the PR URL", async () => {
  const calls: { cmd: string; args: string[] }[] = [];
  const execCmd: ExecCmd = async (cmd, args) => {
    calls.push({ cmd, args });
    if (args[0] === "pr") return { stdout: "https://github.com/org/repo/pull/42\n", stderr: "" };
    return { stdout: "gh version 2.0.0\n", stderr: "" };
  };

  const result = await createPR(execCmd, "main", "feat/my-feature", "Add feature", "Feature body");

  expect(result).toEqual({ ok: true, url: "https://github.com/org/repo/pull/42" });
  expect(calls[0]).toEqual({ cmd: "gh", args: ["--version"] });
  expect(calls[1]).toEqual({
    cmd: "gh",
    args: [
      "pr",
      "create",
      "--base",
      "main",
      "--head",
      "feat/my-feature",
      "--title",
      "Add feature",
      "--body",
      "Feature body",
    ],
  });
});
```

**Step 2 — Run test, verify it fails**
Run: `bun test tests/pr-creator.test.ts -t "checks gh availability, passes explicit base/head arguments, and returns the PR URL"`
Expected: FAIL — `expect(received).toEqual(expected)` because `--base` is missing from the `gh pr create` argument list

**Step 3 — Write minimal implementation**
Update `extensions/megapowers/vcs/pr-creator.ts` so the exported `PRResult` union is explicit before the new `createPR()` signature:

```ts
export type PRResult =
  | { ok: true; url: string }
  | { ok: false; error: string }
  | { skipped: true; reason: string };

export async function createPR(
  execCmd: ExecCmd,
  baseBranch: string,
  branchName: string,
  title: string,
  body: string,
): Promise<PRResult> {
  try {
    await execCmd("gh", ["--version"]);
  } catch {
    return { skipped: true, reason: "gh CLI not installed" };
  }

  try {
    const result = await execCmd("gh", [
      "pr",
      "create",
      "--base",
      baseBranch,
      "--head",
      branchName,
      "--title",
      title,
      "--body",
      body,
    ]);
    return { ok: true, url: result.stdout.trim() };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "createPR failed";
    return { ok: false, error: message };
  }
}
```

At this point in the plan, the only existing `createPR()` call sites are the three tests in `tests/pr-creator.test.ts`. Update the other two tests in that file to pass `"main"` as the first argument, and keep every mock executor returning both `stdout` and `stderr` for both the `gh --version` and `gh pr create` branches.
The two additional existing tests to update are:
- `it("returns skipped when gh is not installed (AC12)", ...)`
- `it("returns ok: false when gh pr create fails (AC12)", ...)`
Both must pass `"main"` as the new first argument to `createPR(...)`.
Call-site reconciliation required in later tasks:
- Task 9 must call `createPR(request.execCmd, request.baseBranch!, request.branchName!, request.prTitle, request.prBody)`.
- Task 10/18 `ship-cli` flow passes these fields via `shipAndCreatePR`, so argument order consistency is enforced transitively.
Use these exact call updates in the other two tests:

```ts
const result = await createPR(execCmd, "main", "feat/my-feature", "Title", "Body");
expect(result).toEqual({ skipped: true, reason: "gh CLI not installed" });
```

```ts
const result = await createPR(execCmd, "main", "feat/my-feature", "Title", "Body");
expect(result).toEqual({ ok: false, error: "authentication required" });
```

**Step 4 — Run test, verify it passes**
Run: `bun test tests/pr-creator.test.ts -t "checks gh availability, passes explicit base/head arguments, and returns the PR URL"`
Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: all passing

### Task 9: Orchestrate finalize, squash, push, and PR as one shipping path [depends: 4, 5, 6, 7, 8]

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

### Task 10: Update the done prompt to call the code-owned shipping helper [depends: 9]

### Task 10: Update the done prompt to call the code-owned shipping helper [depends: 9]

**Files:**
- Create: `extensions/megapowers/vcs/ship-cli.ts`
- Create: `tests/done-prompt.test.ts`
- Modify: `prompts/done.md`
- Test: `tests/done-prompt.test.ts`

**Step 1 — Write the failing test**
`buildInjectedPrompt()` is an existing helper exported by `extensions/megapowers/prompt-inject.ts`; this task verifies the done-prompt wiring through that existing integration point.
No change to `extensions/megapowers/prompt-inject.ts` is required in this task; the test imports and exercises that existing export directly.
This task verifies prompt routing only; CLI state loading (`readState` in `ship-cli.ts`) is intentionally unit-covered in Task 18.
Keep the assertion set focused on both command wiring and preserved prompt structure (header + checklist + push-and-pr section) so formatting regressions are caught.
Create `tests/done-prompt.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, rmSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { buildInjectedPrompt } from "../extensions/megapowers/prompt-inject.js";
import { writeState } from "../extensions/megapowers/state/state-io.js";
import { createInitialState } from "../extensions/megapowers/state/state-machine.js";

describe("done prompt shipping instructions", () => {
  let tmp: string;

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), "done-prompt-"));
    mkdirSync(join(tmp, ".megapowers"), { recursive: true });
    writeState(tmp, {
      ...createInitialState(),
      activeIssue: "093-vcs-lifecycle-audit-clean-commit-strateg",
      workflow: "feature",
      phase: "done",
      megaEnabled: true,
      doneActions: ["push-and-pr"],
      branchName: "feat/093-vcs-lifecycle-audit-clean-commit-strateg",
      baseBranch: "main",
    });
  });

  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  it("routes push-and-pr through the stable ship-cli entrypoint instead of raw git push", () => {
    const result = buildInjectedPrompt(tmp);
    expect(result).toContain("bun extensions/megapowers/vcs/ship-cli.ts");
    expect(result).toContain("Do not run raw `git push` or `gh pr create` commands yourself");
    expect(result).toContain("if push fails, do not attempt PR creation");
    expect(result).not.toContain("git push origin {{branch_name}}");
    expect(result).not.toContain("gh pr create --base {{base_branch}}");
  });
});
```

**Step 2 — Run test, verify it fails**
Run: `bun test tests/done-prompt.test.ts -t "routes push-and-pr through the stable ship-cli entrypoint instead of raw git push"`
Expected: FAIL — `expect(received).toContain(expected)` because the prompt still contains the raw push/PR instructions

**Step 3 — Write minimal implementation**
Create `extensions/megapowers/vcs/ship-cli.ts` as shown below, then update only the `push-and-pr` action block in `prompts/done.md`.

This task owns the initial `ship-cli.ts` entrypoint and **only** the `### push-and-pr` block in `prompts/done.md`. Preserve the entire rest of `prompts/done.md` structure verbatim. Task 18 should only add direct unit coverage to this already-exported helper without changing prompt ownership.

The current `prompts/done.md` file already contains both boundary headings:
- `### push-and-pr` at the current block starting around line 60
In the current file revision, that block spans approximately lines 60–89; treat those as the edit window and re-check with `read("prompts/done.md", { offset: 60, limit: 35 })` before replacing.
- `### close-issue` at the next block starting around line 90

Replace the entire existing block from the `### push-and-pr` heading through the cleanup reminder immediately before `### close-issue`. Do not modify any earlier headings, any earlier action instructions, or the entire `### close-issue` section.
Exact current block markers in `prompts/done.md`:
- Start marker line: `### push-and-pr`
- First line inside old block: `Push the feature branch and create a PR:`
- End marker boundary: the closing code fence of the cleanup reminder block immediately above `### close-issue`.
If the template ever contains multiple similarly worded reminders, use the `### push-and-pr` section that is immediately followed later by `### close-issue` in the same Action Instructions block.
These markers define the replacement boundary and should be matched verbatim before editing.
To avoid boundary mistakes, first inspect that exact region before editing:
```ts
read("prompts/done.md", { offset: 60, limit: 35 })
```
Then replace only from `### push-and-pr` through the cleanup reminder line immediately above `### close-issue`.

Create `extensions/megapowers/vcs/ship-cli.ts`:

```ts
import { readState } from "../state/state-io.js";
import { shipAndCreatePR } from "./shipping.js";

export function buildShipRequest(state: { activeIssue: string | null; branchName: string | null; baseBranch: string | null }) {
  return {
    issueSlug: state.activeIssue ?? "",
    branchName: state.branchName,
    baseBranch: state.baseBranch,
    commitMessage: `feat: ship ${state.activeIssue ?? "issue"}`,
    prTitle: `Ship ${state.activeIssue ?? "issue"}`,
    prBody: `Resolves ${state.activeIssue ?? "issue"}`,
  };
}

if (import.meta.main) {
  const state = readState(process.cwd());
  const request = buildShipRequest(state);
  const execGit = async (args: string[]) => {
    const proc = Bun.spawn(["git", ...args], { stdout: "pipe", stderr: "pipe" });
    const stdout = await new Response(proc.stdout).text();
    const stderr = await new Response(proc.stderr).text();
    const code = await proc.exited;
    if (code !== 0) throw new Error(stderr.trim() || `git ${args[0]} failed`);
    return { stdout, stderr };
  };
  const execCmd = async (cmd: string, args: string[]) => {
    const proc = Bun.spawn([cmd, ...args], { stdout: "pipe", stderr: "pipe" });
    const stdout = await new Response(proc.stdout).text();
    const stderr = await new Response(proc.stderr).text();
    const code = await proc.exited;
    if (code !== 0) throw new Error(stderr.trim() || `${cmd} ${args[0]} failed`);
    return { stdout, stderr };
  };
  const result = await shipAndCreatePR({ execGit, execCmd, ...request });
  console.log(JSON.stringify(result, null, 2));
}
```
`buildShipRequest()` must return exactly: `{ issueSlug, branchName, baseBranch, commitMessage, prTitle, prBody }` so spreading into `shipAndCreatePR({ execGit, execCmd, ...request })` matches Task 9’s `ShipRequest` shape.

Use this exact replacement content for the prompt section:

```md
### push-and-pr
Ship the current issue through the code-owned VCS lifecycle helper. Do not run raw `git push` or `gh pr create` commands yourself.

Run:
```bash
bun extensions/megapowers/vcs/ship-cli.ts
```

Interpret the JSON result from that command as follows:
- if finalization blocks suspicious files, stop and report the blocked file list
- if push fails, do not attempt PR creation
- if PR is skipped because `gh` is unavailable, report that push succeeded and PR must be created manually
- after a successful ship result, print the cleanup reminder

After your PR is merged on GitHub, run these cleanup commands:
```
git checkout main && git pull && git branch -d {{branch_name}}
```
```

**Step 4 — Run test, verify it passes**
Run: `bun test tests/done-prompt.test.ts -t "routes push-and-pr through the stable ship-cli entrypoint instead of raw git push"`
Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: all passing

### Task 11: Document AC12 squash guarantee coverage mapping [no-test] [depends: 7]

### Task 11: Document AC12 squash guarantee coverage mapping [depends: 7] [no-test]

**Covers:** AC12

**Justification:** Plan-coverage clarification only. AC12 implementation and tests already live in Task 7 + existing `tests/branch-manager.test.ts`; this task makes that mapping explicit for reviewers.

**Files:**
- Modify: `.megapowers/plans/093-vcs-lifecycle-audit-clean-commit-strateg/tasks/task-007.md`

**Step 1 — Add explicit AC12 mapping note**
In Task 7 text, explicitly state that `squashBranchToSingleCommit()` + `squashAndPush()` enforce AC12 (single clean squash commit before push).

**Step 2 — Verify mapping consistency**
Confirm Task 7 still points to the squash-specific tests in `tests/branch-manager.test.ts`.

Expected: PASS — AC12 is explicitly mapped to implementation + tests.

**Step 3 — Verification command**
Run: `read .megapowers/plans/093-vcs-lifecycle-audit-clean-commit-strateg/tasks/task-007.md`
Expected: AC12 mapping note present and unambiguous.

### Task 12: Stop the shipping pipeline before push/PR when finalization aborts [depends: 9]

### Task 12: Stop the shipping pipeline before push/PR when finalization aborts [depends: 9]

**Files:**
- Modify: `extensions/megapowers/vcs/shipping.ts`
- Test: `tests/shipping.test.ts`

**Step 1 — Write the failing test**
Append this test to `tests/shipping.test.ts`:

```ts
it("returns a finalize error and does not attempt push or PR when finalization blocks shipment", async () => {
  const gitCalls: string[][] = [];
  const execGit: ExecGit = async (args) => {
    gitCalls.push(args);
    if (args[0] === "status" && args.includes("--ignored")) {
      return { stdout: "?? .env.local\n", stderr: "" };
    }
    throw new Error(`unexpected git call: ${args.join(" ")}`);
  };

  let prAttempted = false;
  const execCmd: ExecCmd = async () => {
    prAttempted = true;
    return { stdout: "", stderr: "" };
  };

  const result = await shipAndCreatePR({
    execGit,
    execCmd,
    issueSlug: "093-vcs-lifecycle-audit-clean-commit-strateg",
    branchName: "feat/093-vcs-lifecycle-audit-clean-commit-strateg",
    baseBranch: "main",
    commitMessage: "feat: ship 093-vcs-lifecycle-audit-clean-commit-strateg",
    prTitle: "Ship 093",
    prBody: "Resolves 093",
  });

  expect(result).toEqual({
    ok: false,
    step: "finalize",
    error: "Blocked suspicious untracked files: .env.local",
    blockedFiles: [".env.local"],
    pushed: false,
  });
  expect(gitCalls).toEqual([["status", "--porcelain", "--untracked-files=all", "--ignored"]]);
  expect(gitCalls.some((c) => c[0] === "push")).toBe(false);
  expect(prAttempted).toBe(false);
  // Explicit guard verification: PR executor was never invoked after finalize abort.
  expect(prAttempted).toBe(false);
});
```

**Step 2 — Run test, verify it fails**
Run: `bun test tests/shipping.test.ts -t "returns a finalize error and does not attempt push or PR when finalization blocks shipment"`
Expected: FAIL — `Error: unexpected git call: reset --soft main` because the orchestrator still continues into squash/push after finalization returns `{ ok: false }`.

**Step 3 — Write minimal implementation**
In `extensions/megapowers/vcs/shipping.ts`, update `ShipResult` and add the finalization guard in `shipAndCreatePR()`:

```ts
export type ShipResult =
  | { ok: true; finalized: boolean; pushed: true; pr: PRResult }
  | { ok: false; step: "validate" | "finalize" | "squash" | "push"; error: string; pushed: false; blockedFiles?: string[] };

const finalized = await finalizeShipment(request.execGit, request.issueSlug);
if (!finalized.ok) {
  return { ok: false, step: "finalize", error: finalized.error, pushed: false, blockedFiles: finalized.blockedFiles };
  // Preserve blocked-file detail from finalizeShipment for AC9 caller visibility.
}
```

Keep this guard before `squashAndPush(...)` and before `createPR(...)`.
This guard only triggers when `finalized.ok === false` (blocked suspicious files). Clean working trees still return `{ ok: true, committed: false }`, so Task 9’s clean-tree happy path remains valid.

**Step 4 — Run test, verify it passes**
Run: `bun test tests/shipping.test.ts -t "returns a finalize error and does not attempt push or PR when finalization blocks shipment"`
Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: all passing

### Task 13: Surface PR creation failures without hiding a successful push [depends: 9, 12]

### Task 13: Surface PR creation failures without hiding a successful push [depends: 9, 12]
**Files:**
- Modify: `extensions/megapowers/vcs/shipping.ts`
- Test: `tests/shipping.test.ts`

**Step 1 — Write the failing test**
Append this single-scenario test to `tests/shipping.test.ts`:
```ts
it("returns a targeted PR error while preserving the earlier successful push result", async () => {
  const execGit: ExecGit = async (args) => {
    if (args[0] === "status" && args.includes("--ignored")) return { stdout: "", stderr: "" };
    if (args[0] === "status" && !args.includes("--ignored")) return { stdout: "", stderr: "" };
    return { stdout: "", stderr: "" };
  };
  const execCmd: ExecCmd = async (_cmd, args) => {
    if (args[0] === "--version") return { stdout: "gh version 2.0.0\n", stderr: "" };
    throw new Error("authentication required");
  };
  const result = await shipAndCreatePR({
    execGit,
    execCmd,
    issueSlug: "093-vcs-lifecycle-audit-clean-commit-strateg",
    branchName: "feat/093-vcs-lifecycle-audit-clean-commit-strateg",
    baseBranch: "main",
    commitMessage: "feat: ship 093-vcs-lifecycle-audit-clean-commit-strateg",
    prTitle: "Ship 093",
    prBody: "Resolves 093",
  });
  expect(result).toEqual({
    ok: false,
    step: "pr",
    error: "authentication required",
    pushed: true,
    pr: { ok: false, error: "authentication required" },
  });
});
```

This task is intentionally focused on AC17 only. GH-missing skip behavior remains covered by Task 8 + Task 9.

**Step 2 — Run test, verify it fails**
Run: `bun test tests/shipping.test.ts -t "returns a targeted PR error while preserving the earlier successful push result"`
Expected: FAIL — `expect(received).toEqual(expected)` because Task 9 currently returns `{ ok: true, pushed: true, pr }` even when `pr.ok === false`.

**Step 3 — Write minimal implementation**
Use the existing `PRResult` export from `extensions/megapowers/vcs/pr-creator.ts` when refining the `ShipResult` union, and preserve Task 12's blocked-file payload on the non-pushed branch:

```ts
export type ShipResult =
  | { ok: true; finalized: boolean; pushed: true; pr: PRResult }
  | {
      ok: false;
      step: "validate" | "finalize" | "squash" | "push";
      error: string;
      pushed: false;
      blockedFiles?: string[];
    }
  | { ok: false; step: "pr"; error: string; pushed: true; pr: { ok: false; error: string } };

const pr = await createPR(
  request.execCmd,
  request.baseBranch!,
  request.branchName!,
  request.prTitle,
  request.prBody,
);
if ("error" in pr) {
  return { ok: false, step: "pr", error: pr.error, pushed: true, pr };
}
return { ok: true, finalized: finalized.committed, pushed: true, pr };
```

This preserves `{ skipped: true, reason: "gh CLI not installed" }` on the success branch while surfacing a clear PR failure when push already succeeded.

**Step 4 — Run test, verify it passes**
Run: `bun test tests/shipping.test.ts -t "returns a targeted PR error while preserving the earlier successful push result"`
Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: all passing

### Task 14: Document AC13 squash-failure stop coverage mapping [no-test] [depends: 7, 9]

### Task 14: Document AC13 squash-failure stop coverage mapping [depends: 7, 9] [no-test]

**Covers:** AC13

**Justification:** Plan-coverage clarification only. AC13 behavior is implemented in Task 7 (`step: "squash"` on squash failure) and consumed in Task 9 orchestration (`pushed: false` early return). This task documents that linkage explicitly.

**Files:**
- Modify: `.megapowers/plans/093-vcs-lifecycle-audit-clean-commit-strateg/tasks/task-007.md`
- Modify: `.megapowers/plans/093-vcs-lifecycle-audit-clean-commit-strateg/tasks/task-009.md`

**Step 1 — Add explicit AC13 mapping note in Task 7**
State that squash failure returns a targeted squash error and does not continue to push.

**Step 2 — Add explicit orchestration stop note in Task 9**
State that when `squashAndPush()` returns `step: "squash"`, `shipAndCreatePR()` returns with `pushed: false` and does not invoke PR creation.

**Step 3 — Verification command**
Run:
- `read .megapowers/plans/093-vcs-lifecycle-audit-clean-commit-strateg/tasks/task-007.md`
- `read .megapowers/plans/093-vcs-lifecycle-audit-clean-commit-strateg/tasks/task-009.md`
Expected: AC13 mapping appears explicitly in both tasks.

### Task 15: Extend VCS coverage with a real-git shipping regression [depends: 9, 13]

### Task 15: Extend VCS coverage with a real-git shipping regression [depends: 9, 13]
**Covers:** AC18

**Files:**
- Create: `tests/vcs-lifecycle-integration.test.ts`
- Test: `tests/vcs-lifecycle-integration.test.ts`

**Step 1 — Write the failing test**
Create `tests/vcs-lifecycle-integration.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { execSync, spawnSync } from "node:child_process";
import { shipAndCreatePR } from "../extensions/megapowers/vcs/shipping.js";
import type { ExecGit } from "../extensions/megapowers/vcs/git-ops.js";
import type { ExecCmd } from "../extensions/megapowers/vcs/pr-creator.js";

function runGit(command: string, cwd: string): string {
  try {
    return execSync(command, { cwd, stdio: "pipe", encoding: "utf8" }) ?? "";
  } catch (error: any) {
    throw new Error(`git command failed: ${command}\n${error?.message ?? error}`);
  }
}

describe("VCS lifecycle integration", () => {
  let tmp: string;
  let remote: string;

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), "vcs-lifecycle-"));
    remote = mkdtempSync(join(tmpdir(), "vcs-remote-"));
    mkdirSync(join(tmp, ".megapowers"), { recursive: true });
    runGit("git init -b main", tmp);
    runGit("git init --bare", remote);
    runGit(`git remote add origin ${remote}`, tmp);
    runGit('git config user.name "test"', tmp);
    runGit('git config user.email "test@test"', tmp);
    runGit('git commit --allow-empty -m "init"', tmp);
    runGit("git push -u origin main", tmp);
  });

  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
    rmSync(remote, { recursive: true, force: true });
  });

  it("ships one clean remote commit in a real git repo", async () => {
    runGit("git checkout -b feat/002-second", tmp);

    writeFileSync(join(tmp, "tracked.ts"), "export const tracked = 1;\n");
    runGit("git add tracked.ts", tmp);
    runGit('git commit -m "WIP: local"', tmp);

    writeFileSync(join(tmp, "tracked.ts"), "export const tracked = 2;\n");
    writeFileSync(join(tmp, "new-file.ts"), "export const second = 2;\n");

    const execGit: ExecGit = async (args) => {
      const result = spawnSync("git", args, { cwd: tmp, encoding: "utf8" });
      if (result.status !== 0) {
        throw new Error((result.stderr || "").trim() || `git ${args[0]} failed`);
      }
      return { stdout: result.stdout ?? "", stderr: result.stderr ?? "" };
    };

    const execCmd: ExecCmd = async (_cmd, args) => {
      if (args[0] === "--version") return { stdout: "gh version 2.0.0\n", stderr: "" };
      if (args[0] === "pr") return { stdout: "https://github.com/org/repo/pull/42\n", stderr: "" };
      throw new Error(`unexpected gh args: ${args.join(" ")}`);
    };

    const result = await shipAndCreatePR({
      execGit,
      execCmd,
      issueSlug: "002-second",
      branchName: "feat/002-second",
      baseBranch: "main",
      commitMessage: "feat: ship 002-second",
      prTitle: "Ship 002-second",
      prBody: "Resolves 002-second",
    });

    expect(runGit("git rev-list --count main..feat/002-second", tmp).trim()).toBe("1");

    const remoteBranchLog = runGit(`git --git-dir=${remote} log refs/heads/feat/002-second --oneline`, tmp);
    expect(remoteBranchLog).toContain("feat: ship 002-second");
    expect(remoteBranchLog).not.toContain("chore: finalize 002-second");
    expect(remoteBranchLog).not.toContain("WIP: local");

    expect(runGit(`git --git-dir=${remote} show refs/heads/feat/002-second:tracked.ts`, tmp)).toContain("export const tracked = 2;");
    expect(runGit(`git --git-dir=${remote} show refs/heads/feat/002-second:new-file.ts`, tmp)).toContain("export const second = 2;");

    expect(result).toEqual({ ok: true, finalized: true, pushed: true, pr: { ok: true, url: "https://github.com/org/repo/pull/42" } });
  });
});
```

Use `spawnSync("git", args, ...)` for the injected `execGit` wrapper. Do **not** build git commands with `args.join(" ")`, because this test sends commit messages with spaces.

**Step 2 — Run test, verify it fails**
Run: `bun test tests/vcs-lifecycle-integration.test.ts -t "ships one clean remote commit in a real git repo"`
Expected: FAIL — before finalization+squash are wired correctly end-to-end, the remote-history assertions fail because the shipped branch still contains `WIP: local` or `chore: finalize 002-second`, or the remote tree is missing the final dirty files.

**Step 3 — Write minimal implementation**
No new production module is required beyond Tasks 9 and 13. Wire those helpers together exactly as described in earlier tasks so this regression passes:

```ts
// ship -> validateShipTarget() -> finalizeShipment() -> squashAndPush() -> createPR()
```

This task is intentionally narrower than the unit suites: it complements the earlier `shipping`, `branch-manager`, and `pr-creator` tests by proving that a real git repo ends up with one clean shipped commit on the remote, with final tracked and untracked file content present and no leaked intermediate history.

If any helper signatures diverged while implementing earlier tasks, reconcile them now so this integration test uses the final public API:
- `shipAndCreatePR({ execGit, execCmd, issueSlug, branchName, baseBranch, commitMessage, prTitle, prBody })`

**Step 4 — Run test, verify it passes**
Run: `bun test tests/vcs-lifecycle-integration.test.ts -t "ships one clean remote commit in a real git repo"`
Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: all passing

### Task 16: Record a non-feature base branch during activation [depends: 2]

### Task 16: Record a non-feature base branch during activation [depends: 2]

**Covers:** AC1, AC2

**Files:**
AC1-specific assertion in this task: successful activation persists `branchName` (e.g., `feat/003-release-fix`) to state.
- Create: `tests/vcs-base-branch-activation.test.ts`
- Modify: `extensions/megapowers/commands.ts`
- Test: `tests/vcs-base-branch-activation.test.ts`

**Step 1 — Write the failing test**
Create `tests/vcs-base-branch-activation.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, rmSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { handleIssueCommand, resolveActivationBaseBranch } from "../extensions/megapowers/commands.js";
import { readState } from "../extensions/megapowers/state/state-io.js";
import { createInitialState } from "../extensions/megapowers/state/state-machine.js";
import type { ExecGit } from "../extensions/megapowers/vcs/git-ops.js";

function makeMockUI(newActiveIssue: string) {
  return {
    handleIssueCommand: async () => ({
      ...createInitialState(),
      activeIssue: newActiveIssue,
      workflow: "feature" as const,
      phase: "brainstorm" as const,
    }),
    renderDashboard: () => {},
    updateStatus: () => {},
    handleTriageCommand: async (s: any) => s,
  };
}

describe("activation base-branch capture", () => {
  let tmp: string;

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), "vcs-base-branch-"));
    mkdirSync(join(tmp, ".megapowers"), { recursive: true });
  });

  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  it("records branchName/baseBranch on activation success (AC1/AC2) while preserving stale-feature cleanup behavior", async () => {
    const calls: string[][] = [];
    const headSequence = ["feat/orphan\n", "release/2026.03\n"] as const;
    // Explicit sequence avoids ambiguous counter logic while still exercising both code paths.
    const execGit: ExecGit = async (args) => {
      calls.push(args);
      if (args[0] === "rev-parse" && args[1] === "--abbrev-ref") {
        return { stdout: headSequence[Math.min(calls.filter((c) => c[0] === "rev-parse" && c[1] === "--abbrev-ref").length - 1, 1)], stderr: "" };
      }
      if (args[0] === "remote") return { stdout: "origin\n", stderr: "" };
      if (args[0] === "fetch") return { stdout: "", stderr: "" };
      if (args[0] === "rev-list") return { stdout: "0\t2\n", stderr: "" };
      if (args[0] === "rev-parse" && args[1] === "--verify") throw new Error("not found");
      return { stdout: "", stderr: "" };
    };

    const resolved = await resolveActivationBaseBranch(execGit);
    expect(resolved).toBe("main");
    expect(calls.some((c) => c[0] === "checkout" && c[1] === "main")).toBe(true);

    let selectCalled = false;
    await handleIssueCommand(
      "list",
      {
        cwd: tmp,
        hasUI: true,
        ui: {
          notify: () => {},
          select: async () => {
            selectCalled = true;
            return "Use local as-is";
          },
        },
      } as any,
      {
        store: { listIssues: () => [] } as any,
        ui: makeMockUI("003-release-fix"),
        execGit,
      } as any,
    );

    expect(selectCalled).toBe(true);
    expect(calls.some((c) => c[0] === "pull")).toBe(false);
    expect(readState(tmp)).toMatchObject({
      baseBranch: "release/2026.03",
      branchName: "feat/003-release-fix",
    });
    // `baseBranch` is later threaded into shipAndCreatePR for shipping operations.
  });
});
```

**Step 2 — Run test, verify it fails**
Run: `bun test tests/vcs-base-branch-activation.test.ts -t "records branchName/baseBranch on activation success (AC1/AC2) while preserving stale-feature cleanup behavior"`
Expected: FAIL — `SyntaxError: Export named 'resolveActivationBaseBranch' not found in module '../extensions/megapowers/commands.js'`

**Step 3 — Write minimal implementation**
In `extensions/megapowers/commands.ts`, extract helper logic from the existing fresh-activation branch handling:
This is a **new exported helper** from `commands.ts` (not previously exported), so the test import path is valid only after this task's implementation.

```ts
export async function resolveActivationBaseBranch(execGit: ExecGit): Promise<string | null> {
  try {
    const r = await execGit(["rev-parse", "--abbrev-ref", "HEAD"]);
    const currentBranch = r.stdout.trim();
    if (currentBranch && /^(feat|fix)\//.test(currentBranch)) {
      await execGit(["checkout", "main"]);
      return "main";
    }
    return currentBranch || null;
  } catch {
    return null;
  }
}
```

Then update the fresh activation path in `handleIssueCommand()` to use the helper but keep the existing sync prompt flow afterward:

```ts
let baseBranch: string | null = null;
if (prevState.branchName) {
  baseBranch = prevState.baseBranch;
} else {
  baseBranch = await resolveActivationBaseBranch(deps.execGit);

  if (baseBranch && deps.execGit) {
    const syncStatus = await checkBranchSync(deps.execGit, baseBranch);
    if (syncStatus.hasRemote && syncStatus.behind > 0 && ctx.hasUI && ctx.ui.select) {
      const choice = await ctx.ui.select(
        `Local \`${baseBranch}\` is ${syncStatus.behind} commit(s) behind remote.`,
        ["Pull latest (recommended)", "Use local as-is"],
      );
      if (choice === "Pull latest (recommended)") {
        try {
          await deps.execGit(["pull"]);
        } catch (err: any) {
          if (ctx.hasUI) ctx.ui.notify(`VCS: git pull failed: ${err?.message}`, "error");
        }
      }
    }
  }
}

const result = await ensureBranch(deps.execGit, newState.activeIssue, newState.workflow);
if ("branchName" in result) {
  newState.branchName = result.branchName;
  newState.baseBranch = baseBranch;
  // Equality validation is enforced at ship time by Task 5/9 (`validateShipTarget`).
```
Keep the existing persistence call after this block:
```ts
writeState(ctx.cwd, newState);
```
so `readState(tmp)` assertions in the test observe `branchName/baseBranch` updates.

Do not remove stale-branch cleanup or sync prompting.
`resolveActivationBaseBranch()` behavior is branch-sensitive: `feat/*`/`fix/*` -> checkout `main`; non-feature branches (e.g. `release/2026.03`) -> returned as-is. The two mocked HEAD values intentionally exercise both code paths.
The test intentionally uses two `rev-parse --abbrev-ref HEAD` responses from different call sites: one for stale feature-branch cleanup (`feat/orphan` → checkout `main`), and a later fresh activation capture (`release/2026.03`).
This project standardizes on `main` (existing command tests and done-phase behavior already assume it), so the helper keeps explicit `checkout main` semantics for stale `feat/*`/`fix/*` cleanup.

**Step 4 — Run test, verify it passes**
Run: `bun test tests/vcs-base-branch-activation.test.ts -t "records branchName/baseBranch on activation success (AC1/AC2) while preserving stale-feature cleanup behavior"`
Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: all passing

### Task 17: Document AC18 non-main base validation coverage mapping [no-test] [depends: 9, 15, 16]

### Task 17: Document AC18 non-main base validation coverage mapping [depends: 9, 15, 16] [no-test]
**Covers:** AC18

**Justification:** Plan-coverage clarification only. Task 16 captures a non-feature `baseBranch`, Task 9 now exercises the validate short-circuit for a captured non-main base branch, and Task 15 adds the real-git shipped-history regression. This task makes that linkage explicit without inventing a redundant post-implementation TDD task.

**Files:**
- Modify: `.megapowers/plans/093-vcs-lifecycle-audit-clean-commit-strateg/tasks/task-009.md`
- Modify: `.megapowers/plans/093-vcs-lifecycle-audit-clean-commit-strateg/tasks/task-015.md`

**Step 1 — Add explicit Task 16 → Task 9 linkage note**
In Task 9 text, state that the validate short-circuit tests include a captured non-main base branch case representing Task 16's persisted `baseBranch`.

**Step 2 — Add explicit AC18 mapping note in Task 15**
In Task 15 text, state that the real-git regression complements the unit suites by proving the shipped remote history collapses to one clean commit with final file content present.

**Step 3 — Verification command**
Run:
- `read .megapowers/plans/093-vcs-lifecycle-audit-clean-commit-strateg/tasks/task-009.md`
- `read .megapowers/plans/093-vcs-lifecycle-audit-clean-commit-strateg/tasks/task-015.md`
Expected: AC18 coverage mapping is explicit and there is no standalone redundant post-implementation regression task.

### Task 18: Extract a testable ship-cli runner [depends: 10]

### Task 18: Extract a testable ship-cli runner [depends: 10]

**Files:**
- Create: `tests/ship-cli.test.ts`
- Modify: `extensions/megapowers/vcs/ship-cli.ts`
- Test: `tests/ship-cli.test.ts`

**Step 1 — Write the failing test**
Create `tests/ship-cli.test.ts`:

```ts
import { describe, it, expect } from "bun:test";
import { buildShipRequest, runShipCli } from "../extensions/megapowers/vcs/ship-cli.js";

describe("ship-cli", () => {
  it("builds a stable ship request and passes it through the CLI runner", async () => {
    const state = {
      activeIssue: "093-vcs-lifecycle-audit-clean-commit-strateg",
      branchName: "feat/093-vcs-lifecycle-audit-clean-commit-strateg",
      baseBranch: "main",
    } as any;

    const logs: string[] = [];
    const result = await runShipCli(state, {
      execGit: async () => ({ stdout: "", stderr: "" }),
      execCmd: async () => ({ stdout: "", stderr: "" }),
      ship: async (request) => {
        expect(request).toEqual({
          ...buildShipRequest(state),
          execGit: expect.any(Function),
          execCmd: expect.any(Function),
        });
        expect(request.issueSlug).toBe("093-vcs-lifecycle-audit-clean-commit-strateg");
        expect(request.branchName).toBe("feat/093-vcs-lifecycle-audit-clean-commit-strateg");
        expect(request.baseBranch).toBe("main");
        return { ok: true, finalized: false, pushed: true, pr: { skipped: true, reason: "gh CLI not installed" } } as const;
      },
      log: (line: string) => logs.push(line),
    });

    expect(result).toEqual({ ok: true, finalized: false, pushed: true, pr: { skipped: true, reason: "gh CLI not installed" } });
    expect(logs).toEqual([
      JSON.stringify({ ok: true, finalized: false, pushed: true, pr: { skipped: true, reason: "gh CLI not installed" } }, null, 2),
    ]);
  });
});
```
This task intentionally unit-tests CLI request plumbing with an injected `ship` function; the full finalization/push/PR error matrix remains covered by shipping tasks 12 and 13.

**Step 2 — Run test, verify it fails**
Run: `bun test tests/ship-cli.test.ts -t "builds a stable ship request and passes it through the CLI runner"`
Expected: FAIL — `SyntaxError: Export named 'runShipCli' not found in module '../extensions/megapowers/vcs/ship-cli.js'`

**Step 3 — Write minimal implementation**
Extend `extensions/megapowers/vcs/ship-cli.ts` by extracting the main execution path into a named helper that keeps using the Task 10 `buildShipRequest()` export:

```ts
export async function runShipCli(
  state: { activeIssue: string | null; branchName: string | null; baseBranch: string | null },
  deps: {
    execGit: (args: string[]) => Promise<{ stdout: string; stderr: string }>;
    execCmd: (cmd: string, args: string[]) => Promise<{ stdout: string; stderr: string }>;
    ship: (request: Parameters<typeof shipAndCreatePR>[0]) => ReturnType<typeof shipAndCreatePR>;
    // `shipAndCreatePR` takes one object argument (`ShipRequest`), so this injected function is called with a single spread object below.
    log: (line: string) => void;
  },
) {
  const result = await deps.ship({
    execGit: deps.execGit,
    execCmd: deps.execCmd,
    ...buildShipRequest(state),
  });
  deps.log(JSON.stringify(result, null, 2));
  return result;
}
```

Then keep the Task 10 `import.meta.main` path intact by having it call that helper:

```ts
if (import.meta.main) {
  const state = readState(process.cwd());
  await runShipCli(state, {
    execGit,
    execCmd,
    ship: shipAndCreatePR,
    log: (line) => console.log(line),
  });
}
```

This task adds direct test coverage for the CLI execution path without changing `prompts/done.md`.
End-to-end invocation of `bun extensions/megapowers/vcs/ship-cli.ts` with real git/gh is intentionally left to done-phase operational use; automated lifecycle integration remains covered by Task 15 and prompt routing coverage by Task 10.

**Step 4 — Run test, verify it passes**
Run: `bun test tests/ship-cli.test.ts -t "builds a stable ship request and passes it through the CLI runner"`
Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: all passing
