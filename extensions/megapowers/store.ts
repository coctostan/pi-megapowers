import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync, appendFileSync } from "node:fs";
import { join } from "node:path";
import { createInitialState, type MegapowersState } from "./state-machine.js";

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
}

export interface Store {
  loadState(): MegapowersState;
  saveState(state: MegapowersState): void;

  listIssues(): Issue[];
  createIssue(title: string, type: "feature" | "bugfix", description: string): Issue;
  getIssue(slug: string): Issue | null;
  updateIssueStatus(slug: string, status: IssueStatus): void;

  ensurePlanDir(issueSlug: string): string;
  writePlanFile(issueSlug: string, filename: string, content: string): void;
  readPlanFile(issueSlug: string, filename: string): string | null;
  planFileExists(issueSlug: string, filename: string): boolean;

  getLearnings(): string;
  appendLearning(learning: string): void;
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

  return {
    id: data.id ? parseInt(data.id) : undefined,
    type: data.type as "feature" | "bugfix" | undefined,
    status: data.status as IssueStatus | undefined,
    createdAt: data.created ? new Date(data.created).getTime() : undefined,
    description: body.replace(/^#[^\n]*\n*/, "").trim(),
    title: body.match(/^#\s+(.+)/)?.[1],
  };
}

function formatIssueFile(issue: Issue): string {
  return `---
id: ${issue.id}
type: ${issue.type}
status: ${issue.status}
created: ${new Date(issue.createdAt).toISOString()}
---

# ${issue.title}

${issue.description}
`;
}

// --- Factory ---

export function createStore(projectRoot: string): Store {
  const root = join(projectRoot, ".megapowers");
  const stateFile = join(root, "state.json");
  const issuesDir = join(root, "issues");
  const plansDir = join(root, "plans");
  const learningsDir = join(root, "learnings");
  const learningsFile = join(learningsDir, "learnings.md");

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
    loadState(): MegapowersState {
      if (!existsSync(stateFile)) return createInitialState();
      try {
        return JSON.parse(readFileSync(stateFile, "utf-8"));
      } catch {
        return createInitialState();
      }
    },

    saveState(state: MegapowersState): void {
      ensureRoot();
      writeFileSync(stateFile, JSON.stringify(state, null, 2) + "\n");
    },

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
          };
        });
    },

    createIssue(title: string, type: "feature" | "bugfix", description: string): Issue {
      ensureRoot();
      const existing = readdirSync(issuesDir).filter((f) => f.endsWith(".md"));
      const nextId = existing.length + 1;
      const slug = `${padId(nextId)}-${slugify(title)}`;

      const issue: Issue = {
        id: nextId,
        slug,
        title,
        type,
        status: "open",
        description,
        createdAt: Date.now(),
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
      };
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
      if (!existsSync(learningsFile)) return "";
      return readFileSync(learningsFile, "utf-8").trim();
    },

    appendLearning(learning: string): void {
      ensureRoot();
      const entry = `- ${learning}\n`;
      appendFileSync(learningsFile, entry);
    },
  };
}
