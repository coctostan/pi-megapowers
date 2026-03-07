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
