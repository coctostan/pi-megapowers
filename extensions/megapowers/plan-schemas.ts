import { z } from "zod";

export const PlanTaskStatusEnum = z.enum(["draft", "approved", "needs_revision"]);
export type PlanTaskStatus = z.infer<typeof PlanTaskStatusEnum>;

export const PlanTaskSchema = z.object({
  id: z.number(),
  title: z.string(),
  status: PlanTaskStatusEnum,
  depends_on: z.array(z.number()).default([]),
  no_test: z.boolean().default(false),
  files_to_modify: z.array(z.string()).default([]),
  files_to_create: z.array(z.string()).default([]),
});
export type PlanTask = z.infer<typeof PlanTaskSchema>;


export const PlanSummaryStatusEnum = z.enum(["draft", "in_review", "approved"]);
export type PlanSummaryStatus = z.infer<typeof PlanSummaryStatusEnum>;

export const PlanSummarySchema = z.object({
  type: z.literal("plan"),
  issue: z.string(),
  status: PlanSummaryStatusEnum,
  iteration: z.number().int().positive(),
  task_count: z.number().int().nonnegative(),
});
export type PlanSummary = z.infer<typeof PlanSummarySchema>;

export const PlanReviewVerdictEnum = z.enum(["approve", "revise"]);
export type PlanReviewVerdict = z.infer<typeof PlanReviewVerdictEnum>;

export const PlanReviewSchema = z.object({
  type: z.literal("plan-review"),
  iteration: z.number().int().positive(),
  verdict: PlanReviewVerdictEnum,
  reviewed_tasks: z.array(z.number()),
  approved_tasks: z.array(z.number()),
  needs_revision_tasks: z.array(z.number()),
});
export type PlanReview = z.infer<typeof PlanReviewSchema>;
