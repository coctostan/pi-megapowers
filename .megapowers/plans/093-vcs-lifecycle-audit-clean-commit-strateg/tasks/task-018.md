---
id: 18
title: Extract a testable ship-cli runner
status: approved
depends_on:
  - 10
no_test: false
files_to_modify:
  - extensions/megapowers/vcs/ship-cli.ts
files_to_create:
  - tests/ship-cli.test.ts
---

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
