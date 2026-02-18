# Core Platform + jj Integration — Implementation Plan

> **REQUIRED SUB-SKILL:** Use the executing-plans skill to implement this plan task-by-task.

**Goal:** Build the foundational pi extension — state machine, project store, jj integration, session persistence, basic TUI, and commands — so the system can track workflow phases, manage issues, and present a dashboard.

**Architecture:** A single pi extension (`extensions/megapowers/index.ts`) wires event handlers and commands. Core logic is split into pure modules (`state-machine.ts`, `store.ts`, `jj.ts`, `ui.ts`, `prompts.ts`). All persistent state lives in `.megapowers/` (JSON + markdown files). The extension uses pi's `appendEntry` for crash recovery and `ctx.ui` for the TUI. jj is called via `pi.exec()`. Pure modules are tested with `bun test`; the extension wiring is tested manually by running `pi -e ./extensions/megapowers/index.ts`.

**Tech Stack:** TypeScript, pi extension API (`@mariozechner/pi-coding-agent`), `@sinclair/typebox`, `@mariozechner/pi-tui`, `bun` (runtime + test runner), jj (source control)

**Reference docs:**
- Architecture: `docs/plans/2026-02-18-architecture.md`
- Component design: `docs/plans/2026-02-18-01-core-platform.md`
- pi extensions: `/opt/homebrew/lib/node_modules/@mariozechner/pi-coding-agent/docs/extensions.md`
- pi packages: `/opt/homebrew/lib/node_modules/@mariozechner/pi-coding-agent/docs/packages.md`
- pi TUI: `/opt/homebrew/lib/node_modules/@mariozechner/pi-coding-agent/docs/tui.md`
- Example (plan-mode): `/opt/homebrew/lib/node_modules/@mariozechner/pi-coding-agent/examples/extensions/plan-mode/`
- Example (todo): `/opt/homebrew/lib/node_modules/@mariozechner/pi-coding-agent/examples/extensions/todo.ts`

---

## Phase 1: Project Skeleton + State Machine (Tasks 1–3)

### Task 1: Package Skeleton

Set up the pi package, TypeScript config, and test runner so everything compiles and `bun test` runs (even with zero tests).

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `extensions/megapowers/index.ts` (empty shell)

**Step 1: Create `package.json`**

```json
{
  "name": "pi-megapowers",
  "version": "0.1.0",
  "keywords": ["pi-package"],
  "pi": {
    "extensions": ["./extensions"]
  },
  "peerDependencies": {
    "@mariozechner/pi-ai": "*",
    "@mariozechner/pi-agent-core": "*",
    "@mariozechner/pi-coding-agent": "*",
    "@mariozechner/pi-tui": "*",
    "@sinclair/typebox": "*"
  },
  "devDependencies": {
    "@types/bun": "latest"
  },
  "scripts": {
    "test": "bun test",
    "test:watch": "bun test --watch"
  }
}
```

**Step 2: Create `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ESNext",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "outDir": "dist",
    "rootDir": ".",
    "declaration": true,
    "types": ["bun-types"]
  },
  "include": ["extensions/**/*.ts", "tests/**/*.ts"],
  "exclude": ["node_modules", "dist"]
}
```

**Step 3: Create the extension shell**

Create `extensions/megapowers/index.ts`:

```typescript
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

export default function megapowers(pi: ExtensionAPI): void {
  // Core platform wiring — built incrementally in subsequent tasks
}
```

**Step 4: Install dependencies and verify**

Run:
```bash
cd /Users/maxwellnewman/pi/workspace/pi-megapowers
bun install
bun test
```

Expected: Install succeeds. `bun test` exits 0 (no test files found is OK).

**Step 5: Commit**

```bash
git add -A
git commit -m "chore: package skeleton with pi extension entry point"
```

---

### Task 2: State Machine — Types + Transitions (Pure Logic)

Implement the state machine as a pure module with no side effects. All transition logic is tested with `bun test`.

**Files:**
- Create: `extensions/megapowers/state-machine.ts`
- Create: `tests/state-machine.test.ts`

**Step 1: Write failing tests for state machine transitions**

Create `tests/state-machine.test.ts`:

```typescript
import { describe, it, expect } from "bun:test";
import {
  createInitialState,
  getValidTransitions,
  canTransition,
  transition,
  type MegapowersState,
  type PlanTask,
} from "../extensions/megapowers/state-machine.js";

describe("createInitialState", () => {
  it("returns a blank state with no active issue", () => {
    const state = createInitialState();
    expect(state.version).toBe(1);
    expect(state.activeIssue).toBeNull();
    expect(state.workflow).toBeNull();
    expect(state.phase).toBeNull();
    expect(state.phaseHistory).toEqual([]);
    expect(state.reviewApproved).toBe(false);
    expect(state.planTasks).toEqual([]);
    expect(state.jjChangeId).toBeNull();
  });
});

describe("getValidTransitions — feature mode", () => {
  it("brainstorm can go to spec", () => {
    const ts = getValidTransitions("feature", "brainstorm");
    expect(ts).toEqual(["spec"]);
  });

  it("spec can go to plan", () => {
    const ts = getValidTransitions("feature", "spec");
    expect(ts).toEqual(["plan"]);
  });

  it("plan can go to review or implement", () => {
    const ts = getValidTransitions("feature", "plan");
    expect(ts).toContain("review");
    expect(ts).toContain("implement");
  });

  it("review can go to implement", () => {
    const ts = getValidTransitions("feature", "review");
    expect(ts).toEqual(["implement"]);
  });

  it("implement can go to verify", () => {
    const ts = getValidTransitions("feature", "implement");
    expect(ts).toEqual(["verify"]);
  });

  it("verify can go to done", () => {
    const ts = getValidTransitions("feature", "verify");
    expect(ts).toEqual(["done"]);
  });

  it("done has no transitions", () => {
    const ts = getValidTransitions("feature", "done");
    expect(ts).toEqual([]);
  });
});

describe("getValidTransitions — bugfix mode", () => {
  it("reproduce can go to diagnose", () => {
    const ts = getValidTransitions("bugfix", "reproduce");
    expect(ts).toEqual(["diagnose"]);
  });

  it("diagnose can go to plan", () => {
    const ts = getValidTransitions("bugfix", "diagnose");
    expect(ts).toEqual(["plan"]);
  });

  it("plan can go to review or implement", () => {
    const ts = getValidTransitions("bugfix", "plan");
    expect(ts).toContain("review");
    expect(ts).toContain("implement");
  });
});

describe("canTransition", () => {
  it("returns true for valid transition", () => {
    expect(canTransition("feature", "brainstorm", "spec")).toBe(true);
  });

  it("returns false for invalid transition", () => {
    expect(canTransition("feature", "brainstorm", "implement")).toBe(false);
  });

  it("returns false for null workflow", () => {
    expect(canTransition(null, "brainstorm", "spec")).toBe(false);
  });
});

describe("transition", () => {
  it("updates phase and appends to phaseHistory", () => {
    const state = createInitialState();
    state.workflow = "feature";
    state.phase = "brainstorm";
    state.activeIssue = "001-test";

    const next = transition(state, "spec");
    expect(next.phase).toBe("spec");
    expect(next.phaseHistory).toHaveLength(1);
    expect(next.phaseHistory[0].from).toBe("brainstorm");
    expect(next.phaseHistory[0].to).toBe("spec");
    expect(next.phaseHistory[0].timestamp).toBeGreaterThan(0);
  });

  it("throws on invalid transition", () => {
    const state = createInitialState();
    state.workflow = "feature";
    state.phase = "brainstorm";
    state.activeIssue = "001-test";

    expect(() => transition(state, "implement")).toThrow();
  });

  it("throws when no active issue", () => {
    const state = createInitialState();
    state.workflow = "feature";
    state.phase = "brainstorm";

    expect(() => transition(state, "spec")).toThrow();
  });

  it("resets reviewApproved when entering plan phase", () => {
    const state = createInitialState();
    state.workflow = "feature";
    state.phase = "spec";
    state.activeIssue = "001-test";
    state.reviewApproved = true;

    const next = transition(state, "plan");
    expect(next.reviewApproved).toBe(false);
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `bun test tests/state-machine.test.ts`
Expected: FAIL — module not found

**Step 3: Implement the state machine**

Create `extensions/megapowers/state-machine.ts`:

```typescript
// --- Types ---

export type WorkflowType = "feature" | "bugfix";

export type FeaturePhase = "brainstorm" | "spec" | "plan" | "review" | "implement" | "verify" | "done";
export type BugfixPhase = "reproduce" | "diagnose" | "plan" | "review" | "implement" | "verify" | "done";
export type Phase = FeaturePhase | BugfixPhase;

export interface PhaseTransition {
  from: Phase | null;
  to: Phase;
  timestamp: number;
  jjChangeId?: string;
}

export interface PlanTask {
  index: number;
  description: string;
  completed: boolean;
}

export interface MegapowersState {
  version: 1;
  activeIssue: string | null;
  workflow: WorkflowType | null;
  phase: Phase | null;
  phaseHistory: PhaseTransition[];
  reviewApproved: boolean;
  planTasks: PlanTask[];
  jjChangeId: string | null;
}

// --- Transition Tables ---

const FEATURE_TRANSITIONS: Record<FeaturePhase, FeaturePhase[]> = {
  brainstorm: ["spec"],
  spec: ["plan"],
  plan: ["review", "implement"],
  review: ["implement"],
  implement: ["verify"],
  verify: ["done"],
  done: [],
};

const BUGFIX_TRANSITIONS: Record<BugfixPhase, BugfixPhase[]> = {
  reproduce: ["diagnose"],
  diagnose: ["plan"],
  plan: ["review", "implement"],
  review: ["implement"],
  implement: ["verify"],
  verify: ["done"],
  done: [],
};

// --- Functions ---

export function createInitialState(): MegapowersState {
  return {
    version: 1,
    activeIssue: null,
    workflow: null,
    phase: null,
    phaseHistory: [],
    reviewApproved: false,
    planTasks: [],
    jjChangeId: null,
  };
}

export function getFirstPhase(workflow: WorkflowType): Phase {
  return workflow === "feature" ? "brainstorm" : "reproduce";
}

export function getValidTransitions(workflow: WorkflowType | null, phase: Phase): Phase[] {
  if (!workflow) return [];
  const table = workflow === "feature" ? FEATURE_TRANSITIONS : BUGFIX_TRANSITIONS;
  return (table as Record<string, Phase[]>)[phase] ?? [];
}

export function canTransition(workflow: WorkflowType | null, from: Phase, to: Phase): boolean {
  return getValidTransitions(workflow, from).includes(to);
}

export function transition(state: MegapowersState, to: Phase): MegapowersState {
  if (!state.activeIssue) {
    throw new Error("Cannot transition without an active issue");
  }
  if (!state.phase || !state.workflow) {
    throw new Error("Cannot transition without an active phase and workflow");
  }
  if (!canTransition(state.workflow, state.phase, to)) {
    throw new Error(`Invalid transition: ${state.phase} → ${to} in ${state.workflow} mode`);
  }

  const next: MegapowersState = {
    ...state,
    phase: to,
    phaseHistory: [
      ...state.phaseHistory,
      { from: state.phase, to, timestamp: Date.now() },
    ],
  };

  // Reset review approval when entering plan (re-planning invalidates previous review)
  if (to === "plan") {
    next.reviewApproved = false;
  }

  return next;
}
```

**Step 4: Run tests to verify they pass**

Run: `bun test tests/state-machine.test.ts`
Expected: All tests PASS

**Step 5: Commit**

```bash
git add -A
git commit -m "feat: state machine with transitions, types, and tests"
```

---

### Task 3: Project Store — Issue + State Persistence (Pure Logic)

Implement the `.megapowers/` filesystem store as a pure module. Uses `node:fs` and `node:path`. Tested with `bun test` using a temp directory.

**Files:**
- Create: `extensions/megapowers/store.ts`
- Create: `tests/store.test.ts`

**Step 1: Write failing tests for the store**

Create `tests/store.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createStore, type Store, type Issue } from "../extensions/megapowers/store.js";
import { createInitialState } from "../extensions/megapowers/state-machine.js";

let tmp: string;
let store: Store;

beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), "megapowers-test-"));
  store = createStore(tmp);
});

afterEach(() => {
  rmSync(tmp, { recursive: true, force: true });
});

describe("state persistence", () => {
  it("saves and loads state round-trip", () => {
    const state = createInitialState();
    state.activeIssue = "001-test";
    state.workflow = "feature";
    state.phase = "brainstorm";

    store.saveState(state);
    const loaded = store.loadState();

    expect(loaded.activeIssue).toBe("001-test");
    expect(loaded.workflow).toBe("feature");
    expect(loaded.phase).toBe("brainstorm");
  });

  it("returns initial state when no state file exists", () => {
    const state = store.loadState();
    expect(state.activeIssue).toBeNull();
    expect(state.version).toBe(1);
  });
});

describe("issues", () => {
  it("creates an issue with auto-incrementing ID", () => {
    const issue = store.createIssue("Auth refactor", "feature", "Refactor auth to use JWT");
    expect(issue.id).toBe(1);
    expect(issue.slug).toBe("001-auth-refactor");
    expect(issue.title).toBe("Auth refactor");
    expect(issue.type).toBe("feature");
    expect(issue.status).toBe("open");
  });

  it("lists all issues", () => {
    store.createIssue("First", "feature", "desc");
    store.createIssue("Second", "bugfix", "desc");
    const issues = store.listIssues();
    expect(issues).toHaveLength(2);
    expect(issues[0].slug).toBe("001-first");
    expect(issues[1].slug).toBe("002-second");
  });

  it("gets an issue by slug", () => {
    store.createIssue("Auth refactor", "feature", "desc");
    const issue = store.getIssue("001-auth-refactor");
    expect(issue).not.toBeNull();
    expect(issue!.title).toBe("Auth refactor");
  });

  it("returns null for unknown slug", () => {
    expect(store.getIssue("999-nope")).toBeNull();
  });

  it("updates issue status", () => {
    store.createIssue("Test", "feature", "desc");
    store.updateIssueStatus("001-test", "in-progress");
    const issue = store.getIssue("001-test");
    expect(issue!.status).toBe("in-progress");
  });
});

describe("plan files", () => {
  it("writes and reads a plan file", () => {
    store.createIssue("Test", "feature", "desc");
    store.ensurePlanDir("001-test");
    store.writePlanFile("001-test", "spec.md", "# Spec\nDo the thing");

    const content = store.readPlanFile("001-test", "spec.md");
    expect(content).toBe("# Spec\nDo the thing");
  });

  it("returns null for missing plan file", () => {
    expect(store.readPlanFile("001-nope", "spec.md")).toBeNull();
  });

  it("checks plan file existence", () => {
    store.createIssue("Test", "feature", "desc");
    store.ensurePlanDir("001-test");
    expect(store.planFileExists("001-test", "spec.md")).toBe(false);
    store.writePlanFile("001-test", "spec.md", "content");
    expect(store.planFileExists("001-test", "spec.md")).toBe(true);
  });
});

describe("learnings", () => {
  it("appends and retrieves learnings", () => {
    store.appendLearning("Auth module needs token mock");
    store.appendLearning("Use bun test not vitest");

    const learnings = store.getLearnings();
    expect(learnings).toContain("Auth module needs token mock");
    expect(learnings).toContain("Use bun test not vitest");
  });

  it("returns empty string when no learnings", () => {
    expect(store.getLearnings()).toBe("");
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `bun test tests/store.test.ts`
Expected: FAIL — module not found

**Step 3: Implement the store**

Create `extensions/megapowers/store.ts`:

```typescript
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
```

**Step 4: Run tests to verify they pass**

Run: `bun test tests/store.test.ts`
Expected: All tests PASS

**Step 5: Commit**

```bash
git add -A
git commit -m "feat: project store with issue management, plan files, and learnings"
```

---

## Phase 2: jj Integration + Plan Task Extraction (Tasks 4–5)

### Task 4: jj Integration Module

Wraps jj CLI commands. Since jj isn't installed in the dev environment, we test the command construction and output parsing logic; actual jj calls are integration-tested manually.

**Files:**
- Create: `extensions/megapowers/jj.ts`
- Create: `tests/jj.test.ts`

**Step 1: Write failing tests for jj output parsing and command builders**

Create `tests/jj.test.ts`:

```typescript
import { describe, it, expect } from "bun:test";
import {
  parseChangeId,
  parseHasConflicts,
  buildNewChangeArgs,
  buildDescribeArgs,
  buildSquashArgs,
  buildBookmarkSetArgs,
  buildLogArgs,
  formatChangeDescription,
} from "../extensions/megapowers/jj.js";

describe("parseChangeId", () => {
  it("extracts change ID from jj log output", () => {
    const output = "ksqxwzzm test@user.com 2026-02-18 12:00:00 abc123de\n  (empty) mega(001): brainstorm";
    expect(parseChangeId(output)).toBe("ksqxwzzm");
  });

  it("extracts change ID from jj new output", () => {
    const output = "Working copy now at: rlvkpntz 3b9a2c1e (empty) mega(001): brainstorm";
    expect(parseChangeId(output)).toBe("rlvkpntz");
  });

  it("returns null for empty output", () => {
    expect(parseChangeId("")).toBeNull();
  });
});

describe("parseHasConflicts", () => {
  it("detects conflicts in jj status", () => {
    const output = "The working copy has conflicts:\nA file.ts";
    expect(parseHasConflicts(output)).toBe(true);
  });

  it("returns false when no conflicts", () => {
    const output = "The working copy is clean";
    expect(parseHasConflicts(output)).toBe(false);
  });
});

describe("command builders", () => {
  it("buildNewChangeArgs creates correct args", () => {
    expect(buildNewChangeArgs("mega(001): brainstorm")).toEqual([
      "new", "-m", "mega(001): brainstorm",
    ]);
  });

  it("buildNewChangeArgs with parent revision", () => {
    expect(buildNewChangeArgs("mega(001): brainstorm", "main")).toEqual([
      "new", "main", "-m", "mega(001): brainstorm",
    ]);
  });

  it("buildDescribeArgs creates correct args", () => {
    expect(buildDescribeArgs("mega(001): spec complete")).toEqual([
      "describe", "-m", "mega(001): spec complete",
    ]);
  });

  it("buildSquashArgs creates correct args", () => {
    expect(buildSquashArgs()).toEqual(["squash"]);
  });

  it("buildBookmarkSetArgs creates correct args", () => {
    expect(buildBookmarkSetArgs("mega/001")).toEqual(["bookmark", "set", "mega/001"]);
  });

  it("buildLogArgs with revset", () => {
    expect(buildLogArgs("@")).toEqual(["log", "-r", "@"]);
  });

  it("buildLogArgs without revset", () => {
    expect(buildLogArgs()).toEqual(["log"]);
  });
});

describe("formatChangeDescription", () => {
  it("formats with issue slug and phase", () => {
    expect(formatChangeDescription("001-auth-refactor", "brainstorm")).toBe(
      "mega(001-auth-refactor): brainstorm"
    );
  });

  it("formats with suffix", () => {
    expect(formatChangeDescription("001-auth-refactor", "spec", "complete")).toBe(
      "mega(001-auth-refactor): spec complete"
    );
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `bun test tests/jj.test.ts`
Expected: FAIL — module not found

**Step 3: Implement jj module**

Create `extensions/megapowers/jj.ts`:

```typescript
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

// --- Pure parsing/building functions (testable without pi) ---

export function parseChangeId(output: string): string | null {
  // Match jj change IDs: 8+ lowercase letter sequences at word boundaries
  // "Working copy now at: rlvkpntz 3b9a..." or "ksqxwzzm user@..."
  const match = output.match(/(?:^|\s)([a-z]{8,})\s/m);
  return match?.[1] ?? null;
}

export function parseHasConflicts(output: string): boolean {
  return output.includes("has conflicts");
}

export function buildNewChangeArgs(description: string, parent?: string): string[] {
  if (parent) return ["new", parent, "-m", description];
  return ["new", "-m", description];
}

export function buildDescribeArgs(description: string): string[] {
  return ["describe", "-m", description];
}

export function buildSquashArgs(): string[] {
  return ["squash"];
}

export function buildBookmarkSetArgs(name: string): string[] {
  return ["bookmark", "set", name];
}

export function buildLogArgs(revset?: string): string[] {
  if (revset) return ["log", "-r", revset];
  return ["log"];
}

export function formatChangeDescription(issueSlug: string, phase: string, suffix?: string): string {
  const desc = suffix ? `${phase} ${suffix}` : phase;
  return `mega(${issueSlug}): ${desc}`;
}

// --- JJ interface (used by extension, wraps pi.exec) ---

export interface JJ {
  isJJRepo(): Promise<boolean>;
  getCurrentChangeId(): Promise<string | null>;
  getChangeDescription(): Promise<string>;
  hasConflicts(): Promise<boolean>;
  newChange(description: string, parent?: string): Promise<string | null>;
  describe(description: string): Promise<void>;
  squash(): Promise<void>;
  bookmarkSet(name: string): Promise<void>;
  log(revset?: string): Promise<string>;
}

export function createJJ(pi: ExtensionAPI): JJ {
  async function run(args: string[]): Promise<{ stdout: string; stderr: string; code: number }> {
    return pi.exec("jj", args);
  }

  return {
    async isJJRepo(): Promise<boolean> {
      const result = await run(["root"]);
      return result.code === 0;
    },

    async getCurrentChangeId(): Promise<string | null> {
      const result = await run(["log", "-r", "@", "--no-graph", "-T", "change_id"]);
      if (result.code !== 0) return null;
      return result.stdout.trim() || null;
    },

    async getChangeDescription(): Promise<string> {
      const result = await run(["log", "-r", "@", "--no-graph", "-T", "description"]);
      return result.stdout.trim();
    },

    async hasConflicts(): Promise<boolean> {
      const result = await run(["status"]);
      return parseHasConflicts(result.stdout);
    },

    async newChange(description: string, parent?: string): Promise<string | null> {
      const result = await run(buildNewChangeArgs(description, parent));
      return parseChangeId(result.stderr + result.stdout);
    },

    async describe(description: string): Promise<void> {
      await run(buildDescribeArgs(description));
    },

    async squash(): Promise<void> {
      await run(buildSquashArgs());
    },

    async bookmarkSet(name: string): Promise<void> {
      await run(buildBookmarkSetArgs(name));
    },

    async log(revset?: string): Promise<string> {
      const result = await run(buildLogArgs(revset));
      return result.stdout;
    },
  };
}
```

**Step 4: Run tests to verify they pass**

Run: `bun test tests/jj.test.ts`
Expected: All tests PASS

**Step 5: Commit**

```bash
git add -A
git commit -m "feat: jj integration module with command builders and output parsing"
```

---

### Task 5: Plan Task Extraction (Pure Logic)

Extract numbered tasks from plan markdown. Used later when transitioning to implement phase.

**Files:**
- Create: `extensions/megapowers/plan-parser.ts`
- Create: `tests/plan-parser.test.ts`

**Step 1: Write failing tests for plan parsing**

Create `tests/plan-parser.test.ts`:

```typescript
import { describe, it, expect } from "bun:test";
import { extractPlanTasks, type PlanTask } from "../extensions/megapowers/plan-parser.js";

describe("extractPlanTasks", () => {
  it("extracts numbered tasks from markdown", () => {
    const plan = `# Implementation Plan

Some intro text.

## Tasks

1. Set up the database schema
2. Create the API endpoint for auth
3. Write integration tests
4. Add error handling
`;
    const tasks = extractPlanTasks(plan);
    expect(tasks).toHaveLength(4);
    expect(tasks[0]).toEqual({ index: 1, description: "Set up the database schema", completed: false });
    expect(tasks[3]).toEqual({ index: 4, description: "Add error handling", completed: false });
  });

  it("handles task lines with sub-content", () => {
    const plan = `## Tasks

1. First task
   - Some detail
   - Another detail
2. Second task
`;
    const tasks = extractPlanTasks(plan);
    expect(tasks).toHaveLength(2);
    expect(tasks[0].description).toBe("First task");
  });

  it("handles markdown formatting in task text", () => {
    const plan = `1. **Bold task** with `+"`code`"+` in it
2. *Italic task*
`;
    const tasks = extractPlanTasks(plan);
    expect(tasks).toHaveLength(2);
    expect(tasks[0].description).toBe("**Bold task** with `code` in it");
  });

  it("returns empty array for plan with no numbered items", () => {
    const plan = "# Plan\n\nJust some text, no tasks.";
    expect(extractPlanTasks(plan)).toEqual([]);
  });

  it("handles plans with ### Task N: headers", () => {
    const plan = `### Task 1: Database Schema

Details...

### Task 2: API Endpoint

Details...

### Task 3: Tests

Details...
`;
    const tasks = extractPlanTasks(plan);
    expect(tasks).toHaveLength(3);
    expect(tasks[0]).toEqual({ index: 1, description: "Database Schema", completed: false });
    expect(tasks[2]).toEqual({ index: 3, description: "Tests", completed: false });
  });

  it("prefers ### Task headers over numbered lists when both exist", () => {
    const plan = `### Task 1: Big Feature

1. Sub-step one
2. Sub-step two

### Task 2: Another Feature

1. Sub-step
`;
    const tasks = extractPlanTasks(plan);
    expect(tasks).toHaveLength(2);
    expect(tasks[0].description).toBe("Big Feature");
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `bun test tests/plan-parser.test.ts`
Expected: FAIL — module not found

**Step 3: Implement plan parser**

Create `extensions/megapowers/plan-parser.ts`:

```typescript
import type { PlanTask } from "./state-machine.js";

export type { PlanTask };

/**
 * Extract tasks from plan markdown.
 *
 * Supports two formats:
 * 1. `### Task N: Description` headers (preferred if present)
 * 2. Top-level numbered list items (`1. Description`)
 */
export function extractPlanTasks(planContent: string): PlanTask[] {
  // Try ### Task N: headers first
  const headerTasks = extractTaskHeaders(planContent);
  if (headerTasks.length > 0) return headerTasks;

  // Fall back to numbered list items
  return extractNumberedItems(planContent);
}

function extractTaskHeaders(content: string): PlanTask[] {
  const tasks: PlanTask[] = [];
  const pattern = /^###\s+Task\s+(\d+):\s*(.+)$/gm;

  for (const match of content.matchAll(pattern)) {
    tasks.push({
      index: parseInt(match[1]),
      description: match[2].trim(),
      completed: false,
    });
  }

  return tasks;
}

function extractNumberedItems(content: string): PlanTask[] {
  const tasks: PlanTask[] = [];
  const lines = content.split("\n");

  for (const line of lines) {
    // Match top-level numbered items (no leading whitespace beyond 0-1 spaces)
    const match = line.match(/^\s{0,1}(\d+)[.)]\s+(.+)/);
    if (match) {
      tasks.push({
        index: parseInt(match[1]),
        description: match[2].trim(),
        completed: false,
      });
    }
  }

  return tasks;
}
```

**Step 4: Run tests to verify they pass**

Run: `bun test tests/plan-parser.test.ts`
Expected: All tests PASS

**Step 5: Commit**

```bash
git add -A
git commit -m "feat: plan task extraction from markdown with two format support"
```

---

## Checkpoint: Run all tests

```bash
bun test
```

Expected: All tests across all 4 test files pass. If any fail, fix before continuing.

---

## Phase 3: UI Rendering + Prompt Injection (Tasks 6–7)

### Task 6: UI Rendering Module

Build the TUI layer — dashboard widget, status line, phase transition menus, issue selection. This module uses `ctx.ui` methods. Pure rendering functions (string builders) are tested; interactive methods are tested manually.

**Files:**
- Create: `extensions/megapowers/ui.ts`
- Create: `tests/ui.test.ts`

**Step 1: Write failing tests for pure rendering functions**

Create `tests/ui.test.ts`:

```typescript
import { describe, it, expect } from "bun:test";
import {
  renderDashboardLines,
  renderStatusText,
  formatPhaseProgress,
  formatIssueListItem,
} from "../extensions/megapowers/ui.js";
import type { MegapowersState } from "../extensions/megapowers/state-machine.js";
import { createInitialState } from "../extensions/megapowers/state-machine.js";

// Stub theme — just returns text unformatted
const plainTheme = {
  fg: (_color: string, text: string) => text,
  bold: (text: string) => text,
  italic: (text: string) => text,
  strikethrough: (text: string) => text,
};

describe("renderDashboardLines — no active issue", () => {
  it("shows no-issue message with commands", () => {
    const state = createInitialState();
    const lines = renderDashboardLines(state, [], plainTheme as any);
    const joined = lines.join("\n");
    expect(joined).toContain("No active issue");
    expect(joined).toContain("/issue new");
    expect(joined).toContain("/issue list");
  });
});

describe("renderDashboardLines — active issue", () => {
  it("shows issue, phase, and task progress", () => {
    const state: MegapowersState = {
      ...createInitialState(),
      activeIssue: "001-auth-refactor",
      workflow: "feature",
      phase: "plan",
      planTasks: [
        { index: 1, description: "A", completed: true },
        { index: 2, description: "B", completed: false },
      ],
    };
    const lines = renderDashboardLines(state, [], plainTheme as any);
    const joined = lines.join("\n");
    expect(joined).toContain("001-auth-refactor");
    expect(joined).toContain("feature");
    expect(joined).toContain("plan");
    expect(joined).toContain("1/2");
  });
});

describe("renderStatusText", () => {
  it("returns empty when no active issue", () => {
    expect(renderStatusText(createInitialState())).toBe("");
  });

  it("returns compact status", () => {
    const state: MegapowersState = {
      ...createInitialState(),
      activeIssue: "001-test",
      phase: "implement",
      planTasks: [
        { index: 1, description: "A", completed: true },
        { index: 2, description: "B", completed: false },
        { index: 3, description: "C", completed: false },
      ],
    };
    const text = renderStatusText(state);
    expect(text).toContain("#001");
    expect(text).toContain("implement");
    expect(text).toContain("1/3");
  });
});

describe("formatPhaseProgress", () => {
  it("shows feature phases with current highlighted", () => {
    const result = formatPhaseProgress("feature", "plan", plainTheme as any);
    expect(result).toContain("brainstorm");
    expect(result).toContain("plan");
    expect(result).toContain("implement");
  });
});

describe("formatIssueListItem", () => {
  it("formats an issue for selection", () => {
    const result = formatIssueListItem({
      id: 1,
      slug: "001-auth",
      title: "Auth refactor",
      type: "feature",
      status: "open",
      description: "",
      createdAt: 0,
    });
    expect(result).toContain("#001");
    expect(result).toContain("Auth refactor");
    expect(result).toContain("feature");
    expect(result).toContain("open");
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `bun test tests/ui.test.ts`
Expected: FAIL — module not found

**Step 3: Implement UI module**

Create `extensions/megapowers/ui.ts`:

```typescript
import type { ExtensionContext, Theme } from "@mariozechner/pi-coding-agent";
import type { MegapowersState, Phase, WorkflowType } from "./state-machine.js";
import type { Issue, Store } from "./store.js";
import type { JJ } from "./jj.js";
import { getFirstPhase, getValidTransitions, transition } from "./state-machine.js";
import { formatChangeDescription } from "./jj.js";

// --- Phase labels ---

const FEATURE_PHASES: Phase[] = ["brainstorm", "spec", "plan", "review", "implement", "verify", "done"];
const BUGFIX_PHASES: Phase[] = ["reproduce", "diagnose", "plan", "review", "implement", "verify", "done"];

function getPhasesForWorkflow(workflow: WorkflowType): Phase[] {
  return workflow === "feature" ? FEATURE_PHASES : BUGFIX_PHASES;
}

// --- Pure rendering (testable) ---

export function formatPhaseProgress(workflow: WorkflowType, currentPhase: Phase, theme: Theme): string {
  const phases = getPhasesForWorkflow(workflow);
  return phases
    .map((p) => {
      if (p === currentPhase) return theme.bold(`▶${p}`);
      const idx = phases.indexOf(p);
      const currentIdx = phases.indexOf(currentPhase);
      if (idx < currentIdx) return theme.fg("success", p);
      return theme.fg("dim", p);
    })
    .join(theme.fg("dim", " → "));
}

export function renderStatusText(state: MegapowersState): string {
  if (!state.activeIssue) return "";
  const idNum = state.activeIssue.match(/^(\d+)/)?.[1] ?? "?";
  const completed = state.planTasks.filter((t) => t.completed).length;
  const total = state.planTasks.length;
  const taskInfo = total > 0 ? ` ${completed}/${total}` : "";
  return `📋 #${idNum} ${state.phase ?? "?"}${taskInfo}`;
}

export function renderDashboardLines(state: MegapowersState, issues: Issue[], theme: Theme): string[] {
  const lines: string[] = [];

  if (!state.activeIssue) {
    lines.push(theme.fg("dim", "No active issue."));
    lines.push(`${theme.fg("accent", "/issue new")}  — create an issue`);
    lines.push(`${theme.fg("accent", "/issue list")} — pick an issue to work on`);
    return lines;
  }

  const workflowLabel = state.workflow ? `[${state.workflow}]` : "";
  lines.push(
    `${theme.fg("accent", "Issue:")} ${theme.bold(`#${state.activeIssue}`)} ${theme.fg("dim", workflowLabel)}`
  );

  if (state.phase && state.workflow) {
    lines.push(`${theme.fg("accent", "Phase:")} ${formatPhaseProgress(state.workflow, state.phase, theme)}`);
  }

  if (state.planTasks.length > 0) {
    const completed = state.planTasks.filter((t) => t.completed).length;
    lines.push(`${theme.fg("accent", "Tasks:")} ${completed}/${state.planTasks.length} complete`);
  }

  if (state.jjChangeId) {
    lines.push(`${theme.fg("accent", "jj:")} ${theme.fg("dim", state.jjChangeId)}`);
  }

  return lines;
}

export function formatIssueListItem(issue: Issue): string {
  const id = `#${String(issue.id).padStart(3, "0")}`;
  return `${id} ${issue.title} [${issue.type}] [${issue.status}]`;
}

// --- Interactive UI (uses ctx.ui) ---

export interface MegapowersUI {
  renderDashboard(ctx: ExtensionContext, state: MegapowersState, store: Store): void;
  updateStatus(ctx: ExtensionContext, state: MegapowersState): void;

  handleIssueCommand(
    ctx: ExtensionContext,
    state: MegapowersState,
    store: Store,
    jj: JJ,
    args: string
  ): Promise<MegapowersState>;

  handlePhaseTransition(
    ctx: ExtensionContext,
    state: MegapowersState,
    store: Store,
    jj: JJ
  ): Promise<MegapowersState>;
}

export function createUI(): MegapowersUI {
  return {
    renderDashboard(ctx, state, store) {
      const issues = store.listIssues();
      const lines = renderDashboardLines(state, issues, ctx.ui.theme);
      ctx.ui.setWidget("megapowers", lines);
      this.updateStatus(ctx, state);
    },

    updateStatus(ctx, state) {
      const text = renderStatusText(state);
      if (text) {
        ctx.ui.setStatus("megapowers", ctx.ui.theme.fg("accent", text));
      } else {
        ctx.ui.setStatus("megapowers", undefined);
      }
    },

    async handleIssueCommand(ctx, state, store, jj, args) {
      const parts = args.trim().split(/\s+/);
      const subcommand = parts[0] || "list";

      if (subcommand === "new" || subcommand === "create") {
        const title = await ctx.ui.input("Issue title:");
        if (!title) return state;

        const typeChoice = await ctx.ui.select("Issue type:", ["feature", "bugfix"]);
        if (!typeChoice) return state;
        const type = typeChoice as "feature" | "bugfix";

        const description = await ctx.ui.editor("Description:", "") ?? "";
        const issue = store.createIssue(title, type, description);

        // Activate the issue
        const firstPhase = getFirstPhase(type);
        const newState: MegapowersState = {
          ...state,
          activeIssue: issue.slug,
          workflow: type,
          phase: firstPhase,
          phaseHistory: [],
          reviewApproved: false,
          planTasks: [],
          jjChangeId: null,
        };

        // Create jj change if in a jj repo
        if (await jj.isJJRepo()) {
          const desc = formatChangeDescription(issue.slug, firstPhase);
          const changeId = await jj.newChange(desc, "main");
          if (changeId) newState.jjChangeId = changeId;
        }

        store.saveState(newState);
        store.updateIssueStatus(issue.slug, "in-progress");
        ctx.ui.notify(`Created and activated: ${issue.slug}`, "success");
        this.renderDashboard(ctx, newState, store);
        return newState;
      }

      if (subcommand === "list") {
        const issues = store.listIssues();
        if (issues.length === 0) {
          ctx.ui.notify("No issues. Use /issue new to create one.", "info");
          return state;
        }

        const items = issues.map(formatIssueListItem);
        items.push("+ Create new issue...");

        const choice = await ctx.ui.select("Pick an issue:", items);
        if (!choice) return state;

        if (choice.startsWith("+")) {
          return this.handleIssueCommand(ctx, state, store, jj, "new");
        }

        // Parse slug from selection
        const idMatch = choice.match(/^#(\d+)/);
        if (!idMatch) return state;
        const selected = issues.find((i) => i.id === parseInt(idMatch[1]));
        if (!selected) return state;

        // Activate the issue
        const firstPhase = getFirstPhase(selected.type);
        const newState: MegapowersState = {
          ...state,
          activeIssue: selected.slug,
          workflow: selected.type,
          phase: firstPhase,
          phaseHistory: [],
          reviewApproved: false,
          planTasks: [],
          jjChangeId: null,
        };

        if (await jj.isJJRepo()) {
          const desc = formatChangeDescription(selected.slug, firstPhase);
          const changeId = await jj.newChange(desc, "main");
          if (changeId) newState.jjChangeId = changeId;
        }

        store.saveState(newState);
        store.updateIssueStatus(selected.slug, "in-progress");
        ctx.ui.notify(`Activated: ${selected.slug}`, "success");
        this.renderDashboard(ctx, newState, store);
        return newState;
      }

      ctx.ui.notify(`Unknown subcommand: ${subcommand}. Use: new, list`, "error");
      return state;
    },

    async handlePhaseTransition(ctx, state, store, jj) {
      if (!state.workflow || !state.phase || !state.activeIssue) return state;

      const validNext = getValidTransitions(state.workflow, state.phase);
      if (validNext.length === 0) {
        ctx.ui.notify("No valid transitions from current phase.", "info");
        return state;
      }

      const labels = validNext.map((p) => {
        if (p === "implement" && validNext.includes("review")) {
          return `${p} (skip review)`;
        }
        return p;
      });

      const choice = await ctx.ui.select(
        `Phase "${state.phase}" — what next?`,
        labels
      );
      if (!choice) return state;

      const targetPhase = choice.split(" ")[0] as Phase;
      let newState = transition(state, targetPhase);

      // jj: describe current, create new change
      if (await jj.isJJRepo()) {
        await jj.describe(formatChangeDescription(state.activeIssue, state.phase!, "complete"));
        const changeId = await jj.newChange(formatChangeDescription(state.activeIssue, targetPhase));
        if (changeId) newState = { ...newState, jjChangeId: changeId };
      }

      store.saveState(newState);
      ctx.ui.notify(`Transitioned to: ${targetPhase}`, "success");
      this.renderDashboard(ctx, newState, store);
      return newState;
    },
  };
}
```

**Step 4: Run tests to verify they pass**

Run: `bun test tests/ui.test.ts`
Expected: All tests PASS

**Step 5: Commit**

```bash
git add -A
git commit -m "feat: UI rendering with dashboard widget, status line, and interactive menus"
```

---

### Task 7: Prompt Injection Module

Load phase-specific prompt templates and interpolate state. Pure functions — no pi dependency.

**Files:**
- Create: `extensions/megapowers/prompts.ts`
- Create: `prompts/brainstorm.md`
- Create: `prompts/write-spec.md`
- Create: `prompts/write-plan.md`
- Create: `prompts/review-plan.md`
- Create: `prompts/diagnose-bug.md`
- Create: `prompts/generate-docs.md`
- Create: `tests/prompts.test.ts`

**Step 1: Write failing tests for prompt loading and interpolation**

Create `tests/prompts.test.ts`:

```typescript
import { describe, it, expect } from "bun:test";
import {
  getPhasePromptTemplate,
  interpolatePrompt,
  PHASE_PROMPT_MAP,
} from "../extensions/megapowers/prompts.js";

describe("PHASE_PROMPT_MAP", () => {
  it("maps every feature phase to a prompt file", () => {
    const phases = ["brainstorm", "spec", "plan", "review", "implement", "verify", "done"];
    for (const phase of phases) {
      expect(PHASE_PROMPT_MAP[phase]).toBeDefined();
    }
  });

  it("maps every bugfix phase to a prompt file", () => {
    const phases = ["reproduce", "diagnose", "plan", "review", "implement", "verify", "done"];
    for (const phase of phases) {
      expect(PHASE_PROMPT_MAP[phase]).toBeDefined();
    }
  });
});

describe("interpolatePrompt", () => {
  it("replaces {{key}} placeholders", () => {
    const template = "Working on {{issue_slug}} in phase {{phase}}.";
    const result = interpolatePrompt(template, {
      issue_slug: "001-auth",
      phase: "plan",
    });
    expect(result).toBe("Working on 001-auth in phase plan.");
  });

  it("leaves unknown placeholders as-is", () => {
    const result = interpolatePrompt("{{known}} and {{unknown}}", { known: "yes" });
    expect(result).toBe("yes and {{unknown}}");
  });

  it("handles empty vars", () => {
    const result = interpolatePrompt("Hello {{name}}", {});
    expect(result).toBe("Hello {{name}}");
  });
});

describe("getPhasePromptTemplate", () => {
  it("returns a non-empty string for brainstorm", () => {
    const template = getPhasePromptTemplate("brainstorm");
    expect(template.length).toBeGreaterThan(0);
  });

  it("returns a non-empty string for plan", () => {
    const template = getPhasePromptTemplate("plan");
    expect(template.length).toBeGreaterThan(0);
    expect(template).toContain("{{spec_content}}");
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `bun test tests/prompts.test.ts`
Expected: FAIL — module not found

**Step 3: Create prompt template files**

Create `prompts/brainstorm.md`:
```markdown
You are brainstorming a new feature or change with the user.

## Context
Working on issue: {{issue_slug}}

## Instructions
- Ask clarifying questions to understand the problem
- Explore edge cases and constraints
- Consider impact on existing code
- Help the user refine their idea into something concrete
- When the idea is solid, summarize what you'd build

Do NOT write code or make changes. This is a thinking phase.
```

Create `prompts/write-spec.md`:
```markdown
You are writing an executable specification for the following feature.

## Context
Issue: {{issue_slug}}

## Instructions
- Write clear acceptance criteria
- Each criterion should be testable
- Use concrete examples (Given/When/Then if helpful)
- Cover happy paths and error cases
- Keep it concise — this becomes the "done" checklist

Write the spec as a markdown document.
```

Create `prompts/write-plan.md`:
```markdown
You are writing an implementation plan for the following spec.

## Spec
{{spec_content}}

## Instructions
- Break the spec into ordered, independently testable tasks
- Each task should be small enough to implement with TDD in one session
- Number each task with ### Task N: Title format
- For each task, note what test(s) would verify it
- Do not include setup/boilerplate unless it's genuinely a separate step

Write the plan as a markdown document.
```

Create `prompts/review-plan.md`:
```markdown
You are reviewing an implementation plan.

## Plan
{{plan_content}}

## Instructions
- Check for missing edge cases
- Verify task ordering (dependencies satisfied?)
- Flag tasks that are too large or too vague
- Note any risks or assumptions
- Suggest improvements if needed
- Approve or request changes

Be specific and constructive.
```

Create `prompts/diagnose-bug.md`:
```markdown
You are diagnosing a bug.

## Context
Issue: {{issue_slug}}

## Reproduction
{{diagnosis_content}}

## Instructions
- Trace through the code to find root cause
- Identify what's wrong and why
- Note what might break if you fix it
- Write a clear diagnosis

Do NOT fix the bug yet. Just diagnose.
```

Create `prompts/generate-docs.md`:
```markdown
You are generating documentation from completed work.

## Context
Issue: {{issue_slug}}
Spec: {{spec_content}}
Plan: {{plan_content}}

## Instructions
- Summarize what was built
- Document any API changes
- Note any configuration or setup required
- Keep it concise and practical
```

**Step 4: Implement prompts module**

Create `extensions/megapowers/prompts.ts`:

```typescript
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { Phase } from "./state-machine.js";

// --- Prompt file mapping ---

export const PHASE_PROMPT_MAP: Record<Phase, string> = {
  brainstorm: "brainstorm.md",
  spec: "write-spec.md",
  plan: "write-plan.md",
  review: "review-plan.md",
  implement: "write-plan.md",  // Re-use plan prompt (LLM sees plan tasks)
  verify: "write-spec.md",    // Re-use spec prompt (LLM checks criteria)
  done: "generate-docs.md",
  reproduce: "diagnose-bug.md",
  diagnose: "diagnose-bug.md",
};

// --- Template loading ---

function getPromptsDir(): string {
  // Resolve relative to this file's location: extensions/megapowers/prompts.ts → ../../prompts/
  const thisDir = dirname(fileURLToPath(import.meta.url));
  return join(thisDir, "..", "..", "prompts");
}

export function getPhasePromptTemplate(phase: Phase): string {
  const filename = PHASE_PROMPT_MAP[phase];
  if (!filename) return "";
  try {
    return readFileSync(join(getPromptsDir(), filename), "utf-8");
  } catch {
    return "";
  }
}

// --- Interpolation ---

export function interpolatePrompt(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    return vars[key] ?? match;
  });
}

// --- High-level: build prompt for a phase ---

export function buildPhasePrompt(
  phase: Phase,
  vars: Record<string, string>
): string {
  const template = getPhasePromptTemplate(phase);
  if (!template) return "";
  return interpolatePrompt(template, vars);
}
```

**Step 5: Run tests to verify they pass**

Run: `bun test tests/prompts.test.ts`
Expected: All tests PASS

**Step 6: Commit**

```bash
git add -A
git commit -m "feat: phase-specific prompt templates with interpolation"
```

---

## Phase 4: Extension Wiring (Task 8)

### Task 8: Wire Everything Together in index.ts

Connect all modules to pi's event system. This is the integration point — event handlers, commands, session persistence.

**Files:**
- Modify: `extensions/megapowers/index.ts`

**Step 1: Implement the full extension wiring**

Replace `extensions/megapowers/index.ts` with:

```typescript
import type { ExtensionAPI, ExtensionContext } from "@mariozechner/pi-coding-agent";
import { createInitialState, getValidTransitions, transition, getFirstPhase, type MegapowersState, type Phase } from "./state-machine.js";
import { createStore, type Store } from "./store.js";
import { createJJ, formatChangeDescription, type JJ } from "./jj.js";
import { createUI, type MegapowersUI } from "./ui.js";
import { buildPhasePrompt } from "./prompts.js";
import { extractPlanTasks } from "./plan-parser.js";
import type { AgentMessage } from "@mariozechner/pi-agent-core";
import type { AssistantMessage, TextContent } from "@mariozechner/pi-ai";

// --- Helpers ---

function isAssistantMessage(m: AgentMessage): m is AssistantMessage {
  return m.role === "assistant" && Array.isArray(m.content);
}

function getAssistantText(message: AssistantMessage): string {
  return message.content
    .filter((block): block is TextContent => block.type === "text")
    .map((block) => block.text)
    .join("\n");
}

// --- Extension ---

export default function megapowers(pi: ExtensionAPI): void {
  let state: MegapowersState = createInitialState();
  let store: Store;
  let jj: JJ;
  let ui: MegapowersUI;

  // --- Session lifecycle ---

  pi.on("session_start", async (_event, ctx) => {
    store = createStore(ctx.cwd);
    jj = createJJ(pi);
    ui = createUI();

    // Load persisted state
    state = store.loadState();

    // Also reconstruct from pi session entries (crash recovery)
    for (const entry of ctx.sessionManager.getEntries()) {
      if (entry.type === "custom" && (entry as any).customType === "megapowers-state") {
        try {
          state = (entry as any).data as MegapowersState;
        } catch { /* ignore corrupt entries */ }
      }
    }

    // jj validation
    if (state.activeIssue && state.jjChangeId && await jj.isJJRepo()) {
      const currentId = await jj.getCurrentChangeId();
      if (currentId && currentId !== state.jjChangeId) {
        if (ctx.hasUI) {
          const choice = await ctx.ui.select(
            `jj change mismatch: on ${currentId.slice(0, 8)}, expected ${state.jjChangeId.slice(0, 8)} for ${state.activeIssue}`,
            ["Continue on current change", "Ignore (update stored ID)"]
          );
          if (choice?.startsWith("Ignore")) {
            state = { ...state, jjChangeId: currentId };
            store.saveState(state);
          }
        }
      }
    }

    // Render dashboard
    if (ctx.hasUI) {
      ui.renderDashboard(ctx, state, store);
    }
  });

  pi.on("session_shutdown", async () => {
    if (store) store.saveState(state);
  });

  // --- Prompt injection ---

  pi.on("before_agent_start", async (_event, ctx) => {
    if (!state.activeIssue || !state.phase) return;

    // Build vars for prompt interpolation
    const vars: Record<string, string> = {
      issue_slug: state.activeIssue,
      phase: state.phase,
    };

    // Load plan artifacts if they exist
    if (store) {
      const spec = store.readPlanFile(state.activeIssue, "spec.md");
      if (spec) vars.spec_content = spec;

      const plan = store.readPlanFile(state.activeIssue, "plan.md");
      if (plan) vars.plan_content = plan;

      const diagnosis = store.readPlanFile(state.activeIssue, "diagnosis.md");
      if (diagnosis) vars.diagnosis_content = diagnosis;
    }

    const prompt = buildPhasePrompt(state.phase, vars);
    if (!prompt) return;

    // Include relevant learnings
    const learnings = store?.getLearnings() ?? "";
    const fullPrompt = learnings
      ? `${prompt}\n\n## Project Learnings\n${learnings}`
      : prompt;

    return {
      message: {
        customType: "megapowers-context",
        content: fullPrompt,
        display: false,
      },
    };
  });

  // --- Agent completion: capture artifacts and offer transitions ---

  pi.on("agent_end", async (event, ctx) => {
    if (!state.activeIssue || !state.phase || !store || !ctx.hasUI) return;

    // Extract text from last assistant message
    const lastAssistant = [...event.messages].reverse().find(isAssistantMessage);
    if (!lastAssistant) return;
    const text = getAssistantText(lastAssistant);
    if (!text) return;

    // Phase-specific artifact capture
    const phase = state.phase;

    if (phase === "spec" || phase === "brainstorm") {
      // After brainstorm/spec, check if there's content worth saving
      if (phase === "spec" && text.length > 100) {
        store.ensurePlanDir(state.activeIssue);
        store.writePlanFile(state.activeIssue, "spec.md", text);
        ctx.ui.notify("Spec saved.", "success");
      }
    }

    if (phase === "plan") {
      if (text.length > 100) {
        store.ensurePlanDir(state.activeIssue);
        store.writePlanFile(state.activeIssue, "plan.md", text);
        const tasks = extractPlanTasks(text);
        state = { ...state, planTasks: tasks };
        store.saveState(state);
        ctx.ui.notify(`Plan saved. ${tasks.length} tasks extracted.`, "success");
      }
    }

    if (phase === "diagnose") {
      if (text.length > 100) {
        store.ensurePlanDir(state.activeIssue);
        store.writePlanFile(state.activeIssue, "diagnosis.md", text);
        ctx.ui.notify("Diagnosis saved.", "success");
      }
    }

    if (phase === "review") {
      // Check if the review approved the plan
      const approved = /\bapproved?\b/i.test(text) && !/\bnot approved\b/i.test(text);
      if (approved) {
        state = { ...state, reviewApproved: true };
        store.saveState(state);
        ctx.ui.notify("Review: approved.", "success");
      }
    }

    // Offer phase transition
    const validNext = getValidTransitions(state.workflow, state.phase);
    if (validNext.length > 0) {
      state = await ui.handlePhaseTransition(ctx, state, store, jj);
      // Persist after transition
      pi.appendEntry("megapowers-state", state);
    }

    ui.renderDashboard(ctx, state, store);
  });

  // --- Commands ---

  pi.registerCommand("mega", {
    description: "Show megapowers dashboard",
    handler: async (_args, ctx) => {
      if (!store) store = createStore(ctx.cwd);
      ui = ui ?? createUI();
      ui.renderDashboard(ctx, state, store);
    },
  });

  pi.registerCommand("issue", {
    description: "Create or list issues (usage: /issue new | /issue list)",
    getArgumentCompletions: (prefix) => {
      const subs = ["new", "list"];
      const filtered = subs.filter((s) => s.startsWith(prefix));
      return filtered.length > 0 ? filtered.map((s) => ({ value: s, label: s })) : null;
    },
    handler: async (args, ctx) => {
      if (!store) store = createStore(ctx.cwd);
      if (!jj) jj = createJJ(pi);
      if (!ui) ui = createUI();
      state = await ui.handleIssueCommand(ctx, state, store, jj, args);
      pi.appendEntry("megapowers-state", state);
    },
  });

  pi.registerCommand("phase", {
    description: "Show current phase or transition (usage: /phase | /phase next)",
    handler: async (args, ctx) => {
      if (!store) store = createStore(ctx.cwd);
      if (!jj) jj = createJJ(pi);
      if (!ui) ui = createUI();

      if (args.trim() === "next") {
        state = await ui.handlePhaseTransition(ctx, state, store, jj);
        pi.appendEntry("megapowers-state", state);
      } else {
        if (state.phase && state.workflow) {
          ctx.ui.notify(
            `Phase: ${state.phase}\nWorkflow: ${state.workflow}\nIssue: ${state.activeIssue ?? "none"}`,
            "info"
          );
        } else {
          ctx.ui.notify("No active workflow. Use /issue to start.", "info");
        }
      }
    },
  });

  pi.registerCommand("learn", {
    description: "Capture a learning",
    handler: async (args, ctx) => {
      if (!store) store = createStore(ctx.cwd);

      if (args.trim()) {
        store.appendLearning(args.trim());
        ctx.ui.notify("Learning captured.", "success");
      } else {
        const learning = await ctx.ui.input("What did you learn?");
        if (learning?.trim()) {
          store.appendLearning(learning.trim());
          ctx.ui.notify("Learning captured.", "success");
        }
      }
    },
  });
}
```

**Step 2: Run all tests to make sure nothing broke**

Run: `bun test`
Expected: All tests PASS (the index.ts changes don't affect unit tests)

**Step 3: Manually test the extension**

Run:
```bash
cd /Users/maxwellnewman/pi/workspace/pi-megapowers
pi -e ./extensions/megapowers/index.ts
```

Verify:
1. Dashboard widget appears showing "No active issue" with command hints
2. `/issue new` prompts for title, type, description and creates an issue
3. `/issue list` shows issues and lets you select one
4. `/mega` refreshes the dashboard
5. `/phase` shows current phase info
6. `/learn some insight` captures a learning
7. Status bar shows the compact status line

**Step 4: Commit**

```bash
git add -A
git commit -m "feat: wire extension with events, commands, prompt injection, and artifact capture"
```

---

## Final Checkpoint

```bash
bun test
```

Expected: All tests pass across all test files:
- `tests/state-machine.test.ts`
- `tests/store.test.ts`
- `tests/jj.test.ts`
- `tests/plan-parser.test.ts`
- `tests/ui.test.ts`
- `tests/prompts.test.ts`

Final manual verification:
```bash
pi -e ./extensions/megapowers/index.ts
```

Verify the full flow: dashboard → `/issue new` → see widget update → chat with LLM → `/phase next` → transition.

---

## Summary

| Task | Module | Tests | Description |
|------|--------|-------|-------------|
| 1 | Package skeleton | — | package.json, tsconfig, empty entry point |
| 2 | state-machine.ts | state-machine.test.ts | Types, transitions, pure logic |
| 3 | store.ts | store.test.ts | .megapowers/ filesystem ops |
| 4 | jj.ts | jj.test.ts | jj command builders + output parsing |
| 5 | plan-parser.ts | plan-parser.test.ts | Extract tasks from plan markdown |
| 6 | ui.ts | ui.test.ts | Dashboard widget, status, menus |
| 7 | prompts.ts + templates | prompts.test.ts | Phase prompt loading + interpolation |
| 8 | index.ts (wiring) | Manual | Events, commands, session persistence |
