// extensions/megapowers/workflows/tool-instructions.ts
import type { PhaseConfig } from "./types.js";

/**
 * Derive the save_artifact phase name from the artifact filename.
 * e.g. "diagnosis.md" → "diagnosis", "code-review.md" → "code-review"
 * This avoids the diagnose/diagnosis naming mismatch.
 */
function artifactSavePhase(artifact: string): string {
  return artifact.replace(/\.md$/, "");
}

export interface DeriveOptions {
  /** True if this is the last phase in the workflow (e.g. "done"). */
  isTerminal?: boolean;
}

/**
 * Derive phase-specific tool instructions from phase config properties.
 * No hardcoded phase names — purely driven by config flags.
 */
export function deriveToolInstructions(phase: PhaseConfig, options?: DeriveOptions): string {
  const parts: string[] = [];

  // Terminal phase (done): save artifacts but no phase_next
  if (options?.isTerminal) {
    parts.push(
      `Use \`megapowers_save_artifact\` to save any done-phase outputs (docs, changelog, learnings).`,
    );
    return parts.join("\n");
  }

  // Review phase: approval workflow
  if (phase.needsReviewApproval) {
    parts.push(
      `If the plan is acceptable, call \`megapowers_signal\` with action \`"review_approve"\` to approve it.`,
      `Then call \`megapowers_signal\` with action \`"phase_next"\` to advance to implement.`,
      `If changes are needed, explain what to fix. The user will revise and re-submit.`,
    );
    return parts.join("\n");
  }

  // TDD phase without artifact: task-driven workflow (implement)
  if (phase.tdd && !phase.artifact) {
    parts.push(
      `For each task: write tests first, run them (they must fail), then write implementation.`,
      `When a task is complete, call \`megapowers_signal\` with action \`"task_done"\`.`,
      `The system will automatically advance to the next task or to verify when all tasks are done.`,
    );
    return parts.join("\n");
  }

  // Artifact phase: save then advance (covers spec, plan, verify, code-review, reproduce, diagnose, brainstorm)
  if (phase.artifact) {
    const savePhase = artifactSavePhase(phase.artifact);
    parts.push(
      `When the ${phase.name} is complete, call \`megapowers_save_artifact\` with phase \`"${savePhase}"\` and the full content.`,
      `Then call \`megapowers_signal\` with action \`"phase_next"\` to advance.`,
    );
    return parts.join("\n");
  }

  // Default: just advance
  parts.push(
    `When you have finished, call \`megapowers_signal\` with action \`"phase_next"\` to advance.`,
  );
  return parts.join("\n");
}
