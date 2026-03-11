## Task 5: Delete the legacy pipeline and one-shot execution stack

This task still needs revision before the plan is implementation-ready.

### 1) Fix the dependency list in frontmatter

The task currently says:

```yaml
depends_on:
  - 1
  - 4
no_test: true
files_to_create: []
```

Change it to:

```yaml
depends_on:
  - 1
  - 2
  - 3
  - 4
no_test: false
files_to_create:
  - tests/legacy-subagent-stack-removed.test.ts
```

Why:
- Task 2 removes `pipeline`/`subagent` from `extensions/megapowers/commands.ts` activation lists.
- Task 3 removes the satellite bootstrap from `extensions/megapowers/index.ts`.
- Task 5 should depend on both directly instead of relying on the transitive chain `5 -> 4 -> 3 -> 2`.

### 2) Convert the task from `[no-test]` to a real 5-step TDD task

Deleting this stack changes observable runtime behavior and removes a large amount of code. It should not stay a dead-code-only no-test task.

Replace the current Step 1 / Step 2 structure with the following.

### Step 1 — Write the failing test

Create `tests/legacy-subagent-stack-removed.test.ts` with a concrete regression check that:
- asserts the legacy runtime modules are gone,
- asserts preserved focused-review code still uses `pi-subagents`,
- asserts legacy-only state fields are absent from the retained state/runtime files.

Use this exact test shape:

```ts
import { describe, it, expect } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const repo = process.cwd();

const legacyRuntimeFiles = [
  "extensions/megapowers/subagent/oneshot-tool.ts",
  "extensions/megapowers/subagent/pipeline-tool.ts",
  "extensions/megapowers/subagent/pipeline-runner.ts",
  "extensions/megapowers/subagent/pipeline-workspace.ts",
  "extensions/megapowers/subagent/pipeline-results.ts",
  "extensions/megapowers/subagent/pipeline-context.ts",
  "extensions/megapowers/subagent/pipeline-context-bounded.ts",
  "extensions/megapowers/subagent/pipeline-log.ts",
  "extensions/megapowers/subagent/pipeline-meta.ts",
  "extensions/megapowers/subagent/pipeline-renderer.ts",
  "extensions/megapowers/subagent/pipeline-steps.ts",
  "extensions/megapowers/subagent/task-deps.ts",
  "extensions/megapowers/subagent/message-utils.ts",
  "extensions/megapowers/subagent/tdd-auditor.ts",
  "extensions/megapowers/subagent/dispatcher.ts",
  "extensions/megapowers/subagent/pi-subagents-dispatcher.ts",
  "extensions/megapowers/subagent/pipeline-schemas.ts",
];

describe("legacy pipeline/subagent stack removal", () => {
  it("deletes the legacy runtime modules", () => {
    for (const rel of legacyRuntimeFiles) {
      expect(existsSync(join(repo, rel))).toBe(false);
    }
  });

  it("keeps focused review wired to pi-subagents", () => {
    const runner = readFileSync(
      join(repo, "extensions/megapowers/plan-review/focused-review-runner.ts"),
      "utf-8",
    );
    expect(runner).toContain('from "pi-subagents/agents.js"');
    expect(runner).toContain('from "pi-subagents/execution.js"');
    expect(runner).not.toContain("pi-subagents-dispatcher");
  });

  it("has no legacy-only state fields in retained state/runtime files", () => {
    const files = [
      "extensions/megapowers/state/state-io.ts",
      "extensions/megapowers/state/state-machine.ts",
      "extensions/megapowers/tools/tool-signal.ts",
    ].map((rel) => readFileSync(join(repo, rel), "utf-8"));

    for (const source of files) {
      expect(source).not.toMatch(/pipeline(Id|Workspace)|subagentId/);
    }
  });
});
```

### Step 2 — Run test, verify it fails

Use:

```bash
bun test tests/legacy-subagent-stack-removed.test.ts
```

Expected failure should be explicit:

```text
FAIL — `expect(existsSync(join(repo, rel))).toBe(false)` fails for files such as
`extensions/megapowers/subagent/pipeline-tool.ts` and
`extensions/megapowers/subagent/oneshot-tool.ts` because the legacy stack still exists.
```

Do not use a vague expected failure like "grep shows matches".

### Step 3 — Write minimal implementation

Keep the deletion scope, but make the implementation instructions concrete.

1. Delete these legacy runtime modules from `extensions/megapowers/subagent/`:
   - `oneshot-tool.ts`
   - `pipeline-tool.ts`
   - `pipeline-runner.ts`
   - `pipeline-workspace.ts`
   - `pipeline-results.ts`
   - `pipeline-context.ts`
   - `pipeline-context-bounded.ts`
   - `pipeline-log.ts`
   - `pipeline-meta.ts`
   - `pipeline-renderer.ts`
   - `pipeline-steps.ts`
   - `task-deps.ts`
   - `message-utils.ts`
   - `tdd-auditor.ts`
   - `dispatcher.ts`
   - `pi-subagents-dispatcher.ts`
   - `pipeline-schemas.ts`

2. Delete only the tests that exist solely for that stack:
   - `tests/oneshot-tool.test.ts`
   - `tests/pipeline-tool.test.ts`
   - `tests/pipeline-runner.test.ts`
   - `tests/pipeline-workspace.test.ts`
   - `tests/pipeline-results.test.ts`
   - `tests/pipeline-context.test.ts`
   - `tests/pipeline-context-bounded.test.ts`
   - `tests/pipeline-log.test.ts`
   - `tests/pipeline-meta.test.ts`
   - `tests/pipeline-renderer.test.ts`
   - `tests/pipeline-steps.test.ts`
   - `tests/task-deps.test.ts`
   - `tests/message-utils.test.ts`
   - `tests/message-utils-test-output.test.ts`
   - `tests/tdd-auditor.test.ts`
   - `tests/pi-subagents-dispatcher.test.ts`
   - `tests/pipeline-schemas-review.test.ts`
   - `tests/pipeline-diff.test.ts`
   - `tests/reproduce-086-bugs.test.ts`
   - `tests/tools-subagent-wiring.test.ts`
   - `tests/tools-pipeline-wiring.test.ts`

3. Preserve these files unchanged because they are the retained non-legacy path:
   - `extensions/megapowers/plan-review/focused-review.ts`
   - `extensions/megapowers/plan-review/focused-review-runner.ts`
   - `tests/focused-review.test.ts`
   - `tests/focused-review-runner.test.ts`
   - `tests/hooks-focused-review.test.ts`
   - `package.json` (keep the `pi-subagents` dependency)
   - `extensions/megapowers/state/state-machine.ts`
   - `extensions/megapowers/state/state-io.ts`
   - `extensions/megapowers/tools/tool-signal.ts`

4. Add one explicit sentence to the task text covering AC 6:

```md
Also verify that `extensions/megapowers/state/state-io.ts`, `extensions/megapowers/state/state-machine.ts`, and `extensions/megapowers/tools/tool-signal.ts` do not contain legacy-only fields `pipelineId`, `pipelineWorkspace`, or `subagentId`.
```

### Step 4 — Run test, verify it passes

Use a deterministic verification command instead of the current broad grep chain:

```bash
bun test tests/legacy-subagent-stack-removed.test.ts tests/state-io.test.ts tests/tool-signal.test.ts tests/phase-advance.test.ts tests/focused-review.test.ts tests/focused-review-runner.test.ts tests/hooks-focused-review.test.ts
```

Expected: PASS

This actively verifies:
- AC 3 / AC 4 / AC 5: deleted legacy stack is gone,
- AC 6: legacy-only state fields are absent,
- AC 11: retained sequential task progression tests still pass,
- AC 12: focused review still uses `pi-subagents`.

### Step 5 — Verify no regressions

Keep:

```bash
bun test
```

Expected: all passing

### 3) Remove the ambiguous grep-based verification language

The current Step 2 command uses:

```bash
grep ... || true; grep ... || true; bun test ... && bun test
```

That is ambiguous because the `|| true` makes the grep portions always succeed, so the implementer cannot tell whether matches are acceptable or failing. It also produces noise from tests and plan artifacts that intentionally mention strings like `pipeline`, `subagent`, `handlePipelineTool`, or `handleOneshotTool`.

Use the explicit test file + targeted bun test commands above instead.