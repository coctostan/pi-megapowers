// extensions/megapowers/prompt-inject.ts
import { readState } from "./state/state-io.js";
import { deriveTasks, deriveAcceptanceCriteria } from "./state/derived.js";
import {
  loadPromptFile,
  interpolatePrompt,
  getPhasePromptTemplate,
  BRAINSTORM_PLAN_PHASES,
  buildImplementTaskVars,
  formatAcceptanceCriteriaList,
  buildSourceIssuesContext,
} from "./prompts.js";
import type { Store } from "./state/store.js";
import type { JJ } from "./jj.js";
import { getWorkflowConfig } from "./workflows/registry.js";
import { deriveToolInstructions } from "./workflows/tool-instructions.js";

/**
 * Build the injected system prompt for the current phase.
 * Returns null when megapowers is disabled or no issue is active.
 *
 * Covers AC41 (prompt injection) and AC42 (phase-specific tool instructions).
 */
export function buildInjectedPrompt(cwd: string, store?: Store, _jj?: JJ): string | null {
  const state = readState(cwd);

  if (!state.megaEnabled) return null;
  if (!state.activeIssue || !state.phase) return null;

  const parts: string[] = [];

  // Base protocol — always included so LLM knows about the tools (AC41)
  const protocol = loadPromptFile("megapowers-protocol.md");
  if (protocol) parts.push(protocol);

  // Build template variables
  const vars: Record<string, string> = {
    issue_slug: state.activeIssue,
    phase: state.phase,
  };

  // Load artifacts from workflow config phases (config-driven, not hardcoded)
  if (store && state.workflow) {
    const config = getWorkflowConfig(state.workflow);

    // Load artifacts declared in phase configs
    for (const phase of config.phases) {
      if (phase.artifact) {
        const content = store.readPlanFile(state.activeIssue, phase.artifact);
        if (content) {
          const varName = phase.artifact.replace(/\.md$/, "").replace(/-/g, "_") + "_content";
          vars[varName] = content;
        }
      }
    }

    // Apply phase aliases: populate aliased variable names
    // e.g. reproduce.md → brainstorm_content, diagnosis.md → spec_content
    if (config.phaseAliases) {
      for (const [aliasName, canonicalName] of Object.entries(config.phaseAliases)) {
        // Find the phase or artifact with this alias name
        const aliasPhase = config.phases.find(p => p.name === aliasName);
        const artifactFile = aliasPhase?.artifact ?? `${aliasName}.md`;
        const content = store.readPlanFile(state.activeIssue, artifactFile);
        if (content) {
          // Set both the alias and canonical variable names
          const aliasVar = aliasName.replace(/-/g, "_") + "_content";
          const canonicalVar = canonicalName.replace(/-/g, "_") + "_content";
          vars[aliasVar] = content;
          vars[canonicalVar] = content;
        }
      }
    }
  }

  // Acceptance criteria
  const criteria = deriveAcceptanceCriteria(cwd, state.activeIssue, state.workflow ?? "feature");
  if (criteria.length > 0) {
    vars.acceptance_criteria_list = formatAcceptanceCriteriaList(criteria);
  }

  // Implement phase: task context via buildImplementTaskVars
  if (state.phase === "implement") {
    const tasks = deriveTasks(cwd, state.activeIssue);
    if (tasks.length > 0) {
      const completedSet = new Set(state.completedTasks);
      const tasksWithCompletion = tasks.map(t => ({ ...t, completed: completedSet.has(t.index) }));
      Object.assign(vars, buildImplementTaskVars(tasksWithCompletion, state.currentTaskIndex));
    }
  }

  // Learnings + Roadmap for brainstorm/plan phases
  if (BRAINSTORM_PLAN_PHASES.includes(state.phase) && store) {
    vars.learnings = store.getLearnings();
    vars.roadmap = store.readRoadmap();
  }

  // Done phase learnings
  if (state.phase === "done" && store) {
    vars.learnings = store.getLearnings();
    if (!vars.files_changed) vars.files_changed = "";
  }

  // Phase prompt template (skip done phase unless doneActions is set)
  if (state.phase !== "done") {
    const template = getPhasePromptTemplate(state.phase);
    if (template) {
      const phasePrompt = interpolatePrompt(template, vars);
      if (phasePrompt) parts.push(phasePrompt);
    }
  } else if (state.doneActions.length > 0) {
    // AC16: done.md template reads doneActions, interpolates the list
    vars.done_actions_list = state.doneActions.map((a) => `- ${a}`).join("\n");
    const template = getPhasePromptTemplate("done");
    if (template) {
      const phasePrompt = interpolatePrompt(template, vars);
      if (phasePrompt) parts.push(phasePrompt);
    }
  }

  // Phase-specific tool instructions derived from config (AC42)
  if (state.workflow && state.phase) {
    const config = getWorkflowConfig(state.workflow);
    const phaseConfig = config.phases.find(p => p.name === state.phase);
    if (phaseConfig) {
      const isTerminal = config.phases[config.phases.length - 1].name === state.phase;
      const toolInstructions = deriveToolInstructions(phaseConfig, { isTerminal });
      if (toolInstructions) parts.push(toolInstructions.trim());
    }
  }

  // Source issues context when store is available
  if (store) {
    const issue = store.getIssue(state.activeIssue);
    if (issue && issue.sources.length > 0) {
      const sourceIssues = store.getSourceIssues(state.activeIssue);
      const sourceContext = buildSourceIssuesContext(sourceIssues);
      if (sourceContext) parts.push(sourceContext);
    }
  }

  return parts.length > 0 ? parts.join("\n\n") : null;
}
