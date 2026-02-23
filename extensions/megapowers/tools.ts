import type { Store } from "./store.js";

export interface BatchResult {
  slug: string;
  id: number;
}

export interface BatchError {
  error: string;
}

export function createBatchHandler(
  store: Pick<Store, "listIssues" | "createIssue">,
  params: { title: string; type: "bugfix" | "feature"; sourceIds: number[]; description: string }
): BatchResult | BatchError {
  const allIssues = store.listIssues();
  const openIds = new Set(
    allIssues.filter(i => i.status !== "done").map(i => i.id)
  );
  const invalid = params.sourceIds.filter(id => !openIds.has(id));
  if (invalid.length > 0) {
    return { error: `Invalid or closed source IDs: ${invalid.join(", ")}` };
  }
  const issue = store.createIssue(params.title, params.type, params.description, params.sourceIds);
  return { slug: issue.slug, id: issue.id };
}
