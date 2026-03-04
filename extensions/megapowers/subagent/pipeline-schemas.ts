import { z } from "zod";

export const ReviewVerdictEnum = z.enum(["approve", "reject"]);
export type ReviewVerdictValue = z.infer<typeof ReviewVerdictEnum>;

export const ReviewFrontmatterSchema = z.object({
  verdict: ReviewVerdictEnum,
});
export type ReviewFrontmatter = z.infer<typeof ReviewFrontmatterSchema>;
