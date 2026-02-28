export interface PipelineStepOutput {
  step: "implement" | "verify" | "review";
  filesChanged: string[];
  testsPassed?: boolean | null;
  finalOutput?: string;
  reviewVerdict?: "approve" | "reject";
  reviewFindings?: string[];
  tddReportJson?: string;
  error?: string;
}

export interface PipelineContext {
  taskDescription: string;
  planSection?: string;
  specContent?: string;
  learnings?: string;

  steps: PipelineStepOutput[];

  retryReason?: string;
  accumulatedReviewFindings: string[];
}

export function buildInitialContext(input: {
  taskDescription: string;
  planSection?: string;
  specContent?: string;
  learnings?: string;
}): PipelineContext {
  return {
    taskDescription: input.taskDescription,
    planSection: input.planSection,
    specContent: input.specContent,
    learnings: input.learnings,
    steps: [],
    accumulatedReviewFindings: [],
  };
}

export function appendStepOutput(ctx: PipelineContext, step: PipelineStepOutput): PipelineContext {
  return { ...ctx, steps: [...ctx.steps, step] };
}

export function setRetryContext(ctx: PipelineContext, retryReason: string, findings?: string): PipelineContext {
  return {
    ...ctx,
    retryReason,
    accumulatedReviewFindings: findings
      ? [...ctx.accumulatedReviewFindings, findings]
      : ctx.accumulatedReviewFindings,
  };
}

export function renderContextPrompt(ctx: PipelineContext): string {
  const sections: string[] = [];
  sections.push(`## Task\n\n${ctx.taskDescription}`);

  if (ctx.planSection) sections.push(`## Plan\n\n${ctx.planSection}`);
  if (ctx.specContent) sections.push(`## Spec / Acceptance Criteria\n\n${ctx.specContent}`);
  if (ctx.learnings) sections.push(`## Project Learnings\n\n${ctx.learnings}`);

  if (ctx.steps.length > 0) {
    const steps = ctx.steps.map((s) => {
      const lines: string[] = [];
      lines.push(`### ${s.step}`);
      if (s.filesChanged.length) lines.push(`Files changed: ${s.filesChanged.join(", ")}`);
      if (s.testsPassed !== undefined) lines.push(`Tests passed: ${String(s.testsPassed)}`);
      if (s.reviewVerdict) lines.push(`Review verdict: ${s.reviewVerdict}`);
      if (s.reviewFindings?.length) {
        lines.push(`Review findings:\n${s.reviewFindings.map((f) => `- ${f}`).join("\n")}`);
      }
      if (s.tddReportJson) lines.push(`TDD report: ${s.tddReportJson}`);
      if (s.error) lines.push(`Error: ${s.error}`);
      if (s.finalOutput) lines.push(`Output:\n\n${s.finalOutput}`);
      return lines.join("\n");
    });
    sections.push(`## Previous Steps\n\n${steps.join("\n\n")}`);
  }

  if (ctx.retryReason) sections.push(`## Retry Reason\n\n${ctx.retryReason}`);
  if (ctx.accumulatedReviewFindings.length > 0) {
    sections.push(
      `## Accumulated Review Findings\n\n${ctx.accumulatedReviewFindings
        .map((f, i) => `### Cycle ${i}\n${f}`)
        .join("\n\n")}`,
    );
  }

  return sections.join("\n\n");
}
