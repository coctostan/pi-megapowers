---
id: 3
title: Add shipment audit for tracked, untracked, and ignored files
status: approved
depends_on:
  - 2
no_test: false
files_to_modify:
  - tests/shipping.test.ts
files_to_create:
  - extensions/megapowers/vcs/shipping.ts
---

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
