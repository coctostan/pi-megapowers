---
id: 7
title: Switch register-tools subagent/pipeline executors from jj to git
status: approved
depends_on:
  - 6
no_test: false
files_to_modify:
  - extensions/megapowers/register-tools.ts
  - tests/register-tools.test.ts
files_to_create: []
---

### Task 7: Switch register-tools subagent/pipeline executors from jj to git [depends: 6]
**Covers AC 11**

> Important: AC13 defines `ExecGit` in `pipeline-workspace.ts`. This task only changes tool wiring to use `git` as the executor command.

#### Step 1 — Write failing tests

In `tests/register-tools.test.ts`, add:

```ts
import { readFileSync } from "node:fs";
import { join } from "node:path";

it("register-tools uses git exec for subagent and pipeline tools", () => {
  const source = readFileSync(join(process.cwd(), "extensions/megapowers/register-tools.ts"), "utf-8");
  expect(source).toContain('pi.exec("git"');
  expect(source).not.toContain('pi.exec("jj"');
  expect(source).toContain("isolated workspace");
  expect(source).not.toContain("isolated jj workspace");
});
```

#### Step 2 — Run tests, verify RED
Run:
- `bun test tests/register-tools.test.ts`

Expected failure: it still contains `pi.exec("jj"`.

#### Step 3 — Implement (surgical edits)

In `extensions/megapowers/register-tools.ts`:
1. Replace any `execJJ` lambdas with `execGit` that calls `pi.exec("git", ...)`.
2. Keep the executor signature compatible with AC13 by using `git -C <cwd>` when a working directory is needed by callers.
   - Example pattern:

```ts
const execGit = async (args: string[]) => {
  const r = await pi.exec("git", args);
  if (r.code !== 0) throw new Error(`git ${args[0]} failed (exit ${r.code}): ${r.stderr}`);
  return { stdout: r.stdout, stderr: r.stderr };
};

// When you need cwd, include -C:
// execGit(["-C", somePath, "worktree", "add", "--detach", ...])
```

3. Update tool descriptions to remove “jj workspace” wording.

#### Step 4 — Run targeted tests, verify GREEN
Run:
- `bun test tests/register-tools.test.ts`

Expected: PASS.

#### Step 5 — Full regression
Run:
- `bun test`

Expected: all tests pass.
