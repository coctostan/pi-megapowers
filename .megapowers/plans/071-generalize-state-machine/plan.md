# Plan v4: Generalize State Machine (#071)

## Changes from v3

1. **Tasks 2–4, 16:** Fixed Step 5 expectations — no longer claim exact baseline pass counts after adding new tests. Changed to "only the same 3 pre-existing failures; no additional failures."
2. **Task 9:** Removed `blocking: true` from bugfix `reproduce` and `diagnose` phases. Current `write-policy.ts` does NOT treat `reproduce`/`diagnose` as blocking (only `brainstorm/spec/plan/review/verify/done`). Preserving current behavior for strict AC17 equivalence.
3. **Task 14:** Added regression test verifying that bugfix `reproduce` and `diagnose` phases are NOT blocking (locking current behavior).

## Changes from v2

1. **Task 5:** Fixed import handling — update existing `node:fs` import to include `writeFileSync`/`mkdirSync` instead of adding a second import line (review finding: Task 5 import collision).
2. **Task 8:** Added `artifact: "brainstorm.md"` on brainstorm phase so `brainstorm_content` continues to be populated after Task 15 removes the hardcoded `artifactMap` (review finding: Task 8 behavioral equivalence risk).
3. **Task 11:** Updated brainstorm test to expect `save_artifact` instructions (now has artifact). Added `isTerminal` handling for done phase so it gets `save_artifact`-style instructions instead of generic `phase_next` (review finding: Task 11 done-phase regression risk).

## Changes from v1

1. **Task 6 (alwaysPass):** Changed `evaluateGate` default to throw for unhandled types, making the alwaysPass test properly fail until implemented (review finding #1).
2. **Tasks 8/9:** Added `needsReviewApproval: true` on review phase. Added `artifact` on reproduce/diagnose phases so tool instructions derive correctly (review finding #2).
3. **Task 10:** Strengthened validation — every non-terminal phase must have at least one outgoing transition (review finding #4).
4. **Task 11:** Derive save_artifact phase name from artifact filename base (e.g. `diagnosis.md` → `"diagnosis"`) instead of phase name. Fixes diagnose/diagnosis mismatch (review finding #3).
5. **Task 12:** Derive `OPEN_ENDED_PHASES` from configs instead of keeping hardcoded (review finding #6).
6. **Task 15:** Artifact loading is config-driven via `PhaseConfig.artifact` and phase aliases. Removed hardcoded `artifactMap` (review finding #5).

## AC Coverage

| AC | Task(s) |
|----|---------|
| 1 (WorkflowConfig type) | 1 |
| 2 (GateConfig tagged union) | 1 |
| 3 (gate evaluator function) | 2 |
| 4 (built-in gates unit-testable) | 2, 3, 4, 5, 6 |
| 5 (custom gate) | 7 |
| 6 (feature workflow config) | 8 |
| 7 (bugfix workflow config) | 9 |
| 8 (registry module) | 10 |
| 9 (phaseAliases) | 9 |
| 10 (derived tool instructions) | 11 |
| 11 (state-machine.ts uses config) | 12 |
| 12 (gates.ts uses config) | 13 |
| 13 (write-policy.ts uses config) | 14 |
| 14 (prompt-inject.ts uses config) | 15 |
| 15 (derived.ts uses config) | 15 |
| 16 (config validation) | 10 |
| 17 (all existing tests pass) | 16 |

---

### Task 1: Define WorkflowConfig and GateConfig types [no-test]

**Justification:** Pure type definitions — no runtime behavior to test. Verified by type-check.

**Files:**
- Create: `extensions/megapowers/workflows/types.ts`

**Step 1 — Make the change**

Create `extensions/megapowers/workflows/types.ts`:

```ts
// extensions/megapowers/workflows/types.ts
import type { Phase, WorkflowType } from "../state/state-machine.js";
import type { MegapowersState } from "../state/state-machine.js";
import type { Store } from "../state/store.js";

// --- Gate Config ---

export interface RequireArtifactGate {
  type: "requireArtifact";
  file: string; // e.g. "spec.md"
}

export interface NoOpenQuestionsGate {
  type: "noOpenQuestions";
  file: string; // file to check for open questions
}

export interface RequireReviewApprovedGate {
  type: "requireReviewApproved";
}

export interface AllTasksCompleteGate {
  type: "allTasksComplete";
}

export interface AlwaysPassGate {
  type: "alwaysPass";
}

export interface CustomGate {
  type: "custom";
  evaluate: (state: MegapowersState, store: Store, cwd?: string) => GateEvalResult;
}

export type GateConfig =
  | RequireArtifactGate
  | NoOpenQuestionsGate
  | RequireReviewApprovedGate
  | AllTasksCompleteGate
  | AlwaysPassGate
  | CustomGate;

export interface GateEvalResult {
  pass: boolean;
  message?: string;
}

// --- Transition Config ---

export interface TransitionConfig {
  from: Phase;
  to: Phase;
  gates: GateConfig[];
  backward?: boolean; // backward transitions skip gates
}

// --- Phase Config ---

export interface PhaseConfig {
  name: Phase;
  artifact?: string;              // e.g. "spec.md" — phase produces this artifact
  tdd?: boolean;                  // phase uses TDD gating
  needsReviewApproval?: boolean;  // phase requires review approval to advance
  openEnded?: boolean;            // suppresses auto phase-transition prompts
  blocking?: boolean;             // blocks source code writes (only .megapowers/ allowed)
  promptTemplate?: string;        // e.g. "write-spec.md"
  guidance?: string;              // short guidance string for UI
}

// --- Workflow Config ---

export interface WorkflowConfig {
  name: WorkflowType;
  phases: PhaseConfig[];
  transitions: TransitionConfig[];
  /** Maps alias names to canonical phase/artifact names.
   *  Keys are artifact base names (e.g. "reproduce", "diagnosis"),
   *  values are the canonical names they alias to (e.g. "brainstorm", "spec").
   *  Used by prompt-inject and derived.ts to resolve bugfix-specific behavior. */
  phaseAliases?: Record<string, string>;
}
```

**Step 2 — Verify**
Run: `cd /Users/maxwellnewman/pi/workspace/pi-megapowers && npx tsc --noEmit`
Expected: No type errors

---

### Task 2: Implement gate evaluator — requireArtifact gate [depends: 1]

**Files:**
- Create: `extensions/megapowers/workflows/gate-evaluator.ts`
- Create: `tests/gate-evaluator.test.ts`

**Step 1 — Write the failing test**

```ts
// tests/gate-evaluator.test.ts
import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { evaluateGate } from "../extensions/megapowers/workflows/gate-evaluator.js";
import { createStore } from "../extensions/megapowers/state/store.js";
import { createInitialState, type MegapowersState } from "../extensions/megapowers/state/state-machine.js";
import type { GateConfig } from "../extensions/megapowers/workflows/types.js";

let tmp: string;

beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), "gate-eval-test-"));
});

afterEach(() => {
  rmSync(tmp, { recursive: true, force: true });
});

function makeState(overrides: Partial<MegapowersState> = {}): MegapowersState {
  return {
    ...createInitialState(),
    activeIssue: "001-test",
    workflow: "feature",
    phase: "spec",
    ...overrides,
  };
}

describe("evaluateGate — requireArtifact", () => {
  it("fails when artifact file does not exist", () => {
    const store = createStore(tmp);
    const gate: GateConfig = { type: "requireArtifact", file: "spec.md" };
    const result = evaluateGate(gate, makeState(), store, tmp);
    expect(result.pass).toBe(false);
    expect(result.message).toContain("spec.md");
  });

  it("passes when artifact file exists", () => {
    const store = createStore(tmp);
    store.ensurePlanDir("001-test");
    store.writePlanFile("001-test", "spec.md", "# Spec\nContent here");
    const gate: GateConfig = { type: "requireArtifact", file: "spec.md" };
    const result = evaluateGate(gate, makeState(), store, tmp);
    expect(result.pass).toBe(true);
  });
});
```

**Step 2 — Run test, verify it fails**
Run: `cd /Users/maxwellnewman/pi/workspace/pi-megapowers && bun test tests/gate-evaluator.test.ts`
Expected: FAIL — `evaluateGate` is not a function / module not found

**Step 3 — Write minimal implementation**

```ts
// extensions/megapowers/workflows/gate-evaluator.ts
import type { GateConfig, GateEvalResult } from "./types.js";
import type { MegapowersState } from "../state/state-machine.js";
import type { Store } from "../state/store.js";

export function evaluateGate(
  gate: GateConfig,
  state: MegapowersState,
  store: Store,
  cwd?: string,
): GateEvalResult {
  switch (gate.type) {
    case "requireArtifact": {
      if (!state.activeIssue) return { pass: false, message: "No active issue" };
      if (!store.planFileExists(state.activeIssue, gate.file)) {
        return { pass: false, message: `${gate.file} not found. The LLM needs to produce it first.` };
      }
      return { pass: true };
    }
    default:
      throw new Error(`Unknown gate type: ${(gate as any).type}`);
  }
}
```

Note: the default branch throws for unhandled gate types. This ensures Task 6 (alwaysPass) has a proper red-green TDD cycle.

**Step 4 — Run test, verify it passes**
Run: `cd /Users/maxwellnewman/pi/workspace/pi-megapowers && bun test tests/gate-evaluator.test.ts`
Expected: PASS

**Step 5 — Verify no regressions**
Run: `cd /Users/maxwellnewman/pi/workspace/pi-megapowers && bun test`
Expected: Only the same 3 pre-existing failures (bugfix variable injection, done template `{{files_changed}}`, bugfix summary placeholders); no additional failures.

---

### Task 3: Implement gate evaluator — noOpenQuestions gate [depends: 2]

**Files:**
- Modify: `extensions/megapowers/workflows/gate-evaluator.ts`
- Modify: `tests/gate-evaluator.test.ts`

**Step 1 — Write the failing test**

Add to `tests/gate-evaluator.test.ts`:

```ts
describe("evaluateGate — noOpenQuestions", () => {
  it("fails when file has open questions", () => {
    const store = createStore(tmp);
    store.ensurePlanDir("001-test");
    store.writePlanFile("001-test", "spec.md", "## Open Questions\n- What about X?");
    const gate: GateConfig = { type: "noOpenQuestions", file: "spec.md" };
    const result = evaluateGate(gate, makeState(), store, tmp);
    expect(result.pass).toBe(false);
    expect(result.message).toContain("open questions");
  });

  it("passes when file has no open questions", () => {
    const store = createStore(tmp);
    store.ensurePlanDir("001-test");
    store.writePlanFile("001-test", "spec.md", "## Goal\nBuild it.\n\n## Open Questions\n*(None)*");
    const gate: GateConfig = { type: "noOpenQuestions", file: "spec.md" };
    const result = evaluateGate(gate, makeState(), store, tmp);
    expect(result.pass).toBe(true);
  });

  it("passes when file does not exist (no questions to block on)", () => {
    const store = createStore(tmp);
    const gate: GateConfig = { type: "noOpenQuestions", file: "spec.md" };
    const result = evaluateGate(gate, makeState(), store, tmp);
    expect(result.pass).toBe(true);
  });
});
```

**Step 2 — Run test, verify it fails**
Run: `cd /Users/maxwellnewman/pi/workspace/pi-megapowers && bun test tests/gate-evaluator.test.ts`
Expected: FAIL — throws "Unknown gate type: noOpenQuestions"

**Step 3 — Write minimal implementation**

Add case to the `switch` in `evaluateGate` (before the `default`):

```ts
    case "noOpenQuestions": {
      if (!state.activeIssue) return { pass: true };
      const content = store.readPlanFile(state.activeIssue, gate.file);
      if (!content) return { pass: true };
      if (hasOpenQuestions(content)) {
        return { pass: false, message: "Spec has unresolved open questions. Resolve them before advancing." };
      }
      return { pass: true };
    }
```

Add import at top: `import { hasOpenQuestions } from "../spec-parser.js";`

**Step 4 — Run test, verify it passes**
Run: `cd /Users/maxwellnewman/pi/workspace/pi-megapowers && bun test tests/gate-evaluator.test.ts`
Expected: PASS

**Step 5 — Verify no regressions**
Run: `cd /Users/maxwellnewman/pi/workspace/pi-megapowers && bun test`
Expected: Only the same 3 pre-existing failures; no additional failures.

---

### Task 4: Implement gate evaluator — requireReviewApproved gate [depends: 2]

**Files:**
- Modify: `extensions/megapowers/workflows/gate-evaluator.ts`
- Modify: `tests/gate-evaluator.test.ts`

**Step 1 — Write the failing test**

Add to `tests/gate-evaluator.test.ts`:

```ts
describe("evaluateGate — requireReviewApproved", () => {
  it("fails when reviewApproved is false", () => {
    const store = createStore(tmp);
    const gate: GateConfig = { type: "requireReviewApproved" };
    const result = evaluateGate(gate, makeState({ phase: "review", reviewApproved: false }), store, tmp);
    expect(result.pass).toBe(false);
    expect(result.message).toContain("not approved");
  });

  it("passes when reviewApproved is true", () => {
    const store = createStore(tmp);
    const gate: GateConfig = { type: "requireReviewApproved" };
    const result = evaluateGate(gate, makeState({ phase: "review", reviewApproved: true }), store, tmp);
    expect(result.pass).toBe(true);
  });
});
```

**Step 2 — Run test, verify it fails**
Run: `cd /Users/maxwellnewman/pi/workspace/pi-megapowers && bun test tests/gate-evaluator.test.ts`
Expected: FAIL — throws "Unknown gate type: requireReviewApproved"

**Step 3 — Write minimal implementation**

Add case to the `switch` in `evaluateGate`:

```ts
    case "requireReviewApproved": {
      if (!state.reviewApproved) {
        return { pass: false, message: "Plan review not approved yet. The LLM needs to approve the plan." };
      }
      return { pass: true };
    }
```

**Step 4 — Run test, verify it passes**
Run: `cd /Users/maxwellnewman/pi/workspace/pi-megapowers && bun test tests/gate-evaluator.test.ts`
Expected: PASS

**Step 5 — Verify no regressions**
Run: `cd /Users/maxwellnewman/pi/workspace/pi-megapowers && bun test`
Expected: Only the same 3 pre-existing failures; no additional failures.

---

### Task 5: Implement gate evaluator — allTasksComplete gate [depends: 2]

**Files:**
- Modify: `extensions/megapowers/workflows/gate-evaluator.ts`
- Modify: `tests/gate-evaluator.test.ts`

**Step 1 — Write the failing test**

Update the existing `node:fs` import at the top of `tests/gate-evaluator.test.ts` to include `writeFileSync` and `mkdirSync`:

```ts
// Change: import { mkdtempSync, rmSync } from "node:fs";
// To:
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
```

Then add the test block:

```ts
describe("evaluateGate — allTasksComplete", () => {
  it("fails when tasks are incomplete", () => {
    const store = createStore(tmp);
    const issueSlug = "001-test";
    const planDir = join(tmp, ".megapowers", "plans", issueSlug);
    mkdirSync(planDir, { recursive: true });
    writeFileSync(join(planDir, "plan.md"), "### Task 1: First task\n\n### Task 2: Second task\n");

    const gate: GateConfig = { type: "allTasksComplete" };
    const state = makeState({ phase: "implement", completedTasks: [1] });
    const result = evaluateGate(gate, state, store, tmp);
    expect(result.pass).toBe(false);
    expect(result.message).toContain("incomplete");
  });

  it("passes when all tasks are complete", () => {
    const store = createStore(tmp);
    const issueSlug = "001-test";
    const planDir = join(tmp, ".megapowers", "plans", issueSlug);
    mkdirSync(planDir, { recursive: true });
    writeFileSync(join(planDir, "plan.md"), "### Task 1: First task\n\n### Task 2: Second task\n");

    const gate: GateConfig = { type: "allTasksComplete" };
    const state = makeState({ phase: "implement", completedTasks: [1, 2] });
    const result = evaluateGate(gate, state, store, tmp);
    expect(result.pass).toBe(true);
  });

  it("fails when no tasks found", () => {
    const store = createStore(tmp);
    const gate: GateConfig = { type: "allTasksComplete" };
    const state = makeState({ phase: "implement" });
    const result = evaluateGate(gate, state, store, tmp);
    expect(result.pass).toBe(false);
    expect(result.message).toContain("No plan tasks");
  });
});
```

**Step 2 — Run test, verify it fails**
Run: `cd /Users/maxwellnewman/pi/workspace/pi-megapowers && bun test tests/gate-evaluator.test.ts`
Expected: FAIL — throws "Unknown gate type: allTasksComplete"

**Step 3 — Write minimal implementation**

Add import: `import { deriveTasks } from "../state/derived.js";`

Add case to the `switch` in `evaluateGate`:

```ts
    case "allTasksComplete": {
      if (!state.activeIssue || !cwd) return { pass: false, message: "No active issue or cwd" };
      const tasks = deriveTasks(cwd, state.activeIssue);
      if (tasks.length === 0) {
        return { pass: false, message: "No plan tasks found. Was the plan parsed correctly?" };
      }
      const completedSet = new Set(state.completedTasks);
      const incomplete = tasks.filter(t => !completedSet.has(t.index));
      if (incomplete.length > 0) {
        return { pass: false, message: `${incomplete.length} of ${tasks.length} tasks still incomplete.` };
      }
      return { pass: true };
    }
```

**Step 4 — Run test, verify it passes**
Run: `cd /Users/maxwellnewman/pi/workspace/pi-megapowers && bun test tests/gate-evaluator.test.ts`
Expected: PASS

**Step 5 — Verify no regressions**
Run: `cd /Users/maxwellnewman/pi/workspace/pi-megapowers && bun test`
Expected: Only the same 3 pre-existing failures; no additional failures.

---

### Task 6: Implement gate evaluator — alwaysPass gate [depends: 2]

**Files:**
- Modify: `extensions/megapowers/workflows/gate-evaluator.ts`
- Modify: `tests/gate-evaluator.test.ts`

**Step 1 — Write the failing test**

Add to `tests/gate-evaluator.test.ts`:

```ts
describe("evaluateGate — alwaysPass", () => {
  it("always returns pass: true", () => {
    const store = createStore(tmp);
    const gate: GateConfig = { type: "alwaysPass" };
    const result = evaluateGate(gate, makeState(), store, tmp);
    expect(result.pass).toBe(true);
    expect(result.message).toBeUndefined();
  });
});
```

**Step 2 — Run test, verify it fails**
Run: `cd /Users/maxwellnewman/pi/workspace/pi-megapowers && bun test tests/gate-evaluator.test.ts`
Expected: FAIL — throws "Unknown gate type: alwaysPass" (because the default branch in `evaluateGate` throws for unhandled types, as implemented in Task 2)

**Step 3 — Write minimal implementation**

Add case to the `switch` in `evaluateGate` (before the `default`):

```ts
    case "alwaysPass":
      return { pass: true };
```

**Step 4 — Run test, verify it passes**
Run: `cd /Users/maxwellnewman/pi/workspace/pi-megapowers && bun test tests/gate-evaluator.test.ts`
Expected: PASS

**Step 5 — Verify no regressions**
Run: `cd /Users/maxwellnewman/pi/workspace/pi-megapowers && bun test`
Expected: Only the same 3 pre-existing failures; no additional failures.

---

### Task 7: Implement gate evaluator — custom gate [depends: 2]

**Files:**
- Modify: `extensions/megapowers/workflows/gate-evaluator.ts`
- Modify: `tests/gate-evaluator.test.ts`

**Step 1 — Write the failing test**

Add to `tests/gate-evaluator.test.ts`:

```ts
describe("evaluateGate — custom", () => {
  it("delegates to the custom function and returns its result", () => {
    const store = createStore(tmp);
    const gate: GateConfig = {
      type: "custom",
      evaluate: (_state, _store, _cwd) => ({ pass: false, message: "Custom gate says no" }),
    };
    const result = evaluateGate(gate, makeState(), store, tmp);
    expect(result.pass).toBe(false);
    expect(result.message).toBe("Custom gate says no");
  });

  it("passes when custom function returns pass: true", () => {
    const store = createStore(tmp);
    const gate: GateConfig = {
      type: "custom",
      evaluate: () => ({ pass: true }),
    };
    const result = evaluateGate(gate, makeState(), store, tmp);
    expect(result.pass).toBe(true);
  });
});
```

**Step 2 — Run test, verify it fails**
Run: `cd /Users/maxwellnewman/pi/workspace/pi-megapowers && bun test tests/gate-evaluator.test.ts`
Expected: FAIL — throws "Unknown gate type: custom"

**Step 3 — Write minimal implementation**

Add case to the `switch` in `evaluateGate`:

```ts
    case "custom":
      return gate.evaluate(state, store, cwd);
```

**Step 4 — Run test, verify it passes**
Run: `cd /Users/maxwellnewman/pi/workspace/pi-megapowers && bun test tests/gate-evaluator.test.ts`
Expected: PASS

**Step 5 — Verify no regressions**
Run: `cd /Users/maxwellnewman/pi/workspace/pi-megapowers && bun test`
Expected: Only the same 3 pre-existing failures; no additional failures.

---

### Task 8: Define feature workflow config [depends: 1]

**Files:**
- Create: `extensions/megapowers/workflows/feature.ts`
- Create: `tests/workflow-configs.test.ts`

**Step 1 — Write the failing test**

```ts
// tests/workflow-configs.test.ts
import { describe, it, expect } from "bun:test";
import { featureWorkflow } from "../extensions/megapowers/workflows/feature.js";

describe("feature workflow config", () => {
  it("has name 'feature'", () => {
    expect(featureWorkflow.name).toBe("feature");
  });

  it("has 8 phases in correct order", () => {
    const phaseNames = featureWorkflow.phases.map(p => p.name);
    expect(phaseNames).toEqual(["brainstorm", "spec", "plan", "review", "implement", "verify", "code-review", "done"]);
  });

  it("has brainstorm → spec transition with alwaysPass gate", () => {
    const t = featureWorkflow.transitions.find(t => t.from === "brainstorm" && t.to === "spec");
    expect(t).toBeDefined();
    expect(t!.gates).toEqual([{ type: "alwaysPass" }]);
  });

  it("has spec → plan transition with requireArtifact and noOpenQuestions gates", () => {
    const t = featureWorkflow.transitions.find(t => t.from === "spec" && t.to === "plan");
    expect(t).toBeDefined();
    expect(t!.gates).toEqual([
      { type: "requireArtifact", file: "spec.md" },
      { type: "noOpenQuestions", file: "spec.md" },
    ]);
  });

  it("has plan → review transition with requireArtifact gate", () => {
    const t = featureWorkflow.transitions.find(t => t.from === "plan" && t.to === "review");
    expect(t).toBeDefined();
    expect(t!.gates).toEqual([{ type: "requireArtifact", file: "plan.md" }]);
  });

  it("has plan → implement transition with requireArtifact gate", () => {
    const t = featureWorkflow.transitions.find(t => t.from === "plan" && t.to === "implement");
    expect(t).toBeDefined();
    expect(t!.gates).toEqual([{ type: "requireArtifact", file: "plan.md" }]);
  });

  it("has review → implement transition with requireReviewApproved gate", () => {
    const t = featureWorkflow.transitions.find(t => t.from === "review" && t.to === "implement");
    expect(t).toBeDefined();
    expect(t!.gates).toEqual([{ type: "requireReviewApproved" }]);
  });

  it("has review → plan as backward transition", () => {
    const t = featureWorkflow.transitions.find(t => t.from === "review" && t.to === "plan");
    expect(t).toBeDefined();
    expect(t!.backward).toBe(true);
  });

  it("has implement → verify transition with allTasksComplete gate", () => {
    const t = featureWorkflow.transitions.find(t => t.from === "implement" && t.to === "verify");
    expect(t).toBeDefined();
    expect(t!.gates).toEqual([{ type: "allTasksComplete" }]);
  });

  it("has verify → code-review transition with requireArtifact gate", () => {
    const t = featureWorkflow.transitions.find(t => t.from === "verify" && t.to === "code-review");
    expect(t).toBeDefined();
    expect(t!.gates).toEqual([{ type: "requireArtifact", file: "verify.md" }]);
  });

  it("has verify → implement as backward transition", () => {
    const t = featureWorkflow.transitions.find(t => t.from === "verify" && t.to === "implement");
    expect(t).toBeDefined();
    expect(t!.backward).toBe(true);
  });

  it("has code-review → done transition with requireArtifact gate", () => {
    const t = featureWorkflow.transitions.find(t => t.from === "code-review" && t.to === "done");
    expect(t).toBeDefined();
    expect(t!.gates).toEqual([{ type: "requireArtifact", file: "code-review.md" }]);
  });

  it("has code-review → implement as backward transition", () => {
    const t = featureWorkflow.transitions.find(t => t.from === "code-review" && t.to === "implement");
    expect(t).toBeDefined();
    expect(t!.backward).toBe(true);
  });

  it("marks brainstorm as open-ended", () => {
    const p = featureWorkflow.phases.find(p => p.name === "brainstorm");
    expect(p!.openEnded).toBe(true);
  });

  it("marks implement as TDD phase", () => {
    const p = featureWorkflow.phases.find(p => p.name === "implement");
    expect(p!.tdd).toBe(true);
  });

  it("marks code-review as TDD phase", () => {
    const p = featureWorkflow.phases.find(p => p.name === "code-review");
    expect(p!.tdd).toBe(true);
  });

  it("marks blocking phases correctly", () => {
    const blockingPhases = featureWorkflow.phases.filter(p => p.blocking).map(p => p.name);
    expect(blockingPhases).toEqual(expect.arrayContaining(["brainstorm", "spec", "plan", "review", "verify", "done"]));
  });

  it("marks review phase with needsReviewApproval", () => {
    const p = featureWorkflow.phases.find(p => p.name === "review");
    expect(p!.needsReviewApproval).toBe(true);
  });

  it("declares artifact on brainstorm phase", () => {
    const p = featureWorkflow.phases.find(p => p.name === "brainstorm");
    expect(p!.artifact).toBe("brainstorm.md");
  });

  it("has no phaseAliases", () => {
    expect(featureWorkflow.phaseAliases).toBeUndefined();
  });
});
```

**Step 2 — Run test, verify it fails**
Run: `cd /Users/maxwellnewman/pi/workspace/pi-megapowers && bun test tests/workflow-configs.test.ts`
Expected: FAIL — module not found

**Step 3 — Write minimal implementation**

```ts
// extensions/megapowers/workflows/feature.ts
import type { WorkflowConfig } from "./types.js";

export const featureWorkflow: WorkflowConfig = {
  name: "feature",
  phases: [
    { name: "brainstorm", artifact: "brainstorm.md", openEnded: true, blocking: true, promptTemplate: "brainstorm.md", guidance: "Send a message to brainstorm your idea." },
    { name: "spec", artifact: "spec.md", blocking: true, promptTemplate: "write-spec.md", guidance: "Send a message to write the spec." },
    { name: "plan", artifact: "plan.md", blocking: true, promptTemplate: "write-plan.md", guidance: "Send a message to generate the plan." },
    { name: "review", needsReviewApproval: true, blocking: true, promptTemplate: "review-plan.md", guidance: "Send a message to review the plan." },
    { name: "implement", tdd: true, promptTemplate: "implement-task.md" },
    { name: "verify", artifact: "verify.md", blocking: true, promptTemplate: "verify.md", guidance: "Send a message to verify the implementation." },
    { name: "code-review", artifact: "code-review.md", tdd: true, promptTemplate: "code-review.md", guidance: "Send a message to review the code." },
    { name: "done", blocking: true },
  ],
  transitions: [
    { from: "brainstorm", to: "spec", gates: [{ type: "alwaysPass" }] },
    { from: "spec", to: "plan", gates: [{ type: "requireArtifact", file: "spec.md" }, { type: "noOpenQuestions", file: "spec.md" }] },
    { from: "plan", to: "review", gates: [{ type: "requireArtifact", file: "plan.md" }] },
    { from: "plan", to: "implement", gates: [{ type: "requireArtifact", file: "plan.md" }] },
    { from: "review", to: "implement", gates: [{ type: "requireReviewApproved" }] },
    { from: "review", to: "plan", gates: [], backward: true },
    { from: "implement", to: "verify", gates: [{ type: "allTasksComplete" }] },
    { from: "verify", to: "code-review", gates: [{ type: "requireArtifact", file: "verify.md" }] },
    { from: "verify", to: "implement", gates: [], backward: true },
    { from: "code-review", to: "done", gates: [{ type: "requireArtifact", file: "code-review.md" }] },
    { from: "code-review", to: "implement", gates: [], backward: true },
  ],
};
```

**Step 4 — Run test, verify it passes**
Run: `cd /Users/maxwellnewman/pi/workspace/pi-megapowers && bun test tests/workflow-configs.test.ts`
Expected: PASS

**Step 5 — Verify no regressions**
Run: `cd /Users/maxwellnewman/pi/workspace/pi-megapowers && bun test`
Expected: Only the same 3 pre-existing failures; no additional failures.

---

### Task 9: Define bugfix workflow config with phaseAliases [depends: 1]

**Files:**
- Create: `extensions/megapowers/workflows/bugfix.ts`
- Modify: `tests/workflow-configs.test.ts`

**Behavioral decision (v4 change):** Current `write-policy.ts` does NOT treat `reproduce` or `diagnose` as blocking phases — only `brainstorm/spec/plan/review/verify/done` are blocking. To preserve strict behavioral equivalence (AC17), bugfix `reproduce` and `diagnose` are configured with `blocking: false` (omitted). This means source code writes remain allowed during these phases, matching current behavior. Task 14 adds a regression test to lock this decision.

**Step 1 — Write the failing test**

Add to `tests/workflow-configs.test.ts`:

```ts
import { bugfixWorkflow } from "../extensions/megapowers/workflows/bugfix.js";

describe("bugfix workflow config", () => {
  it("has name 'bugfix'", () => {
    expect(bugfixWorkflow.name).toBe("bugfix");
  });

  it("has 7 phases in correct order", () => {
    const phaseNames = bugfixWorkflow.phases.map(p => p.name);
    expect(phaseNames).toEqual(["reproduce", "diagnose", "plan", "review", "implement", "verify", "done"]);
  });

  it("has reproduce → diagnose transition with requireArtifact gate for reproduce.md", () => {
    const t = bugfixWorkflow.transitions.find(t => t.from === "reproduce" && t.to === "diagnose");
    expect(t).toBeDefined();
    expect(t!.gates).toEqual([{ type: "requireArtifact", file: "reproduce.md" }]);
  });

  it("has diagnose → plan transition with requireArtifact gate for diagnosis.md", () => {
    const t = bugfixWorkflow.transitions.find(t => t.from === "diagnose" && t.to === "plan");
    expect(t).toBeDefined();
    expect(t!.gates).toEqual([{ type: "requireArtifact", file: "diagnosis.md" }]);
  });

  it("has review → implement transition with requireReviewApproved gate", () => {
    const transitions = bugfixWorkflow.transitions.filter(t => t.from === "review");
    expect(transitions).toHaveLength(1);
    expect(transitions[0].to).toBe("implement");
    expect(transitions[0].gates).toEqual([{ type: "requireReviewApproved" }]);
  });

  it("has verify → done transition with alwaysPass", () => {
    const t = bugfixWorkflow.transitions.find(t => t.from === "verify" && t.to === "done");
    expect(t).toBeDefined();
    expect(t!.gates).toEqual([{ type: "alwaysPass" }]);
  });

  it("has phaseAliases mapping reproduce→brainstorm and diagnosis→spec", () => {
    expect(bugfixWorkflow.phaseAliases).toEqual({
      reproduce: "brainstorm",
      diagnosis: "spec",
    });
  });

  it("marks reproduce and diagnose as open-ended", () => {
    const openEnded = bugfixWorkflow.phases.filter(p => p.openEnded).map(p => p.name);
    expect(openEnded).toContain("reproduce");
    expect(openEnded).toContain("diagnose");
  });

  it("marks review phase with needsReviewApproval", () => {
    const p = bugfixWorkflow.phases.find(p => p.name === "review");
    expect(p!.needsReviewApproval).toBe(true);
  });

  it("declares artifact on reproduce phase", () => {
    const p = bugfixWorkflow.phases.find(p => p.name === "reproduce");
    expect(p!.artifact).toBe("reproduce.md");
  });

  it("declares artifact on diagnose phase", () => {
    const p = bugfixWorkflow.phases.find(p => p.name === "diagnose");
    expect(p!.artifact).toBe("diagnosis.md");
  });

  it("does NOT mark reproduce or diagnose as blocking (preserves current behavior)", () => {
    const reproduce = bugfixWorkflow.phases.find(p => p.name === "reproduce");
    const diagnose = bugfixWorkflow.phases.find(p => p.name === "diagnose");
    expect(reproduce!.blocking).toBeFalsy();
    expect(diagnose!.blocking).toBeFalsy();
  });

  it("marks plan, review, verify, done as blocking", () => {
    const blockingPhases = bugfixWorkflow.phases.filter(p => p.blocking).map(p => p.name);
    expect(blockingPhases).toEqual(expect.arrayContaining(["plan", "review", "verify", "done"]));
    expect(blockingPhases).not.toContain("reproduce");
    expect(blockingPhases).not.toContain("diagnose");
  });
});
```

**Step 2 — Run test, verify it fails**
Run: `cd /Users/maxwellnewman/pi/workspace/pi-megapowers && bun test tests/workflow-configs.test.ts`
Expected: FAIL — module not found

**Step 3 — Write minimal implementation**

```ts
// extensions/megapowers/workflows/bugfix.ts
import type { WorkflowConfig } from "./types.js";

export const bugfixWorkflow: WorkflowConfig = {
  name: "bugfix",
  phases: [
    { name: "reproduce", artifact: "reproduce.md", openEnded: true, promptTemplate: "reproduce-bug.md", guidance: "Send a message to reproduce the bug." },
    { name: "diagnose", artifact: "diagnosis.md", openEnded: true, promptTemplate: "diagnose-bug.md", guidance: "Send a message to diagnose the root cause." },
    { name: "plan", artifact: "plan.md", blocking: true, promptTemplate: "write-plan.md", guidance: "Send a message to generate the plan." },
    { name: "review", needsReviewApproval: true, blocking: true, promptTemplate: "review-plan.md", guidance: "Send a message to review the plan." },
    { name: "implement", tdd: true, promptTemplate: "implement-task.md" },
    { name: "verify", artifact: "verify.md", blocking: true, promptTemplate: "verify.md", guidance: "Send a message to verify the implementation." },
    { name: "done", blocking: true },
  ],
  transitions: [
    { from: "reproduce", to: "diagnose", gates: [{ type: "requireArtifact", file: "reproduce.md" }] },
    { from: "diagnose", to: "plan", gates: [{ type: "requireArtifact", file: "diagnosis.md" }] },
    { from: "plan", to: "review", gates: [{ type: "requireArtifact", file: "plan.md" }] },
    { from: "plan", to: "implement", gates: [{ type: "requireArtifact", file: "plan.md" }] },
    { from: "review", to: "implement", gates: [{ type: "requireReviewApproved" }] },
    { from: "implement", to: "verify", gates: [{ type: "allTasksComplete" }] },
    { from: "verify", to: "done", gates: [{ type: "alwaysPass" }] },
  ],
  phaseAliases: {
    reproduce: "brainstorm",
    diagnosis: "spec",
  },
};
```

Note: `reproduce` and `diagnose` have no `blocking` property (defaults to falsy), preserving current behavior where these phases allow source code writes.

**Step 4 — Run test, verify it passes**
Run: `cd /Users/maxwellnewman/pi/workspace/pi-megapowers && bun test tests/workflow-configs.test.ts`
Expected: PASS

**Step 5 — Verify no regressions**
Run: `cd /Users/maxwellnewman/pi/workspace/pi-megapowers && bun test`
Expected: Only the same 3 pre-existing failures; no additional failures.

---

### Task 10: Create registry with validation [depends: 8, 9]

**Files:**
- Create: `extensions/megapowers/workflows/registry.ts`
- Modify: `tests/workflow-configs.test.ts`

**Step 1 — Write the failing test**

Add to `tests/workflow-configs.test.ts`:

```ts
import { getWorkflowConfig, validateWorkflowConfig } from "../extensions/megapowers/workflows/registry.js";
import type { WorkflowConfig } from "../extensions/megapowers/workflows/types.js";

describe("workflow registry", () => {
  it("returns feature config for 'feature'", () => {
    const config = getWorkflowConfig("feature");
    expect(config.name).toBe("feature");
  });

  it("returns bugfix config for 'bugfix'", () => {
    const config = getWorkflowConfig("bugfix");
    expect(config.name).toBe("bugfix");
  });

  it("throws for unknown workflow name", () => {
    expect(() => getWorkflowConfig("unknown" as any)).toThrow("Unknown workflow");
  });
});

describe("workflow config validation", () => {
  it("rejects config with transition 'to' referencing unknown phase", () => {
    const bad: WorkflowConfig = {
      name: "feature",
      phases: [{ name: "brainstorm" }, { name: "spec" }],
      transitions: [{ from: "brainstorm", to: "nonexistent" as any, gates: [] }],
    };
    expect(() => validateWorkflowConfig(bad)).toThrow("nonexistent");
  });

  it("rejects config with transition 'from' referencing unknown phase", () => {
    const bad: WorkflowConfig = {
      name: "feature",
      phases: [{ name: "brainstorm" }, { name: "spec" }],
      transitions: [{ from: "nonexistent" as any, to: "spec", gates: [] }],
    };
    expect(() => validateWorkflowConfig(bad)).toThrow("nonexistent");
  });

  it("rejects config where non-terminal phase has no outgoing transition", () => {
    const bad: WorkflowConfig = {
      name: "feature",
      phases: [{ name: "brainstorm" }, { name: "spec" }, { name: "done" }],
      transitions: [{ from: "brainstorm", to: "spec", gates: [] }],
      // spec has no outgoing transition but is not the terminal phase
    };
    expect(() => validateWorkflowConfig(bad)).toThrow("spec");
  });

  it("accepts valid feature config", () => {
    expect(() => validateWorkflowConfig(featureWorkflow)).not.toThrow();
  });

  it("accepts valid bugfix config", () => {
    expect(() => validateWorkflowConfig(bugfixWorkflow)).not.toThrow();
  });
});
```

**Step 2 — Run test, verify it fails**
Run: `cd /Users/maxwellnewman/pi/workspace/pi-megapowers && bun test tests/workflow-configs.test.ts`
Expected: FAIL — module not found

**Step 3 — Write minimal implementation**

```ts
// extensions/megapowers/workflows/registry.ts
import type { WorkflowConfig } from "./types.js";
import type { WorkflowType } from "../state/state-machine.js";
import { featureWorkflow } from "./feature.js";
import { bugfixWorkflow } from "./bugfix.js";

export function validateWorkflowConfig(config: WorkflowConfig): void {
  const phaseNames = new Set(config.phases.map(p => p.name));

  // Check all transition references point to valid phases
  for (const t of config.transitions) {
    if (!phaseNames.has(t.from)) {
      throw new Error(`Transition references unknown 'from' phase: ${t.from}`);
    }
    if (!phaseNames.has(t.to)) {
      throw new Error(`Transition references unknown 'to' phase: ${t.to}`);
    }
  }

  // Check every non-terminal phase has at least one outgoing transition
  const terminal = config.phases[config.phases.length - 1].name; // last phase is terminal
  const phasesWithOutgoing = new Set(config.transitions.map(t => t.from));
  for (const phase of config.phases) {
    if (phase.name !== terminal && !phasesWithOutgoing.has(phase.name)) {
      throw new Error(`Phase '${phase.name}' has no outgoing transition but is not the terminal phase`);
    }
  }
}

// Validate at registration time (AC16)
validateWorkflowConfig(featureWorkflow);
validateWorkflowConfig(bugfixWorkflow);

const REGISTRY: Record<string, WorkflowConfig> = {
  feature: featureWorkflow,
  bugfix: bugfixWorkflow,
};

export function getWorkflowConfig(name: WorkflowType): WorkflowConfig {
  const config = REGISTRY[name];
  if (!config) {
    throw new Error(`Unknown workflow: ${name}`);
  }
  return config;
}

/** Get all registered workflow configs (for building derived data like phase sets). */
export function getAllWorkflowConfigs(): WorkflowConfig[] {
  return Object.values(REGISTRY);
}
```

**Step 4 — Run test, verify it passes**
Run: `cd /Users/maxwellnewman/pi/workspace/pi-megapowers && bun test tests/workflow-configs.test.ts`
Expected: PASS

**Step 5 — Verify no regressions**
Run: `cd /Users/maxwellnewman/pi/workspace/pi-megapowers && bun test`
Expected: Only the same 3 pre-existing failures; no additional failures.

---

### Task 11: Derive tool instructions from phase config [depends: 8, 9]

**Files:**
- Create: `extensions/megapowers/workflows/tool-instructions.ts`
- Modify: `tests/workflow-configs.test.ts`

**Step 1 — Write the failing test**

Add to `tests/workflow-configs.test.ts`:

```ts
import { deriveToolInstructions, type DeriveOptions } from "../extensions/megapowers/workflows/tool-instructions.js";

describe("deriveToolInstructions", () => {
  it("returns save_artifact + phase_next for phase with artifact (spec)", () => {
    const phase = featureWorkflow.phases.find(p => p.name === "spec")!;
    const instructions = deriveToolInstructions(phase);
    expect(instructions).toContain("megapowers_save_artifact");
    expect(instructions).toContain('"spec"');
    expect(instructions).toContain("phase_next");
  });

  it("derives save phase name from artifact filename base, not phase name", () => {
    // diagnose phase has artifact "diagnosis.md" — save phase should be "diagnosis", not "diagnose"
    const phase = bugfixWorkflow.phases.find(p => p.name === "diagnose")!;
    const instructions = deriveToolInstructions(phase);
    expect(instructions).toContain("megapowers_save_artifact");
    expect(instructions).toContain('"diagnosis"');
    expect(instructions).not.toContain('"diagnose"');
  });

  it("returns TDD instructions for implement phase (tdd, no artifact)", () => {
    const phase = featureWorkflow.phases.find(p => p.name === "implement")!;
    const instructions = deriveToolInstructions(phase);
    expect(instructions).toContain("task_done");
    expect(instructions).toContain("test");
  });

  it("returns review_approve for review phase (needsReviewApproval)", () => {
    const phase = featureWorkflow.phases.find(p => p.name === "review")!;
    const instructions = deriveToolInstructions(phase);
    expect(instructions).toContain("review_approve");
  });

  it("returns save_artifact + phase_next for brainstorm (has artifact, open-ended)", () => {
    const phase = featureWorkflow.phases.find(p => p.name === "brainstorm")!;
    const instructions = deriveToolInstructions(phase);
    expect(instructions).toContain("megapowers_save_artifact");
    expect(instructions).toContain('"brainstorm"');
    expect(instructions).toContain("phase_next");
  });

  it("returns save_artifact guidance for terminal phase (done)", () => {
    const phase = featureWorkflow.phases.find(p => p.name === "done")!;
    const instructions = deriveToolInstructions(phase, { isTerminal: true });
    expect(instructions).toContain("megapowers_save_artifact");
    expect(instructions).not.toContain("phase_next");
  });

  it("returns save_artifact + phase_next for reproduce phase (has artifact)", () => {
    const phase = bugfixWorkflow.phases.find(p => p.name === "reproduce")!;
    const instructions = deriveToolInstructions(phase);
    expect(instructions).toContain("megapowers_save_artifact");
    expect(instructions).toContain('"reproduce"');
    expect(instructions).toContain("phase_next");
  });

  it("returns save_artifact + phase_next for code-review phase (artifact + tdd)", () => {
    const phase = featureWorkflow.phases.find(p => p.name === "code-review")!;
    const instructions = deriveToolInstructions(phase);
    expect(instructions).toContain("megapowers_save_artifact");
    expect(instructions).toContain('"code-review"');
    expect(instructions).toContain("phase_next");
  });
});
```

**Step 2 — Run test, verify it fails**
Run: `cd /Users/maxwellnewman/pi/workspace/pi-megapowers && bun test tests/workflow-configs.test.ts`
Expected: FAIL — module not found

**Step 3 — Write minimal implementation**

```ts
// extensions/megapowers/workflows/tool-instructions.ts
import type { PhaseConfig } from "./types.js";

/**
 * Derive the save_artifact phase name from the artifact filename.
 * e.g. "diagnosis.md" → "diagnosis", "code-review.md" → "code-review"
 * This avoids the diagnose/diagnosis naming mismatch.
 */
function artifactSavePhase(artifact: string): string {
  return artifact.replace(/\.md$/, "");
}

export interface DeriveOptions {
  /** True if this is the last phase in the workflow (e.g. "done"). */
  isTerminal?: boolean;
}

/**
 * Derive phase-specific tool instructions from phase config properties.
 * No hardcoded phase names — purely driven by config flags.
 */
export function deriveToolInstructions(phase: PhaseConfig, options?: DeriveOptions): string {
  const parts: string[] = [];

  // Terminal phase (done): save artifacts but no phase_next
  if (options?.isTerminal) {
    parts.push(
      `Use \`megapowers_save_artifact\` to save any done-phase outputs (docs, changelog, learnings).`,
    );
    return parts.join("\n");
  }

  // Review phase: approval workflow
  if (phase.needsReviewApproval) {
    parts.push(
      `If the plan is acceptable, call \`megapowers_signal\` with action \`"review_approve"\` to approve it.`,
      `Then call \`megapowers_signal\` with action \`"phase_next"\` to advance to implement.`,
      `If changes are needed, explain what to fix. The user will revise and re-submit.`,
    );
    return parts.join("\n");
  }

  // TDD phase without artifact: task-driven workflow (implement)
  if (phase.tdd && !phase.artifact) {
    parts.push(
      `For each task: write tests first, run them (they must fail), then write implementation.`,
      `When a task is complete, call \`megapowers_signal\` with action \`"task_done"\`.`,
      `The system will automatically advance to the next task or to verify when all tasks are done.`,
    );
    return parts.join("\n");
  }

  // Artifact phase: save then advance (covers spec, plan, verify, code-review, reproduce, diagnose, brainstorm)
  if (phase.artifact) {
    const savePhase = artifactSavePhase(phase.artifact);
    parts.push(
      `When the ${phase.name} is complete, call \`megapowers_save_artifact\` with phase \`"${savePhase}"\` and the full content.`,
      `Then call \`megapowers_signal\` with action \`"phase_next"\` to advance.`,
    );
    return parts.join("\n");
  }

  // Default: just advance
  parts.push(
    `When you have finished, call \`megapowers_signal\` with action \`"phase_next"\` to advance.`,
  );
  return parts.join("\n");
}
```

**Step 4 — Run test, verify it passes**
Run: `cd /Users/maxwellnewman/pi/workspace/pi-megapowers && bun test tests/workflow-configs.test.ts`
Expected: PASS

**Step 5 — Verify no regressions**
Run: `cd /Users/maxwellnewman/pi/workspace/pi-megapowers && bun test`
Expected: Only the same 3 pre-existing failures; no additional failures.

---

### Task 12: Refactor state-machine.ts to use workflow config [depends: 10]

**Files:**
- Modify: `extensions/megapowers/state/state-machine.ts`
- Test: `tests/state-machine.test.ts` (existing — no changes, acts as regression)

**Step 1 — Write the failing test**

No new test — the existing `tests/state-machine.test.ts` (60+ tests) validates all transition behavior. The refactor must keep these green.

**Step 2 — Run test, verify baseline**
Run: `cd /Users/maxwellnewman/pi/workspace/pi-megapowers && bun test tests/state-machine.test.ts`
Expected: PASS (all existing tests)

**Step 3 — Write minimal implementation**

In `extensions/megapowers/state/state-machine.ts`:

1. Add import:
```ts
import { getWorkflowConfig, getAllWorkflowConfigs } from "../workflows/registry.js";
```

2. Remove `FEATURE_TRANSITIONS` and `BUGFIX_TRANSITIONS` constants entirely.

3. Replace `OPEN_ENDED_PHASES` with a config-derived set:
```ts
/**
 * Open-ended phases suppress automatic phase-transition prompts after every message.
 * Derived from all registered workflow configs.
 */
export const OPEN_ENDED_PHASES: ReadonlySet<Phase> = new Set(
  getAllWorkflowConfigs().flatMap(c => c.phases.filter(p => p.openEnded).map(p => p.name))
);
```

4. Replace `getFirstPhase`:
```ts
export function getFirstPhase(workflow: WorkflowType): Phase {
  const config = getWorkflowConfig(workflow);
  return config.phases[0].name;
}
```

5. Replace `getValidTransitions`:
```ts
export function getValidTransitions(workflow: WorkflowType | null, phase: Phase): Phase[] {
  if (!workflow) return [];
  const config = getWorkflowConfig(workflow);
  return config.transitions.filter(t => t.from === phase).map(t => t.to);
}
```

Keep `canTransition`, `transition`, and `createInitialState` unchanged — they all use `getValidTransitions` internally.

**Step 4 — Run test, verify it passes**
Run: `cd /Users/maxwellnewman/pi/workspace/pi-megapowers && bun test tests/state-machine.test.ts`
Expected: PASS — all existing tests still green

**Step 5 — Verify no regressions**
Run: `cd /Users/maxwellnewman/pi/workspace/pi-megapowers && bun test`
Expected: Only the same 3 pre-existing failures; no additional failures.

---

### Task 13: Refactor gates.ts to use gate evaluator + workflow config [depends: 7, 10, 12]

**Files:**
- Modify: `extensions/megapowers/policy/gates.ts`
- Test: `tests/gates.test.ts` (existing — no changes, acts as regression)

**Step 1 — Write the failing test**

No new test — existing `tests/gates.test.ts` (30+ tests) validates all gate behavior.

**Step 2 — Run test, verify baseline**
Run: `cd /Users/maxwellnewman/pi/workspace/pi-megapowers && bun test tests/gates.test.ts`
Expected: PASS

**Step 3 — Write minimal implementation**

Rewrite `extensions/megapowers/policy/gates.ts` to use the workflow config and gate evaluator:

```ts
// extensions/megapowers/policy/gates.ts
import type { MegapowersState, Phase } from "../state/state-machine.js";
import type { Store } from "../state/store.js";
import { getWorkflowConfig } from "../workflows/registry.js";
import { evaluateGate } from "../workflows/gate-evaluator.js";

export interface GateResult {
  pass: boolean;
  reason?: string;
}

export function checkGate(state: MegapowersState, target: Phase, store: Store, cwd?: string): GateResult {
  const from = state.phase;
  if (!from || !state.activeIssue || !state.workflow) {
    return { pass: false, reason: "No active phase or issue" };
  }

  const config = getWorkflowConfig(state.workflow);
  const transition = config.transitions.find(t => t.from === from && t.to === target);

  if (!transition) {
    return { pass: false, reason: `No transition from ${from} to ${target}` };
  }

  // Backward transitions skip gates
  if (transition.backward) {
    return { pass: true };
  }

  // Evaluate all gates — first failure stops
  for (const gate of transition.gates) {
    const result = evaluateGate(gate, state, store, cwd);
    if (!result.pass) {
      return { pass: false, reason: result.message };
    }
  }

  return { pass: true };
}
```

Remove old imports (`hasOpenQuestions`, `deriveTasks`) and the `BACKWARD_TARGETS` / `isBackward` helper.

**Step 4 — Run test, verify it passes**
Run: `cd /Users/maxwellnewman/pi/workspace/pi-megapowers && bun test tests/gates.test.ts`
Expected: PASS

**Step 5 — Verify no regressions**
Run: `cd /Users/maxwellnewman/pi/workspace/pi-megapowers && bun test`
Expected: Only the same 3 pre-existing failures; no additional failures.

---

### Task 14: Refactor write-policy.ts to use workflow config [depends: 10, 9]

**Files:**
- Modify: `extensions/megapowers/policy/write-policy.ts`
- Modify: `tests/tool-overrides.test.ts` (add regression test for bugfix phases)
- Test: `tests/tool-overrides.test.ts` (existing + new)

**Step 1 — Write the failing test**

Add a new regression test to `tests/tool-overrides.test.ts` to lock the write-policy behavior for bugfix `reproduce` and `diagnose` phases. Find the test file's existing describe block for write policy and add:

```ts
  describe("bugfix reproduce/diagnose write policy (behavioral equivalence)", () => {
    it("allows source code writes during reproduce phase", () => {
      const result = canWrite("reproduce", "src/app.ts", true, false, null);
      expect(result.allowed).toBe(true);
    });

    it("allows source code writes during diagnose phase", () => {
      const result = canWrite("diagnose", "src/app.ts", true, false, null);
      expect(result.allowed).toBe(true);
    });
  });
```

**Step 2 — Run test, verify it passes with current code (baseline)**
Run: `cd /Users/maxwellnewman/pi/workspace/pi-megapowers && bun test tests/tool-overrides.test.ts`
Expected: PASS — tests pass against the current hardcoded write-policy (reproduce/diagnose are not in BLOCKING_PHASES, so they fall through to `return { allowed: true }`)

**Step 3 — Write minimal implementation**

In `extensions/megapowers/policy/write-policy.ts`, replace the hardcoded `BLOCKING_PHASES` and `TDD_PHASES` sets with config-derived versions:

1. Add import:
```ts
import { getAllWorkflowConfigs } from "../workflows/registry.js";
```

2. Replace the constants:
```ts
/** Phases where source code writes are completely blocked (only .megapowers/ allowed). */
const BLOCKING_PHASES: ReadonlySet<string> = new Set(
  getAllWorkflowConfigs().flatMap(c => c.phases.filter(p => p.blocking).map(p => p.name))
);

/** Phases where writes require TDD gating (tests before production code). */
const TDD_PHASES: ReadonlySet<string> = new Set(
  getAllWorkflowConfigs().flatMap(c => c.phases.filter(p => p.tdd).map(p => p.name))
);
```

Keep the rest of `canWrite` unchanged.

**Step 4 — Run test, verify it passes**
Run: `cd /Users/maxwellnewman/pi/workspace/pi-megapowers && bun test tests/tool-overrides.test.ts`
Expected: PASS — all existing tests plus the new regression tests pass. `reproduce` and `diagnose` are NOT in BLOCKING_PHASES (since their config has no `blocking: true`), so source writes are allowed.

**Step 5 — Verify no regressions**
Run: `cd /Users/maxwellnewman/pi/workspace/pi-megapowers && bun test`
Expected: Only the same 3 pre-existing failures; no additional failures.

---

### Task 15: Refactor prompt-inject.ts and derived.ts to use workflow config [depends: 10, 11]

**Files:**
- Modify: `extensions/megapowers/prompt-inject.ts`
- Modify: `extensions/megapowers/state/derived.ts`
- Test: `tests/prompt-inject.test.ts` (existing — no changes, acts as regression)
- Test: `tests/derived.test.ts` (existing — no changes, acts as regression)

**Step 1 — Write the failing test**

No new test — existing tests validate prompt injection and derived data behavior.

**Step 2 — Run test, verify baseline**
Run: `cd /Users/maxwellnewman/pi/workspace/pi-megapowers && bun test tests/prompt-inject.test.ts tests/derived.test.ts`
Expected: PASS

**Step 3 — Write minimal implementation**

**A. In `extensions/megapowers/state/derived.ts`:**

Replace the hardcoded bugfix filename selection with config-driven logic:

Add import:
```ts
import { getWorkflowConfig } from "../workflows/registry.js";
```

Replace the `deriveAcceptanceCriteria` function:
```ts
export function deriveAcceptanceCriteria(
  cwd: string,
  issueSlug: string,
  workflow: WorkflowType,
): AcceptanceCriterion[] {
  const config = getWorkflowConfig(workflow);
  // If "diagnosis" is aliased to "spec", use diagnosis.md with Fixed When extraction
  const usesDiagnosisAlias = config.phaseAliases?.["diagnosis"] === "spec";
  const filename = usesDiagnosisAlias ? "diagnosis.md" : "spec.md";
  const filePath = join(cwd, ".megapowers", "plans", issueSlug, filename);
  if (!existsSync(filePath)) return [];
  const content = readFileSync(filePath, "utf-8");
  return usesDiagnosisAlias
    ? extractFixedWhenCriteria(content)
    : extractAcceptanceCriteria(content);
}
```

**B. In `extensions/megapowers/prompt-inject.ts`:**

Add imports:
```ts
import { getWorkflowConfig } from "./workflows/registry.js";
import { deriveToolInstructions } from "./workflows/tool-instructions.js";
```

Replace the hardcoded `artifactMap` block and bugfix aliasing block with config-driven artifact loading. Find the block:
```ts
    const artifactMap: Record<string, string> = {
      "brainstorm.md": "brainstorm_content",
      ...
    };
    for (const [file, varName] of Object.entries(artifactMap)) {
      ...
    }

    // Bugfix aliasing: reproduce → brainstorm_content, diagnosis → spec_content
    if (state.workflow === "bugfix") {
      ...
    }
```

Replace it with:
```ts
    // Load artifacts from workflow config phases (config-driven, not hardcoded)
    if (state.workflow) {
      const config = getWorkflowConfig(state.workflow);

      // Load artifacts declared in phase configs
      for (const phase of config.phases) {
        if (phase.artifact) {
          const content = store.readPlanFile(state.activeIssue, phase.artifact);
          if (content) {
            const varName = phase.artifact.replace(/\.md$/, "").replace(/-/g, "_") + "_content";
            vars[varName] = content;
          }
        }
      }

      // Apply phase aliases: populate aliased variable names
      // e.g. reproduce.md → brainstorm_content, diagnosis.md → spec_content
      if (config.phaseAliases) {
        for (const [aliasName, canonicalName] of Object.entries(config.phaseAliases)) {
          // Find the phase or artifact with this alias name
          const aliasPhase = config.phases.find(p => p.name === aliasName);
          const artifactFile = aliasPhase?.artifact ?? `${aliasName}.md`;
          const content = store.readPlanFile(state.activeIssue, artifactFile);
          if (content) {
            // Set both the alias and canonical variable names
            const aliasVar = aliasName.replace(/-/g, "_") + "_content";
            const canonicalVar = canonicalName.replace(/-/g, "_") + "_content";
            vars[aliasVar] = content;
            vars[canonicalVar] = content;
          }
        }
      }
    }
```

Note: For feature workflows (no aliases), this loads `brainstorm.md → brainstorm_content`, `spec.md → spec_content`, etc. For bugfix workflows, it loads `reproduce.md → reproduce_content` and then the alias mapping sets `brainstorm_content = reproduce_content` and `spec_content = diagnosis_content`, matching current behavior.

Replace the `PHASE_TOOL_INSTRUCTIONS` constant and its lookup. Remove the entire `PHASE_TOOL_INSTRUCTIONS` constant definition (lines 18-62 approximately).

Replace:
```ts
  // Phase-specific tool instructions (AC42)
  const toolInstructions = PHASE_TOOL_INSTRUCTIONS[state.phase];
  if (toolInstructions) parts.push(toolInstructions.trim());
```

With:
```ts
  // Phase-specific tool instructions derived from config (AC42)
  if (state.workflow && state.phase) {
    const config = getWorkflowConfig(state.workflow);
    const phaseConfig = config.phases.find(p => p.name === state.phase);
    if (phaseConfig) {
      const isTerminal = config.phases[config.phases.length - 1].name === state.phase;
      const toolInstructions = deriveToolInstructions(phaseConfig, { isTerminal });
      if (toolInstructions) parts.push(toolInstructions.trim());
    }
  }
```

The `done` phase is handled as a terminal phase: `deriveToolInstructions` receives `{ isTerminal: true }` and returns `save_artifact` guidance (matching current behavior) instead of a generic `phase_next` message. The `isTerminal` flag is derived from the workflow config (last phase in the phases array).

**Step 4 — Run test, verify it passes**
Run: `cd /Users/maxwellnewman/pi/workspace/pi-megapowers && bun test tests/prompt-inject.test.ts tests/derived.test.ts`
Expected: PASS

**Step 5 — Verify no regressions**
Run: `cd /Users/maxwellnewman/pi/workspace/pi-megapowers && bun test`
Expected: Only the same 3 pre-existing failures; no additional failures.

---

### Task 16: Full regression — all existing tests pass [depends: 12, 13, 14, 15]

**Files:**
- No new files — verification only

**Step 1 — Run full test suite**
Run: `cd /Users/maxwellnewman/pi/workspace/pi-megapowers && bun test`
Expected: Only the same 3 pre-existing failures (bugfix variable injection, done template `{{files_changed}}`, bugfix summary placeholders); no additional failures.

**Step 2 — Verify no new failures**
Compare output to baseline. Any failure beyond the known 3 indicates a behavioral regression from the refactor. The known failures are:
- `bugfix variable injection — done phase with generate-bugfix-summary > generate-bugfix-summary.md interpolates all 6 bugfix variables`
- `prompt templates — done phase template updates > done (generate-docs) template contains {{files_changed}} placeholder`
- `prompt templates — generate-bugfix-summary.md > bugfix summary template contains expected placeholders`

**Step 3 — Fix any regressions**
If any new failures appear, trace them to the refactored module and fix. The fix must not change test expectations — only the implementation.