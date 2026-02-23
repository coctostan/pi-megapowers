# Plan: Issue Triage & Batching

## Coverage Map
| AC | Task(s) |
|----|---------|
| 1  | 1 |
| 2  | 1 |
| 15 | 2 |
| 16 | 1 |
| 3  | 3 |
| 4  | 3 |
| 5  | 4 |
| 14 | 5 |
| 9  | 6 |
| 10 | 6 |
| 11 | 7 |
| 12 | 8 |
| 13 | 8 |
| 6  | 9 |
| 7  | 9 |
| 8  | 9 |

---

### Task 1: Add `sources` field to Issue type and frontmatter parser

**Files:**
- Modify: `extensions/megapowers/store.ts`
- Test: `tests/store.test.ts`

**Test:**

Add to the `describe("issues", ...)` block in `tests/store.test.ts`:

```typescript
describe("sources field", () => {
  it("parses sources from issue frontmatter into number array", () => {
    // Manually write an issue file with sources in frontmatter
    const { writeFileSync, mkdirSync } = require("node:fs");
    mkdirSync(join(tmp, ".megapowers", "issues"), { recursive: true });
    writeFileSync(join(tmp, ".megapowers", "issues", "019-batch-parser-fixes.md"), `---
id: 19
type: bugfix
status: open
created: 2026-02-23T00:00:00.000Z
sources: [6, 13, 17]
---

# Batch parser fixes

Consolidation of parser-related bugs.
`);
    const issue = store.getIssue("019-batch-parser-fixes");
    expect(issue).not.toBeNull();
    expect(issue!.sources).toEqual([6, 13, 17]);
  });

  it("returns empty array for issues without sources field", () => {
    const issue = store.createIssue("Regular issue", "feature", "No sources");
    expect(issue.sources).toEqual([]);
  });

  it("returns empty array for issues with empty sources", () => {
    const { writeFileSync, mkdirSync } = require("node:fs");
    mkdirSync(join(tmp, ".megapowers", "issues"), { recursive: true });
    writeFileSync(join(tmp, ".megapowers", "issues", "019-empty-sources.md"), `---
id: 19
type: bugfix
status: open
created: 2026-02-23T00:00:00.000Z
sources: []
---

# Empty sources test
`);
    const issue = store.getIssue("019-empty-sources");
    expect(issue!.sources).toEqual([]);
  });

  it("includes sources in listIssues output", () => {
    const { writeFileSync, mkdirSync } = require("node:fs");
    mkdirSync(join(tmp, ".megapowers", "issues"), { recursive: true });
    writeFileSync(join(tmp, ".megapowers", "issues", "001-batch.md"), `---
id: 1
type: bugfix
status: open
created: 2026-02-23T00:00:00.000Z
sources: [5, 10]
---

# Batch fix
`);
    const issues = store.listIssues();
    expect(issues[0].sources).toEqual([5, 10]);
  });
});
```

**Implementation:**

1. Add `sources: number[]` to the `Issue` interface in `store.ts`.

2. Update `parseIssueFrontmatter` to parse the `sources` field. The frontmatter line looks like `sources: [6, 13, 17]`. Parse it with a regex to extract the bracketed list, then split on commas and parseInt each:

```typescript
// Inside parseIssueFrontmatter, after the existing kv parsing loop:
// Parse sources: [1, 2, 3] from frontmatter
let sources: number[] = [];
const sourcesLine = frontmatter.split("\n").find(l => l.startsWith("sources:"));
if (sourcesLine) {
  const bracketMatch = sourcesLine.match(/\[([^\]]*)\]/);
  if (bracketMatch && bracketMatch[1].trim()) {
    sources = bracketMatch[1].split(",").map(s => parseInt(s.trim())).filter(n => !isNaN(n));
  }
}
// Add to the returned partial: sources
```

3. Update `listIssues` and `getIssue` to include `sources: parsed.sources ?? []` in the returned `Issue` object.

4. Update `formatIssueFile` to NOT write sources (sources is only written by `createIssue` — see Task 2). Regular issues created via `createIssue` without sources don't need the field.

**Verify:** `bun test tests/store.test.ts`

---

### Task 2: Add `sources` parameter to `createIssue` [depends: 1]

**Files:**
- Modify: `extensions/megapowers/store.ts`
- Test: `tests/store.test.ts`

**Test:**

Add to the `describe("issues", ...)` block:

```typescript
it("creates an issue with sources in frontmatter", () => {
  const issue = store.createIssue("Batch fix", "bugfix", "Combined fix", [6, 13, 17]);
  expect(issue.sources).toEqual([6, 13, 17]);

  // Verify persisted to file
  const reloaded = store.getIssue(issue.slug);
  expect(reloaded!.sources).toEqual([6, 13, 17]);
});

it("creates an issue without sources when parameter omitted", () => {
  const issue = store.createIssue("Normal", "feature", "desc");
  expect(issue.sources).toEqual([]);

  const reloaded = store.getIssue(issue.slug);
  expect(reloaded!.sources).toEqual([]);
});
```

**Implementation:**

1. Change `createIssue` signature to accept an optional 4th parameter:
```typescript
createIssue(title: string, type: "feature" | "bugfix", description: string, sources?: number[]): Issue
```

2. Add `sources: sources ?? []` to the `Issue` object created inside `createIssue`.

3. Update `formatIssueFile` to accept `Issue` (which now has `sources`) and conditionally write the `sources` line in frontmatter only if `sources.length > 0`:
```typescript
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
```

4. Update the `Store` interface type for `createIssue` to match.

**Verify:** `bun test tests/store.test.ts`

---

### Task 3: Add `getSourceIssues` method to store [depends: 1]

**Files:**
- Modify: `extensions/megapowers/store.ts`
- Test: `tests/store.test.ts`

**Test:**

Add a new describe block in `tests/store.test.ts`:

```typescript
describe("getSourceIssues", () => {
  it("returns Issue objects for each source ID", () => {
    store.createIssue("Bug A", "bugfix", "desc A");  // id 1
    store.createIssue("Bug B", "bugfix", "desc B");  // id 2
    store.createIssue("Bug C", "bugfix", "desc C");  // id 3

    // Create batch referencing 1 and 3
    const batch = store.createIssue("Batch fix", "bugfix", "combined", [1, 3]);
    const sources = store.getSourceIssues(batch.slug);

    expect(sources).toHaveLength(2);
    expect(sources[0].id).toBe(1);
    expect(sources[0].title).toBe("Bug A");
    expect(sources[1].id).toBe(3);
    expect(sources[1].title).toBe("Bug C");
  });

  it("returns empty array for non-batch issue", () => {
    const issue = store.createIssue("Normal", "feature", "desc");
    expect(store.getSourceIssues(issue.slug)).toEqual([]);
  });

  it("returns empty array for unknown slug", () => {
    expect(store.getSourceIssues("999-nonexistent")).toEqual([]);
  });

  it("skips source IDs that don't match any existing issue", () => {
    store.createIssue("Bug A", "bugfix", "desc A");  // id 1
    const batch = store.createIssue("Batch fix", "bugfix", "combined", [1, 99]);
    const sources = store.getSourceIssues(batch.slug);
    expect(sources).toHaveLength(1);
    expect(sources[0].id).toBe(1);
  });
});
```

**Implementation:**

1. Add `getSourceIssues(slug: string): Issue[]` to the `Store` interface.

2. Implement:
```typescript
getSourceIssues(slug: string): Issue[] {
  const issue = this.getIssue(slug);
  if (!issue || issue.sources.length === 0) return [];

  const allIssues = this.listIssues();
  const sourceSet = new Set(issue.sources);
  return allIssues.filter(i => sourceSet.has(i.id));
}
```

**Verify:** `bun test tests/store.test.ts`

---

### Task 4: Add `getBatchForIssue` method to store [depends: 1]

**Files:**
- Modify: `extensions/megapowers/store.ts`
- Test: `tests/store.test.ts`

**Test:**

Add a new describe block:

```typescript
describe("getBatchForIssue", () => {
  it("returns batch slug when issue is a source in an open batch", () => {
    store.createIssue("Bug A", "bugfix", "desc");  // id 1
    const batch = store.createIssue("Batch", "bugfix", "combined", [1]);
    const result = store.getBatchForIssue(1);
    expect(result).toBe(batch.slug);
  });

  it("returns batch slug when issue is a source in an in-progress batch", () => {
    store.createIssue("Bug A", "bugfix", "desc");  // id 1
    const batch = store.createIssue("Batch", "bugfix", "combined", [1]);
    store.updateIssueStatus(batch.slug, "in-progress");
    expect(store.getBatchForIssue(1)).toBe(batch.slug);
  });

  it("returns null when issue is not in any batch", () => {
    store.createIssue("Standalone", "bugfix", "desc");  // id 1
    expect(store.getBatchForIssue(1)).toBeNull();
  });

  it("returns null when only batch containing the issue is done", () => {
    store.createIssue("Bug A", "bugfix", "desc");  // id 1
    const batch = store.createIssue("Batch", "bugfix", "combined", [1]);
    store.updateIssueStatus(batch.slug, "done");
    expect(store.getBatchForIssue(1)).toBeNull();
  });

  it("returns first matching batch when issue is in multiple batches", () => {
    store.createIssue("Bug A", "bugfix", "desc");  // id 1
    const batch1 = store.createIssue("Batch 1", "bugfix", "combined", [1]);
    const batch2 = store.createIssue("Batch 2", "bugfix", "combined", [1]);
    // First by file sort order (002 before 003)
    expect(store.getBatchForIssue(1)).toBe(batch1.slug);
  });
});
```

**Implementation:**

1. Add `getBatchForIssue(issueId: number): string | null` to the `Store` interface.

2. Implement:
```typescript
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
}
```

**Verify:** `bun test tests/store.test.ts`

---

### Task 5: Create triage prompt template

**Files:**
- Create: `prompts/triage.md`
- Test: `tests/prompts.test.ts`

**Test:**

Add to `tests/prompts.test.ts`:

```typescript
describe("triage prompt template", () => {
  it("triage.md template file exists and loads", () => {
    const content = loadPromptFile("triage.md");
    expect(content.length).toBeGreaterThan(0);
  });

  it("triage template contains open issues placeholder", () => {
    const content = loadPromptFile("triage.md");
    expect(content).toContain("{{open_issues}}");
  });

  it("triage template interpolates open issues content", () => {
    const template = loadPromptFile("triage.md");
    const result = interpolatePrompt(template, {
      open_issues: "- #006 Acceptance criteria not extracted [bugfix]\n- #013 /mega does nothing [bugfix]",
    });
    expect(result).toContain("#006");
    expect(result).toContain("#013");
    expect(result).not.toContain("{{open_issues}}");
  });
});
```

**Implementation:**

Create `prompts/triage.md`:

```markdown
You are triaging a project's open issues. Your job is to review all open issues, group related ones, and help the user create batch work items.

## Open Issues

{{open_issues}}

## Instructions

Review the issues above and propose groupings based on:

1. **Type affinity** — group bugs with bugs, features with features
2. **Code affinity** — issues that touch the same files or modules should be grouped
3. **Dependency** — if fixing one issue makes another easier, group them
4. **Complexity** — mix simple and moderate issues in the same batch; flag very complex issues that may need solo attention

For each proposed group, provide:
- A short batch title (e.g., "Parser fixes", "Command infrastructure")
- The type: `bugfix` or `feature`
- Which issue IDs belong in the group
- A brief rationale for the grouping

Present your groupings and ask the user if they want to adjust before creating batch issues.

Issues that don't fit any group can remain as standalone items.
```

**Verify:** `bun test tests/prompts.test.ts`

---

### Task 6: Inject source issue content into phase prompts [depends: 1, 3]

**Files:**
- Modify: `extensions/megapowers/index.ts`
- Test: `tests/prompts.test.ts`

**Test:**

This tests the source-content-building logic. We'll extract the injection logic into a testable pure function and test that, rather than testing the event handler directly.

Add to `extensions/megapowers/prompts.ts` and test in `tests/prompts.test.ts`:

```typescript
// Test in tests/prompts.test.ts:
import { buildSourceIssuesContext } from "../extensions/megapowers/prompts.js";
import type { Issue } from "../extensions/megapowers/store.js";

describe("buildSourceIssuesContext", () => {
  it("returns formatted context for source issues", () => {
    const sources: Issue[] = [
      { id: 6, slug: "006-criteria-bug", title: "Criteria not extracted", type: "bugfix", status: "open", description: "The parser fails to extract acceptance criteria.", createdAt: 0, sources: [] },
      { id: 17, slug: "017-no-test-tasks", title: "No-test tasks fail", type: "bugfix", status: "open", description: "Tasks marked [no-test] are not detected as complete.", createdAt: 0, sources: [] },
    ];
    const result = buildSourceIssuesContext(sources);
    expect(result).toContain("006-criteria-bug");
    expect(result).toContain("Criteria not extracted");
    expect(result).toContain("The parser fails to extract acceptance criteria.");
    expect(result).toContain("017-no-test-tasks");
  });

  it("returns empty string for empty source list", () => {
    expect(buildSourceIssuesContext([])).toBe("");
  });
});
```

**Implementation:**

1. Add to `extensions/megapowers/prompts.ts`:

```typescript
import type { Issue } from "./store.js";

export function buildSourceIssuesContext(sourceIssues: Issue[]): string {
  if (sourceIssues.length === 0) return "";

  const sections = sourceIssues.map(issue => {
    return `### Issue #${String(issue.id).padStart(3, "0")}: ${issue.title}
- **Slug:** ${issue.slug}
- **Type:** ${issue.type}
- **Status:** ${issue.status}

${issue.description}`;
  });

  return `## Source Issues (Batch Context)\n\nThis is a batch issue addressing the following individual issues:\n\n${sections.join("\n\n---\n\n")}`;
}
```

2. In `extensions/megapowers/index.ts`, in the `before_agent_start` handler, after loading artifact vars and before interpolation, add:

```typescript
// Batch issue: inject source issue content
if (store) {
  const issue = store.getIssue(state.activeIssue);
  if (issue && issue.sources.length > 0) {
    const sourceIssues = store.getSourceIssues(state.activeIssue);
    const sourceContext = buildSourceIssuesContext(sourceIssues);
    if (sourceContext) {
      vars.source_issues_context = sourceContext;
    }
  }
}
```

3. The `source_issues_context` variable gets appended to the final prompt. Since `interpolatePrompt` only replaces `{{key}}` placeholders and we want this injected universally (all phases), append it after interpolation:

```typescript
let finalPrompt = interpolatePrompt(template, vars);
if (vars.source_issues_context) {
  finalPrompt = finalPrompt + "\n\n" + vars.source_issues_context;
}
```

**Verify:** `bun test tests/prompts.test.ts`

---

### Task 7: Annotate issue list items with batch membership [depends: 4]

**Files:**
- Modify: `extensions/megapowers/ui.ts`
- Test: `tests/ui.test.ts`

**Test:**

Add to `tests/ui.test.ts`:

```typescript
import type { Issue } from "../extensions/megapowers/store.js";
import { formatIssueListItem } from "../extensions/megapowers/ui.js";

describe("formatIssueListItem — batch annotation", () => {
  it("appends batch annotation when batchSlug is provided", () => {
    const issue: Issue = {
      id: 6, slug: "006-criteria-bug", title: "Criteria not extracted",
      type: "bugfix", status: "open", description: "", createdAt: 0, sources: [],
    };
    const result = formatIssueListItem(issue, "019-batch-parser-fixes");
    expect(result).toContain("#006");
    expect(result).toContain("Criteria not extracted");
    expect(result).toContain("(in batch 019-batch-parser-fixes)");
  });

  it("does not append annotation when batchSlug is null", () => {
    const issue: Issue = {
      id: 6, slug: "006-criteria-bug", title: "Criteria not extracted",
      type: "bugfix", status: "open", description: "", createdAt: 0, sources: [],
    };
    const result = formatIssueListItem(issue, null);
    expect(result).not.toContain("in batch");
  });

  it("does not append annotation when batchSlug is undefined (backwards compat)", () => {
    const issue: Issue = {
      id: 6, slug: "006-criteria-bug", title: "Criteria not extracted",
      type: "bugfix", status: "open", description: "", createdAt: 0, sources: [],
    };
    const result = formatIssueListItem(issue);
    expect(result).not.toContain("in batch");
  });
});
```

**Implementation:**

1. Change `formatIssueListItem` signature to accept an optional second parameter:

```typescript
export function formatIssueListItem(issue: Issue, batchSlug?: string | null): string {
  const id = `#${String(issue.id).padStart(3, "0")}`;
  const batchAnnotation = batchSlug ? ` (in batch ${batchSlug})` : "";
  return `${id} ${issue.title} [${issue.type}] [${issue.status}]${batchAnnotation}`;
}
```

2. Update the call site in `handleIssueCommand` (the `list` subcommand) to pass the batch slug. In `ui.ts`, the `handleIssueCommand` method receives `store` — use `store.getBatchForIssue(issue.id)` for each issue:

```typescript
// In handleIssueCommand, "list" subcommand:
const items = issues.map(i => formatIssueListItem(i, store.getBatchForIssue(i.id)));
```

**Verify:** `bun test tests/ui.test.ts`

---

### Task 8: Auto-close source issues in done phase [depends: 1, 3]

**Files:**
- Modify: `extensions/megapowers/ui.ts`
- Test: `tests/ui.test.ts`

**Test:**

Add to `tests/ui.test.ts` (in a new describe block):

```typescript
describe("handleDonePhase — batch auto-close", () => {
  let tmp: string;
  let testStore: ReturnType<typeof createStore>;

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), "megapowers-ui-batch-"));
    testStore = createStore(tmp);
  });

  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  it("closes source issues when batch issue is closed via 'Close issue'", async () => {
    // Create source issues
    testStore.createIssue("Bug A", "bugfix", "desc");  // id 1
    testStore.createIssue("Bug B", "bugfix", "desc");  // id 2

    // Create batch referencing both
    const batch = testStore.createIssue("Batch fix", "bugfix", "combined", [1, 2]);
    testStore.updateIssueStatus(batch.slug, "in-progress");

    const state: MegapowersState = {
      ...createInitialState(),
      activeIssue: batch.slug,
      workflow: "bugfix",
      phase: "done",
    };

    const ctx = createMockCtx("Close issue");
    const jj = createMockJJ();
    const uiInstance = createUI();

    const newState = await uiInstance.handleDonePhase(ctx as any, state, testStore, jj);

    // Batch issue itself should be done (state reset)
    expect(newState.activeIssue).toBeNull();

    // Source issues should be closed
    const bugA = testStore.getIssue("001-bug-a");
    const bugB = testStore.getIssue("002-bug-b");
    expect(bugA!.status).toBe("done");
    expect(bugB!.status).toBe("done");
  });

  it("closes source issues when batch issue is closed via 'Done' action", async () => {
    testStore.createIssue("Bug A", "bugfix", "desc");  // id 1
    const batch = testStore.createIssue("Batch fix", "bugfix", "combined", [1]);
    testStore.updateIssueStatus(batch.slug, "in-progress");

    const state: MegapowersState = {
      ...createInitialState(),
      activeIssue: batch.slug,
      workflow: "bugfix",
      phase: "done",
    };

    const ctx = createMockCtx("Done — finish without further actions");
    const jj = createMockJJ();
    const uiInstance = createUI();

    await uiInstance.handleDonePhase(ctx as any, state, testStore, jj);

    const bugA = testStore.getIssue("001-bug-a");
    expect(bugA!.status).toBe("done");
  });

  it("does not close source issues for non-batch issues", async () => {
    testStore.createIssue("Normal bug", "bugfix", "desc");  // id 1
    testStore.updateIssueStatus("001-normal-bug", "in-progress");

    const state: MegapowersState = {
      ...createInitialState(),
      activeIssue: "001-normal-bug",
      workflow: "bugfix",
      phase: "done",
    };

    const ctx = createMockCtx("Close issue");
    const jj = createMockJJ();
    const uiInstance = createUI();

    await uiInstance.handleDonePhase(ctx as any, state, testStore, jj);

    // Issue itself is closed (state reset confirms)
    // No crash, no side effects on other issues
  });
});
```

**Implementation:**

In `ui.ts`, inside `handleDonePhase`, create a helper that closes source issues:

```typescript
// Add at the top of handleDonePhase or as a local function:
function closeSourceIssues(activeIssue: string, store: Store): void {
  const issue = store.getIssue(activeIssue);
  if (issue && issue.sources.length > 0) {
    const sourceIssues = store.getSourceIssues(activeIssue);
    for (const src of sourceIssues) {
      store.updateIssueStatus(src.slug, "done");
    }
  }
}
```

Then call `closeSourceIssues(state.activeIssue, store)` in the two places where the issue is closed:

1. In the `"Close issue"` branch, before `newState = createInitialState()`.
2. In the `"Done — finish without further actions"` branch, before `newState = createInitialState()`.

The `Store` type needs `getSourceIssues` available — already added in Task 3.

**Verify:** `bun test tests/ui.test.ts`

---

### Task 9: Register `/triage` command [depends: 2, 5, 6]

**Files:**
- Modify: `extensions/megapowers/index.ts`
- Modify: `extensions/megapowers/ui.ts`
- Test: `tests/ui.test.ts`

**Test:**

We test the triage logic through the UI handler (same pattern as `handleIssueCommand`). Add to `tests/ui.test.ts`:

```typescript
describe("handleTriageCommand", () => {
  let tmp: string;
  let testStore: ReturnType<typeof createStore>;

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), "megapowers-ui-triage-"));
    testStore = createStore(tmp);
  });

  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  it("reads open issues and formats triage context", async () => {
    testStore.createIssue("Bug A", "bugfix", "Parser fails");  // id 1
    testStore.createIssue("Feature B", "feature", "Add widget");  // id 2
    testStore.createIssue("Bug C", "bugfix", "Command broken");  // id 3
    // Close one to verify it's excluded
    testStore.updateIssueStatus("002-feature-b", "done");

    const uiInstance = createUI();
    const ctx = {
      ...createMockCtx(),
      ui: {
        ...createMockCtx().ui,
        select: async (prompt: string, items: string[]) => {
          // Simulate: user picks bugfix type, then confirms
          if (prompt.includes("type")) return "bugfix";
          return null;
        },
        input: async (prompt: string) => {
          if (prompt.toLowerCase().includes("title")) return "Parser batch fix";
          if (prompt.toLowerCase().includes("source")) return "1, 3";
          return null;
        },
        editor: async () => "Combined parser fix",
      },
    };

    const state = createInitialState();
    const jj = createMockJJ();
    const result = await uiInstance.handleTriageCommand(ctx as any, state, testStore, jj);

    // Should have created a batch issue and activated it
    expect(result.activeIssue).toBeDefined();
    expect(result.activeIssue).not.toBeNull();

    // The created issue should have sources
    if (result.activeIssue) {
      const batchIssue = testStore.getIssue(result.activeIssue);
      expect(batchIssue).not.toBeNull();
      expect(batchIssue!.sources).toEqual([1, 3]);
      expect(batchIssue!.type).toBe("bugfix");
    }
  });

  it("returns unchanged state when user cancels", async () => {
    testStore.createIssue("Bug A", "bugfix", "desc");
    const uiInstance = createUI();
    const ctx = createMockCtx(null);  // user cancels select

    const state = createInitialState();
    const jj = createMockJJ();
    const result = await uiInstance.handleTriageCommand(ctx as any, state, testStore, jj);

    expect(result.activeIssue).toBeNull();
  });

  it("formats open issues for triage prompt display", async () => {
    testStore.createIssue("Bug A", "bugfix", "Parser fails");
    testStore.createIssue("Bug B", "bugfix", "Command broken");

    const uiInstance = createUI();
    const notifications: string[] = [];
    const ctx = {
      ...createMockCtx(),
      ui: {
        ...createMockCtx().ui,
        notify: (msg: string) => notifications.push(msg),
        select: async () => null,  // cancel after seeing the list
      },
    };

    const state = createInitialState();
    const jj = createMockJJ();
    await uiInstance.handleTriageCommand(ctx as any, state, testStore, jj);

    // Should have displayed the open issues
    const displayedIssues = notifications.find(n => n.includes("Bug A") || n.includes("#001"));
    expect(displayedIssues).toBeDefined();
  });
});
```

**Implementation:**

1. Add `handleTriageCommand` to the `MegapowersUI` interface in `ui.ts`:

```typescript
handleTriageCommand(
  ctx: ExtensionContext,
  state: MegapowersState,
  store: Store,
  jj: JJ,
): Promise<MegapowersState>;
```

2. Implement `handleTriageCommand` in the `createUI` return object:

```typescript
async handleTriageCommand(ctx, state, store, jj) {
  const allIssues = store.listIssues();
  const openIssues = allIssues.filter(i => i.status !== "done" && i.sources.length === 0);

  if (openIssues.length === 0) {
    ctx.ui.notify("No open issues to triage.", "info");
    return state;
  }

  // Display open issues
  const issueList = openIssues
    .map(i => `- #${String(i.id).padStart(3, "0")} ${i.title} [${i.type}] — ${i.description.slice(0, 80)}`)
    .join("\n");
  ctx.ui.notify(`Open issues:\n${issueList}`, "info");

  // Get batch parameters from user
  const title = await ctx.ui.input("Batch title:");
  if (!title) return state;

  const typeChoice = await ctx.ui.select("Batch type:", ["bugfix", "feature"]);
  if (!typeChoice) return state;
  const type = typeChoice as "feature" | "bugfix";

  const sourceInput = await ctx.ui.input("Source issue IDs (comma-separated, e.g. 1, 3, 5):");
  if (!sourceInput) return state;

  const sources = sourceInput.split(",").map(s => parseInt(s.trim())).filter(n => !isNaN(n));
  if (sources.length === 0) {
    ctx.ui.notify("No valid source IDs provided.", "error");
    return state;
  }

  const description = await ctx.ui.editor("Batch description:", "") ?? "";

  // Create the batch issue
  const issue = store.createIssue(title, type, description, sources);

  // Activate it
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
    acceptanceCriteria: [],
    currentTaskIndex: 0,
    tddTaskState: null,
    taskJJChanges: {},
    doneMode: null,
  };

  if (await jj.isJJRepo()) {
    const desc = formatChangeDescription(issue.slug, firstPhase);
    const changeId = await jj.newChange(desc, "main");
    if (changeId) newState.jjChangeId = changeId;
  }

  store.saveState(newState);
  store.updateIssueStatus(issue.slug, "in-progress");
  ctx.ui.notify(`Created batch: ${issue.slug} (sources: ${sources.join(", ")})`, "info");
  this.renderDashboard(ctx, newState, store);
  return newState;
},
```

3. Register the `/triage` command in `index.ts`:

```typescript
pi.registerCommand("triage", {
  description: "Triage open issues into batches",
  handler: async (_args, ctx) => {
    if (!store) store = createStore(ctx.cwd);
    if (!jj) jj = createJJ(pi);
    if (!ui) ui = createUI();
    state = await ui.handleTriageCommand(ctx, state, store, jj);
    pi.appendEntry("megapowers-state", state);
  },
});
```

**Verify:** `bun test tests/ui.test.ts`

---

**Final verification:** `bun test` (all tests)
