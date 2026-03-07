// extensions/megapowers/prompt-inject.ts
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
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
import { getWorkflowConfig } from "./workflows/registry.js";
import { deriveToolInstructions } from "./workflows/tool-instructions.js";
import { shouldRunFocusedReviewFanout } from "./plan-review/focused-review.js";

/**
 * Build the injected system prompt for the current phase.
 * Returns null when megapowers is disabled or no issue is active.
 *
 * Covers AC41 (prompt injection) and AC42 (phase-specific tool instructions).
 */

function buildIdlePrompt(_cwd: string, store?: Store): string | null {
  const parts: string[] = [];
  const protocol = loadPromptFile("megapowers-protocol.md");
  if (protocol) parts.push(protocol);

  if (store) {
    const issues = store.listIssues().filter(i => i.status !== "done");
    const issueLines = issues.map(i =>
      `- #${String(i.id).padStart(3, "0")} ${i.title} (milestone: ${i.milestone || "none"}, priority: ${i.priority ?? "none"})`,
    );

    parts.push(
      issues.length > 0
        ? `## Open Issues\n\n${issueLines.join("\n")}`
        : "## Open Issues\n\nNo open issues. Use `/issue new` to create one.",
    );
  }

  parts.push(`## Available Commands

- \`/issue new\` — create a new issue
- \`/issue list\` — pick an issue to work on
- \`/triage\` — batch and prioritize open issues
- \`/mega on|off\` — enable/disable workflow enforcement`);

  parts.push("See `ROADMAP.md` and `.megapowers/milestones.md` for what's next.");

  return parts.length > 0 ? parts.join("\n\n") : null;
}

function buildFocusedReviewArtifactsSection(cwd: string, issueSlug: string, taskCount: number): string {
  if (!shouldRunFocusedReviewFanout(taskCount)) return "";

  const planDir = join(cwd, ".megapowers", "plans", issueSlug);
  const artifactFiles = [
    "coverage-review.md",
    "dependency-review.md",
    "task-quality-review.md",
  ] as const;

  const available = artifactFiles.filter((file) => existsSync(join(planDir, file)));
  const missing = artifactFiles.filter((file) => !existsSync(join(planDir, file)));

  const sections = [
    "## Focused Review Advisory Artifacts",
    "Focused reviewers are advisory only. Artifact availability does not change which session may call `megapowers_plan_review`.",
    "The main plan-review session still owns the final approve/revise decision and the only allowed `megapowers_plan_review` call.",
    "",
  ];

  if (available.length === 0) {
    sections.push("Focused review fan-out failed and the review proceeded without advisory artifacts.");
    return sections.join("\n");
  }

  if (missing.length > 0) {
    sections.push(`Unavailable focused review artifacts: ${missing.join(", ")}`);
    sections.push("");
  }

  for (const file of available) {
    sections.push(`### ${file}`);
    sections.push(readFileSync(join(planDir, file), "utf-8").trim());
    sections.push("");
  }

  return sections.join("\n").trim();
}
export function buildInjectedPrompt(cwd: string, store?: Store): string | null {
  const state = readState(cwd);

  if (!state.megaEnabled) return null;
  if (!state.activeIssue || !state.phase) {
    return buildIdlePrompt(cwd, store);
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

  const derivedTasks = deriveTasks(cwd, state.activeIssue);
  if (state.phase === "implement") {
    if (derivedTasks.length > 0) {
      const completedSet = new Set(state.completedTasks);
      const tasksWithCompletion = derivedTasks.map(t => ({ ...t, completed: completedSet.has(t.index) }));
      Object.assign(vars, buildImplementTaskVars(tasksWithCompletion, state.currentTaskIndex));
    }
  }

  // Learnings + Roadmap for brainstorm/plan phases
  if (BRAINSTORM_PLAN_PHASES.includes(state.phase) && store) {
    vars.learnings = store.getLearnings();
    vars.roadmap = store.readRoadmap();
  }

  // Done phase: learnings + VCS context for LLM-driven push
  if (state.phase === "done") {
    if (store) {
      vars.learnings = store.getLearnings();
    }
    if (!vars.files_changed) vars.files_changed = "";
    // IMPORTANT: always set these so interpolatePrompt does not leave raw {{...}} markers
    vars.branch_name = state.branchName ?? "";
    vars.base_branch = state.baseBranch ?? "";
  }

  // Plan phase: inject plan_iteration and revise_instructions (AC1-4)
  if (state.phase === "plan") {
    vars.plan_iteration = String(state.planIteration);
    if (state.planMode === "revise" && store) {
      const filename = `revise-instructions-${state.planIteration - 1}.md`;
      const content = store.readPlanFile(state.activeIssue!, filename);
      vars.revise_instructions = content ?? "";
    }
    if (state.planMode === "review") {
      vars.focused_review_artifacts = buildFocusedReviewArtifactsSection(
        cwd,
        state.activeIssue,
        derivedTasks.length,
      );
    } else {
      vars.focused_review_artifacts = "";
    }
  }

  // Phase prompt template (plan-mode aware; skip done phase unless doneActions is set)
  if (state.phase === "plan" && state.planMode) {
    const PLAN_MODE_TEMPLATES: Record<"draft" | "review" | "revise", string> = {
      draft: "write-plan.md",
      review: "review-plan.md",
      revise: "revise-plan.md",
    };
    const templateName = PLAN_MODE_TEMPLATES[state.planMode];
    const template = loadPromptFile(templateName);
    if (template) {
      const phasePrompt = interpolatePrompt(template, vars);
      if (phasePrompt) parts.push(phasePrompt);
    }
  } else if (state.phase !== "done") {
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
      const toolInstructions = deriveToolInstructions(phaseConfig, state.activeIssue, { isTerminal });
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
