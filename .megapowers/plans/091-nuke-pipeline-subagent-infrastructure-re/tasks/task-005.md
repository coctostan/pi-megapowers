---
id: 5
title: Delete the legacy pipeline and one-shot execution stack
status: approved
depends_on:
  - 1
  - 2
  - 3
  - 4
no_test: false
files_to_modify:
  - extensions/megapowers/subagent/oneshot-tool.ts
  - extensions/megapowers/subagent/pipeline-tool.ts
  - extensions/megapowers/subagent/pipeline-runner.ts
  - extensions/megapowers/subagent/pipeline-workspace.ts
  - extensions/megapowers/subagent/pipeline-results.ts
  - extensions/megapowers/subagent/pipeline-context.ts
  - extensions/megapowers/subagent/pipeline-context-bounded.ts
  - extensions/megapowers/subagent/pipeline-log.ts
  - extensions/megapowers/subagent/pipeline-meta.ts
  - extensions/megapowers/subagent/pipeline-renderer.ts
  - extensions/megapowers/subagent/pipeline-steps.ts
  - extensions/megapowers/subagent/task-deps.ts
  - extensions/megapowers/subagent/message-utils.ts
  - extensions/megapowers/subagent/tdd-auditor.ts
  - extensions/megapowers/subagent/dispatcher.ts
  - extensions/megapowers/subagent/pi-subagents-dispatcher.ts
  - extensions/megapowers/subagent/pipeline-schemas.ts
  - tests/oneshot-tool.test.ts
  - tests/pipeline-tool.test.ts
  - tests/pipeline-runner.test.ts
  - tests/pipeline-workspace.test.ts
  - tests/pipeline-results.test.ts
  - tests/pipeline-context.test.ts
  - tests/pipeline-context-bounded.test.ts
  - tests/pipeline-log.test.ts
  - tests/pipeline-meta.test.ts
  - tests/pipeline-renderer.test.ts
  - tests/pipeline-steps.test.ts
  - tests/task-deps.test.ts
  - tests/message-utils.test.ts
  - tests/message-utils-test-output.test.ts
  - tests/tdd-auditor.test.ts
  - tests/pi-subagents-dispatcher.test.ts
  - tests/pipeline-schemas-review.test.ts
  - tests/pipeline-diff.test.ts
  - tests/reproduce-086-bugs.test.ts
  - tests/tools-subagent-wiring.test.ts
  - tests/tools-pipeline-wiring.test.ts
files_to_create:
  - tests/legacy-subagent-stack-removed.test.ts
---

### Task 5: Delete the legacy pipeline and one-shot execution stack [depends: 1, 2, 3, 4]

**Files:**
- Create test: `tests/legacy-subagent-stack-removed.test.ts`
- Modify/Delete: `extensions/megapowers/subagent/oneshot-tool.ts`
- Modify/Delete: `extensions/megapowers/subagent/pipeline-tool.ts`
- Modify/Delete: `extensions/megapowers/subagent/pipeline-runner.ts`
- Modify/Delete: `extensions/megapowers/subagent/pipeline-workspace.ts`
- Modify/Delete: `extensions/megapowers/subagent/pipeline-results.ts`
- Modify/Delete: `extensions/megapowers/subagent/pipeline-context.ts`
- Modify/Delete: `extensions/megapowers/subagent/pipeline-context-bounded.ts`
- Modify/Delete: `extensions/megapowers/subagent/pipeline-log.ts`
- Modify/Delete: `extensions/megapowers/subagent/pipeline-meta.ts`
- Modify/Delete: `extensions/megapowers/subagent/pipeline-renderer.ts`
- Modify/Delete: `extensions/megapowers/subagent/pipeline-steps.ts`
- Modify/Delete: `extensions/megapowers/subagent/task-deps.ts`
- Modify/Delete: `extensions/megapowers/subagent/message-utils.ts`
- Modify/Delete: `extensions/megapowers/subagent/tdd-auditor.ts`
- Modify/Delete: `extensions/megapowers/subagent/dispatcher.ts`
- Modify/Delete: `extensions/megapowers/subagent/pi-subagents-dispatcher.ts`
- Modify/Delete: `extensions/megapowers/subagent/pipeline-schemas.ts`
- Modify/Delete: `tests/oneshot-tool.test.ts`
- Modify/Delete: `tests/pipeline-tool.test.ts`
- Modify/Delete: `tests/pipeline-runner.test.ts`
- Modify/Delete: `tests/pipeline-workspace.test.ts`
- Modify/Delete: `tests/pipeline-results.test.ts`
- Modify/Delete: `tests/pipeline-context.test.ts`
- Modify/Delete: `tests/pipeline-context-bounded.test.ts`
- Modify/Delete: `tests/pipeline-log.test.ts`
- Modify/Delete: `tests/pipeline-meta.test.ts`
- Modify/Delete: `tests/pipeline-renderer.test.ts`
- Modify/Delete: `tests/pipeline-steps.test.ts`
- Modify/Delete: `tests/task-deps.test.ts`
- Modify/Delete: `tests/message-utils.test.ts`
- Modify/Delete: `tests/message-utils-test-output.test.ts`
- Modify/Delete: `tests/tdd-auditor.test.ts`
- Modify/Delete: `tests/pi-subagents-dispatcher.test.ts`
- Modify/Delete: `tests/pipeline-schemas-review.test.ts`
- Modify/Delete: `tests/pipeline-diff.test.ts`
- Modify/Delete: `tests/reproduce-086-bugs.test.ts`
- Modify/Delete: `tests/tools-subagent-wiring.test.ts`
- Modify/Delete: `tests/tools-pipeline-wiring.test.ts`

**Step 1 — Write the failing test**
Create `tests/legacy-subagent-stack-removed.test.ts` with:

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

**Step 2 — Run test, verify it fails**
Run: `bun test tests/legacy-subagent-stack-removed.test.ts`
Expected: FAIL — `expect(existsSync(join(repo, rel))).toBe(false)` fails for files such as `extensions/megapowers/subagent/pipeline-tool.ts` and `extensions/megapowers/subagent/oneshot-tool.ts` because the legacy stack still exists.

**Step 3 — Write minimal implementation**
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
4. Also verify that `extensions/megapowers/state/state-io.ts`, `extensions/megapowers/state/state-machine.ts`, and `extensions/megapowers/tools/tool-signal.ts` do not contain legacy-only fields `pipelineId`, `pipelineWorkspace`, or `subagentId`.
5. Do **not** add any replacement orchestration layer, new state fields, or new dispatch wrappers.

**Step 4 — Run test, verify it passes**
Run: `bun test tests/legacy-subagent-stack-removed.test.ts tests/state-io.test.ts tests/tool-signal.test.ts tests/phase-advance.test.ts tests/focused-review.test.ts tests/focused-review-runner.test.ts tests/hooks-focused-review.test.ts`
Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: all passing
