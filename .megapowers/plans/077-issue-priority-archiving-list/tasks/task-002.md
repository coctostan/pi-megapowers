---
id: 2
title: Add store archive operation for successful moves and metadata
status: approved
depends_on:
  - 1
no_test: false
files_to_modify:
  - extensions/megapowers/state/store.ts
files_to_create:
  - tests/store-archive-operation.test.ts
---

### Task 2: Add store archive operation for successful moves and metadata [depends: 1]

**Files:**
- Modify: `extensions/megapowers/state/store.ts`
- Test: `tests/store-archive-operation.test.ts`

**Step 1 — Write the failing test**
```ts
import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, rmSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createStore, type Store } from "../extensions/megapowers/state/store.js";

let tmp: string;
let store: Store;

beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), "store-archive-op-"));
  store = createStore(tmp);
});

afterEach(() => {
  rmSync(tmp, { recursive: true, force: true });
});

describe("store.archiveIssue success path (AC14-AC22)", () => {
  it("moves the file into archive, rewrites status, writes archived timestamp, and preserves identity fields", () => {
    const openIssue = store.createIssue("Open item", "feature", "desc");
    const inProgressIssue = store.createIssue("In progress item", "feature", "desc");
    store.updateIssueStatus(inProgressIssue.slug, "in-progress");
    const doneIssue = store.createIssue("Done item", "feature", "desc");
    store.updateIssueStatus(doneIssue.slug, "done");

    const openResult = store.archiveIssue(openIssue.slug);
    const inProgressResult = store.archiveIssue(inProgressIssue.slug);
    const doneResult = store.archiveIssue(doneIssue.slug);

    expect(openResult.ok).toBe(true);
    expect(inProgressResult.ok).toBe(true);
    expect(doneResult.ok).toBe(true);

    const archivedPath = join(tmp, ".megapowers", "issues", "archive", `${openIssue.slug}.md`);
    expect(existsSync(archivedPath)).toBe(true);
    expect(existsSync(join(tmp, ".megapowers", "issues", `${openIssue.slug}.md`))).toBe(false);

    const archivedContent = readFileSync(archivedPath, "utf-8");
    expect(archivedContent).toContain("status: archived");
    expect(archivedContent).toMatch(/archived:\s*\d{4}-\d{2}-\d{2}T/);
    expect(archivedContent).toContain(`id: ${openIssue.id}`);
    expect(archivedContent).toContain(`# ${openIssue.title}`);

    const archivedIssues = store.listArchivedIssues();
    expect(archivedIssues.map(i => i.slug)).toEqual([
      doneIssue.slug,
      inProgressIssue.slug,
      openIssue.slug,
    ].sort());
  });
});
```

**Step 2 — Run test, verify it fails**
Run: `bun test tests/store-archive-operation.test.ts`
Expected: FAIL — `TypeError: store.archiveIssue is not a function`

**Step 3 — Write minimal implementation**
```ts
// extensions/megapowers/state/store.ts
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync, appendFileSync, rmSync } from "node:fs";
import { join } from "node:path";

export interface Store {
  listIssues(): Issue[];
  listArchivedIssues(): Issue[];
  archiveIssue(slug: string): { ok: true; archivedIssue: Issue } | { ok: false; error: string };
  createIssue(title: string, type: "feature" | "bugfix", description: string, sources?: number[], milestone?: string, priority?: number): Issue;
  getIssue(slug: string): Issue | null;
  getSourceIssues(slug: string): Issue[];
  getBatchForIssue(issueId: number): string | null;
  updateIssueStatus(slug: string, status: IssueStatus): void;
  ensurePlanDir(issueSlug: string): string;
  writePlanFile(issueSlug: string, filename: string, content: string): void;
  readPlanFile(issueSlug: string, filename: string): string | null;
  planFileExists(issueSlug: string, filename: string): boolean;
  getLearnings(): string;
  appendLearning(learning: string): void;
  appendLearnings(issueSlug: string, entries: string[]): void;
  readRoadmap(): string;
  writeFeatureDoc(issueSlug: string, content: string): void;
  appendChangelog(entry: string): void;
}

function parseIssueFrontmatter(content: string): Partial<Issue & { archivedAt?: string }> {
  const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) return {};
  const frontmatter = match[1];
  const body = match[2].trim();
  const data: Record<string, string> = {};
  for (const line of frontmatter.split("\n")) {
    const kv = line.match(/^(\w+):\s*(.+)$/);
    if (kv) data[kv[1]] = kv[2].trim();
  }
  let sources: number[] = [];
  const sourcesLine = frontmatter.split("\n").find(l => l.startsWith("sources:"));
  if (sourcesLine) {
    const bracketMatch = sourcesLine.match(/\[([^\]]*)\]/);
    if (bracketMatch && bracketMatch[1].trim()) {
      sources = bracketMatch[1].split(",").map(s => parseInt(s.trim())).filter(n => !isNaN(n));
    }
  }
  return {
    id: data.id ? parseInt(data.id) : undefined,
    type: data.type as "feature" | "bugfix" | undefined,
    status: data.status as IssueStatus | undefined,
    createdAt: data.created ? new Date(data.created).getTime() : undefined,
    description: body.replace(/^#[^\n]*\n*/, "").trim(),
    title: body.match(/^#\s+(.+)/)?.[1],
    sources,
    milestone: data.milestone ?? undefined,
    priority: data.priority ? parseInt(data.priority) : undefined,
    archivedAt: data.archived,
  };
}

function formatIssueFile(issue: Issue, archivedAt?: string): string {
  const sourcesLine = issue.sources.length > 0 ? `sources: [${issue.sources.join(", ")}]\n` : "";
  const milestoneLine = issue.milestone?.trim() ? `milestone: ${issue.milestone.trim()}\n` : "";
  const priorityLine = typeof issue.priority === "number" ? `priority: ${issue.priority}\n` : "";
  const archivedLine = archivedAt ? `archived: ${archivedAt}\n` : "";
  return `---
id: ${issue.id}
type: ${issue.type}
status: ${issue.status}
created: ${new Date(issue.createdAt).toISOString()}
${sourcesLine}${milestoneLine}${priorityLine}${archivedLine}---
# ${issue.title}
${issue.description}
`;
}

// inside createStore(...)
archiveIssue(slug: string) {
  ensureRoot();
  const activePath = join(issuesDir, `${slug}.md`);
  if (!existsSync(activePath)) return { ok: false as const, error: `Issue not found: ${slug}` };

  const current = this.getIssue(slug);
  if (!current) return { ok: false as const, error: `Issue not found: ${slug}` };

  const archivedIssue: Issue = { ...current, status: "archived" };
  const archivedAt = new Date().toISOString();
  writeFileSync(join(archiveDir, `${slug}.md`), formatIssueFile(archivedIssue, archivedAt));
  rmSync(activePath);
  return { ok: true as const, archivedIssue };
},
```

**Step 4 — Run test, verify it passes**
Run: `bun test tests/store-archive-operation.test.ts`
Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: all passing
