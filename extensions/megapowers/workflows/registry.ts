// extensions/megapowers/workflows/registry.ts
import type { WorkflowConfig } from "./types.js";
import type { WorkflowType } from "../state/state-machine.js";
import { featureWorkflow } from "./feature.js";
import { bugfixWorkflow } from "./bugfix.js";

export function validateWorkflowConfig(config: WorkflowConfig): void {
  const phaseNames = new Set(config.phases.map(p => p.name));

  // Check all transition references point to valid phases
  for (const t of config.transitions) {
    if (!phaseNames.has(t.from)) {
      throw new Error(`Transition references unknown 'from' phase: ${t.from}`);
    }
    if (!phaseNames.has(t.to)) {
      throw new Error(`Transition references unknown 'to' phase: ${t.to}`);
    }
  }

  // Check every non-terminal phase has at least one outgoing transition
  const terminal = config.phases[config.phases.length - 1].name; // last phase is terminal
  const phasesWithOutgoing = new Set(config.transitions.map(t => t.from));
  for (const phase of config.phases) {
    if (phase.name !== terminal && !phasesWithOutgoing.has(phase.name)) {
      throw new Error(`Phase '${phase.name}' has no outgoing transition but is not the terminal phase`);
    }
  }
}

// Validate at registration time (AC16)
validateWorkflowConfig(featureWorkflow);
validateWorkflowConfig(bugfixWorkflow);

const REGISTRY: Record<string, WorkflowConfig> = {
  feature: featureWorkflow,
  bugfix: bugfixWorkflow,
};

export function getWorkflowConfig(name: WorkflowType): WorkflowConfig {
  const config = REGISTRY[name];
  if (!config) {
    throw new Error(`Unknown workflow: ${name}`);
  }
  return config;
}

/** Get all registered workflow configs (for building derived data like phase sets). */
export function getAllWorkflowConfigs(): WorkflowConfig[] {
  return Object.values(REGISTRY);
}
