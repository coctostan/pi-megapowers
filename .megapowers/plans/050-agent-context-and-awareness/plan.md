# Plan: Agent Context and Awareness (#050)

### Task 1: Reorder `canWrite()` so allowlisted files pass in all phases and add `reproduce`/`diagnose` to blocking

**Files:**
- Modify: `extensions/megapowers/write-policy.ts`
- Test: `tests/write-policy.test.ts` (new file)

**Test:**

```ts
// tests/write-policy.test.ts
import { describe, it, expect } from "bun:test";
import { canWrite } from "../extensions/megapowers/write-policy.js";
import type { TddTaskState } from "../extensions/megapowers/state-machine.js";

describe("canWrite — allowlisted files in all phases", () => {
  const BLOCKING_PHASES = ["brainstorm", "spec", "plan", "review", "verify", "done", "reproduce", "diagnose"] as const;
  const TDD_PHASES = ["implement", "code-review"] as const;
  const ALL_PHASES = [...BLOCKING_PHASES, ...TDD_PHASES] as const;

  // AC5: allowlisted files writable in every phase
  for (const phase of ALL_PHASES) {
    it(`allows README.md in ${phase} phase`, () => {
      const result = canWrite(phase, "README.md", true, false, null);
      expect(result.allowed).toBe(true);
    });

    it(`allows CHANGELOG.md in ${phase} phase`, () => {
      const result = canWrite(phase, "CHANGELOG.md", true, false, null);
      expect(result.allowed).toBe(true);
    });

    it(`allows docs/foo.md in ${phase} phase`, () => {
      const result = canWrite(phase, "docs/foo.md", true, false, null);
      expect(result.allowed).toBe(true);
    });

    it(`allows tsconfig.json in ${phase} phase`, () => {
      const result = canWrite(phase, "tsconfig.json", true, false, null);
      expect(result.allowed).toBe(true);
    });

    it(`allows .env in ${phase} phase`, () => {
      const result = canWrite(phase, ".env", true, false, null);
      expect(result.allowed).toBe(true);
    });

    it(`allows types.d.ts in ${phase} phase`, () => {
      const result = canWrite(phase, "types.d.ts", true, false, null);
      expect(result.allowed).toBe(true);
    });
  }

  // AC6: non-allowlisted source code blocked in all blocking phases (including bugfix phases)
  for (const phase of BLOCKING_PHASES) {
    it(`blocks src/app.ts in ${phase} phase`, () => {
      const result = canWrite(phase, "src/app.ts", true, false, null);
      expect(result.allowed).toBe(false);
    });

    it(`blocks lib/index.js in ${phase} phase`, () => {
      const result = canWrite(phase, "lib/index.js", true, false, null);
      expect(result.allowed).toBe(false);
    });
  }

  // AC7: TDD guard still enforced for source files during implement
  it("blocks source files in implement when TDD not satisfied", () => {
    const result = canWrite("implement", "src/app.ts", true, false, null);
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("TDD");
  });

  it("allows source files in implement when TDD impl-allowed", () => {
    const tdd: TddTaskState = { taskIndex: 1, state: "impl-allowed", skipped: false };
    const result = canWrite("implement", "src/app.ts", true, false, tdd);
    expect(result.allowed).toBe(true);
  });

  it("allows test files in implement without TDD", () => {
    const result = canWrite("implement", "tests/foo.test.ts", true, false, null);
    expect(result.allowed).toBe(true);
  });

  // mega off and no phase passthrough still work
  it("allows everything when mega is off", () => {
    const result = canWrite("spec", "src/app.ts", false, false, null);
    expect(result.allowed).toBe(true);
  });

  it("allows everything when phase is null", () => {
    const result = canWrite(null, "src/app.ts", true, false, null);
    expect(result.allowed).toBe(true);
  });
});
```

**Implementation:**

In `extensions/megapowers/write-policy.ts`, two changes:

1. Add `reproduce` and `diagnose` to `BLOCKING_PHASES`:

```ts
const BLOCKING_PHASES: ReadonlySet<string> = new Set([
  "brainstorm", "spec", "plan", "review", "verify", "done",
  "reproduce", "diagnose",
]);
```

2. Move the `isAllowlisted()` check to just after the `.megapowers/` check and before the `BLOCKING_PHASES` check. Remove the redundant `isAllowlisted()` check inside the `TDD_PHASES` block:

```ts
  // .megapowers/ paths always writable
  if (filePath.startsWith(".megapowers/") || filePath.includes("/.megapowers/")) {
    return { allowed: true };
  }

  // Allowlisted files (docs, config, typings) pass through in ALL phases
  if (isAllowlisted(filePath)) return { allowed: true };

  // Blocking phases: only .megapowers/ and allowlisted files pass (handled above)
  if (BLOCKING_PHASES.has(phase)) {
    return {
      allowed: false,
      reason: `Source code writes are blocked during the ${phase} phase. Only .megapowers/ and allowlisted paths (docs, config, typings) are writable.`,
    };
  }

  // TDD-guarded phases (implement, code-review)
  if (TDD_PHASES.has(phase)) {
    // Test files always allowed (this is how the RED step happens)
    if (isTestFile(filePath)) return { allowed: true };

    // [no-test] task: no TDD required
    if (taskIsNoTest) return { allowed: true };

    // Explicitly skipped TDD
    if (tddState?.skipped) return { allowed: true };

    // Tests have failed (RED ✓), impl is now allowed (GREEN)
    if (tddState?.state === "impl-allowed") return { allowed: true };

    // Everything else is blocked until TDD is satisfied
    return {
      allowed: false,
      reason:
        "TDD violation: write a test file and run tests (they must fail) before writing production code." +
        " Or use /tdd skip to bypass for this task.",
    };
  }

  return { allowed: true };
```

**Verify:** `bun test tests/write-policy.test.ts`

---

### Task 2: Create `prompts/base.md` template for no-active-issue state

**Files:**
- Create: `prompts/base.md`

**Test:** (verified in Task 3 integration test)

**Implementation:**

```md
## Megapowers Protocol

You have access to these megapowers tools:

### `megapowers_signal`
Call this to signal state transitions:
- `{ action: "task_done" }` — Mark the current implementation task as complete
- `{ action: "review_approve" }` — Approve the plan during review phase
- `{ action: "phase_next" }` — Advance to the next workflow phase

### `megapowers_save_artifact`
Call this to save phase output:
- `{ phase: "<phase>", content: "<full content>" }` — Save artifact for the current phase

### Error Handling
When a megapowers tool returns an error:
1. READ the error message — it tells you exactly what's wrong
2. FIX the issue described
3. RETRY the tool call
Do NOT work around errors by editing state files directly.

## Getting Started

No issue is currently active. To begin a workflow:

1. Use the `/issue` command to browse and select an existing issue
2. Or ask to create a new issue — describe the feature or bug and it will be filed

Once an issue is selected, megapowers will guide you through the appropriate workflow (feature or bugfix) with phase-specific instructions.
```

**Verify:** `test -f prompts/base.md && echo "exists"`

---

### Task 3: Restructure `buildInjectedPrompt()` for three-tier injection [depends: 2]

**Files:**
- Modify: `extensions/megapowers/prompt-inject.ts`
- Test: `tests/prompt-inject.test.ts`

**Test:** Add these test cases to the existing `describe("buildInjectedPrompt")` block in `tests/prompt-inject.test.ts`:

```ts
  // AC1: enabled + no active issue → base.md content
  it("returns base.md content when megaEnabled but no active issue", () => {
    writeState(tmp, { ...createInitialState(), megaEnabled: true });
    const result = buildInjectedPrompt(tmp);
    expect(result).not.toBeNull();
    expect(result).toContain("Getting Started");
    expect(result).toContain("/issue");
    expect(result).toContain("megapowers_signal");
  });

  // AC2: disabled → null even with active issue
  it("returns null when megaEnabled is false even with active issue", () => {
    setState(tmp, { phase: "spec", megaEnabled: false, activeIssue: "001-test" });
    expect(buildInjectedPrompt(tmp)).toBeNull();
  });

  // AC3: enabled + active issue → phase prompt (not base.md)
  it("returns phase prompt (not base.md) when issue is active", () => {
    setState(tmp, { phase: "spec", megaEnabled: true });
    const result = buildInjectedPrompt(tmp);
    expect(result).not.toBeNull();
    expect(result).not.toContain("Getting Started");
    expect(result).toContain("executable specification");
  });
```

Note: The AC3 test asserts `"executable specification"` which is a phrase that appears in `prompts/write-spec.md` (`"You are writing an executable specification"`). This is more stable than asserting a generic word like "spec".

**Implementation:**

In `extensions/megapowers/prompt-inject.ts`, change the early-return logic at the top of `buildInjectedPrompt()`:

```ts
// Current:
  if (!state.megaEnabled) return null;
  if (!state.activeIssue || !state.phase) return null;

// New:
  if (!state.megaEnabled) return null;

  // No active issue: return base orientation prompt only (AC1, AC4)
  if (!state.activeIssue || !state.phase) {
    const base = loadPromptFile("base.md");
    return base || null;
  }
```

The rest of the function remains unchanged — it already handles the full phase-prompt path correctly.

Also update the existing test `"returns null when no active issue"` — it now expects non-null:

```ts
  // Update existing test:
  it("returns base prompt when no active issue but mega enabled", () => {
    writeState(tmp, { ...createInitialState(), megaEnabled: true });
    const result = buildInjectedPrompt(tmp);
    expect(result).not.toBeNull();
    expect(result).toContain("Getting Started");
  });
```

**Verify:** `bun test tests/prompt-inject.test.ts`

---

### Task 4: Add `[no-test]` annotation guidance to `write-plan.md`

**Files:**
- Modify: `prompts/write-plan.md`

**Test:** (verified in Task 6 template variable audit)

**Implementation:**

Add to the `## Rules` section of `prompts/write-plan.md`, after the existing rules:

```md
- **Type-only tasks** (interface changes, type aliases, `.d.ts` edits) that cannot produce a failing runtime test must be annotated with `[no-test]` in the task title (e.g., `### Task 3: Add phase field to State interface [no-test]`). This bypasses TDD enforcement for that task.
```

**Verify:** `grep -q "no-test" prompts/write-plan.md && echo "found"`

---

### Task 5: Add `/tdd skip` guidance to `implement-task.md`

**Files:**
- Modify: `prompts/implement-task.md`

**Test:** (verified in Task 6 template variable audit)

**Implementation:**

Add a new section after the TDD-related content in `prompts/implement-task.md`:

```md
## Type-Only Tasks

If the current task is purely type-level (e.g., adding a field to an interface, changing a type alias) and cannot produce a failing runtime test:
- If the task is annotated `[no-test]` in the plan, TDD is already bypassed — write the implementation directly.
- Otherwise, use the `/tdd skip` command to bypass the TDD guard for this task, then proceed with the implementation.
```

**Verify:** `grep -q "tdd skip" prompts/implement-task.md && echo "found"`

---

### Task 6: Template variable coverage audit test [depends: 3]

**Files:**
- Create: `tests/prompt-templates.test.ts`
- Possibly modify: `extensions/megapowers/prompt-inject.ts` (if uninterpolated vars found)

**Test:**

```ts
// tests/prompt-templates.test.ts
import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { readdirSync, mkdtempSync, rmSync, mkdirSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { buildInjectedPrompt } from "../extensions/megapowers/prompt-inject.js";
import { writeState } from "../extensions/megapowers/state-io.js";
import { createInitialState, type MegapowersState } from "../extensions/megapowers/state-machine.js";
import { createStore, type Store } from "../extensions/megapowers/store.js";

const PROMPTS_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "prompts");

// Templates that are not interpolated by buildInjectedPrompt (different code path or no vars)
const SKIP_TEMPLATES = new Set(["megapowers-protocol.md", "base.md", "triage.md"]);

// Map template filenames to the phase + state that triggers their interpolation
const TEMPLATE_PHASE_MAP: Record<string, { phase: string; extras?: Partial<MegapowersState> }> = {
  "brainstorm.md": { phase: "brainstorm" },
  "write-spec.md": { phase: "spec" },
  "write-plan.md": { phase: "plan" },
  "review-plan.md": { phase: "review" },
  "implement-task.md": { phase: "implement", extras: { currentTaskIndex: 0 } },
  "verify.md": { phase: "verify" },
  "code-review.md": { phase: "code-review" },
  "reproduce-bug.md": { phase: "reproduce", extras: { workflow: "bugfix" } },
  "diagnose-bug.md": { phase: "diagnose", extras: { workflow: "bugfix" } },
  "generate-docs.md": { phase: "done", extras: { doneMode: "generate-docs" } },
  "generate-bugfix-summary.md": { phase: "done", extras: { doneMode: "generate-bugfix-summary", workflow: "bugfix" } },
  "write-changelog.md": { phase: "done", extras: { doneMode: "write-changelog" } },
  "capture-learnings.md": { phase: "done", extras: { doneMode: "capture-learnings" } },
};

describe("prompt template variable coverage (AC10)", () => {
  let tmp: string;
  let store: Store;

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), "template-var-test-"));
    store = createStore(tmp);
    // Create minimal artifacts so derivation and store reads work
    const dir = join(tmp, ".megapowers", "plans", "001-test");
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "plan.md"), "# Plan\n\n### Task 1: Build it\n");
    writeFileSync(join(dir, "spec.md"), "# Spec\n\n## Acceptance Criteria\n1. It works\n");
    writeFileSync(join(dir, "brainstorm.md"), "# Brainstorm\n\nSome ideas.");
    writeFileSync(join(dir, "diagnosis.md"), "# Diagnosis\n\n## Fixed When\n1. Bug is gone\n");
    writeFileSync(join(dir, "reproduce.md"), "# Reproduce\n\nSteps to reproduce.");
    writeFileSync(join(dir, "verify.md"), "# Verification\n\nAll tests pass.");
    writeFileSync(join(dir, "code-review.md"), "# Code Review\n\nLGTM.");
    // Create roadmap and learnings files
    writeFileSync(join(tmp, "ROADMAP.md"), "# Roadmap\n\nSome plans.");
    mkdirSync(join(tmp, ".megapowers", "learnings"), { recursive: true });
    writeFileSync(join(tmp, ".megapowers", "learnings", "learnings.md"), "# Learnings\n\nSome learnings.");
  });

  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  const templates = readdirSync(PROMPTS_DIR).filter(f => f.endsWith(".md"));

  for (const filename of templates) {
    if (SKIP_TEMPLATES.has(filename)) continue;

    it(`${filename} has no uninterpolated {{var}} placeholders in output`, () => {
      const mapping = TEMPLATE_PHASE_MAP[filename];
      // Fail loudly if a new template is added without a mapping
      if (!mapping) {
        throw new Error(
          `No phase mapping for ${filename} — add it to TEMPLATE_PHASE_MAP in prompt-templates.test.ts`
        );
      }

      writeState(tmp, {
        ...createInitialState(),
        activeIssue: "001-test",
        workflow: (mapping.extras?.workflow as any) ?? "feature",
        phase: mapping.phase as any,
        megaEnabled: true,
        ...mapping.extras,
      });

      const result = buildInjectedPrompt(tmp, store);
      if (!result) {
        throw new Error(
          `buildInjectedPrompt returned null for ${filename} (phase=${mapping.phase}) — check state/store setup`
        );
      }

      // Check for uninterpolated variables (literal {{word}} in output)
      const uninterpolated = result.match(/\{\{(\w+)\}\}/g) ?? [];
      expect(uninterpolated).toEqual([]);
    });
  }
});
```

Key differences from the original plan:
- Uses `createStore(tmp)` to get a real store so `{{learnings}}`, `{{roadmap}}`, and artifact `{{*_content}}` vars are populated.
- Creates minimal artifact files (`brainstorm.md`, `reproduce.md`, `diagnosis.md`, etc.) so store reads return content.
- Creates `ROADMAP.md` and learnings file so store-dependent vars resolve.
- Missing template mappings **throw** instead of `console.warn + return` — AC10 requires no gaps.
- Null result from `buildInjectedPrompt` also **throws** instead of silent return.
- Removed unused `extractVars()` helper and unused imports.
- Removed `.withContext()` call which is not a Bun `expect` API.

**Implementation:** If the test reveals uninterpolated variables, fix the population logic in `buildInjectedPrompt()` to provide defaults or populate the missing vars.

**Verify:** `bun test tests/prompt-templates.test.ts`

---

### Task 7: Collaborative prompt audit [depends: 1, 2, 3, 4, 5] [no-test]

**Files:**
- Modify: All files in `prompts/` (proposed edits subject to user approval)
- Modify: `extensions/megapowers/prompt-inject.ts` (if new vars needed)

**Test:** No automated test — collaborative human review.

**Implementation:**

For each of the 16 prompt templates in `prompts/` (15 existing + `base.md`):
1. Read the template
2. Check against the audit criteria from issue #040:
   - **Accuracy**: correct tool API descriptions (`megapowers_signal`, `megapowers_save_artifact`)
   - **Phase correctness**: accurate description of what the phase produces and what comes next
   - **Template variable coverage**: all `{{var}}` placeholders populated by `buildInjectedPrompt()`
   - **Consistency**: same terminology, formatting, signal conventions across all templates
   - **Completeness**: missing guidance that would help the LLM
   - **Brevity**: remove unnecessary verbosity
3. Propose each edit to the user and wait for approval before writing
4. Document findings in a brief audit summary

This is a collaborative task — do NOT batch-rewrite prompts autonomously.

**Verify:** User approval of each proposed edit.