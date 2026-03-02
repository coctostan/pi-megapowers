import { z } from "zod";

export const PlanTaskSchema = z.object({
  id: z.number(),
  title: z.string(),
  status: z.enum(["draft", "approved", "needs_revision"]),
  depends_on: z.array(z.number()).default([]),
  no_test: z.boolean().default(false),
  files_to_modify: z.array(z.string()).default([]),
  files_to_create: z.array(z.string()).default([]),
});

export type PlanTask = z.infer<typeof PlanTaskSchema>;

export const PlanReviewSchema = z.object({
  type: z.literal("plan-review"),
  iteration: z.number(),
  verdict: z.enum(["approve", "revise"]),
  reviewed_tasks: z.array(z.number()),
  approved_tasks: z.array(z.number()),
  needs_revision_tasks: z.array(z.number()),
});

export type PlanReview = z.infer<typeof PlanReviewSchema>;

export const PlanSummarySchema = z.object({
  type: z.literal("plan-summary"),
  iteration: z.number(),
});

export type PlanSummary = z.infer<typeof PlanSummarySchema>;
