export type RetryReason =
  | "implement_failed"
  | "verify_failed"
  | "review_rejected"
  | "review_failed";

export interface RetryContext {
  reason: RetryReason;
  detail: string;
}

export interface BoundedPipelineContext {
  taskDescription: string;
  planSection?: string;
  specContent?: string;
  learnings?: string;
  retryContext?: RetryContext;
}

export function buildInitialContext(input: {
  taskDescription: string;
  planSection?: string;
  specContent?: string;
  learnings?: string;
}): BoundedPipelineContext {
  return {
    taskDescription: input.taskDescription,
    planSection: input.planSection,
    specContent: input.specContent,
    learnings: input.learnings,
  };
}

export function withRetryContext(
  ctx: BoundedPipelineContext,
  retry: RetryContext,
): BoundedPipelineContext {
  return { ...ctx, retryContext: retry };
}

export function renderContextPrompt(ctx: BoundedPipelineContext): string {
  const sections: string[] = [];
  sections.push(`## Task\n\n${ctx.taskDescription}`);

  if (ctx.planSection) sections.push(`## Plan\n\n${ctx.planSection}`);
  if (ctx.specContent) sections.push(`## Spec / Acceptance Criteria\n\n${ctx.specContent}`);
  if (ctx.learnings) sections.push(`## Project Learnings\n\n${ctx.learnings}`);

  if (ctx.retryContext) {
    sections.push(`## Retry Context\n\nReason: ${ctx.retryContext.reason}\n\n${ctx.retryContext.detail}`);
  }

  return sections.join("\n\n");
}
