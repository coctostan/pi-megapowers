import { z } from "zod";

export const CreateIssueInputSchema = z.object({
  title: z.string({ error: "title is required" }).min(1, "title is required"),
  type: z.enum(["feature", "bugfix"], { error: "type is required" }),
  description: z.string({ error: "description is required" }).min(1, "description is required"),
  milestone: z.string().min(1).optional(),
  priority: z.number().optional(),
  sources: z.array(z.number()).optional(),
});

export type CreateIssueInput = z.infer<typeof CreateIssueInputSchema>;
