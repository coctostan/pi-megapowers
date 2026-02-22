# Cross-Cutting Concerns Implementation Plan

> **REQUIRED SUB-SKILL:** Use the executing-plans skill to implement this plan task-by-task.

**Goal:** Add project learnings persistence, living documentation generation, and roadmap awareness — all feeding into brainstorm/plan prompts and done-phase wrap-up actions.

**Architecture:** Three interlocking features share a single injection point (`before_agent_start`) and a single wrap-up point (done phase). Learnings and roadmap are injected only into brainstorm and plan phase prompts. Done-phase LLM actions are driven by a new `doneMode` field in state that tells `before_agent_start` which prompt to inject and tells `agent_end` what artifact to save.

**Tech Stack:** TypeScript, Bun test, existing pi extension API (`Store`, `MegapowersState`, `ExtensionContext`)

---

## Background: How Done-Phase LLM Actions Work

The extension can't start agent turns directly. The user triggers them. The `doneMode` field bridges the menu and the LLM:

1. User selects "Generate feature doc" in the Done phase menu → `doneMode = "generate-docs"` saved to state, user notified to send any message.
2. User sends a message → `before_agent_start` sees `phase = "done"` + `doneMode = "generate-docs"` → injects `generate-docs.md` with artifact context.
3. LLM generates the doc → `agent_end` sees `doneMode = "generate-docs"` → saves to `.megapowers/docs/{slug}.md`, clears `doneMode`.
4. Done menu shown again for next action.

---

### Task 1: Extend `store.ts` with learnings attribution, roadmap reading, and done-phase artifact storage

**TDD scenario:** New feature — full TDD cycle

**Files:**
- Modify: `extensions/megapowers/store.ts`
- Test: `tests/store.test.ts`

**What this adds to `Store` interface:**
```typescript
appendLearnings(issueSlug: string, entries: string[]): void;
readRoadmap(): string;
writeFeatureDoc(issueSlug: string, content: string): void;
appendChangelog(entry: string): void;
```

`appendLearnings` writes a dated, slug-attributed block to `.megapowers/learnings.md` (flat file, not in a `learnings/` subdir — the design doc uses `.megapowers/learnings.md`). The existing `appendLearning` (singular) can remain for the `/learn` command's simple bullet appending.

**Step 1: Write the failing tests**

Add to `tests/store.test.ts`:

```typescript
describe("appendLearnings — attributed entries", () => {
  it("appends a dated block attributed to the issue slug", () => {
    store.appendLearnings("001-auth", ["Token service needs DI mocking", "Use fake clock for timer tests"]);
    const content = store.getLearnings();
    expect(content).toContain("001-auth");
    expect(content).toContain("Token service needs DI mocking");
    expect(content).toContain("Use fake clock for timer tests");
  });

  it("appends multiple blocks independently", () => {
    store.appendLearnings("001-auth", ["First learning"]);
    store.appendLearnings("002-retry", ["Second learning"]);
    const content = store.getLearnings();
    expect(content).toContain("001-auth");
    expect(content).toContain("002-retry");
    expect(content).toContain("First learning");
    expect(content).toContain("Second learning");
  });

  it("writes nothing when entries array is empty", () => {
    store.appendLearnings("001-auth", []);
    expect(store.getLearnings()).toBe("");
  });
});

describe("readRoadmap", () => {
  it("returns empty string when ROADMAP.md does not exist", () => {
    expect(store.readRoadmap()).toBe("");
  });

  it("returns roadmap content when ROADMAP.md exists in project root", () => {
    const { writeFileSync } = require("node:fs");
    writeFileSync(join(tmp, "ROADMAP.md"), "# Roadmap\n\n- Phase 1: Auth\n- Phase 2: API\n");
    expect(store.readRoadmap()).toContain("Phase 1: Auth");
  });
});

describe("writeFeatureDoc", () => {
  it("writes doc to .megapowers/docs/{slug}.md", () => {
    store.writeFeatureDoc("001-auth", "# Feature: Auth\n\nBuilt JWT auth.");
    const { readFileSync, existsSync } = require("node:fs");
    const docPath = join(tmp, ".megapowers", "docs", "001-auth.md");
    expect(existsSync(docPath)).toBe(true);
    expect(readFileSync(docPath, "utf-8")).toContain("Built JWT auth.");
  });

  it("creates the docs directory if it does not exist", () => {
    expect(() => store.writeFeatureDoc("001-auth", "content")).not.toThrow();
  });
});

describe("appendChangelog", () => {
  it("creates CHANGELOG.md and appends an entry", () => {
    store.appendChangelog("## v1.1.0\n\n- Added JWT auth");
    const { readFileSync } = require("node:fs");
    const changelogPath = join(tmp, ".megapowers", "CHANGELOG.md");
    const content = readFileSync(changelogPath, "utf-8");
    expect(content).toContain("Added JWT auth");
  });

  it("appends to existing CHANGELOG.md without overwriting", () => {
    store.appendChangelog("Entry 1");
    store.appendChangelog("Entry 2");
    const { readFileSync } = require("node:fs");
    const content = readFileSync(join(tmp, ".megapowers", "CHANGELOG.md"), "utf-8");
    expect(content).toContain("Entry 1");
    expect(content).toContain("Entry 2");
  });
});
```

**Step 2: Run tests to verify they fail**

```bash
cd /Users/maxwellnewman/pi/workspace/pi-megapowers
bun test tests/store.test.ts 2>&1 | tail -20
```

Expected: FAIL — `appendLearnings is not a function` (and similar for other missing methods)

**Step 3: Implement in `store.ts`**

Add to the `Store` interface (after `appendLearning`):
```typescript
appendLearnings(issueSlug: string, entries: string[]): void;
readRoadmap(): string;
writeFeatureDoc(issueSlug: string, content: string): void;
appendChangelog(entry: string): void;
```

Add new directory vars inside `createStore` (after `learningsFile`):
```typescript
const learningsFlatFile = join(root, "learnings.md");
const docsDir = join(root, "docs");
const changelogFile = join(root, "CHANGELOG.md");
```

Add method implementations to the returned object:
```typescript
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
```

Also update `getLearnings()` to also read `learningsFlatFile` when it exists (the flat file for attributed learnings), in addition to the old `learningsFile` path. Or — simpler — since both the old `/learn` command bullets and new `appendLearnings` blocks are going into different files, update `getLearnings()` to merge both:

```typescript
getLearnings(): string {
  const parts: string[] = [];
  // Old per-bullet learnings file (used by /learn command)
  if (existsSync(learningsFile)) {
    const old = readFileSync(learningsFile, "utf-8").trim();
    if (old) parts.push(old);
  }
  // New attributed learnings flat file (used by done-phase capture)
  if (existsSync(learningsFlatFile)) {
    const attributed = readFileSync(learningsFlatFile, "utf-8").trim();
    if (attributed) parts.push(attributed);
  }
  return parts.join("\n\n").trim();
},
```

**Step 4: Run tests to verify they pass**

```bash
bun test tests/store.test.ts 2>&1 | tail -20
```

Expected: all store tests PASS

**Step 5: Run full test suite to check for regressions**

```bash
bun test 2>&1 | tail -10
```

Expected: all tests pass

**Step 6: Commit**

```bash
git add extensions/megapowers/store.ts tests/store.test.ts
git commit -m "feat(store): add appendLearnings, readRoadmap, writeFeatureDoc, appendChangelog"
```

---

### Task 2: Add `doneMode` to `MegapowersState`

**TDD scenario:** Modifying tested code — run existing tests first

**Files:**
- Modify: `extensions/megapowers/state-machine.ts`
- Test: `tests/state-machine.test.ts`

**Step 1: Run existing tests to establish baseline**

```bash
bun test tests/state-machine.test.ts 2>&1 | tail -10
```

Expected: all pass

**Step 2: Write the failing test**

Add to `tests/state-machine.test.ts`:

```typescript
describe("doneMode field", () => {
  it("initializes to null", () => {
    const state = createInitialState();
    expect(state.doneMode).toBeNull();
  });

  it("is included in the state type (TypeScript compile check via assignment)", () => {
    const state = createInitialState();
    const copy: MegapowersState = { ...state, doneMode: "generate-docs" };
    expect(copy.doneMode).toBe("generate-docs");
  });

  it("transition to non-done phase resets doneMode to null", () => {
    const state: MegapowersState = {
      ...createInitialState(),
      activeIssue: "001-test",
      workflow: "feature",
      phase: "code-review",
      doneMode: "generate-docs",
    };
    const next = transition(state, "done");
    expect(next.doneMode).toBeNull();
  });
});
```

**Step 3: Run test to verify it fails**

```bash
bun test tests/state-machine.test.ts --test-name-pattern "doneMode" 2>&1 | tail -15
```

Expected: FAIL — `state.doneMode` is `undefined`

**Step 4: Implement in `state-machine.ts`**

Add to `MegapowersState` interface (after `taskJJChanges`):
```typescript
doneMode: "generate-docs" | "capture-learnings" | "write-changelog" | null;
```

Add to `createInitialState()` (after `taskJJChanges: {}`):
```typescript
doneMode: null,
```

Add to `transition()` function, at the end of the `next` construction (add a reset for `doneMode`):
```typescript
// Reset doneMode on every phase transition (entering a new phase clears any pending done action)
next.doneMode = null;
```

Also update `store.ts` `loadState()` migration block — add `doneMode` to the merge defaults so it survives missing the field in old state files. The `{ ...createInitialState(), ...raw }` merge already handles this since `createInitialState()` now includes `doneMode: null`. No extra code needed.

**Step 5: Run test to verify it passes**

```bash
bun test tests/state-machine.test.ts 2>&1 | tail -10
```

Expected: all pass

**Step 6: Commit**

```bash
git add extensions/megapowers/state-machine.ts tests/state-machine.test.ts
git commit -m "feat(state): add doneMode field to MegapowersState"
```

---

### Task 3: Update prompt templates — add context sections and new templates

**TDD scenario:** Trivial change — these are `.md` files. Verified by running `bun test tests/prompts.test.ts` after adding test coverage for the new variables.

**Files:**
- Modify: `prompts/brainstorm.md`
- Modify: `prompts/write-plan.md`
- Modify: `prompts/generate-docs.md`
- Create: `prompts/capture-learnings.md`
- Create: `prompts/write-changelog.md`
- Test: `tests/prompts.test.ts`

**Step 1: Write the failing tests**

Add to `tests/prompts.test.ts`:

```typescript
describe("prompt templates — learnings and roadmap variables", () => {
  it("brainstorm template contains {{learnings}} placeholder", () => {
    const template = getPhasePromptTemplate("brainstorm");
    expect(template).toContain("{{learnings}}");
  });

  it("brainstorm template contains {{roadmap}} placeholder", () => {
    const template = getPhasePromptTemplate("brainstorm");
    expect(template).toContain("{{roadmap}}");
  });

  it("plan (write-plan) template contains {{learnings}} placeholder", () => {
    const template = getPhasePromptTemplate("plan");
    expect(template).toContain("{{learnings}}");
  });

  it("plan (write-plan) template contains {{roadmap}} placeholder", () => {
    const template = getPhasePromptTemplate("plan");
    expect(template).toContain("{{roadmap}}");
  });
});

describe("prompt templates — generate-docs artifacts", () => {
  it("generate-docs template contains {{files_changed}} placeholder", () => {
    const template = getPhasePromptTemplate("done");
    expect(template).toContain("{{files_changed}}");
  });

  it("generate-docs template contains {{learnings}} placeholder", () => {
    const template = getPhasePromptTemplate("done");
    expect(template).toContain("{{learnings}}");
  });
});

describe("prompt templates — capture-learnings and write-changelog", () => {
  it("capture-learnings.md is loadable and non-empty", () => {
    // Load directly since it's not tied to a phase
    const { readFileSync } = require("node:fs");
    const { join, dirname } = require("node:path");
    const { fileURLToPath } = require("node:url");
    const thisDir = dirname(fileURLToPath(import.meta.url));
    const promptsDir = join(thisDir, "..", "prompts");
    const content = readFileSync(join(promptsDir, "capture-learnings.md"), "utf-8");
    expect(content.length).toBeGreaterThan(50);
    expect(content).toContain("{{spec_content}}");
  });

  it("write-changelog.md is loadable and non-empty", () => {
    const { readFileSync } = require("node:fs");
    const { join, dirname } = require("node:path");
    const { fileURLToPath } = require("node:url");
    const thisDir = dirname(fileURLToPath(import.meta.url));
    const promptsDir = join(thisDir, "..", "prompts");
    const content = readFileSync(join(promptsDir, "write-changelog.md"), "utf-8");
    expect(content.length).toBeGreaterThan(50);
    expect(content).toContain("{{spec_content}}");
  });
});
```

**Step 2: Run tests to verify they fail**

```bash
bun test tests/prompts.test.ts --test-name-pattern "learnings|roadmap|generate-docs|capture-learnings|write-changelog" 2>&1 | tail -20
```

Expected: FAIL

**Step 3: Update `prompts/brainstorm.md`**

Append this block at the end of the file (before the final instruction):

```markdown
## Project Learnings
{{learnings}}

## Roadmap Context
{{roadmap}}
```

If `{{learnings}}` or `{{roadmap}}` are empty strings (no file exists or empty), the section header will still appear but with no content — that's fine.

**Step 4: Update `prompts/write-plan.md`**

Append at the end of the file:

```markdown
## Project Learnings
{{learnings}}

## Roadmap Context
{{roadmap}}
```

**Step 5: Update `prompts/generate-docs.md`**

Replace the entire file with:

```markdown
You are generating a feature document for a completed issue. Produce a structured, durable document from the artifacts below.

## Context
Issue: {{issue_slug}}

## Spec
{{spec_content}}

## Plan
{{plan_content}}

## Verification Results
{{verify_content}}

## Files Changed
{{files_changed}}

## Learnings Captured
{{learnings}}

## Output Format

Write the feature document in this exact structure:

```markdown
# Feature: [issue title from spec]

## Summary
Brief description (2–3 sentences) of what was built and why.

## Design Decisions
Key architectural choices, trade-offs, alternatives rejected.

## API / Interface
Public API, CLI commands, configuration keys, or UI changes added or modified.

## Testing
Testing approach, notable test cases, coverage notes.

## Files Changed
List of files added or modified with one-line descriptions.
```

Save the document to `.megapowers/docs/{{issue_slug}}.md`.
```

**Step 6: Create `prompts/capture-learnings.md`**

```markdown
You are capturing learnings from a completed issue. Review what happened during implementation and extract concise, reusable insights for future issues.

## Context
Issue: {{issue_slug}}

## Spec
{{spec_content}}

## Plan
{{plan_content}}

## Verification Results
{{verify_content}}

## Instructions

Reflect on this issue and propose 2–5 learning entries. Each entry should be:
- **Specific** — not "testing is important" but "bun test requires `.js` extension in imports"
- **Actionable** — something a developer can act on next time
- **Concise** — one sentence per entry

Format your response as a markdown list. The user will review and approve before anything is saved.

## Example entries
- Rate limiter tests need a fake clock — real timers cause flaky failures
- The token service requires mocking via dependency injection, not module stubbing
- `bun test` runs all `.test.ts` files in the project root `tests/` dir by default
```

**Step 7: Create `prompts/write-changelog.md`**

```markdown
You are writing a changelog entry for a completed feature. The entry should be user-facing — describe what changed and why it matters, not implementation details.

## Context
Issue: {{issue_slug}}

## Spec
{{spec_content}}

## Verification Results
{{verify_content}}

## Instructions

Write a concise changelog entry suitable for a project CHANGELOG.md. Format:

```markdown
## [date] — [feature title]

- [User-facing change 1]
- [User-facing change 2]
- [Breaking changes, if any, clearly marked]
```

Keep it to 3–5 bullets. Focus on what users or developers consuming this project will observe, not on internal implementation choices.
```

**Step 8: Run tests to verify they pass**

```bash
bun test tests/prompts.test.ts 2>&1 | tail -15
```

Expected: all pass

**Step 9: Commit**

```bash
git add prompts/brainstorm.md prompts/write-plan.md prompts/generate-docs.md \
        prompts/capture-learnings.md prompts/write-changelog.md \
        tests/prompts.test.ts
git commit -m "feat(prompts): add learnings/roadmap injection vars, restructure generate-docs, add capture-learnings and write-changelog"
```

---

### Task 4: Update `prompts.ts` — expose helpers for doneMode prompt selection and learnings/roadmap loading

**TDD scenario:** New feature — full TDD cycle

**Files:**
- Modify: `extensions/megapowers/prompts.ts`
- Test: `tests/prompts.test.ts`

**What this adds:**
1. `loadPromptFile(filename)` — loads any named prompt from the `prompts/` directory (reuses internal logic, now exported for doneMode use)
2. `BRAINSTORM_PLAN_PHASES` — constant for phases that get learnings/roadmap injection (used by `index.ts`)

**Step 1: Write the failing tests**

Add to `tests/prompts.test.ts`:

```typescript
import {
  // existing imports...
  loadPromptFile,
  BRAINSTORM_PLAN_PHASES,
} from "../extensions/megapowers/prompts.js";

describe("loadPromptFile", () => {
  it("loads capture-learnings.md by filename", () => {
    const content = loadPromptFile("capture-learnings.md");
    expect(content.length).toBeGreaterThan(0);
    expect(content).toContain("{{spec_content}}");
  });

  it("loads write-changelog.md by filename", () => {
    const content = loadPromptFile("write-changelog.md");
    expect(content.length).toBeGreaterThan(0);
  });

  it("returns empty string for non-existent file", () => {
    expect(loadPromptFile("nonexistent.md")).toBe("");
  });
});

describe("BRAINSTORM_PLAN_PHASES", () => {
  it("includes brainstorm and plan", () => {
    expect(BRAINSTORM_PLAN_PHASES).toContain("brainstorm");
    expect(BRAINSTORM_PLAN_PHASES).toContain("plan");
  });

  it("does not include implement, verify, or done", () => {
    expect(BRAINSTORM_PLAN_PHASES).not.toContain("implement");
    expect(BRAINSTORM_PLAN_PHASES).not.toContain("verify");
    expect(BRAINSTORM_PLAN_PHASES).not.toContain("done");
  });
});
```

**Step 2: Run test to verify it fails**

```bash
bun test tests/prompts.test.ts --test-name-pattern "loadPromptFile|BRAINSTORM_PLAN_PHASES" 2>&1 | tail -15
```

Expected: FAIL — `loadPromptFile is not exported`

**Step 3: Implement in `prompts.ts`**

The internal `readFileSync` call in `getPhasePromptTemplate` already reads from `getPromptsDir()`. Extract it:

Add after `getPromptsDir()`:

```typescript
export function loadPromptFile(filename: string): string {
  try {
    return readFileSync(join(getPromptsDir(), filename), "utf-8");
  } catch {
    return "";
  }
}
```

Update `getPhasePromptTemplate` to use it:

```typescript
export function getPhasePromptTemplate(phase: Phase): string {
  const filename = PHASE_PROMPT_MAP[phase];
  if (!filename) return "";
  return loadPromptFile(filename);
}
```

Add the constant:

```typescript
export const BRAINSTORM_PLAN_PHASES: Phase[] = ["brainstorm", "plan"];
```

**Step 4: Run tests to verify they pass**

```bash
bun test tests/prompts.test.ts 2>&1 | tail -10
```

Expected: all pass

**Step 5: Run full suite**

```bash
bun test 2>&1 | tail -10
```

Expected: all pass

**Step 6: Commit**

```bash
git add extensions/megapowers/prompts.ts tests/prompts.test.ts
git commit -m "feat(prompts): export loadPromptFile and BRAINSTORM_PLAN_PHASES"
```

---

### Task 5: Update `index.ts` — restrict learnings/roadmap to brainstorm+plan, wire doneMode prompt and artifact capture

**TDD scenario:** Modifying tested code — `index.ts` is integration logic, not unit-tested directly. Verify via manual inspection and full `bun test` at end.

**Files:**
- Modify: `extensions/megapowers/index.ts`

This task has three changes in `before_agent_start` and two in `agent_end`.

**Step 1: Update imports at the top of `index.ts`**

Add `loadPromptFile` and `BRAINSTORM_PLAN_PHASES` to the prompts import:

```typescript
import { buildPhasePrompt, buildImplementTaskVars, formatAcceptanceCriteriaList, loadPromptFile, BRAINSTORM_PLAN_PHASES } from "./prompts.js";
```

**Step 2: Replace learnings injection in `before_agent_start`**

Find this block (current code at the end of `before_agent_start`):

```typescript
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
```

Replace with:

```typescript
// --- Learnings + Roadmap: brainstorm and plan phases only ---
if (BRAINSTORM_PLAN_PHASES.includes(state.phase)) {
  vars.learnings = store?.getLearnings() ?? "";
  vars.roadmap = store?.readRoadmap() ?? "";
} else {
  vars.learnings = "";
  vars.roadmap = "";
}

// --- Done phase: select prompt based on doneMode ---
let promptTemplate = prompt; // default: phase prompt from PHASE_PROMPT_MAP

if (state.phase === "done" && state.doneMode && store) {
  const doneModeTemplateMap: Record<string, string> = {
    "generate-docs": "generate-docs.md",
    "capture-learnings": "capture-learnings.md",
    "write-changelog": "write-changelog.md",
  };
  const filename = doneModeTemplateMap[state.doneMode];
  if (filename) {
    const modeTemplate = loadPromptFile(filename);
    if (modeTemplate) promptTemplate = modeTemplate;
    // Inject files_changed via jj diff if available
    if (state.jjChangeId && await jj.isJJRepo()) {
      try {
        vars.files_changed = await jj.diff(state.jjChangeId);
      } catch {
        vars.files_changed = "(jj diff unavailable)";
      }
    } else {
      vars.files_changed = "(no jj change tracked)";
    }
    // Inject learnings for done-phase prompts that use them
    vars.learnings = store.getLearnings();
  }
}

const finalPrompt = promptTemplate
  ? interpolatePrompt(promptTemplate, vars)
  : "";
if (!finalPrompt) return;

return {
  message: {
    customType: "megapowers-context",
    content: finalPrompt,
    display: false,
  },
};
```

Also add `interpolatePrompt` to the prompts import (it's already exported from `prompts.ts`):

```typescript
import { buildPhasePrompt, buildImplementTaskVars, formatAcceptanceCriteriaList, loadPromptFile, BRAINSTORM_PLAN_PHASES, interpolatePrompt } from "./prompts.js";
```

**Important:** The existing `buildPhasePrompt` call at the top of `before_agent_start` already calls `interpolatePrompt` internally. Now we're building vars first and calling `interpolatePrompt(promptTemplate, vars)` directly at the end. Remove the `buildPhasePrompt` call and replace with just loading the template:

The full revised `before_agent_start` body becomes:

```typescript
pi.on("before_agent_start", async (_event, _ctx) => {
  if (!state.activeIssue || !state.phase) return;

  const vars: Record<string, string> = {
    issue_slug: state.activeIssue,
    phase: state.phase,
  };

  // Load all artifacts for prompt context
  if (store) {
    const artifactMap: Record<string, string> = {
      "brainstorm.md": "brainstorm_content",
      "spec.md": "spec_content",
      "plan.md": "plan_content",
      "diagnosis.md": "diagnosis_content",
      "verify.md": "verify_content",
      "code-review.md": "code_review_content",
    };
    for (const [file, varName] of Object.entries(artifactMap)) {
      const content = store.readPlanFile(state.activeIssue, file);
      if (content) vars[varName] = content;
    }
  }

  // Acceptance criteria formatting
  if (state.acceptanceCriteria.length > 0) {
    vars.acceptance_criteria_list = formatAcceptanceCriteriaList(state.acceptanceCriteria);
  }

  // Implement phase: inject per-task context
  if (state.phase === "implement" && state.planTasks.length > 0) {
    Object.assign(vars, buildImplementTaskVars(state.planTasks, state.currentTaskIndex));
  }

  // Create per-task jj change if needed
  if (state.phase === "implement" && state.planTasks.length > 0 && await jj.isJJRepo()) {
    if (shouldCreateTaskChange(state)) {
      const task = state.planTasks[state.currentTaskIndex];
      const result = await createTaskChange(
        jj,
        state.activeIssue!,
        task.index,
        task.description,
        state.jjChangeId ?? undefined
      );
      if (result.changeId) {
        state = { ...state, taskJJChanges: { ...state.taskJJChanges, [task.index]: result.changeId } };
        store.saveState(state);
      }
    }
  }

  // Learnings + Roadmap: brainstorm and plan phases only
  if (BRAINSTORM_PLAN_PHASES.includes(state.phase)) {
    vars.learnings = store?.getLearnings() ?? "";
    vars.roadmap = store?.readRoadmap() ?? "";
  }

  // Select prompt template
  let template = getPhasePromptTemplate(state.phase);

  if (state.phase === "done" && state.doneMode && store) {
    const doneModeTemplateMap: Record<string, string> = {
      "generate-docs": "generate-docs.md",
      "capture-learnings": "capture-learnings.md",
      "write-changelog": "write-changelog.md",
    };
    const filename = doneModeTemplateMap[state.doneMode];
    if (filename) {
      const modeTemplate = loadPromptFile(filename);
      if (modeTemplate) template = modeTemplate;
    }
    // files_changed for done-phase artifact prompts
    if (state.jjChangeId && await jj.isJJRepo()) {
      try { vars.files_changed = await jj.diff(state.jjChangeId); } catch { vars.files_changed = ""; }
    } else {
      vars.files_changed = "";
    }
    vars.learnings = store.getLearnings();
  }

  const prompt = interpolatePrompt(template, vars);
  if (!prompt) return;

  return {
    message: {
      customType: "megapowers-context",
      content: prompt,
      display: false,
    },
  };
});
```

Also add `getPhasePromptTemplate` to the imports (it's already there, just confirm it's included).

**Step 3: Add done-phase artifact capture in `agent_end`**

In the `agent_end` handler, after the existing `handleDonePhase` call block, add artifact capture for doneMode. Find:

```typescript
// Done phase: trigger wrap-up menu
if (state.phase === "done") {
  state = await ui.handleDonePhase(ctx, state, store, jj);
  store.saveState(state);
  pi.appendEntry("megapowers-state", state);
}
```

Insert before the `handleDonePhase` call (so artifacts are saved from THIS agent turn's output before we show the menu for next actions):

```typescript
// Done phase: capture artifacts from doneMode LLM output
if (state.phase === "done" && state.doneMode && activeIssue && text.length > 100) {
  if (state.doneMode === "generate-docs") {
    store.ensurePlanDir(activeIssue);
    store.writeFeatureDoc(activeIssue, text);
    if (ctx.hasUI) ctx.ui.notify(`Feature doc saved to .megapowers/docs/${activeIssue}.md`, "info");
  }
  if (state.doneMode === "write-changelog") {
    store.appendChangelog(text);
    if (ctx.hasUI) ctx.ui.notify("Changelog entry appended to .megapowers/CHANGELOG.md", "info");
  }
  // capture-learnings: the UI handleDonePhase menu handles approval flow
  // Clear doneMode after artifact capture
  if (state.doneMode !== "capture-learnings") {
    state = { ...state, doneMode: null };
    store.saveState(state);
  }
}
```

**Step 4: Run full test suite**

```bash
bun test 2>&1 | tail -15
```

Expected: all pass (index.ts changes are runtime-only, no unit tests)

**Step 5: Commit**

```bash
git add extensions/megapowers/index.ts
git commit -m "feat(index): restrict learnings/roadmap to brainstorm+plan, wire doneMode prompt and artifact capture"
```

---

### Task 6: Update `ui.ts` — Done phase menu with wired actions

**TDD scenario:** Modifying tested code — run existing tests first

**Files:**
- Modify: `extensions/megapowers/ui.ts`
- Test: `tests/ui.test.ts`

The Done phase menu needs to:
1. Replace vague notification stubs with real `doneMode` state updates
2. Add "Capture learnings" option with a review-and-confirm flow for learnings
3. Return updated state (with `doneMode` set) so `before_agent_start` picks the right prompt next turn

**Step 1: Run existing tests to establish baseline**

```bash
bun test tests/ui.test.ts 2>&1 | tail -10
```

Expected: all pass

**Step 2: Write the failing tests**

Add to `tests/ui.test.ts`:

```typescript
describe("handleDonePhase — doneMode actions", () => {
  let tmp: string;

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), "megapowers-ui-donemode-test-"));
  });

  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  it("sets doneMode to 'generate-docs' when feature doc is selected", async () => {
    const store = createStore(tmp);
    const ui = createUI();
    const jj = createMockJJ();
    const state: MegapowersState = {
      ...createInitialState(),
      activeIssue: "001-test",
      workflow: "feature",
      phase: "done",
    };

    let callCount = 0;
    const ctx = createMockCtx();
    ctx.ui.select = async (_prompt: string, _items: string[]) => {
      callCount++;
      if (callCount === 1) return "Generate feature doc";
      return "Done — finish without further actions";
    };

    const result = await ui.handleDonePhase(ctx as any, state, store, jj as any);
    expect(result.doneMode).toBe("generate-docs");
  });

  it("sets doneMode to 'write-changelog' when changelog is selected", async () => {
    const store = createStore(tmp);
    const ui = createUI();
    const jj = createMockJJ();
    const state: MegapowersState = {
      ...createInitialState(),
      activeIssue: "001-test",
      workflow: "feature",
      phase: "done",
    };

    let callCount = 0;
    const ctx = createMockCtx();
    ctx.ui.select = async (_prompt: string, _items: string[]) => {
      callCount++;
      if (callCount === 1) return "Write changelog entry";
      return "Done — finish without further actions";
    };

    const result = await ui.handleDonePhase(ctx as any, state, store, jj as any);
    expect(result.doneMode).toBe("write-changelog");
  });

  it("sets doneMode to 'capture-learnings' when capture learnings is selected", async () => {
    const store = createStore(tmp);
    const ui = createUI();
    const jj = createMockJJ();
    const state: MegapowersState = {
      ...createInitialState(),
      activeIssue: "001-test",
      workflow: "feature",
      phase: "done",
    };

    let callCount = 0;
    const ctx = createMockCtx();
    ctx.ui.select = async (_prompt: string, _items: string[]) => {
      callCount++;
      if (callCount === 1) return "Capture learnings";
      return "Done — finish without further actions";
    };

    const result = await ui.handleDonePhase(ctx as any, state, store, jj as any);
    expect(result.doneMode).toBe("capture-learnings");
  });

  it("menu includes all three doneMode action labels", async () => {
    const store = createStore(tmp);
    const ui = createUI();
    const jj = createMockJJ();
    const state: MegapowersState = {
      ...createInitialState(),
      activeIssue: "001-test",
      workflow: "feature",
      phase: "done",
    };

    let menuItems: string[] = [];
    const ctx = createMockCtx();
    ctx.ui.select = async (_prompt: string, items: string[]) => {
      menuItems = items;
      return "Done — finish without further actions";
    };

    await ui.handleDonePhase(ctx as any, state, store, jj as any);
    expect(menuItems).toContain("Generate feature doc");
    expect(menuItems).toContain("Write changelog entry");
    expect(menuItems).toContain("Capture learnings");
  });
});
```

**Step 3: Run tests to verify they fail**

```bash
bun test tests/ui.test.ts --test-name-pattern "doneMode" 2>&1 | tail -20
```

Expected: FAIL — menu items don't match / doneMode not set

**Step 4: Update `handleDonePhase` in `ui.ts`**

Replace the current `handleDonePhase` implementation:

```typescript
async handleDonePhase(ctx, state, store, jj) {
  if (!state.activeIssue) return state;

  const actions = [
    "Generate feature doc",
    "Write changelog entry",
    "Capture learnings",
    "Close issue",
  ];

  // Offer squash if there are per-task jj changes and a phase change to squash into
  const hasTaskChanges = Object.keys(state.taskJJChanges).length > 0 && state.jjChangeId;
  if (hasTaskChanges) {
    actions.push("Squash task changes into phase change");
  }

  actions.push("Done — finish without further actions");

  let continueMenu = true;
  let newState = state;

  while (continueMenu) {
    const choice = await ctx.ui.select("Wrap-up actions:", actions);
    if (!choice || choice.startsWith("Done")) {
      continueMenu = false;
      break;
    }

    if (choice === "Generate feature doc") {
      newState = { ...newState, doneMode: "generate-docs" };
      ctx.ui.notify(
        "Feature doc mode active. Send any message to the LLM to generate the feature doc.\nThe doc will be saved to .megapowers/docs/.",
        "info"
      );
      continueMenu = false;
      break;
    }

    if (choice === "Write changelog entry") {
      newState = { ...newState, doneMode: "write-changelog" };
      ctx.ui.notify(
        "Changelog mode active. Send any message to the LLM to generate the changelog entry.\nThe entry will be appended to .megapowers/CHANGELOG.md.",
        "info"
      );
      continueMenu = false;
      break;
    }

    if (choice === "Capture learnings") {
      newState = { ...newState, doneMode: "capture-learnings" };
      ctx.ui.notify(
        "Learnings capture mode active. Send any message to the LLM to generate learning suggestions.\nReview the output and use /learn to save individual entries.",
        "info"
      );
      continueMenu = false;
      break;
    }

    if (choice === "Close issue") {
      store.updateIssueStatus(state.activeIssue, "done");
      newState = createInitialState();
      store.saveState(newState);
      ctx.ui.notify("Issue closed.", "info");
      continueMenu = false;
      break;
    }

    if (choice === "Squash task changes into phase change") {
      if (state.jjChangeId) {
        await jj.squashInto(state.jjChangeId);
        newState = { ...newState, taskJJChanges: {} };
        ctx.ui.notify("Task changes squashed into phase change.", "info");
      }
      // Continue menu after squash
    }
  }

  return newState;
},
```

**Step 5: Run tests to verify they pass**

```bash
bun test tests/ui.test.ts 2>&1 | tail -15
```

Expected: all pass (including existing tests)

**Step 6: Run full suite**

```bash
bun test 2>&1 | tail -10
```

Expected: all pass

**Step 7: Commit**

```bash
git add extensions/megapowers/ui.ts tests/ui.test.ts
git commit -m "feat(ui): update done phase menu with generate-docs, capture-learnings, write-changelog actions"
```

---

## Verification Checklist

After all tasks complete:

```bash
# All tests pass
bun test

# TypeScript compiles cleanly (if tsc is available)
bun run typecheck 2>/dev/null || npx tsc --noEmit 2>&1 | head -20

# Check new files exist
ls prompts/capture-learnings.md prompts/write-changelog.md

# Check store test coverage
bun test tests/store.test.ts --verbose 2>&1 | grep -E "(✓|✗)"
```

---

## Design Notes for Implementer

**`doneMode` and the menu loop:** The `handleDonePhase` loop breaks after setting `doneMode`. This is intentional — once a doneMode action is chosen, the user must interact with the LLM, then the menu reappears (driven by `agent_end`). The menu doesn't keep looping because the next action depends on what the LLM does.

**Learnings capture flow:** `capture-learnings` doneMode is treated differently from `generate-docs` and `write-changelog`. The LLM suggests learnings, but the user manually approves them via `/learn` command. There's no automatic save. The `agent_end` hook clears `doneMode` for generate-docs and write-changelog (which auto-save artifacts) but NOT for capture-learnings — the user sees the suggestions, uses `/learn` for ones they approve, and the `doneMode` persists until they select a different action from the menu.

Wait — actually this needs a refinement. Looking at `agent_end` in Task 5, we clear `doneMode` for everything except `capture-learnings`. But `capture-learnings` will keep firing the capture-learnings prompt every turn until the user picks a different menu option. That's actually correct UX: the user can ask follow-up questions about learnings, use `/learn` to save them, then pick "Done" from the menu.

**`vars.learnings` in `before_agent_start`:** When `doneMode` is active, learnings are explicitly set for all done-phase prompts. For brainstorm/plan phases, learnings are also set. For all other phases (implement, verify, code-review, spec), `vars.learnings` is NOT set — `interpolatePrompt` will leave `{{learnings}}` as-is if the template has it, but none of those templates do, so it's a non-issue.

**`readRoadmap()` in `store.ts`:** Uses `projectRoot` (the string passed to `createStore`). This is the project root, same as where `.megapowers/` lives. The `ROADMAP.md` lookup is `join(projectRoot, "ROADMAP.md")`.
