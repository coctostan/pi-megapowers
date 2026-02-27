import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync, appendFileSync } from "node:fs";
import { join } from "node:path";

// --- Types ---

export type IssueStatus = "open" | "in-progress" | "done";

export interface Issue {
  id: number;
  slug: string;
  title: string;
  type: "feature" | "bugfix";
  status: IssueStatus;
  description: string;
  createdAt: number;
  sources: number[];
  milestone: string;
  priority: number;
}

export interface Store {
  listIssues(): Issue[];
  createIssue(title: string, type: "feature" | "bugfix", description: string, sources?: number[]): Issue;
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

// --- Helpers ---

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

  // Parse sources: [1, 2, 3] from frontmatter
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
  return `---
id: ${issue.id}
type: ${issue.type}
status: ${issue.status}
created: ${new Date(issue.createdAt).toISOString()}
${sourcesLine}---

# ${issue.title}

${issue.description}
`;
}

// --- Factory ---

export function createStore(projectRoot: string): Store {
  const root = join(projectRoot, ".megapowers");
  const issuesDir = join(root, "issues");
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
    ensureDir(plansDir);
    ensureDir(learningsDir);
  }

  return {
    listIssues(): Issue[] {
      ensureRoot();
      if (!existsSync(issuesDir)) return [];

      return readdirSync(issuesDir)
        .filter((f) => f.endsWith(".md"))
        .sort()
        .map((f) => {
          const content = readFileSync(join(issuesDir, f), "utf-8");
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
            milestone: parsed.milestone ?? "",
            priority: parsed.priority ?? 0,
          };
        });
    },

    createIssue(title: string, type: "feature" | "bugfix", description: string, sources?: number[]): Issue {
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
        milestone: "",
        priority: 0,
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
        milestone: parsed.milestone ?? "",
        priority: parsed.priority ?? 0,
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
          if (issue.status === "open" || issue.status === "in-progress") {
            return issue.slug;
          }
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
      const entry = `- ${learning}\n`;
      appendFileSync(learningsFile, entry);
    },

    appendLearnings(issueSlug: string, entries: string[]): void {
      if (entries.length === 0) return;
      ensureRoot();
      const date = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
      const block = `\n## ${date} — ${issueSlug}\n\n${entries.map(e => `- ${e}`).join("\n")}\n`;
      appendFileSync(learningsFlatFile, block);
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
