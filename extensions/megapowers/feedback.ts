// extensions/megapowers/feedback.ts
//
// Shared status vocabulary and result-message composer.
// Used by handleSignal, handlePlanTask, handlePlanReview, handlePlanDraftDone, handleCloseIssue.

export const ICONS = {
  success: "✅",
  info: "📋",
  warn: "⚠️",
  error: "❌",
  note: "📝",
} as const;

export type IconKey = keyof typeof ICONS;

export interface ComposeArgs {
  icon: IconKey;
  /** First-line summary after the icon. */
  summary: string;
  /** Optional bullets describing what changed. */
  changes?: string[];
  /** Optional saved artifact path under .megapowers/plans/<slug>/. */
  artifactPath?: string;
  /** Optional explicit next-step phrase. */
  nextStep?: string;
}

export function composeMessage(args: ComposeArgs): string {
  const lines: string[] = [`${ICONS[args.icon]} ${args.summary}`];
  if (args.changes) {
    for (const c of args.changes) lines.push(`  • ${c}`);
  }
  if (args.artifactPath) lines.push(`  → ${args.artifactPath}`);
  if (args.nextStep) lines.push(`  Next: ${args.nextStep}`);
  return lines.join("\n");
}
