---
id: 9
title: Migrate pipeline runner/tool/oneshot to ExecGit
status: approved
depends_on:
  - 8
no_test: false
files_to_modify:
  - extensions/megapowers/subagent/pipeline-runner.ts
  - extensions/megapowers/subagent/pipeline-tool.ts
  - extensions/megapowers/subagent/oneshot-tool.ts
  - tests/pipeline-runner.test.ts
  - tests/pipeline-tool.test.ts
  - tests/oneshot-tool.test.ts
files_to_create: []
---

### Task 9: Migrate pipeline runner/tool/oneshot to ExecGit [depends: 8]
**Covers AC 19**

#### Step 1 — Write failing tests

In `tests/pipeline-tool.test.ts`:
- Rename all existing mocks/types `ExecJJ` → `ExecGit` and `execJJ` → `execGit`.
- Add a behavioral failure-propagation test:

```ts
import { type ExecGit } from "../extensions/megapowers/subagent/pipeline-workspace.js";

it("handlePipelineTool accepts ExecGit and surfaces workspace creation failure", async () => {
  const execGit: ExecGit = async (args) => {
    if (args.includes("worktree") && args.includes("add")) throw new Error("git worktree failed (exit 128)");
    return { stdout: "", stderr: "" };
  };

  const result = await handlePipelineTool(tmp, validInput, mockDispatcher, execGit);
  expect(result.error).toBeDefined();
});
```

In `tests/pipeline-runner.test.ts` and `tests/oneshot-tool.test.ts`:
- Rename `ExecJJ` → `ExecGit` and `execJJ` → `execGit` consistently.

#### Step 2 — Run tests, verify RED
Run:
- `bun test tests/pipeline-runner.test.ts tests/pipeline-tool.test.ts tests/oneshot-tool.test.ts`

Expected failure: TypeScript/runtime import errors because production code still references `ExecJJ` / expects an `execJJ` injected executor.

#### Step 3 — Implement (surgical edits)

In `extensions/megapowers/subagent/pipeline-runner.ts`:
- Import `ExecGit` from `./pipeline-workspace.js` and rename the option to `execGit`.

In `extensions/megapowers/subagent/pipeline-tool.ts`:
- Replace all `ExecJJ`/`execJJ` usage with `ExecGit`/`execGit`.
- Ensure calls to workspace helpers pass `execGit`.

In `extensions/megapowers/subagent/oneshot-tool.ts`:
- Same migration: `ExecGit`/`execGit`.

#### Step 4 — Run targeted tests, verify GREEN
Run:
- `bun test tests/pipeline-runner.test.ts tests/pipeline-tool.test.ts tests/oneshot-tool.test.ts`

Expected: PASS.

#### Step 5 — Full regression
Run:
- `bun test`

Expected: all tests pass.
