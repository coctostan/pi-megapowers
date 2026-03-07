---
id: 5
title: Run focused reviewers in parallel with soft-fail artifact collection
status: approved
depends_on:
  - 4
no_test: false
files_to_modify: []
files_to_create:
  - extensions/megapowers/plan-review/focused-review-runner.ts
  - tests/focused-review-runner.test.ts
---

### Task 5: Run focused reviewers in parallel with soft-fail artifact collection [depends: 4]

**Files:**
- Create: `extensions/megapowers/plan-review/focused-review-runner.ts`
- Test: `tests/focused-review-runner.test.ts`

**Covers:** AC24, AC25, AC26, AC27

**Step 1 — Write the failing test**
Create `tests/focused-review-runner.test.ts` with this complete content:

```ts
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
```

**Step 2 — Run test, verify it fails**
Run: `bun test tests/focused-review-runner.test.ts`
Expected: FAIL — `Cannot find module '../extensions/megapowers/plan-review/focused-review-runner.js'`

**Step 3 — Write minimal implementation**
Create `extensions/megapowers/plan-review/focused-review-runner.ts` with this complete content:

```ts
import { existsSync } from "node:fs";
import { join } from "node:path";
import { discoverAgents } from "pi-subagents/agents.js";
import { runSync } from "pi-subagents/execution.js";
import type { AgentConfig } from "pi-subagents/agents.js";
import type { SingleResult } from "pi-subagents/types.js";
import {
  buildFocusedReviewFanoutPlan,
  type BuildFocusedReviewFanoutPlanParams,
} from "./focused-review.js";

export interface FocusedReviewFanoutResult {
  ran: boolean;
  runtime: "pi-subagents";
  mode: "parallel";
  availableArtifacts: string[];
  unavailableArtifacts: string[];
  message: string;
}

export interface FocusedReviewRunnerDeps {
  runtimeCwd?: string;
  discoverAgents?: (cwd: string, scope: unknown) => { agents: AgentConfig[] };
  runSync?: (
    runtimeCwd: string,
    agents: AgentConfig[],
    agentName: string,
    task: string,
    options: { cwd?: string; runId: string; modelOverride?: string },
  ) => Promise<SingleResult>;
}

export async function runFocusedReviewFanout(
  params: BuildFocusedReviewFanoutPlanParams & { cwd: string },
  deps: FocusedReviewRunnerDeps = {},
): Promise<FocusedReviewFanoutResult> {
  const fanoutPlan = buildFocusedReviewFanoutPlan(params);
  if (!fanoutPlan) {
    return {
      ran: false,
      runtime: "pi-subagents",
      mode: "parallel",
      availableArtifacts: [],
      unavailableArtifacts: [],
      message: "Focused review fan-out not triggered.",
    };
  }

  const discover = deps.discoverAgents ?? discoverAgents;
  const exec = deps.runSync ?? runSync;
  const runtimeCwd = deps.runtimeCwd ?? params.cwd;
  const agents = discover(params.cwd, "both").agents;

  await Promise.allSettled(
    fanoutPlan.tasks.map((task, index) =>
      exec(runtimeCwd, agents, task.agent, task.task, {
        cwd: params.cwd,
        runId: `focused-review-${params.issueSlug}-${index + 1}`,
      }),
    ),
  );

  const artifactEntries = Object.entries(fanoutPlan.artifacts) as Array<[string, string]>;
  const availableArtifacts = artifactEntries
    .filter(([, artifactPath]) => existsSync(join(params.cwd, artifactPath)))
    .map(([, artifactPath]) => artifactPath.split("/").pop()!);
  const unavailableArtifacts = artifactEntries
    .filter(([, artifactPath]) => !existsSync(join(params.cwd, artifactPath)))
    .map(([, artifactPath]) => artifactPath.split("/").pop()!);

  const message = unavailableArtifacts.length === 0
    ? "Focused review fan-out completed with all advisory artifacts available."
    : availableArtifacts.length === 0
      ? "Focused review fan-out failed and the review proceeded without advisory artifacts."
      : `Unavailable focused review artifacts: ${unavailableArtifacts.join(", ")}`;

  return {
    ran: true,
    runtime: fanoutPlan.runtime,
    mode: fanoutPlan.mode,
    availableArtifacts,
    unavailableArtifacts,
    message,
  };
}
```

**Step 4 — Run test, verify it passes**
Run: `bun test tests/focused-review-runner.test.ts`
Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: all passing
