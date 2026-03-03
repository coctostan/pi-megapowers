import { CreateIssueInputSchema } from "./create-issue-schema.js";
import type { Store } from "../state/store.js";

export type CreateIssueOk = { slug: string; id: number };
export type CreateIssueErr = { error: string };

export function createIssueHandler(
  store: Pick<Store, "createIssue">,
  params: unknown,
): CreateIssueOk | CreateIssueErr {
  const parsed = CreateIssueInputSchema.safeParse(params);
  if (!parsed.success) {
    return { error: parsed.error.message };
  }

  const p = parsed.data;
  const issue = store.createIssue(p.title, p.type, p.description, p.sources, p.milestone, p.priority);
  return { slug: issue.slug, id: issue.id };
}
