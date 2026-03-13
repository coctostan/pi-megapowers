// extensions/megapowers/workflows/tool-instructions.ts
import type { PhaseConfig } from "./types.js";

export interface DeriveOptions {
  /** True if this is the last phase in the workflow (e.g. "done"). */
  isTerminal?: boolean;
}

export function deriveToolInstructions(
  phase: PhaseConfig,
  issueSlug: string,
  options?: DeriveOptions,
): string {
  const parts: string[] = [];
  const planDir = `.megapowers/plans/${issueSlug}`;

  // Terminal phase (done): save outputs but no phase_next
  if (options?.isTerminal) {
    parts.push(
      `Use \`write\` (or \`edit\`) to save done-phase outputs as files under \`${planDir}/\` (e.g. \`${planDir}/learnings.md\`).`,
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

  // Artifact phase: save then advance
  if (phase.artifact) {
    const artifactPath = `${planDir}/${phase.artifact}`;
    parts.push(
      `When the ${phase.name} is complete, save the artifact by writing it to \`${artifactPath}\` using the \`write\` tool (or \`edit\` for incremental revisions).`,
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
