---
id: 10
title: Update remaining workspace-related tests and comments for git worktrees
status: approved
depends_on:
  - 9
no_test: false
files_to_modify:
  - tests/pipeline-diff.test.ts
  - tests/reproduce-086-bugs.test.ts
  - extensions/megapowers/subagent/dispatcher.ts
  - extensions/megapowers/satellite.ts
  - tests/satellite.test.ts
files_to_create: []
---

### Task 10: Update remaining workspace-related tests and comments for git worktrees [depends: 9]
**Covers AC 12 (no remaining jj imports/usages), AC 20 (tests updated)**

#### Step 1 — Write failing tests

In `tests/pipeline-diff.test.ts`:
- Rename `ExecJJ` → `ExecGit` and `execJJ` → `execGit`.
- Update mock call expectations to the staged git flow:
  - `git -C <ws> add -A`
  - `git -C <ws> diff --cached HEAD --stat`
  - `git -C <ws> diff --cached HEAD`

Add/adjust a test like:

```ts
import { type ExecGit } from "../extensions/megapowers/subagent/pipeline-workspace.js";

it("getWorkspaceDiff stages changes before diffing", async () => {
  const calls: string[][] = [];
  const execGit: ExecGit = async (args) => {
    calls.push(args);
    if (args.includes("--stat")) return { stdout: "a.ts | 2 ++\n", stderr: "" };
    if (args.includes("diff") && args.includes("--cached") && !args.includes("--stat")) return { stdout: "patch content", stderr: "" };
    return { stdout: "", stderr: "" };
  };

  const result = await getWorkspaceDiff("/ws", execGit);
  expect(result.diff).toBe("patch content");

  const addIdx = calls.findIndex((c) => c[0] === "-C" && c[1] === "/ws" && c[2] === "add");
  const statIdx = calls.findIndex((c) => c.includes("--stat"));
  const diffIdx = calls.findIndex((c) => c.includes("diff") && c.includes("--cached") && !c.includes("--stat"));
  expect(addIdx).toBeGreaterThanOrEqual(0);
  expect(statIdx).toBeGreaterThan(addIdx);
  expect(diffIdx).toBeGreaterThan(statIdx);
});
```

In `tests/satellite.test.ts`, add a simple wording guard (source-level is fine for doc comments):

```ts
import { readFileSync } from "node:fs";
import { join } from "node:path";

it("dispatcher.ts does not mention jj workspace", () => {
  const source = readFileSync(join(process.cwd(), "extensions/megapowers/subagent/dispatcher.ts"), "utf-8");
  expect(source).not.toContain("jj workspace");
});
```

In `tests/reproduce-086-bugs.test.ts`:
- Replace any `jj workspace add` mock expectations with git worktree expectations.
- Assert that a call includes `"worktree", "add"` and `"--detach"` and that the path includes `.megapowers/workspaces/`.

#### Step 2 — Run tests, verify RED
Run:
- `bun test tests/pipeline-diff.test.ts tests/reproduce-086-bugs.test.ts tests/satellite.test.ts`

Expected failure: wording/test expectations still reference jj and/or old command shapes.

#### Step 3 — Implement (surgical edits)

In `extensions/megapowers/subagent/dispatcher.ts` and `extensions/megapowers/satellite.ts`:
- Replace any “jj workspace” wording in comments/docs with “git worktree” or “isolated workspace”.

Update the three test files as described in Step 1.

#### Step 4 — Run targeted tests, verify GREEN
Run:
- `bun test tests/pipeline-diff.test.ts tests/reproduce-086-bugs.test.ts tests/satellite.test.ts`

Expected: PASS.

#### Step 5 — Full regression
Run:
- `bun test`

Expected: all tests pass.
