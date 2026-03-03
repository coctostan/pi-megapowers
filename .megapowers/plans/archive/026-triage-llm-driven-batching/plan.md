# Plan: Triage LLM-Driven Batching

## Coverage Map
| AC | Task(s) |
|----|---------|
| 1  | 1 |
| 2  | 1 |
| 3  | 1 |
| 4  | 1 |
| 5  | 1 |
| 6  | 1 |
| 7  | 2 |
| 8  | 2 |
| 9  | 2 |
| 10 | 2 |
| 11 | 3 |
| 12 | 3 |
| 13 | 3 |

---

### Task 1: Register `create_batch` tool with extracted handler

**Files:**
- Create: `extensions/megapowers/tools.ts`
- Create: `tests/tools.test.ts`
- Modify: `extensions/megapowers/index.ts`

**Test:** `tests/tools.test.ts`

```typescript
import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createStore } from "../extensions/megapowers/store.js";
import { createBatchHandler } from "../extensions/megapowers/tools.js";

let tmp: string;
let store: ReturnType<typeof createStore>;

beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), "megapowers-test-"));
  store = createStore(tmp);
});

afterEach(() => {
  rmSync(tmp, { recursive: true, force: true });
});

describe("createBatchHandler", () => {
  it("creates a batch issue with title, type, description, and source IDs (AC 1, 3)", () => {
    store.createIssue("Bug A", "bugfix", "First bug");
    store.createIssue("Bug B", "bugfix", "Second bug");

    const result = createBatchHandler(store, {
      title: "Parser fixes",
      type: "bugfix",
      sourceIds: [1, 2],
      description: "Fix both parser bugs",
    });

    expect("error" in result).toBe(false);
    if (!("error" in result)) {
      expect(result.slug).toContain("parser-fixes");
      expect(result.id).toBeGreaterThan(2);
    }
  });

  it("returns slug and id on success (AC 4)", () => {
    store.createIssue("Bug A", "bugfix", "desc");
    const result = createBatchHandler(store, {
      title: "Batch",
      type: "bugfix",
      sourceIds: [1],
      description: "desc",
    });
    expect("error" in result).toBe(false);
    if (!("error" in result)) {
      expect(typeof result.slug).toBe("string");
      expect(typeof result.id).toBe("number");
    }
  });

  it("returns error when a sourceId does not exist (AC 5)", () => {
    store.createIssue("Bug A", "bugfix", "desc");
    const result = createBatchHandler(store, {
      title: "Batch",
      type: "bugfix",
      sourceIds: [1, 99],
      description: "desc",
    });
    expect("error" in result).toBe(true);
    if ("error" in result) {
      expect(result.error).toContain("99");
    }
  });

  it("returns error when a sourceId references a done issue (AC 5)", () => {
    const issue = store.createIssue("Bug A", "bugfix", "desc");
    store.updateIssueStatus(issue.slug, "done");
    const result = createBatchHandler(store, {
      title: "Batch",
      type: "bugfix",
      sourceIds: [1],
      description: "desc",
    });
    expect("error" in result).toBe(true);
    if ("error" in result) {
      expect(result.error).toContain("1");
    }
  });

  it("does not change workflow state (AC 6)", () => {
    store.createIssue("Bug A", "bugfix", "desc");
    const stateBefore = store.loadState();
    createBatchHandler(store, {
      title: "Batch",
      type: "bugfix",
      sourceIds: [1],
      description: "desc",
    });
    const stateAfter = store.loadState();
    expect(stateAfter.activeIssue).toBe(stateBefore.activeIssue);
    expect(stateAfter.phase).toBe(stateBefore.phase);
    expect(stateAfter.workflow).toBe(stateBefore.workflow);
  });
});
```

**Implementation:** `extensions/megapowers/tools.ts`

```typescript
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
```

Then in `extensions/megapowers/index.ts`, add the tool registration inside `activate()`. Add these imports at the top:

```typescript
import { Type } from "@sinclair/typebox";
import { StringEnum } from "@mariozechner/pi-ai";
import { createBatchHandler } from "./tools.js";
```

Register the tool after the existing command registrations:

```typescript
pi.registerTool({
  name: "create_batch",
  description: "Create a batch issue grouping source issues.",
  parameters: Type.Object({
    title: Type.String(),
    type: StringEnum(["bugfix", "feature"] as const),
    sourceIds: Type.Array(Type.Number()),
    description: Type.String(),
  }),
  async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
    if (!store) store = createStore(ctx.cwd);
    const result = createBatchHandler(store, params);
    if ("error" in result) {
      return { content: [{ type: "text", text: result.error }] };
    }
    return {
      content: [{ type: "text", text: `Created batch: ${result.slug} (id: ${result.id})` }],
    };
  },
});
```

The tool description is 7 words (AC 2). The tool does not touch state (AC 6).

**Verify:** `bun test tests/tools.test.ts`

---

### Task 2: Refactor `/triage` command [depends: 1]

**Files:**
- Modify: `extensions/megapowers/ui.ts` — replace `handleTriageCommand` body
- Modify: `extensions/megapowers/index.ts` — update command handler
- Test: `tests/ui.test.ts`

**Test:** Add to `tests/ui.test.ts` (replace any existing triage tests):

```typescript
import { filterTriageableIssues, formatTriageIssueList } from "../extensions/megapowers/ui.js";

describe("filterTriageableIssues", () => {
  it("returns open non-batch issues (AC 7)", () => {
    const issues = [
      { id: 1, slug: "001-a", title: "A", type: "bugfix" as const, status: "open" as const, description: "d", sources: [], createdAt: 0 },
      { id: 2, slug: "002-b", title: "B", type: "bugfix" as const, status: "done" as const, description: "d", sources: [], createdAt: 0 },
      { id: 3, slug: "003-c", title: "C", type: "feature" as const, status: "open" as const, description: "d", sources: [1, 2], createdAt: 0 },
      { id: 4, slug: "004-d", title: "D", type: "bugfix" as const, status: "in-progress" as const, description: "d", sources: [], createdAt: 0 },
    ];
    const result = filterTriageableIssues(issues);
    expect(result).toHaveLength(2);
    expect(result.map(i => i.id)).toEqual([1, 4]);
  });

  it("returns empty array when no issues match", () => {
    const result = filterTriageableIssues([]);
    expect(result).toHaveLength(0);
  });
});

describe("formatTriageIssueList", () => {
  it("formats issues with id, title, type, and description (AC 7)", () => {
    const issues = [
      { id: 1, slug: "001-a", title: "Bug A", type: "bugfix" as const, status: "open" as const, description: "Parser fails on edge case", sources: [], createdAt: 0 },
    ];
    const result = formatTriageIssueList(issues);
    expect(result).toContain("#001");
    expect(result).toContain("Bug A");
    expect(result).toContain("bugfix");
    expect(result).toContain("Parser fails");
  });
});
```

**Implementation:**

In `extensions/megapowers/ui.ts`, add these two exported functions (above `createUI`):

```typescript
export function filterTriageableIssues(issues: Issue[]): Issue[] {
  return issues.filter(i => i.status !== "done" && i.sources.length === 0);
}

export function formatTriageIssueList(issues: Issue[]): string {
  return issues
    .map(i => `- #${String(i.id).padStart(3, "0")} ${i.title} [${i.type}] — ${i.description.slice(0, 120)}`)
    .join("\n");
}
```

Replace the `handleTriageCommand` body inside `createUI()` with a stub that just returns state (the actual command logic moves to `index.ts`):

```typescript
async handleTriageCommand(ctx, state, store, _jj) {
  const openIssues = filterTriageableIssues(store.listIssues());
  if (openIssues.length === 0) {
    ctx.ui.notify("No open issues to triage.", "info");
    return state;
  }
  return state;
},
```

In `extensions/megapowers/index.ts`, update the `/triage` command handler to use `pi.sendUserMessage()` (AC 8, 10):

```typescript
import { filterTriageableIssues, formatTriageIssueList } from "./ui.js";
import { loadPromptFile, interpolatePrompt } from "./prompts.js";

pi.registerCommand("triage", {
  description: "Triage open issues into batches",
  handler: async (_args, ctx) => {
    if (!store) store = createStore(ctx.cwd);
    const issues = filterTriageableIssues(store.listIssues());
    if (issues.length === 0) {
      ctx.ui.notify("No open issues to triage.", "info");
      return;
    }
    const issueList = formatTriageIssueList(issues);
    const template = loadPromptFile("triage.md");
    const prompt = interpolatePrompt(template, { open_issues: issueList });
    pi.sendUserMessage(prompt);
  },
});
```

This removes all `ctx.ui.input`, `ctx.ui.select`, `ctx.ui.editor` usage (AC 10). Shows notification when no issues (AC 9). Sends interpolated prompt as user message (AC 8).

**Verify:** `bun test tests/ui.test.ts`

---

### Task 3: Update triage prompt template [depends: 1]

**Files:**
- Modify: `prompts/triage.md`
- Test: `tests/prompts.test.ts`

**Test:** Add to `tests/prompts.test.ts`:

```typescript
import { loadPromptFile, interpolatePrompt } from "../extensions/megapowers/prompts.js";

describe("triage prompt template", () => {
  it("references create_batch tool (AC 13)", () => {
    const content = loadPromptFile("triage.md");
    expect(content).toContain("create_batch");
  });

  it("instructs to discuss before creating (AC 11)", () => {
    const content = loadPromptFile("triage.md");
    expect(content).toMatch(/before|discuss|confirm|adjust|agree/i);
  });

  it("instructs against single-issue batches (AC 12)", () => {
    const content = loadPromptFile("triage.md");
    expect(content).toMatch(/single.issue|one.issue|at least (two|2)/i);
  });

  it("interpolates open_issues placeholder (AC 8)", () => {
    const template = loadPromptFile("triage.md");
    const result = interpolatePrompt(template, { open_issues: "- #001 Bug A [bugfix]" });
    expect(result).toContain("#001");
    expect(result).not.toContain("{{open_issues}}");
  });
});
```

**Implementation:** Replace `prompts/triage.md` with:

```markdown
You are triaging a project's open issues. Review them, propose batch groupings, and create batches when the user confirms.

## Open Issues

{{open_issues}}

## Instructions

1. Group related issues by type affinity, code affinity, dependency, and complexity.
2. For each group, propose: a short title, type (bugfix/feature), which issue IDs, and a brief rationale.
3. Do not create single-issue batches — every batch must contain at least two source issues. Issues that don't fit a group should remain standalone.
4. Flag complex issues that may need solo attention.
5. Present your groupings and discuss with the user before creating anything.
6. When the user confirms, call the `create_batch` tool once per batch with title, type, sourceIds, and description.
```

**Verify:** `bun test tests/prompts.test.ts`

---

**Final verification:** `bun test`
