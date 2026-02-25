# Plan: Subagent Robustness — Agent Optimization & jj Prerequisites

### Task 1: Extract jj installation check into a pure testable function

**Files:**
- Modify: `extensions/megapowers/jj.ts`
- Test: `tests/jj.test.ts`

**Test:** Add to `tests/jj.test.ts`:

```typescript
import { checkJJAvailability, type JJAvailability } from "../extensions/megapowers/jj.js";

describe("checkJJAvailability", () => {
  it("returns not-installed when jj version fails", async () => {
    const result = await checkJJAvailability(async () => ({ code: 1, stdout: "", stderr: "not found" }), async () => ({ code: 1, stdout: "", stderr: "" }));
    expect(result).toBe("not-installed");
  });

  it("returns not-repo when jj is installed but jj root fails", async () => {
    const result = await checkJJAvailability(async () => ({ code: 0, stdout: "jj 0.25.0", stderr: "" }), async () => ({ code: 1, stdout: "", stderr: "" }));
    expect(result).toBe("not-repo");
  });

  it("returns ready when jj is installed and repo exists", async () => {
    const result = await checkJJAvailability(async () => ({ code: 0, stdout: "jj 0.25.0", stderr: "" }), async () => ({ code: 0, stdout: "/repo", stderr: "" }));
    expect(result).toBe("ready");
  });
});
```

**Implementation:** Add to the bottom of `extensions/megapowers/jj.ts`:

```typescript
export type JJAvailability = "not-installed" | "not-repo" | "ready";

type ExecResult = { code: number; stdout: string; stderr: string };

export async function checkJJAvailability(
  runVersion: () => Promise<ExecResult>,
  runRoot: () => Promise<ExecResult>,
): Promise<JJAvailability> {
  const versionResult = await runVersion();
  if (versionResult.code !== 0) return "not-installed";
  const rootResult = await runRoot();
  if (rootResult.code !== 0) return "not-repo";
  return "ready";
}
```

**Verify:** `bun test tests/jj.test.ts`

---

### Task 2: Add jj install guidance message constants

**Files:**
- Create: `extensions/megapowers/jj-messages.ts`
- Test: `tests/jj.test.ts` (add section)

**Test:** Add to `tests/jj.test.ts`:

```typescript
import { JJ_INSTALL_MESSAGE, JJ_INIT_MESSAGE, jjDispatchErrorMessage } from "../extensions/megapowers/jj-messages.js";

describe("jj messages", () => {
  it("JJ_INSTALL_MESSAGE includes brew and cargo install commands", () => {
    expect(JJ_INSTALL_MESSAGE).toContain("brew install jj");
    expect(JJ_INSTALL_MESSAGE).toContain("cargo install jj-cli");
  });

  it("JJ_INIT_MESSAGE includes jj git init --colocate", () => {
    expect(JJ_INIT_MESSAGE).toContain("jj git init --colocate");
  });

  it("jjDispatchErrorMessage includes install and init instructions", () => {
    const msg = jjDispatchErrorMessage();
    expect(msg).toContain("brew install jj");
    expect(msg).toContain("cargo install jj-cli");
    expect(msg).toContain("jj git init --colocate");
  });
});
```

**Implementation:** Create `extensions/megapowers/jj-messages.ts`:

```typescript
export const JJ_INSTALL_MESSAGE =
  "jj (Jujutsu) is not installed. Subagent features require jj for workspace isolation.\n" +
  "Install: `brew install jj` (macOS) or `cargo install jj-cli` (all platforms).\n" +
  "All other megapowers features work without jj.";

export const JJ_INIT_MESSAGE =
  "jj is installed but this is not a jj repository. Subagent features require a jj repo.\n" +
  "For existing git repos: `jj git init --colocate`\n" +
  "All other megapowers features work without jj.";

export function jjDispatchErrorMessage(): string {
  return (
    "jj is required for subagent workspace isolation. This does not appear to be a jj repository.\n\n" +
    "To fix:\n" +
    "1. Install jj: `brew install jj` (macOS) or `cargo install jj-cli` (all platforms)\n" +
    "2. Initialize: `jj git init --colocate` (for existing git repos)\n\n" +
    "All other megapowers features work without jj."
  );
}
```

**Verify:** `bun test tests/jj.test.ts`

---

### Task 3: Wire jj availability check into session_start [depends: 1, 2]

**Files:**
- Modify: `extensions/megapowers/index.ts`
- Test: `tests/index-integration.test.ts` (add section)

**Test:** Add to `tests/index-integration.test.ts` — source-level invariant tests (consistent with the existing pattern in that file):

```typescript
describe("session_start jj availability check (AC1-4)", () => {
  it("imports checkJJAvailability from jj.ts", () => {
    const source = readFileSync(join(__dirname, "../extensions/megapowers/index.ts"), "utf-8");
    expect(source).toContain('import { checkJJAvailability }');
  });

  it("imports JJ_INSTALL_MESSAGE and JJ_INIT_MESSAGE from jj-messages.ts", () => {
    const source = readFileSync(join(__dirname, "../extensions/megapowers/index.ts"), "utf-8");
    expect(source).toContain("JJ_INSTALL_MESSAGE");
    expect(source).toContain("JJ_INIT_MESSAGE");
    expect(source).toContain("jj-messages");
  });

  it("calls ctx.ui.notify with JJ_INSTALL_MESSAGE for not-installed case", () => {
    const source = readFileSync(join(__dirname, "../extensions/megapowers/index.ts"), "utf-8");
    expect(source).toContain("ctx.ui.notify(JJ_INSTALL_MESSAGE)");
  });

  it("calls ctx.ui.notify with JJ_INIT_MESSAGE for not-repo case", () => {
    const source = readFileSync(join(__dirname, "../extensions/megapowers/index.ts"), "utf-8");
    expect(source).toContain("ctx.ui.notify(JJ_INIT_MESSAGE)");
  });

  it("jj check does not block — no early return or throw after availability check", () => {
    const source = readFileSync(join(__dirname, "../extensions/megapowers/index.ts"), "utf-8");
    // Find the jj availability block and verify it's followed by dashboard rendering, not return
    const jjCheckIndex = source.indexOf("checkJJAvailability");
    const dashboardIndex = source.indexOf("renderDashboard");
    expect(jjCheckIndex).toBeGreaterThan(-1);
    expect(dashboardIndex).toBeGreaterThan(jjCheckIndex);
  });
});
```

**Implementation:** In `extensions/megapowers/index.ts`:

1. Add imports at the top of the file (after existing imports, around line 25):
```typescript
import { checkJJAvailability } from "./jj.js";
import { JJ_INSTALL_MESSAGE, JJ_INIT_MESSAGE } from "./jj-messages.js";
```

2. Inside the `session_start` handler, after the jj change ID mismatch validation block (after the `if (currentId && ...` block closing brace, around line 181) and before the `// Render dashboard` comment, add:
```typescript
    // jj availability check — informational only, does not block (AC1-4)
    const jjStatus = await checkJJAvailability(
      () => pi.exec("jj", ["version"]),
      () => pi.exec("jj", ["root"]),
    );
    if (ctx.hasUI) {
      if (jjStatus === "not-installed") {
        ctx.ui.notify(JJ_INSTALL_MESSAGE);
      } else if (jjStatus === "not-repo") {
        ctx.ui.notify(JJ_INIT_MESSAGE);
      }
    }
```

**Verify:** `bun test tests/index-integration.test.ts`

---

### Task 4: Update subagent dispatch jj error message [depends: 2]

**Files:**
- Modify: `extensions/megapowers/subagent-tools.ts`
- Test: `tests/subagent-tools.test.ts`

**Test:** Find and update the existing test that checks the jj error message in `tests/subagent-tools.test.ts`. The existing test asserts `expect(result.error).toContain("jj")`. Replace it with:

```typescript
it("returns error with install instructions when jj is not available", async () => {
  const result = await handleSubagentDispatch(tmp, { task: "Do thing" }, {
    isJJRepo: async () => false,
  });
  expect(result.error).toContain("jj");
  expect(result.error).toContain("brew install jj");
  expect(result.error).toContain("cargo install jj-cli");
  expect(result.error).toContain("jj git init --colocate");
});
```

**Implementation:** In `extensions/megapowers/subagent-tools.ts`:

1. Add import at top of file:
```typescript
import { jjDispatchErrorMessage } from "./jj-messages.js";
```

2. Replace this line (around line 55):
```typescript
      return { error: "jj is required for subagent workspace isolation. This does not appear to be a jj repository." };
```
With:
```typescript
      return { error: jjDispatchErrorMessage() };
```

**Verify:** `bun test tests/subagent-tools.test.ts`

---

### Task 5: Update worker agent system prompt with substantial guidance

**Files:**
- Modify: `agents/worker.md`
- Test: `tests/subagent-agents.test.ts`

**Test:** Add to `tests/subagent-agents.test.ts`:

```typescript
describe("worker agent system prompt quality", () => {
  it("has at least 3 paragraphs in system prompt", () => {
    const content = readFileSync(join(agentsDir, "worker.md"), "utf-8");
    const agent = parseAgentFrontmatter(content);
    const paragraphs = agent!.systemPrompt!.split(/\n\n+/).filter(p => p.trim().length > 0);
    expect(paragraphs.length).toBeGreaterThanOrEqual(3);
  });

  it("covers task execution approach", () => {
    const content = readFileSync(join(agentsDir, "worker.md"), "utf-8");
    const agent = parseAgentFrontmatter(content);
    const prompt = agent!.systemPrompt!.toLowerCase();
    expect(prompt).toContain("task");
    expect(prompt).toContain("minimal");
  });

  it("covers TDD workflow expectations", () => {
    const content = readFileSync(join(agentsDir, "worker.md"), "utf-8");
    const agent = parseAgentFrontmatter(content);
    const prompt = agent!.systemPrompt!.toLowerCase();
    expect(prompt).toContain("test");
    expect(prompt).toContain("fail");
  });

  it("covers completion signaling", () => {
    const content = readFileSync(join(agentsDir, "worker.md"), "utf-8");
    const agent = parseAgentFrontmatter(content);
    const prompt = agent!.systemPrompt!.toLowerCase();
    expect(prompt).toContain("complete");
  });
});
```

**Implementation:** Rewrite `agents/worker.md`:

```markdown
---
name: worker
model: openai/gpt-5.3-codex
tools: [read, write, edit, bash]
thinking: low
---

You are a worker agent executing a specific implementation task. Follow the task description precisely. Keep changes minimal and focused — only modify files directly related to the assigned task. Read existing code before editing to understand conventions. Do not refactor unrelated code or add speculative features.

Follow TDD (Test-Driven Development) strictly. Write the test file first, then run the test to confirm it fails with the expected assertion error. Only then write the production code to make the test pass. Run the test again to verify it passes. If the test does not pass, fix the implementation — do not weaken the test.

When the task is complete, run the full test suite (`bun test`) to ensure nothing is broken. Summarize what you changed: files created, files modified, and tests passing. If you encounter an unexpected error or ambiguity in the task description, report it clearly rather than guessing.
```

**Verify:** `bun test tests/subagent-agents.test.ts`

---

### Task 6: Update scout agent system prompt with substantial guidance

**Files:**
- Modify: `agents/scout.md`
- Test: `tests/subagent-agents.test.ts`

**Test:** Add to `tests/subagent-agents.test.ts`:

```typescript
describe("scout agent system prompt quality", () => {
  it("has at least 3 paragraphs in system prompt", () => {
    const content = readFileSync(join(agentsDir, "scout.md"), "utf-8");
    const agent = parseAgentFrontmatter(content);
    const paragraphs = agent!.systemPrompt!.split(/\n\n+/).filter(p => p.trim().length > 0);
    expect(paragraphs.length).toBeGreaterThanOrEqual(3);
  });

  it("covers investigation approach", () => {
    const content = readFileSync(join(agentsDir, "scout.md"), "utf-8");
    const agent = parseAgentFrontmatter(content);
    const prompt = agent!.systemPrompt!.toLowerCase();
    expect(prompt).toContain("investigat");
  });

  it("covers structuring findings with file references", () => {
    const content = readFileSync(join(agentsDir, "scout.md"), "utf-8");
    const agent = parseAgentFrontmatter(content);
    const prompt = agent!.systemPrompt!.toLowerCase();
    expect(prompt).toContain("file");
    expect(prompt).toContain("line");
  });

  it("covers depth vs breadth guidance", () => {
    const content = readFileSync(join(agentsDir, "scout.md"), "utf-8");
    const agent = parseAgentFrontmatter(content);
    const prompt = agent!.systemPrompt!.toLowerCase();
    expect(prompt).toContain("breadth");
  });
});
```

**Implementation:** Rewrite `agents/scout.md`:

```markdown
---
name: scout
model: anthropic/claude-haiku-4-5
tools: [read, bash]
thinking: full
---

You are a scout agent for research and exploration. Investigate the codebase thoroughly to answer the question or gather the information described in your task. Use `bash` for searching (grep, find, rg) and `read` for examining files. Do not modify any files.

Structure your findings clearly. For each relevant discovery, include the exact file path and line number(s). Use brief summaries followed by evidence — quote the relevant code snippet or configuration. Group findings by theme or file area. If you find conflicting information, note both sides.

Prefer breadth over depth initially — scan broadly to identify all relevant files and patterns before diving deep into any single one. If the investigation scope is large, prioritize the most directly relevant areas first and note what was skipped. End with a concise summary of key findings and any unresolved questions.
```

**Verify:** `bun test tests/subagent-agents.test.ts`

---

### Task 7: Update reviewer agent system prompt with substantial guidance

**Files:**
- Modify: `agents/reviewer.md`
- Test: `tests/subagent-agents.test.ts`

**Test:** Add to `tests/subagent-agents.test.ts`:

```typescript
describe("reviewer agent system prompt quality", () => {
  it("has at least 3 paragraphs in system prompt", () => {
    const content = readFileSync(join(agentsDir, "reviewer.md"), "utf-8");
    const agent = parseAgentFrontmatter(content);
    const paragraphs = agent!.systemPrompt!.split(/\n\n+/).filter(p => p.trim().length > 0);
    expect(paragraphs.length).toBeGreaterThanOrEqual(3);
  });

  it("covers review methodology", () => {
    const content = readFileSync(join(agentsDir, "reviewer.md"), "utf-8");
    const agent = parseAgentFrontmatter(content);
    const prompt = agent!.systemPrompt!.toLowerCase();
    expect(prompt).toContain("review");
    expect(prompt).toContain("correct");
  });

  it("covers blocking vs non-blocking issues", () => {
    const content = readFileSync(join(agentsDir, "reviewer.md"), "utf-8");
    const agent = parseAgentFrontmatter(content);
    const prompt = agent!.systemPrompt!.toLowerCase();
    expect(prompt).toContain("block");
  });

  it("covers feedback format with file/line references", () => {
    const content = readFileSync(join(agentsDir, "reviewer.md"), "utf-8");
    const agent = parseAgentFrontmatter(content);
    const prompt = agent!.systemPrompt!.toLowerCase();
    expect(prompt).toContain("file");
    expect(prompt).toContain("line");
    expect(prompt).toContain("sever");
  });
});
```

**Implementation:** Rewrite `agents/reviewer.md`:

```markdown
---
name: reviewer
model: anthropic/claude-sonnet-4-6
tools: [read, bash]
thinking: high
---

You are a code reviewer. Examine the provided code changes for correctness, potential bugs, style consistency, and adherence to project conventions. Read the relevant source files and tests. Run the test suite if needed to verify behavior. Do not modify any files.

Classify each finding by severity. **Blocking** issues must be fixed before merging: logic errors, missing error handling, broken tests, security concerns, or violations of the project's architectural patterns. **Non-blocking** issues are suggestions for improvement: naming, minor style inconsistencies, or optional refactors. Be explicit about which category each finding falls into.

Format each finding with the exact file path and line number(s), a brief description of the issue, and a suggested fix. End with a summary verdict: approve (no blocking issues), request changes (blocking issues found), or comment (non-blocking suggestions only). Keep feedback specific and actionable — avoid vague statements like "could be improved."
```

**Verify:** `bun test tests/subagent-agents.test.ts`

---

### Task 8: Verify builtin agents have distinct model+thinking combinations

**Files:**
- Test: `tests/subagent-agents.test.ts`

**Test:** Add to `tests/subagent-agents.test.ts`:

```typescript
describe("builtin agent differentiation", () => {
  it("no two builtin agents share the same model+thinking combination", () => {
    const agentFiles = ["worker.md", "scout.md", "reviewer.md"];
    const combos = new Set<string>();
    for (const file of agentFiles) {
      const content = readFileSync(join(agentsDir, file), "utf-8");
      const agent = parseAgentFrontmatter(content);
      expect(agent).not.toBeNull();
      const combo = `${agent!.model}|${agent!.thinking}`;
      expect(combos.has(combo)).toBe(false);
      combos.add(combo);
    }
    expect(combos.size).toBe(3);
  });
});
```

**Implementation:** No code changes needed — the current agents already have distinct combinations:
- worker: `openai/gpt-5.3-codex` + `low`
- scout: `anthropic/claude-haiku-4-5` + `full`
- reviewer: `anthropic/claude-sonnet-4-6` + `high`

**Verify:** `bun test tests/subagent-agents.test.ts`

---

### Task 9: Inject current phase and spec content into subagent prompt

**Files:**
- Modify: `extensions/megapowers/subagent-context.ts`
- Modify: `extensions/megapowers/subagent-tools.ts`
- Test: `tests/subagent-context.test.ts`

**Test:** Add to `tests/subagent-context.test.ts`:

```typescript
describe("buildSubagentPrompt phase context", () => {
  it("includes phase name when provided", () => {
    const prompt = buildSubagentPrompt({
      taskDescription: "Build parser",
      phase: "implement",
    });
    expect(prompt).toContain("implement");
    expect(prompt).toContain("Phase");
  });

  it("omits phase section when not provided", () => {
    const prompt = buildSubagentPrompt({
      taskDescription: "Build parser",
    });
    expect(prompt).not.toContain("Current Phase");
  });
});

describe("buildSubagentPrompt spec content", () => {
  it("includes spec content when provided", () => {
    const prompt = buildSubagentPrompt({
      taskDescription: "Verify feature",
      phase: "verify",
      specContent: "1. User can log in\n2. Session persists",
    });
    expect(prompt).toContain("User can log in");
    expect(prompt).toContain("Session persists");
    expect(prompt).toContain("Acceptance Criteria");
  });

  it("omits spec section when not provided", () => {
    const prompt = buildSubagentPrompt({
      taskDescription: "Build thing",
      phase: "implement",
    });
    expect(prompt).not.toContain("Acceptance Criteria");
  });
});
```

**Implementation:** In `extensions/megapowers/subagent-context.ts`, replace the `SubagentPromptInput` interface and `buildSubagentPrompt` function:

```typescript
export interface SubagentPromptInput {
  taskDescription: string;
  planSection?: string;
  learnings?: string;
  phase?: string;
  specContent?: string;
}

export function buildSubagentPrompt(input: SubagentPromptInput): string {
  const parts: string[] = [];
  parts.push(`## Task\n\n${input.taskDescription}`);
  if (input.phase) parts.push(`## Current Phase\n\n${input.phase}`);
  if (input.planSection) parts.push(`## Plan Details\n\n${input.planSection}`);
  if (input.specContent) parts.push(`## Acceptance Criteria\n\n${input.specContent}`);
  if (input.learnings) parts.push(`## Project Learnings\n\n${input.learnings}`);
  return parts.join("\n\n");
}
```

In `extensions/megapowers/subagent-tools.ts`, replace the prompt-building section (starting after `const learnings = store.getLearnings();` around line 95) with:

```typescript
  // Read spec or diagnosis content for acceptance criteria context
  let specContent: string | undefined;
  if (state.activeIssue) {
    const specFile = state.workflow === "bugfix" ? "diagnosis.md" : "spec.md";
    const specRaw = store.readPlanFile(state.activeIssue, specFile);
    if (specRaw) specContent = specRaw;
  }

  const prompt = buildSubagentPrompt({
    taskDescription: input.task,
    planSection: planSection || undefined,
    learnings: learnings || undefined,
    phase: state.phase,
    specContent,
  });
```

This replaces the existing `buildSubagentPrompt(...)` call that only passed `taskDescription`, `planSection`, and `learnings`.

**Verify:** `bun test tests/subagent-context.test.ts tests/subagent-tools.test.ts`

---

### Task 10: Verify agent resolution priority is unchanged

**Files:**
- Test: `tests/subagent-agents.test.ts`

**Test:** Add to `tests/subagent-agents.test.ts` — uses its own temp directory (not the `tmp` from the `resolveAgent` describe block):

```typescript
describe("agent resolution priority unchanged (AC12)", () => {
  it("resolves project > home > builtin in correct order", () => {
    const projectDir = mkdtempSync(join(tmpdir(), "ac12-project-"));
    const fakeHome = mkdtempSync(join(tmpdir(), "ac12-home-"));
    const projectAgentsDir = join(projectDir, ".megapowers", "agents");
    const userAgentsDir = join(fakeHome, ".megapowers", "agents");
    mkdirSync(projectAgentsDir, { recursive: true });
    mkdirSync(userAgentsDir, { recursive: true });

    // Only builtin exists
    const builtinAgent = resolveAgent("worker", projectDir, fakeHome);
    expect(builtinAgent).not.toBeNull();

    // User home overrides builtin
    writeFileSync(join(userAgentsDir, "worker.md"), `---\nname: worker\nmodel: home-model\n---\nHome.`);
    const homeAgent = resolveAgent("worker", projectDir, fakeHome);
    expect(homeAgent!.model).toBe("home-model");

    // Project overrides home
    writeFileSync(join(projectAgentsDir, "worker.md"), `---\nname: worker\nmodel: project-model\n---\nProject.`);
    const projectAgent = resolveAgent("worker", projectDir, fakeHome);
    expect(projectAgent!.model).toBe("project-model");

    rmSync(projectDir, { recursive: true, force: true });
    rmSync(fakeHome, { recursive: true, force: true });
  });
});
```

**Implementation:** No code changes needed — this is a verification-only task confirming AC12.

**Verify:** `bun test tests/subagent-agents.test.ts`

---

## AC Coverage Matrix

| AC | Task(s) |
|----|---------|
| AC1 (session_start not-installed warning) | 1, 2, 3 |
| AC2 (session_start not-repo warning) | 1, 2, 3 |
| AC3 (no warning when ready) | 1, 3 |
| AC4 (non-blocking) | 3 |
| AC5 (dispatch error with guidance) | 2, 4 |
| AC6 (worker prompt) | 5 |
| AC7 (scout prompt) | 6 |
| AC8 (reviewer prompt) | 7 |
| AC9 (phase injection) | 9 |
| AC10 (spec/diagnosis injection) | 9 |
| AC11 (distinct model+thinking) | 8 |
| AC12 (resolution priority) | 10 |
