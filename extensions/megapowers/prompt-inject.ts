// extensions/megapowers/prompt-inject.ts
import { readState } from "./state-io.js";
import { deriveTasks, deriveAcceptanceCriteria } from "./derived.js";
import {
  loadPromptFile,
  interpolatePrompt,
  getPhasePromptTemplate,
  BRAINSTORM_PLAN_PHASES,
  buildImplementTaskVars,
  formatAcceptanceCriteriaList,
  buildSourceIssuesContext,
} from "./prompts.js";
import type { Phase } from "./state-machine.js";
import type { Store } from "./store.js";
import type { JJ } from "./jj.js";

/** Phase-specific tool call instructions appended to every phase prompt (AC42). */
const PHASE_TOOL_INSTRUCTIONS: Partial<Record<Phase, string>> = {
  brainstorm: `
When you have finished brainstorming, call \`megapowers_signal\` with action \`"phase_next"\` to advance to the spec phase.`,

  spec: `
When the spec is complete, call \`megapowers_save_artifact\` with phase \`"spec"\` and the full spec content.
Then call \`megapowers_signal\` with action \`"phase_next"\` to advance to the plan phase.`,

  plan: `
When the plan is complete, call \`megapowers_save_artifact\` with phase \`"plan"\` and the full plan content.
Then call \`megapowers_signal\` with action \`"phase_next"\` to advance to the review phase.`,

  review: `
If the plan is acceptable, call \`megapowers_signal\` with action \`"review_approve"\` to approve it.
Then call \`megapowers_signal\` with action \`"phase_next"\` to advance to implement.
If changes are needed, explain what to fix. The user will revise and re-submit.`,

  implement: `
For each task: write tests first, run them (they must fail), then write implementation.
When a task is complete, call \`megapowers_signal\` with action \`"task_done"\`.
The system will automatically advance to the next task or to verify when all tasks are done.`,

  verify: `
When verification is complete, call \`megapowers_save_artifact\` with phase \`"verify"\` and the verification report.
Then call \`megapowers_signal\` with action \`"phase_next"\` to advance.`,

  "code-review": `
When the code review is complete, call \`megapowers_save_artifact\` with phase \`"code-review"\` and the review report.
Then call \`megapowers_signal\` with action \`"phase_next"\` to advance to done.`,

  reproduce: `
When the bug is reproduced, call \`megapowers_save_artifact\` with phase \`"reproduce"\` and the reproduction steps.
Then call \`megapowers_signal\` with action \`"phase_next"\` to advance to diagnose.`,

  diagnose: `
When the diagnosis is complete, call \`megapowers_save_artifact\` with phase \`"diagnose"\` and the diagnosis.
Then call \`megapowers_signal\` with action \`"phase_next"\` to advance to plan.`,

  done: `
Use \`megapowers_save_artifact\` to save any done-phase outputs (docs, changelog, learnings).`,
};

/**
 * Build the injected system prompt for the current phase.
 * Returns null when megapowers is disabled or no issue is active.
 *
 * Covers AC41 (prompt injection) and AC42 (phase-specific tool instructions).
 */
export function buildInjectedPrompt(cwd: string, store?: Store, _jj?: JJ): string | null {
  const state = readState(cwd);

  if (!state.megaEnabled) return null;

  // No active issue: return base orientation prompt only (AC1, AC4)
  if (!state.activeIssue || !state.phase) {
    const base = loadPromptFile("base.md");
    return base || null;
  }

  const parts: string[] = [];

  // Base protocol — always included so LLM knows about the tools (AC41)
  const protocol = loadPromptFile("megapowers-protocol.md");
  if (protocol) parts.push(protocol);

  // Build template variables
  const vars: Record<string, string> = {
    issue_slug: state.activeIssue,
    phase: state.phase,
  };

  // Load artifacts for context when store is available
  if (store) {
    const artifactMap: Record<string, string> = {
      "brainstorm.md": "brainstorm_content",
      "spec.md": "spec_content",
      "plan.md": "plan_content",
      "diagnosis.md": "diagnosis_content",
      "verify.md": "verify_content",
      "code-review.md": "code_review_content",
    };
    for (const [file, varName] of Object.entries(artifactMap)) {
      const content = store.readPlanFile(state.activeIssue, file);
      if (content) vars[varName] = content;
    }

    // Bugfix aliasing: reproduce → brainstorm_content, diagnosis → spec_content
    if (state.workflow === "bugfix") {
      const reproduce = store.readPlanFile(state.activeIssue, "reproduce.md");
      const diagnosis = store.readPlanFile(state.activeIssue, "diagnosis.md");
      if (reproduce) { vars.brainstorm_content = reproduce; vars.reproduce_content = reproduce; }
      if (diagnosis) { vars.spec_content = diagnosis; vars.diagnosis_content = diagnosis; }
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

  // Phase prompt template (skip done phase unless doneMode is set)
  if (state.phase !== "done") {
    const template = getPhasePromptTemplate(state.phase);
    if (template) {
      const phasePrompt = interpolatePrompt(template, vars);
      if (phasePrompt) parts.push(phasePrompt);
    }
  } else if (state.doneMode) {
    const doneModeTemplateMap: Record<string, string> = {
      "generate-docs": "generate-docs.md",
      "capture-learnings": "capture-learnings.md",
      "write-changelog": "write-changelog.md",
      "generate-bugfix-summary": "generate-bugfix-summary.md",
    };
    const filename = doneModeTemplateMap[state.doneMode];
    if (filename) {
      const template = loadPromptFile(filename);
      if (template) {
        const phasePrompt = interpolatePrompt(template, vars);
        if (phasePrompt) parts.push(phasePrompt);
      }
    }
  }

  // Phase-specific tool instructions (AC42)
  const toolInstructions = PHASE_TOOL_INSTRUCTIONS[state.phase];
  if (toolInstructions) parts.push(toolInstructions.trim());

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
