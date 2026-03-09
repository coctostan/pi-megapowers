# Plan

### Task 1: Add archived status parsing and separate active/archive issue queries

### Task 1: Add archived status parsing and separate active/archive issue queries

**Files:**
- Modify: `extensions/megapowers/state/store.ts`
- Test: `tests/store-archive-listing.test.ts`

**Step 1 — Write the failing test**
```ts
import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createStore, type Store } from "../extensions/megapowers/state/store.js";

let tmp: string;
let store: Store;

beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), "store-archive-listing-"));
  store = createStore(tmp);
});

afterEach(() => {
  rmSync(tmp, { recursive: true, force: true });
});

describe("store archive-aware listing (AC1-AC3)", () => {
  it("parses archived status and separates active issues from archived issues", () => {
    const active = store.createIssue("Active item", "feature", "active desc", undefined, "M2", 2);

    const archiveDir = join(tmp, ".megapowers", "issues", "archive");
    mkdirSync(archiveDir, { recursive: true });
    writeFileSync(
      join(archiveDir, "099-archived-item.md"),
      `---\nid: 99\ntype: feature\nstatus: archived\ncreated: 2026-03-01T00:00:00.000Z\nmilestone: M1\npriority: 1\n---\n# Archived item\narchived desc\n`,
    );

    const activeIssues = store.listIssues();
    const archivedIssues = store.listArchivedIssues();

    expect(activeIssues.map(i => i.slug)).toEqual([active.slug]);
    expect(activeIssues.some(i => i.status === "archived")).toBe(false);
    expect(archivedIssues).toHaveLength(1);
    expect(archivedIssues[0].slug).toBe("099-archived-item");
    expect(archivedIssues[0].status).toBe("archived");
  });
});
```

**Step 2 — Run test, verify it fails**
Run: `bun test tests/store-archive-listing.test.ts`
Expected: FAIL — `TypeError: store.listArchivedIssues is not a function`

**Step 3 — Write minimal implementation**
```ts
// extensions/megapowers/state/store.ts
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync, appendFileSync } from "node:fs";
import { join } from "node:path";

export type IssueStatus = "open" | "in-progress" | "done" | "archived";

export interface Issue {
  id: number;
  slug: string;
  title: string;
  type: "feature" | "bugfix";
  status: IssueStatus;
  description: string;
  createdAt: number;
  sources: number[];
  milestone?: string;
  priority?: number;
}

export interface Store {
  listIssues(): Issue[];
  listArchivedIssues(): Issue[];
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

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

function padId(id: number): string {
  return String(id).padStart(3, "0");
}

function parseIssueFrontmatter(content: string): Partial<Issue> {
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
  };
}

function formatIssueFile(issue: Issue): string {
  const sourcesLine = issue.sources.length > 0 ? `sources: [${issue.sources.join(", ")}]\n` : "";
  const milestoneLine = issue.milestone?.trim() ? `milestone: ${issue.milestone.trim()}\n` : "";
  const priorityLine = typeof issue.priority === "number" ? `priority: ${issue.priority}\n` : "";
  return `---
id: ${issue.id}
type: ${issue.type}
status: ${issue.status}
created: ${new Date(issue.createdAt).toISOString()}
${sourcesLine}${milestoneLine}${priorityLine}---
# ${issue.title}
${issue.description}
`;
}

function readIssuesFromDir(dir: string): Issue[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith(".md"))
    .sort()
    .map((f) => {
      const content = readFileSync(join(dir, f), "utf-8");
      const parsed = parseIssueFrontmatter(content);
      const slug = f.replace(/\.md$/, "");
      return {
        id: parsed.id ?? 0,
        slug,
        title: parsed.title ?? slug,
        type: parsed.type ?? "feature",
        status: parsed.status ?? "open",
        description: parsed.description ?? "",
        createdAt: parsed.createdAt ?? 0,
        sources: parsed.sources ?? [],
        milestone: parsed.milestone,
        priority: parsed.priority,
      };
    });
}

export function createStore(projectRoot: string): Store {
  const root = join(projectRoot, ".megapowers");
  const issuesDir = join(root, "issues");
  const archiveDir = join(issuesDir, "archive");
  const plansDir = join(root, "plans");
  const learningsDir = join(root, "learnings");
  const learningsFile = join(learningsDir, "learnings.md");
  const learningsFlatFile = join(root, "learnings.md");
  const docsDir = join(root, "docs");
  const changelogFile = join(root, "CHANGELOG.md");

  function ensureDir(dir: string): void {
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  }

  function ensureRoot(): void {
    ensureDir(root);
    ensureDir(issuesDir);
    ensureDir(archiveDir);
    ensureDir(plansDir);
    ensureDir(learningsDir);
  }

  return {
    listIssues(): Issue[] {
      ensureRoot();
      return readIssuesFromDir(issuesDir);
    },

    listArchivedIssues(): Issue[] {
      ensureRoot();
      return readIssuesFromDir(archiveDir);
    },

    createIssue(title: string, type: "feature" | "bugfix", description: string, sources?: number[], milestone?: string, priority?: number): Issue {
      ensureRoot();
      const existing = readdirSync(issuesDir).filter((f) => f.endsWith(".md"));
      const maxId = existing.reduce((max, f) => {
        const idMatch = f.match(/^(\d+)-/);
        return idMatch ? Math.max(max, parseInt(idMatch[1])) : max;
      }, 0);
      const nextId = maxId + 1;
      const slug = `${padId(nextId)}-${slugify(title)}`;

      const issue: Issue = {
        id: nextId,
        slug,
        title,
        type,
        status: "open",
        description,
        createdAt: Date.now(),
        sources: sources ?? [],
        milestone: milestone?.trim() ? milestone.trim() : undefined,
        priority: typeof priority === "number" ? priority : undefined,
      };

      writeFileSync(join(issuesDir, `${slug}.md`), formatIssueFile(issue));
      return issue;
    },

    getIssue(slug: string): Issue | null {
      const filepath = join(issuesDir, `${slug}.md`);
      if (!existsSync(filepath)) return null;
      const content = readFileSync(filepath, "utf-8");
      const parsed = parseIssueFrontmatter(content);
      return {
        id: parsed.id ?? 0,
        slug,
        title: parsed.title ?? slug,
        type: parsed.type ?? "feature",
        status: parsed.status ?? "open",
        description: parsed.description ?? "",
        createdAt: parsed.createdAt ?? 0,
        sources: parsed.sources ?? [],
        milestone: parsed.milestone,
        priority: parsed.priority,
      };
    },

    getSourceIssues(slug: string): Issue[] {
      const issue = this.getIssue(slug);
      if (!issue || issue.sources.length === 0) return [];
      const allIssues = this.listIssues();
      const sourceSet = new Set(issue.sources);
      return allIssues.filter(i => sourceSet.has(i.id));
    },

    getBatchForIssue(issueId: number): string | null {
      const allIssues = this.listIssues();
      for (const issue of allIssues) {
        if (issue.sources.length > 0 && issue.sources.includes(issueId)) {
          if (issue.status === "open" || issue.status === "in-progress") return issue.slug;
        }
      }
      return null;
    },

    updateIssueStatus(slug: string, status: IssueStatus): void {
      const filepath = join(issuesDir, `${slug}.md`);
      if (!existsSync(filepath)) return;
      const content = readFileSync(filepath, "utf-8");
      const updated = content.replace(/^status:\s*.+$/m, `status: ${status}`);
      writeFileSync(filepath, updated);
    },

    ensurePlanDir(issueSlug: string): string {
      const dir = join(plansDir, issueSlug);
      ensureDir(dir);
      return dir;
    },

    writePlanFile(issueSlug: string, filename: string, content: string): void {
      const dir = join(plansDir, issueSlug);
      ensureDir(dir);
      writeFileSync(join(dir, filename), content);
    },

    readPlanFile(issueSlug: string, filename: string): string | null {
      const filepath = join(plansDir, issueSlug, filename);
      if (!existsSync(filepath)) return null;
      return readFileSync(filepath, "utf-8");
    },

    planFileExists(issueSlug: string, filename: string): boolean {
      return existsSync(join(plansDir, issueSlug, filename));
    },

    getLearnings(): string {
      const parts: string[] = [];
      if (existsSync(learningsFile)) {
        const old = readFileSync(learningsFile, "utf-8").trim();
        if (old) parts.push(old);
      }
      if (existsSync(learningsFlatFile)) {
        const attributed = readFileSync(learningsFlatFile, "utf-8").trim();
        if (attributed) parts.push(attributed);
      }
      return parts.join("\n\n").trim();
    },

    appendLearning(learning: string): void {
      ensureRoot();
      appendFileSync(learningsFile, `- ${learning}\n`);
    },

    appendLearnings(issueSlug: string, entries: string[]): void {
      if (entries.length === 0) return;
      ensureRoot();
      const date = new Date().toISOString().slice(0, 10);
      appendFileSync(learningsFlatFile, `\n## ${date} — ${issueSlug}\n\n${entries.map(e => `- ${e}`).join("\n")}\n`);
    },

    readRoadmap(): string {
      const roadmapPath = join(projectRoot, "ROADMAP.md");
      if (!existsSync(roadmapPath)) return "";
      return readFileSync(roadmapPath, "utf-8").trim();
    },

    writeFeatureDoc(issueSlug: string, content: string): void {
      ensureRoot();
      ensureDir(docsDir);
      writeFileSync(join(docsDir, `${issueSlug}.md`), content);
    },

    appendChangelog(entry: string): void {
      ensureRoot();
      appendFileSync(changelogFile, entry + "\n");
    },
  };
}
```

**Step 4 — Run test, verify it passes**
Run: `bun test tests/store-archive-listing.test.ts`
Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: all passing

### Task 2: Add store archive operation for successful moves and metadata [depends: 1]

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

### Task 3: Return clear archive errors for missing and already archived issues [depends: 2]

### Task 3: Return clear archive errors for missing and already archived issues [depends: 2]

**Files:**
- Modify: `extensions/megapowers/state/store.ts`
- Test: `tests/store-archive-errors.test.ts`

**Step 1 — Write the failing test**
```ts
import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createStore, type Store } from "../extensions/megapowers/state/store.js";

let tmp: string;
let store: Store;

beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), "store-archive-errors-"));
  store = createStore(tmp);
});

afterEach(() => {
  rmSync(tmp, { recursive: true, force: true });
});

describe("store.archiveIssue errors (AC23-AC24)", () => {
  it("returns clear errors for missing issues and already archived issues", () => {
    const missing = store.archiveIssue("999-missing-issue");
    expect(missing).toEqual({ ok: false, error: "Issue not found: 999-missing-issue" });

    const created = store.createIssue("Archive me", "feature", "desc");
    const first = store.archiveIssue(created.slug);
    expect(first.ok).toBe(true);

    const second = store.archiveIssue(created.slug);
    expect(second).toEqual({ ok: false, error: `Issue already archived: ${created.slug}` });
  });
});
```

**Step 2 — Run test, verify it fails**
Run: `bun test tests/store-archive-errors.test.ts`
Expected: FAIL — `Expected: { ok: false, error: "Issue already archived: 001-archive-me" } Received: { ok: false, error: "Issue not found: 001-archive-me" }`

**Step 3 — Write minimal implementation**
```ts
// extensions/megapowers/state/store.ts
archiveIssue(slug: string) {
  ensureRoot();
  const activePath = join(issuesDir, `${slug}.md`);
  const archivedPath = join(archiveDir, `${slug}.md`);

  if (existsSync(archivedPath)) {
    return { ok: false as const, error: `Issue already archived: ${slug}` };
  }

  if (!existsSync(activePath)) {
    return { ok: false as const, error: `Issue not found: ${slug}` };
  }

  const current = this.getIssue(slug);
  if (!current) {
    return { ok: false as const, error: `Issue not found: ${slug}` };
  }

  const archivedIssue: Issue = { ...current, status: "archived" };
  const archivedAt = new Date().toISOString();
  writeFileSync(archivedPath, formatIssueFile(archivedIssue, archivedAt));
  rmSync(activePath);
  return { ok: true as const, archivedIssue };
},
```

**Step 4 — Run test, verify it passes**
Run: `bun test tests/store-archive-errors.test.ts`
Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: all passing

### Task 4: Add pure active-issue sorting grouping and triage filtering helpers [depends: 1]

### Task 4: Add pure active-issue sorting grouping and triage filtering helpers [depends: 1]

**Files:**
- Modify: `extensions/megapowers/ui.ts`
- Test: `tests/ui-issue-list.test.ts`

**Step 1 — Write the failing test**
```ts
import { describe, it, expect } from "bun:test";
import {
  sortActiveIssues,
  buildMilestoneIssueSections,
  formatActiveIssueListItem,
  filterTriageableIssues,
} from "../extensions/megapowers/ui.js";
import type { Issue } from "../extensions/megapowers/state/store.js";

const issue = (
  id: number,
  title: string,
  milestone: string | undefined,
  priority: number | undefined,
  createdAt: number,
  status: Issue["status"] = "open",
): Issue => ({
  id,
  slug: `${String(id).padStart(3, "0")}-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
  title,
  type: "feature",
  status,
  description: `${title} description`,
  createdAt,
  sources: [],
  milestone,
  priority,
});

describe("active issue list helpers (AC4-AC13)", () => {
  const issues = [
    issue(4, "Later M2", "M2", 2, 400),
    issue(2, "Earlier M1", "M1", 2, 200),
    issue(1, "Top M1", "M1", 1, 300),
    issue(3, "No priority M1 old", "M1", undefined, 100),
    issue(5, "Archived", "M1", 1, 50, "archived"),
  ];

  it("sortActiveIssues orders by milestone, then priority, then createdAt (AC4-AC6)", () => {
    const sorted = sortActiveIssues(issues.filter(i => i.status !== "archived"));
    expect(sorted.map(i => i.id)).toEqual([1, 2, 3, 4]);
  });

  it("buildMilestoneIssueSections groups sorted issues by milestone (AC7)", () => {
    const sorted = sortActiveIssues(issues.filter(i => i.status !== "archived"));
    const sections = buildMilestoneIssueSections(sorted);
    expect(sections[0].milestone).toBe("M1");
    expect(sections[0].issues.map(i => i.id)).toEqual([1, 2, 3]);
    expect(sections[1].milestone).toBe("M2");
    expect(sections[1].issues.map(i => i.id)).toEqual([4]);
  });

  it("formatActiveIssueListItem includes id, title, status, and priority (AC8-AC11)", () => {
    const sorted = sortActiveIssues(issues.filter(i => i.status !== "archived"));
    const item = formatActiveIssueListItem(sorted[0]);
    expect(item).toContain("#001");
    expect(item).toContain("Top M1");
    expect(item).toContain("[open]");
    expect(item).toContain("[P1]");
  });

  it("filterTriageableIssues excludes archived, done, and batch issues (AC13)", () => {
    const withBatch = [
      ...issues,
      issue(6, "Done", "M1", 1, 600, "done"),
      { ...issue(7, "Batch child", "M1", 1, 700), sources: [1, 2] },
    ];
    const triageable = filterTriageableIssues(withBatch);
    expect(triageable.map(i => i.id)).toEqual([4, 2, 1, 3]);
  });
});
```

**Step 2 — Run test, verify it fails**
Run: `bun test tests/ui-issue-list.test.ts`
Expected: FAIL — `SyntaxError: Export named 'sortActiveIssues' not found in module '../extensions/megapowers/ui.js'`

**Step 3 — Write minimal implementation**
```ts
// Add to extensions/megapowers/ui.ts — new exports after existing filterTriageableIssues
export interface MilestoneIssueSection {
  milestone: string;
  issues: Issue[];
}
function milestoneRank(milestone?: string): number {
  if (!milestone) return Number.MAX_SAFE_INTEGER;
  const match = milestone.match(/^M(\d+)$/i);
  return match ? parseInt(match[1], 10) : Number.MAX_SAFE_INTEGER;
}
export function sortActiveIssues(issues: Issue[]): Issue[] {
  return [...issues].sort((a, b) => {
    const milestoneCmp = milestoneRank(a.milestone) - milestoneRank(b.milestone);
    if (milestoneCmp !== 0) return milestoneCmp;
    const aPriority = typeof a.priority === "number" ? a.priority : Number.MAX_SAFE_INTEGER;
    const bPriority = typeof b.priority === "number" ? b.priority : Number.MAX_SAFE_INTEGER;
    if (aPriority !== bPriority) return aPriority - bPriority;
    return a.createdAt - b.createdAt;
  });
}
export function buildMilestoneIssueSections(issues: Issue[]): MilestoneIssueSection[] {
  const sections: MilestoneIssueSection[] = [];
  for (const issue of issues) {
    const milestone = issue.milestone || "none";
    const existing = sections.find(section => section.milestone === milestone);
    if (existing) {
      existing.issues.push(issue);
    } else {
      sections.push({ milestone, issues: [issue] });
    }
  }
  return sections;
}
export function formatActiveIssueListItem(issue: Issue, batchSlug?: string | null): string {
  const id = `#${String(issue.id).padStart(3, "0")}`;
  const priority = typeof issue.priority === "number" ? ` [P${issue.priority}]` : "";
  const batchAnnotation = batchSlug ? ` (in batch ${batchSlug})` : "";
  return `${id}${priority} ${issue.title} [${issue.status}]${batchAnnotation}`;
}
// Update existing filterTriageableIssues to also exclude archived:
export function filterTriageableIssues(issues: Issue[]): Issue[] {
  return issues.filter(i => i.status !== "done" && i.status !== "archived" && i.sources.length === 0);
}
```

**Step 4 — Run test, verify it passes**
Run: `bun test tests/ui-issue-list.test.ts`
Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: all passing

### Task 5: Use grouped active issues in issue list and add archived view subcommand [depends: 1, 4]

### Task 5: Use grouped active issues in issue list and add archived view subcommand [depends: 1, 4]

**Files:**
- Modify: `extensions/megapowers/ui.ts`
- Test: `tests/ui-issue-command-list.test.ts`

**Step 1 — Write the failing test**
```ts
import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createUI } from "../extensions/megapowers/ui.js";
import { createStore } from "../extensions/megapowers/state/store.js";
import { createInitialState } from "../extensions/megapowers/state/state-machine.js";

let tmp: string;

beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), "ui-issue-command-list-"));
});

afterEach(() => {
  rmSync(tmp, { recursive: true, force: true });
});

function createMockCtx(selectReturn?: string) {
  const notifications: string[] = [];
  const selects: string[][] = [];
  return {
    hasUI: true,
    cwd: tmp,
    ui: {
      theme: { fg: (_c: string, t: string) => t, bold: (t: string) => t },
      select: async (_prompt: string, items: string[]) => {
        selects.push(items);
        return selectReturn ?? null;
      },
      input: async () => null,
      editor: async () => null,
      notify: (msg: string) => notifications.push(msg),
      setWidget: () => {},
      setStatus: () => {},
    },
    _notifications: notifications,
    _selects: selects,
  };
}

describe("issue command list and archived view (AC7-AC12, AC28, AC30)", () => {
  it("shows grouped active issues in default list and archived issues only in archived view", async () => {
    const store = createStore(tmp);
    const ui = createUI();
    const state = createInitialState();

    store.createIssue("M2 item", "feature", "desc", undefined, "M2", 2);
    const m1 = store.createIssue("M1 top", "feature", "desc", undefined, "M1", 1);

    const archiveDir = join(tmp, ".megapowers", "issues", "archive");
    mkdirSync(archiveDir, { recursive: true });
    writeFileSync(
      join(archiveDir, "099-archived-item.md"),
      `---\nid: 99\ntype: feature\nstatus: archived\ncreated: 2026-03-01T00:00:00.000Z\nmilestone: M1\npriority: 1\narchived: 2026-03-02T00:00:00.000Z\n---\n# Archived item\narchived desc\n`,
    );

    const listCtx = createMockCtx(`#${String(m1.id).padStart(3, "0")} [P1] M1 top [open]`);
    await ui.handleIssueCommand(listCtx as any, state, store, "list");

    const renderedItems = listCtx._selects[0].join("\n");
    expect(renderedItems).toContain("M1:");
    expect(renderedItems).toContain("M2:");
    expect(renderedItems).toContain("#002 [P1] M1 top [open]");
    expect(renderedItems).not.toContain("Archived item");

    const archivedCtx = createMockCtx();
    await ui.handleIssueCommand(archivedCtx as any, state, store, "archived");
    expect(archivedCtx._notifications.join("\n")).toContain("Archived item");
    expect(archivedCtx._notifications.join("\n")).not.toContain("M1 top");
  });
});
```

**Step 2 — Run test, verify it fails**
Run: `bun test tests/ui-issue-command-list.test.ts`
Expected: FAIL — `expect(received).toContain(expected) // Expected substring: "M1:"`

**Step 3 — Write minimal implementation**
```ts
// extensions/megapowers/ui.ts — add two new exported helpers near other helpers
export function formatMilestoneHeader(milestone: string, issues: Issue[]): string {
  return `${milestone}: (${issues.length} issue${issues.length === 1 ? "" : "s"})`;
}
export function formatArchivedIssueList(issues: Issue[]): string {
  return issues.map(i => formatActiveIssueListItem(i)).join("\n");
}
```

```ts
// extensions/megapowers/ui.ts — inside createUI().handleIssueCommand()
// INSERT this block AFTER the `if (subcommand === "new" || subcommand === "create")` block
// and BEFORE the existing `if (subcommand === "list")` block:
if (subcommand === "archived") {
        const archivedIssues = sortActiveIssues(store.listArchivedIssues());
        if (archivedIssues.length === 0) {
          ctx.ui.notify("No archived issues.", "info");
          return state;
        }
        ctx.ui.notify(`Archived issues:\n${formatArchivedIssueList(archivedIssues)}`, "info");
        return state;
      }
```

```ts
// extensions/megapowers/ui.ts — REPLACE the existing `if (subcommand === "list")` block
// with this updated version that uses milestone grouping and robust header guard:
if (subcommand === "list") {
        const issues = sortActiveIssues(store.listIssues().filter(i => i.status !== "done"));
        if (issues.length === 0) {
          ctx.ui.notify("No open issues. Use /issue new to create one.", "info");
          return state;
        }
  const sections = buildMilestoneIssueSections(issues);
        const items = sections.flatMap(section => [
          formatMilestoneHeader(section.milestone, section.issues),
          ...section.issues.map(i => formatActiveIssueListItem(i, store.getBatchForIssue(i.id))),
        ]);
  items.push("+ Create new issue...");
        const choice = await ctx.ui.select("Pick an issue:", items);
        if (!choice) return state;
  if (choice.startsWith("+")) return this.handleIssueCommand(ctx, state, store, "new");
        const idMatch = choice.match(/^#(\d+)/);
        if (!idMatch) return state;
        const selected = issues.find((i) => i.id === parseInt(idMatch[1]));
  if (!selected) return state;
        const firstPhase = getFirstPhase(selected.type);
        const newState: MegapowersState = {
          ...state,
          activeIssue: selected.slug,
          workflow: selected.type,
          phase: firstPhase,
          phaseHistory: [],
          reviewApproved: false,
          currentTaskIndex: 0,
          completedTasks: [],
          tddTaskState: null,
          doneActions: [],
        };
  writeState(ctx.cwd, newState);
        store.updateIssueStatus(selected.slug, "in-progress");
        ctx.ui.notify(`Activated: ${selected.slug}`, "info");
        this.renderDashboard(ctx, newState, store);
        return newState;
      }
      // unknown-subcommand branch stays at the end
      ctx.ui.notify(`Unknown subcommand: ${subcommand}. Use: new, list, archived`, "error");
      return state;
```

**Step 4 — Run test, verify it passes**
Run: `bun test tests/ui-issue-command-list.test.ts`
Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: all passing

### Task 6: Add issue archive subcommand with active-state reset behavior [depends: 2, 3, 5]

### Task 6: Add issue archive subcommand with active-state reset behavior [depends: 2, 3, 5]

**Files:**
- Modify: `extensions/megapowers/ui.ts`
- Test: `tests/ui-issue-archive-command.test.ts`

**Step 1 — Write the failing test**
```ts
import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createUI } from "../extensions/megapowers/ui.js";
import { createStore } from "../extensions/megapowers/state/store.js";
import { createInitialState, type MegapowersState } from "../extensions/megapowers/state/state-machine.js";

let tmp: string;

beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), "ui-issue-archive-command-"));
});

afterEach(() => {
  rmSync(tmp, { recursive: true, force: true });
});

function createMockCtx() {
  const notifications: string[] = [];
  return {
    hasUI: true,
    cwd: tmp,
    ui: {
      theme: { fg: (_c: string, t: string) => t, bold: (t: string) => t },
      select: async () => null,
      input: async () => null,
      editor: async () => null,
      notify: (msg: string) => notifications.push(msg),
      setWidget: () => {},
      setStatus: () => {},
    },
    _notifications: notifications,
  };
}

describe("issue archive subcommand (AC25-AC27)", () => {
  it("archives non-active issues without resetting state and resets state when archiving the active issue", async () => {
    const store = createStore(tmp);
    const ui = createUI();
    const nonActive = store.createIssue("Non active", "feature", "desc");
    const active = store.createIssue("Active", "feature", "desc");

    const baseState: MegapowersState = {
      ...createInitialState(),
      activeIssue: active.slug,
      workflow: "feature",
      phase: "spec",
    };

    const ctx = createMockCtx();
    const afterNonActive = await ui.handleIssueCommand(ctx as any, baseState, store, `archive ${nonActive.slug}`);
    expect(afterNonActive.activeIssue).toBe(active.slug);
    expect(store.listIssues().some(i => i.slug === nonActive.slug)).toBe(false);
    expect(store.listArchivedIssues().some(i => i.slug === nonActive.slug)).toBe(true);

    const afterActive = await ui.handleIssueCommand(ctx as any, afterNonActive, store, `archive ${active.slug}`);
    expect(afterActive.activeIssue).toBeNull();
    expect(afterActive.workflow).toBeNull();
    expect(afterActive.phase).toBeNull();
    expect(store.listArchivedIssues().some(i => i.slug === active.slug)).toBe(true);
    expect(ctx._notifications.join("\n")).toContain(`Archived: ${active.slug}`);
  });
});
```

**Step 2 — Run test, verify it fails**
Run: `bun test tests/ui-issue-archive-command.test.ts`
Expected: FAIL — `expect(received).toBeNull() // Received: "002-active"`

**Step 3 — Write minimal implementation**
```ts
// extensions/megapowers/ui.ts
import { createInitialState } from "./state/state-machine.js";

// inside createUI().handleIssueCommand, before the unknown-subcommand branch
if (subcommand === "archive") {
  const target = parts[1];
  if (!target) {
    ctx.ui.notify("Usage: /issue archive <slug>", "error");
    return state;
  }

  const result = store.archiveIssue(target);
  if (!result.ok) {
    ctx.ui.notify(result.error, "error");
    return state;
  }

  ctx.ui.notify(`Archived: ${target}`, "info");

  if (state.activeIssue === target) {
    const resetState: MegapowersState = {
      ...createInitialState(),
      megaEnabled: state.megaEnabled,
      branchName: state.branchName,
      baseBranch: state.baseBranch,
    };
    writeState(ctx.cwd, resetState);
    this.renderDashboard(ctx, resetState, store);
    return resetState;
  }

  this.renderDashboard(ctx, state, store);
  return state;
}
```

**Step 4 — Run test, verify it passes**
Run: `bun test tests/ui-issue-archive-command.test.ts`
Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: all passing

### Task 7: Exclude archived issues from idle prompt open-issues summary [depends: 1]

### Task 7: Exclude archived issues from idle prompt open-issues summary [depends: 1]

**Files:**
- Modify: `extensions/megapowers/prompt-inject.ts`
- Test: `tests/prompt-inject-archived.test.ts`
**Step 1 — Write the failing test**
```ts
import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { buildInjectedPrompt } from "../extensions/megapowers/prompt-inject.js";
import { createInitialState } from "../extensions/megapowers/state/state-machine.js";
import { writeState } from "../extensions/megapowers/state/state-io.js";
import { createStore } from "../extensions/megapowers/state/store.js";
let tmp: string;
beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), "prompt-inject-archived-"));
});
afterEach(() => {
  rmSync(tmp, { recursive: true, force: true });
});
describe("buildInjectedPrompt archived issue filtering (AC29)", () => {
  it("does not include archived issues in the open issue list", () => {
    writeState(tmp, { ...createInitialState(), megaEnabled: true });
    const store = createStore(tmp);
    store.createIssue("Open task", "feature", "Still open", undefined, "M2", 2);

    // Write an archived-status issue directly into the active directory
    // so this test exercises the filter itself rather than archive dir separation.
    const issuesDir = join(tmp, ".megapowers", "issues");
    writeFileSync(
      join(issuesDir, "002-archived-task.md"),
      `---\nid: 2\ntype: feature\nstatus: archived\ncreated: 2026-03-01T00:00:00.000Z\nmilestone: M1\npriority: 1\n---\n# Archived task\nNo longer active\n`,
    );
    const prompt = buildInjectedPrompt(tmp, store)!;
    expect(prompt).toContain("Open task");
    expect(prompt).not.toContain("Archived task");
  });
});
```
**Step 2 — Run test, verify it fails**
Run: `bun test tests/prompt-inject-archived.test.ts`
Expected: FAIL — `expect(received).not.toContain(expected) // Expected substring: not "Archived task"`

**Step 3 — Write minimal implementation**
```ts
// extensions/megapowers/prompt-inject.ts
function buildIdlePrompt(_cwd: string, store?: Store): string | null {
  const parts: string[] = [];
  const protocol = loadPromptFile("megapowers-protocol.md");
  if (protocol) parts.push(protocol);
  if (store) {
    const issues = store
      .listIssues()
      .filter(i => i.status !== "done" && i.status !== "archived");
    const issueLines = issues.map(i =>
      `- #${String(i.id).padStart(3, "0")} ${i.title} (milestone: ${i.milestone || "none"}, priority: ${i.priority ?? "none"})`,
    );
    parts.push(
      issues.length > 0
        ? `## Open Issues\n\n${issueLines.join("\n")}`
        : "## Open Issues\n\nNo open issues. Use `/issue new` to create one.",
    );
  }

  parts.push(`## Available Commands
- \`/issue new\` — create a new issue
- \`/issue list\` — pick an issue to work on
- \`/triage\` — batch and prioritize open issues
- \`/mega on|off\` — enable/disable workflow enforcement`);
  parts.push("See `ROADMAP.md` and `.megapowers/milestones.md` for what's next.");
  return parts.length > 0 ? parts.join("\n\n") : null;
}
```
**Step 4 — Run test, verify it passes**
Run: `bun test tests/prompt-inject-archived.test.ts`
Expected: PASS
**Step 5 — Verify no regressions**
Run: `bun test`
Expected: all passing
