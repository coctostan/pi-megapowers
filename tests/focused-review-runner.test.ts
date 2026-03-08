import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import type { AgentConfig } from "pi-subagents/agents.js";
import type { SingleResult } from "pi-subagents/types.js";
import { runFocusedReviewFanout } from "../extensions/megapowers/plan-review/focused-review-runner.js";

function makeResult(agent: string, task: string): SingleResult {
  return {
    agent,
    task,
    exitCode: 0,
    messages: [],
    usage: { inputTokens: 1, outputTokens: 1, cacheReadTokens: 0, cacheWriteTokens: 0 },
  };
}

describe("runFocusedReviewFanout", () => {
  let tmp: string;
  let agents: AgentConfig[];

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), "focused-review-runner-"));
    mkdirSync(join(tmp, ".megapowers", "plans", "001-test"), { recursive: true });
    agents = [
      {
        name: "coverage-reviewer",
        description: "coverage",
        systemPrompt: "coverage",
        source: "project",
        filePath: "/x/coverage.md",
      },
      {
        name: "dependency-reviewer",
        description: "dependency",
        systemPrompt: "dependency",
        source: "project",
        filePath: "/x/dependency.md",
      },
      {
        name: "task-quality-reviewer",
        description: "quality",
        systemPrompt: "quality",
        source: "project",
        filePath: "/x/task-quality.md",
      },
    ];
  });

  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  it("runs the exact three focused reviewers in parallel through pi-subagents and records all produced artifacts", async () => {
    const calls: string[] = [];

    const result = await runFocusedReviewFanout(
      {
        cwd: tmp,
        issueSlug: "001-test",
        workflow: "feature",
        taskCount: 5,
      },
      {
        runtimeCwd: tmp,
        discoverAgents: () => ({ agents }),
        runSync: async (_runtimeCwd, _agents, agentName, task) => {
          calls.push(agentName);
          const filename =
            agentName === "coverage-reviewer"
              ? "coverage-review.md"
              : agentName === "dependency-reviewer"
                ? "dependency-review.md"
                : "task-quality-review.md";
          writeFileSync(join(tmp, ".megapowers", "plans", "001-test", filename), `# ${agentName}\n${task}`);
          return makeResult(agentName, task);
        },
      },
    );

    expect(result.ran).toBe(true);
    expect(result.mode).toBe("parallel");
    expect(result.runtime).toBe("pi-subagents");
    expect(calls.sort()).toEqual([
      "coverage-reviewer",
      "dependency-reviewer",
      "task-quality-reviewer",
    ]);
    expect(result.availableArtifacts).toEqual([
      "coverage-review.md",
      "dependency-review.md",
      "task-quality-review.md",
    ]);
    expect(result.unavailableArtifacts).toEqual([]);
  });

  it("continues when only one artifact is produced and names the unavailable artifacts", async () => {
    const result = await runFocusedReviewFanout(
      {
        cwd: tmp,
        issueSlug: "001-test",
        workflow: "feature",
        taskCount: 5,
      },
      {
        runtimeCwd: tmp,
        discoverAgents: () => ({ agents }),
        runSync: async (_runtimeCwd, _agents, agentName, task) => {
          if (agentName === "coverage-reviewer") {
            writeFileSync(join(tmp, ".megapowers", "plans", "001-test", "coverage-review.md"), `# coverage\n${task}`);
          }
          return makeResult(agentName, task);
        },
      },
    );

    expect(result.ran).toBe(true);
    expect(result.availableArtifacts).toEqual(["coverage-review.md"]);
    expect(result.unavailableArtifacts).toEqual([
      "dependency-review.md",
      "task-quality-review.md",
    ]);
    expect(result.message).toContain("Unavailable focused review artifacts: dependency-review.md, task-quality-review.md");
  });

  it("continues when all focused reviewers fail and reports a full fan-out failure", async () => {
    const result = await runFocusedReviewFanout(
      {
        cwd: tmp,
        issueSlug: "001-test",
        workflow: "feature",
        taskCount: 5,
      },
      {
        runtimeCwd: tmp,
        discoverAgents: () => ({ agents }),
        runSync: async () => {
          throw new Error("subagent crashed");
        },
      },
    );

    expect(result.ran).toBe(true);
    expect(result.availableArtifacts).toEqual([]);
    expect(result.unavailableArtifacts).toEqual([
      "coverage-review.md",
      "dependency-review.md",
      "task-quality-review.md",
    ]);
    expect(result.message).toContain("Focused review fan-out failed");
    expect(result.message).toContain("review proceeded without advisory artifacts");
  });
});
