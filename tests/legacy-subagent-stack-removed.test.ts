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
