# Feature Mode Implementation Plan

> **REQUIRED SUB-SKILL:** Use the executing-plans skill to implement this plan task-by-task.

**Goal:** Implement the full Feature Mode flow (brainstorm→spec→plan→review→implement→verify→code-review→done) with rich prompt templates, gate conditions, artifact routing, acceptance criteria tracking, task-by-task implementation, and done-phase wrap-up.

**Architecture:** The core platform (state machine, store, jj, UI, prompts) is already built. This plan layers Feature Mode behavior on top: extending the state machine with a code-review phase and backward transitions, adding gate condition enforcement, replacing stub prompts with rich guided templates, building a spec parser for acceptance criteria extraction, enhancing artifact capture in the agent_end handler, implementing the task-by-task implement phase flow, and adding the done-phase wrap-up menu. Pure logic is tested with `bun test`; extension wiring is tested manually.

**Tech Stack:** TypeScript, pi extension API (`@mariozechner/pi-coding-agent`), `bun` (runtime + test runner)

**Reference docs:**
- Feature Mode design: `docs/plans/2026-02-18-02-feature-mode-design.md`
- Architecture: `docs/plans/2026-02-18-architecture.md`
- Core platform design: `docs/plans/2026-02-18-01-core-platform.md`
- Core platform impl: `docs/plans/2026-02-18-01-core-platform.impl.md`
- pi extensions: `/opt/homebrew/lib/node_modules/@mariozechner/pi-coding-agent/docs/extensions.md`

**Existing code to modify:**
- `extensions/megapowers/state-machine.ts` — phase types, transitions
- `extensions/megapowers/store.ts` — state shape
- `extensions/megapowers/prompts.ts` — prompt loading, interpolation
- `extensions/megapowers/ui.ts` — transition UI, dashboard
- `extensions/megapowers/index.ts` — event handlers, artifact routing
- `prompts/*.md` — prompt template files

---

## Phase 1: State Machine + Data Model (Tasks 1–3)

### Task 1: State Machine — Add Code-Review Phase + Backward Transitions

Extend the state machine with the `code-review` phase for feature mode, backward transitions (review→plan, verify→implement, code-review→implement), and new state fields for acceptance criteria tracking and current task index.

**Files:**
- Modify: `extensions/megapowers/state-machine.ts`
- Modify: `tests/state-machine.test.ts`

**Step 1: Write failing tests for new transitions and state fields**

Add the following tests to `tests/state-machine.test.ts`:

```typescript
// Inside "getValidTransitions — feature mode" describe block:

it("verify can go to code-review or implement (backward)", () => {
  const ts = getValidTransitions("feature", "verify");
  expect(ts).toContain("code-review");
  expect(ts).toContain("implement");
});

it("code-review can go to done or implement (backward)", () => {
  const ts = getValidTransitions("feature", "code-review");
  expect(ts).toContain("done");
  expect(ts).toContain("implement");
});

it("review can go to implement or plan (backward)", () => {
  const ts = getValidTransitions("feature", "review");
  expect(ts).toContain("implement");
  expect(ts).toContain("plan");
});
```

Also add a new `describe` block:

```typescript
describe("createInitialState — new fields", () => {
  it("includes acceptanceCriteria and currentTaskIndex", () => {
    const state = createInitialState();
    expect(state.acceptanceCriteria).toEqual([]);
    expect(state.currentTaskIndex).toBe(0);
  });
});

describe("transition — backward transitions", () => {
  it("allows review → plan (revise)", () => {
    const state = createInitialState();
    state.workflow = "feature";
    state.phase = "review";
    state.activeIssue = "001-test";
    const next = transition(state, "plan");
    expect(next.phase).toBe("plan");
    expect(next.reviewApproved).toBe(false);
  });

  it("allows verify → implement (fix failures)", () => {
    const state = createInitialState();
    state.workflow = "feature";
    state.phase = "verify";
    state.activeIssue = "001-test";
    const next = transition(state, "implement");
    expect(next.phase).toBe("implement");
  });

  it("allows code-review → implement (fix issues)", () => {
    const state = createInitialState();
    state.workflow = "feature";
    state.phase = "code-review";
    state.activeIssue = "001-test";
    const next = transition(state, "implement");
    expect(next.phase).toBe("implement");
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `bun test tests/state-machine.test.ts`
Expected: FAIL — "code-review" not in types, verify→done doesn't include code-review, etc.

**Step 3: Update the state machine**

In `extensions/megapowers/state-machine.ts`:

1. Add `"code-review"` to the `FeaturePhase` type:

```typescript
export type FeaturePhase = "brainstorm" | "spec" | "plan" | "review" | "implement" | "verify" | "code-review" | "done";
```

2. Add `AcceptanceCriterion` type:

```typescript
export interface AcceptanceCriterion {
  id: number;
  text: string;
  status: "pending" | "pass" | "fail" | "partial";
}
```

3. Add fields to `MegapowersState`:

```typescript
export interface MegapowersState {
  version: 1;
  activeIssue: string | null;
  workflow: WorkflowType | null;
  phase: Phase | null;
  phaseHistory: PhaseTransition[];
  reviewApproved: boolean;
  planTasks: PlanTask[];
  jjChangeId: string | null;
  acceptanceCriteria: AcceptanceCriterion[];
  currentTaskIndex: number;
}
```

4. Update `createInitialState()` to include the new fields:

```typescript
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
    acceptanceCriteria: [],
    currentTaskIndex: 0,
  };
}
```

5. Update `FEATURE_TRANSITIONS`:

```typescript
const FEATURE_TRANSITIONS: Record<FeaturePhase, FeaturePhase[]> = {
  brainstorm: ["spec"],
  spec: ["plan"],
  plan: ["review", "implement"],
  review: ["implement", "plan"],
  implement: ["verify"],
  verify: ["code-review", "implement"],
  "code-review": ["done", "implement"],
  done: [],
};
```

6. Update `transition()` to reset `currentTaskIndex` when re-entering implement:

```typescript
// Inside transition(), after the reviewApproved reset:
if (to === "implement") {
  // Reset task index when entering/re-entering implement phase
  // Keep existing task completion status (tasks completed in previous pass stay completed)
  next.currentTaskIndex = next.planTasks.findIndex(t => !t.completed);
  if (next.currentTaskIndex === -1) next.currentTaskIndex = 0;
}
```

**Step 4: Run tests to verify they pass**

Run: `bun test tests/state-machine.test.ts`
Expected: All tests PASS (existing tests updated where verify→done changed to verify→code-review)

Note: The existing test `"verify can go to done"` must be updated to reflect the new transitions:

```typescript
it("verify can go to code-review or implement (backward)", () => {
  const ts = getValidTransitions("feature", "verify");
  expect(ts).toContain("code-review");
  expect(ts).toContain("implement");
  expect(ts).not.toContain("done");
});
```

**Step 5: Commit**

```bash
git add -A
git commit -m "feat: add code-review phase, backward transitions, acceptance criteria state"
```

---

### Task 2: Spec Parser — Acceptance Criteria Extraction

Parse numbered acceptance criteria from a spec markdown document into structured data. Used when spec.md is saved to populate `acceptanceCriteria` in state.

**Files:**
- Create: `extensions/megapowers/spec-parser.ts`
- Create: `tests/spec-parser.test.ts`

**Step 1: Write failing tests for spec parsing**

Create `tests/spec-parser.test.ts`:

```typescript
import { describe, it, expect } from "bun:test";
import { extractAcceptanceCriteria, type AcceptanceCriterion } from "../extensions/megapowers/spec-parser.js";

describe("extractAcceptanceCriteria", () => {
  it("extracts numbered criteria from ## Acceptance Criteria section", () => {
    const spec = `# Feature Spec

## Goal
Build the thing.

## Acceptance Criteria
1. User can create a new account with email and password
2. System validates email format before submission
3. User sees an error message when email is invalid
4. Successful registration redirects to the dashboard

## Out of Scope
- Social login
`;
    const criteria = extractAcceptanceCriteria(spec);
    expect(criteria).toHaveLength(4);
    expect(criteria[0]).toEqual({
      id: 1,
      text: "User can create a new account with email and password",
      status: "pending",
    });
    expect(criteria[3]).toEqual({
      id: 4,
      text: "Successful registration redirects to the dashboard",
      status: "pending",
    });
  });

  it("handles criteria with markdown formatting", () => {
    const spec = `## Acceptance Criteria
1. **User** can _log in_ with \`valid credentials\`
2. System returns a **JWT token** on success
`;
    const criteria = extractAcceptanceCriteria(spec);
    expect(criteria).toHaveLength(2);
    expect(criteria[0].text).toBe("**User** can _log in_ with `valid credentials`");
  });

  it("stops at the next ## heading", () => {
    const spec = `## Acceptance Criteria
1. First criterion
2. Second criterion

## Out of Scope
1. This should not be included
`;
    const criteria = extractAcceptanceCriteria(spec);
    expect(criteria).toHaveLength(2);
  });

  it("returns empty array when no Acceptance Criteria section", () => {
    const spec = `# Spec\n\nJust some text.`;
    expect(extractAcceptanceCriteria(spec)).toEqual([]);
  });

  it("returns empty array when section is empty", () => {
    const spec = `## Acceptance Criteria\n\n## Out of Scope\n- stuff`;
    expect(extractAcceptanceCriteria(spec)).toEqual([]);
  });

  it("handles criteria with multi-line continuation (ignores sub-items)", () => {
    const spec = `## Acceptance Criteria
1. First criterion
   - Detail about first
   - More detail
2. Second criterion
`;
    const criteria = extractAcceptanceCriteria(spec);
    expect(criteria).toHaveLength(2);
    expect(criteria[0].text).toBe("First criterion");
  });

  it("detects presence of Open Questions section content", () => {
    // Separate function for gate checking
  });
});

describe("hasOpenQuestions", () => {
  it("returns false when no Open Questions section", () => {
    const { hasOpenQuestions } = require("../extensions/megapowers/spec-parser.js");
    const spec = `## Goal\nBuild it.\n\n## Acceptance Criteria\n1. It works`;
    expect(hasOpenQuestions(spec)).toBe(false);
  });

  it("returns false when Open Questions section is empty", () => {
    const { hasOpenQuestions } = require("../extensions/megapowers/spec-parser.js");
    const spec = `## Acceptance Criteria\n1. It works\n\n## Open Questions\n`;
    expect(hasOpenQuestions(spec)).toBe(false);
  });

  it("returns true when Open Questions has content", () => {
    const { hasOpenQuestions } = require("../extensions/megapowers/spec-parser.js");
    const spec = `## Acceptance Criteria\n1. It works\n\n## Open Questions\n- What about edge case X?`;
    expect(hasOpenQuestions(spec)).toBe(true);
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `bun test tests/spec-parser.test.ts`
Expected: FAIL — module not found

**Step 3: Implement spec parser**

Create `extensions/megapowers/spec-parser.ts`:

```typescript
import type { AcceptanceCriterion } from "./state-machine.js";

export type { AcceptanceCriterion };

/**
 * Extract numbered acceptance criteria from a spec document.
 * Looks for content under a "## Acceptance Criteria" heading,
 * stops at the next ## heading.
 */
export function extractAcceptanceCriteria(specContent: string): AcceptanceCriterion[] {
  const lines = specContent.split("\n");
  const criteria: AcceptanceCriterion[] = [];

  let inSection = false;

  for (const line of lines) {
    // Start of Acceptance Criteria section
    if (/^##\s+Acceptance\s+Criteria/i.test(line)) {
      inSection = true;
      continue;
    }

    // End of section (next ## heading)
    if (inSection && /^##\s+/.test(line)) {
      break;
    }

    if (!inSection) continue;

    // Match numbered items: "1. Text" or "1) Text"
    const match = line.match(/^\s{0,1}(\d+)[.)]\s+(.+)/);
    if (match) {
      criteria.push({
        id: parseInt(match[1]),
        text: match[2].trim(),
        status: "pending",
      });
    }
  }

  return criteria;
}

/**
 * Check if a spec has unresolved open questions.
 * Returns true if there's an "## Open Questions" section with non-empty content.
 */
export function hasOpenQuestions(specContent: string): boolean {
  const lines = specContent.split("\n");
  let inSection = false;

  for (const line of lines) {
    if (/^##\s+Open\s+Questions/i.test(line)) {
      inSection = true;
      continue;
    }

    if (inSection && /^##\s+/.test(line)) {
      break;
    }

    if (inSection && line.trim().length > 0) {
      return true;
    }
  }

  return false;
}
```

**Step 4: Run tests to verify they pass**

Run: `bun test tests/spec-parser.test.ts`
Expected: All tests PASS

**Step 5: Commit**

```bash
git add -A
git commit -m "feat: spec parser for acceptance criteria extraction"
```

---

### Task 3: Gate Conditions Module

A pure module that checks whether a phase transition's preconditions are met — artifact existence, required structure, etc. Returns a result with pass/fail and a human-readable reason.

**Files:**
- Create: `extensions/megapowers/gates.ts`
- Create: `tests/gates.test.ts`

**Step 1: Write failing tests for gate conditions**

Create `tests/gates.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { checkGate, type GateResult } from "../extensions/megapowers/gates.js";
import { createStore } from "../extensions/megapowers/store.js";
import { createInitialState, type MegapowersState } from "../extensions/megapowers/state-machine.js";

let tmp: string;

beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), "megapowers-gate-test-"));
});

afterEach(() => {
  rmSync(tmp, { recursive: true, force: true });
});

function makeState(overrides: Partial<MegapowersState> = {}): MegapowersState {
  return {
    ...createInitialState(),
    activeIssue: "001-test",
    workflow: "feature",
    ...overrides,
  };
}

describe("brainstorm → spec", () => {
  it("always passes (brainstorm is freeform)", () => {
    const store = createStore(tmp);
    const result = checkGate(makeState({ phase: "brainstorm" }), "spec", store);
    expect(result.pass).toBe(true);
  });
});

describe("spec → plan", () => {
  it("fails when spec.md does not exist", () => {
    const store = createStore(tmp);
    const result = checkGate(makeState({ phase: "spec" }), "plan", store);
    expect(result.pass).toBe(false);
    expect(result.reason).toContain("spec.md");
  });

  it("fails when spec.md has open questions", () => {
    const store = createStore(tmp);
    store.ensurePlanDir("001-test");
    store.writePlanFile("001-test", "spec.md", "## Acceptance Criteria\n1. Works\n\n## Open Questions\n- What about X?");
    const result = checkGate(makeState({ phase: "spec" }), "plan", store);
    expect(result.pass).toBe(false);
    expect(result.reason).toContain("open questions");
  });

  it("passes when spec.md exists with no open questions", () => {
    const store = createStore(tmp);
    store.ensurePlanDir("001-test");
    store.writePlanFile("001-test", "spec.md", "## Goal\nBuild it.\n\n## Acceptance Criteria\n1. It works\n\n## Out of Scope\n- Nothing");
    const result = checkGate(makeState({ phase: "spec" }), "plan", store);
    expect(result.pass).toBe(true);
  });
});

describe("plan → review / implement", () => {
  it("fails when plan.md does not exist", () => {
    const store = createStore(tmp);
    const result = checkGate(makeState({ phase: "plan" }), "review", store);
    expect(result.pass).toBe(false);
    expect(result.reason).toContain("plan.md");
  });

  it("passes when plan.md exists", () => {
    const store = createStore(tmp);
    store.ensurePlanDir("001-test");
    store.writePlanFile("001-test", "plan.md", "### Task 1: Do thing\nDetails...");
    const result = checkGate(makeState({ phase: "plan" }), "implement", store);
    expect(result.pass).toBe(true);
  });
});

describe("review → implement", () => {
  it("fails when review not approved", () => {
    const store = createStore(tmp);
    const result = checkGate(makeState({ phase: "review", reviewApproved: false }), "implement", store);
    expect(result.pass).toBe(false);
    expect(result.reason).toContain("approved");
  });

  it("passes when review approved", () => {
    const store = createStore(tmp);
    const result = checkGate(makeState({ phase: "review", reviewApproved: true }), "implement", store);
    expect(result.pass).toBe(true);
  });
});

describe("implement → verify", () => {
  it("fails when no tasks completed", () => {
    const store = createStore(tmp);
    const state = makeState({
      phase: "implement",
      planTasks: [
        { index: 1, description: "A", completed: false },
        { index: 2, description: "B", completed: false },
      ],
    });
    const result = checkGate(state, "verify", store);
    expect(result.pass).toBe(false);
    expect(result.reason).toContain("tasks");
  });

  it("passes when all tasks completed", () => {
    const store = createStore(tmp);
    const state = makeState({
      phase: "implement",
      planTasks: [
        { index: 1, description: "A", completed: true },
        { index: 2, description: "B", completed: true },
      ],
    });
    const result = checkGate(state, "verify", store);
    expect(result.pass).toBe(true);
  });
});

describe("verify → code-review", () => {
  it("fails when verify.md does not exist", () => {
    const store = createStore(tmp);
    const result = checkGate(makeState({ phase: "verify" }), "code-review", store);
    expect(result.pass).toBe(false);
    expect(result.reason).toContain("verify.md");
  });

  it("passes when verify.md exists with pass verdict", () => {
    const store = createStore(tmp);
    store.ensurePlanDir("001-test");
    store.writePlanFile("001-test", "verify.md", "## Overall Verdict\npass\n\nAll criteria met.");
    const result = checkGate(makeState({ phase: "verify" }), "code-review", store);
    expect(result.pass).toBe(true);
  });
});

describe("code-review → done", () => {
  it("fails when code-review.md does not exist", () => {
    const store = createStore(tmp);
    const result = checkGate(makeState({ phase: "code-review" }), "done", store);
    expect(result.pass).toBe(false);
    expect(result.reason).toContain("code-review.md");
  });

  it("passes when code-review.md exists with ready assessment", () => {
    const store = createStore(tmp);
    store.ensurePlanDir("001-test");
    store.writePlanFile("001-test", "code-review.md", "## Assessment\nready\n\nNo critical issues.");
    const result = checkGate(makeState({ phase: "code-review" }), "done", store);
    expect(result.pass).toBe(true);
  });
});

describe("backward transitions pass without gates", () => {
  it("review → plan always passes", () => {
    const store = createStore(tmp);
    const result = checkGate(makeState({ phase: "review" }), "plan", store);
    expect(result.pass).toBe(true);
  });

  it("verify → implement always passes", () => {
    const store = createStore(tmp);
    const result = checkGate(makeState({ phase: "verify" }), "implement", store);
    expect(result.pass).toBe(true);
  });

  it("code-review → implement always passes", () => {
    const store = createStore(tmp);
    const result = checkGate(makeState({ phase: "code-review" }), "implement", store);
    expect(result.pass).toBe(true);
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `bun test tests/gates.test.ts`
Expected: FAIL — module not found

**Step 3: Implement gate conditions**

Create `extensions/megapowers/gates.ts`:

```typescript
import type { MegapowersState, Phase } from "./state-machine.js";
import type { Store } from "./store.js";
import { hasOpenQuestions } from "./spec-parser.js";

export interface GateResult {
  pass: boolean;
  reason?: string;
}

// Backward transitions (going to an earlier phase) have no gate conditions
const BACKWARD_TARGETS = new Set<string>([
  "review→plan",
  "verify→implement",
  "code-review→implement",
]);

function isBackward(from: Phase, to: Phase): boolean {
  return BACKWARD_TARGETS.has(`${from}→${to}`);
}

/**
 * Check whether the gate condition for transitioning from state.phase to `target` is met.
 */
export function checkGate(state: MegapowersState, target: Phase, store: Store): GateResult {
  const from = state.phase;
  if (!from || !state.activeIssue) {
    return { pass: false, reason: "No active phase or issue" };
  }

  // Backward transitions always pass
  if (isBackward(from, target)) {
    return { pass: true };
  }

  switch (`${from}→${target}`) {
    case "brainstorm→spec":
      // Brainstorm is freeform — no gate
      return { pass: true };

    case "spec→plan": {
      // spec.md must exist with no open questions
      if (!store.planFileExists(state.activeIssue, "spec.md")) {
        return { pass: false, reason: "spec.md not found. The LLM needs to produce a spec first." };
      }
      const spec = store.readPlanFile(state.activeIssue, "spec.md");
      if (spec && hasOpenQuestions(spec)) {
        return { pass: false, reason: "Spec has unresolved open questions. Resolve them before advancing." };
      }
      return { pass: true };
    }

    case "plan→review":
    case "plan→implement": {
      // plan.md must exist
      if (!store.planFileExists(state.activeIssue, "plan.md")) {
        return { pass: false, reason: "plan.md not found. The LLM needs to produce a plan first." };
      }
      return { pass: true };
    }

    case "review→implement": {
      // Review must be approved
      if (!state.reviewApproved) {
        return { pass: false, reason: "Plan review not approved yet. The LLM needs to approve the plan." };
      }
      return { pass: true };
    }

    case "implement→verify": {
      // All plan tasks must be completed
      if (state.planTasks.length === 0) {
        return { pass: false, reason: "No plan tasks found. Was the plan parsed correctly?" };
      }
      const incomplete = state.planTasks.filter(t => !t.completed);
      if (incomplete.length > 0) {
        return {
          pass: false,
          reason: `${incomplete.length} of ${state.planTasks.length} tasks still incomplete.`,
        };
      }
      return { pass: true };
    }

    case "verify→code-review": {
      // verify.md must exist
      if (!store.planFileExists(state.activeIssue, "verify.md")) {
        return { pass: false, reason: "verify.md not found. Run verification first." };
      }
      return { pass: true };
    }

    case "code-review→done": {
      // code-review.md must exist
      if (!store.planFileExists(state.activeIssue, "code-review.md")) {
        return { pass: false, reason: "code-review.md not found. Run code review first." };
      }
      return { pass: true };
    }

    default:
      // Unknown transition — no gate (let the state machine handle validity)
      return { pass: true };
  }
}
```

**Step 4: Run tests to verify they pass**

Run: `bun test tests/gates.test.ts`
Expected: All tests PASS

**Step 5: Commit**

```bash
git add -A
git commit -m "feat: gate conditions for phase transitions"
```

---

## Checkpoint: Run all tests

```bash
bun test
```

Expected: All tests across all files pass. Fix any failures before continuing.

---

## Phase 2: Prompt Templates (Tasks 4–5)

### Task 4: Rich Prompt Templates

Replace the stub prompt markdown files with detailed, guided prompts per the Feature Mode design. These are the prompts injected by the extension to scope LLM behavior in each phase.

**Files:**
- Modify: `prompts/brainstorm.md`
- Modify: `prompts/write-spec.md`
- Modify: `prompts/write-plan.md`
- Modify: `prompts/review-plan.md`
- Create: `prompts/implement-task.md`
- Create: `prompts/verify.md`
- Create: `prompts/code-review.md`
- Modify: `prompts/generate-docs.md` (rename conceptually to "done" phase)

**Step 1: Write `prompts/brainstorm.md`**

```markdown
You are brainstorming a new feature with the user. Your job is to understand what they want and help them think through the design — without writing any code.

## Context
Issue: {{issue_slug}}
{{#issue_description}}
Description: {{issue_description}}
{{/issue_description}}

## Instructions

**Read first.** Before asking questions, scan the project — key files, docs, recent commits. Understand what already exists.

**Check if it's already solved.** Does the codebase or a library already handle this? Say so before reinventing.

**Ask questions one at a time, one per message.** Break complex topics into separate questions. Prefer multiple choice when possible, open-ended when needed.

**Focus on understanding:**
- What problem does this solve? Who is it for?
- What are the constraints? (Performance, compatibility, scope)
- What does "done" look like? What are the success criteria?

**Explore 2–3 approaches with trade-offs.** Lead with your recommendation and explain why. Cover: complexity, maintainability, testability.

**Design for testability.** Favor clear boundaries that are easy to verify with TDD.

**Present design in 200–300 word sections:**
1. Architecture — how components fit together
2. Data flow — what moves where
3. Error handling — what can go wrong
4. Testing — how to verify it works

Validate each section with the user before moving to the next.

**Be flexible.** Go back and revisit earlier decisions when new information emerges.

**YAGNI ruthlessly.** If the user asks for something speculative, push back gently.

**When the design is solid**, produce a summary with these sections:

## Approach
[2-3 paragraphs describing the chosen approach]

## Key Decisions
[Bullet list of important design choices and why]

## Components
[What will be built, at a high level]

## Testing Strategy
[How this will be tested]

**Do NOT write code or edit files.** This is a read-only thinking phase.
```

**Step 2: Write `prompts/write-spec.md`**

```markdown
You are writing an executable specification. Convert the brainstorm design into a structured document with testable acceptance criteria.

## Context
Issue: {{issue_slug}}

## Brainstorm Notes
{{brainstorm_content}}

## Required Structure

Write a spec with exactly these sections:

### ## Goal
One paragraph: what is being built and why.

### ## Acceptance Criteria
Numbered list. Each criterion must be:
- **Specific and verifiable** — "user sees error message with validation failure" not "error handling works"
- **Self-contained** — understandable without reading the brainstorm notes
- **TDD-friendly** — maps naturally to a test
- **Bite-sized** — if it has "and" in it, split it into two criteria

### ## Out of Scope
Explicit boundaries. What this feature does NOT do.

### ## Open Questions
Anything unresolved. **This section must be empty to advance to planning.** If you have questions, ask the user now.

## Rules
- DRY and YAGNI — only criteria essential to the goal
- Each criterion should assume zero codebase context
- Keep it concise — spec is a contract, not a design doc
- Number criteria sequentially (1, 2, 3...)
```

**Step 3: Write `prompts/write-plan.md`**

```markdown
You are writing a step-by-step implementation plan from a spec. Each task maps 1:1 to a test. A developer with zero context about this codebase should be able to execute any task from this plan alone.

## Context
Issue: {{issue_slug}}

## Spec
{{spec_content}}

## Brainstorm Notes
{{brainstorm_content}}

## Instructions

For each task:
- Use `### Task N: Title` format
- List **exact file paths**: what to create, modify, test
- Include **complete code** — no "implement something similar" or "add validation"
- Specify the **test that verifies it** with full test code
- Follow **TDD sequence**: write test → verify it fails → implement → verify it passes
- Note **what previous tasks provide** if there are dependencies

### Task structure:

```
### Task N: [Name]

**Files:**
- Create: `exact/path/to/file.ts`
- Modify: `exact/path/to/existing.ts`
- Test: `tests/exact/path/to/test.ts`

**Test:** [Full test code]

**Implementation:** [Full implementation code]

**Verify:** [Exact command to run]
```

## Rules
- Tasks must be **independently verifiable** — if a task has "and" in it, split it
- Task order must **respect dependencies** — foundational pieces first
- **YAGNI** — no tasks for speculative features
- **DRY** — extract shared code into utilities, don't duplicate
- Each acceptance criterion from the spec should be covered by at least one task
```

**Step 4: Write `prompts/review-plan.md`**

```markdown
You are reviewing an implementation plan before it goes to implementation. Quick sanity check — not a deep audit.

## Context
Issue: {{issue_slug}}

## Spec (acceptance criteria)
{{spec_content}}

## Plan
{{plan_content}}

## Evaluate against three criteria:

### 1. Coverage
Does every acceptance criterion have at least one task addressing it? List any gaps.

### 2. Ordering
Are dependencies respected? Will task N have everything it needs from tasks 1..N-1? Flag any ordering issues.

### 3. Completeness
Are tasks self-contained enough to execute? Flag: missing file paths, vague descriptions, incomplete code.

## Produce a verdict:
- **pass** — plan is ready for implementation
- **revise** — specific tasks need adjustment. List what and why.
- **rethink** — fundamental issue (wrong approach, missing acceptance criteria). Explain what needs to change.

## Rules
- Keep feedback **actionable** — "Task 3 doesn't specify which file to modify" not "could be more detailed"
- Be specific — reference task numbers and acceptance criteria IDs
- Present findings to the user for confirmation before concluding
```

**Step 5: Write `prompts/implement-task.md`**

```markdown
You are implementing a single task from the plan. Follow strict Red-Green-Refactor TDD.

## Context
Issue: {{issue_slug}}
Phase: implement — Task {{current_task_index}} of {{total_tasks}}

## Current Task
{{current_task_description}}

## Previous Tasks Completed
{{previous_task_summaries}}

## Plan Reference
{{plan_content}}

## Strict Red-Green-Refactor:

### RED — Write one failing test
1. Write the test from the plan
2. Run it
3. Confirm it fails **for the right reason** (missing feature, not typo/import error)
4. If it passes, the test is wrong — fix it before continuing

### GREEN — Write minimal code to pass
1. Write the smallest amount of code that makes the test pass
2. Run the test — confirm it passes
3. Run **all** tests — confirm nothing else broke

### REFACTOR — Clean up
1. Remove duplication, improve names, extract helpers
2. Keep tests green throughout
3. Do NOT add behavior during refactor

## Rules
- Work on **only the current task** — don't look ahead or refactor future tasks
- **No production code without a failing test first**
- If stuck, **stop and say so** — don't guess or force through
- Do not modify code unrelated to the current task

## When done, report:
- What was implemented (1-2 sentences)
- Files changed (list)
- Test results (actual output)
```

**Step 6: Write `prompts/verify.md`**

```markdown
You are verifying whether the implementation satisfies the spec. Evidence before claims, always.

## Context
Issue: {{issue_slug}}

## Spec
{{spec_content}}

## Acceptance Criteria
{{acceptance_criteria_list}}

## Instructions

### Step 1: Run the full test suite fresh
Not from memory. Run the actual commands now and show the output.

### Step 2: For each acceptance criterion, follow the Gate Function:

1. **IDENTIFY:** What command or code inspection proves this criterion?
2. **RUN:** Execute the command (fresh, complete)
3. **READ:** Full output, check exit code
4. **VERIFY:** Does output confirm the criterion is met?
5. **ONLY THEN:** State pass or fail **with evidence** (actual output, file paths, line numbers)

### Step 3: Produce a verification report

```
## Test Suite Results
[Actual test output, pass/fail counts]

## Per-Criterion Verification

### Criterion 1: [text]
**Evidence:** [command run, output shown]
**Verdict:** pass / fail / partial

### Criterion 2: [text]
...

## Overall Verdict
pass / fail
[Summary explanation]
```

## Rules
- **Tests passing ≠ criteria met** — verify both independently
- **No weasel words** — "should pass", "looks correct", "seems to work" are NOT verification
- Only claims backed by command output
- If any criterion fails: explain what's missing and recommend going back to implement (small fix) or plan (bigger gap)
```

**Step 7: Write `prompts/code-review.md`**

```markdown
You are reviewing code quality. Verification already confirmed the feature works — now evaluate whether the code is good.

## Context
Issue: {{issue_slug}}

## Spec
{{spec_content}}

## Verify Results
{{verify_content}}

## Instructions

Review all code changes for this feature (use git diff from branch point if available, otherwise inspect changed files).

### Evaluate against:
- **Correctness** — edge cases, error handling, race conditions
- **Maintainability** — naming, duplication, complexity, readability
- **Patterns** — consistent with codebase conventions, no anti-patterns
- **YAGNI** — unused code, over-engineering, speculative abstractions
- **Test quality** — tests are meaningful (not just coverage), test edge cases, readable

### Categorize findings:
- **Critical** — must fix before merge (bugs, security, data loss)
- **Important** — should fix before merge (maintainability, readability)
- **Minor** — note for later (style nits, optional improvements)

### Produce a report:

```
## Findings

### Critical
[List or "None"]

### Important
[List or "None"]

### Minor
[List or "None"]

## Assessment
ready / needs-fixes / needs-rework
[Explanation]
```

## Rules
- **Verify suggestions against codebase reality** before making them
- Be specific — reference file paths and line numbers
- No performative agreement on future changes — fix now or note for later
- If needs-fixes: implement fixes in this session, re-run tests, update the review
- If needs-rework: recommend going back to implement or plan depending on severity
```

**Step 8: Write `prompts/generate-docs.md`** (updated for done phase)

```markdown
You are wrapping up a completed feature. Help the user finalize the work.

## Context
Issue: {{issue_slug}}

## Spec
{{spec_content}}

## Verification
{{verify_content}}

## Code Review
{{code_review_content}}

## Available Actions
The user will choose from:
- **Commit** — generate a commit message (conventional commits format)
- **Squash** — clean up commit history
- **Update docs** — generate or update documentation based on what was built
- **Changelog entry** — write a summary for release notes
- **Close issue** — mark the issue as done

## Instructions
- Keep it brief — this is housekeeping, not creative work
- Commit messages should summarize the feature, not list every file
- Documentation should be generated from the spec and verification results, not from memory
- Changelog entries should be user-facing (what changed, not how)
```

**Step 9: Run existing prompt tests to make sure nothing broke**

Run: `bun test tests/prompts.test.ts`
Expected: All tests PASS (the test checks for non-empty templates and {{spec_content}} in the plan prompt)

**Step 10: Commit**

```bash
git add -A
git commit -m "feat: rich phase-specific prompt templates for full feature mode flow"
```

---

### Task 5: Prompt Module Updates

Update `prompts.ts` to map the new phases (code-review, implement per-task), add new template variables (brainstorm_content, acceptance_criteria_list, etc.), and build phase-specific prompt context.

**Files:**
- Modify: `extensions/megapowers/prompts.ts`
- Modify: `tests/prompts.test.ts`

**Step 1: Write failing tests for new prompt functionality**

Add to `tests/prompts.test.ts`:

```typescript
import {
  getPhasePromptTemplate,
  interpolatePrompt,
  PHASE_PROMPT_MAP,
  buildImplementTaskVars,
} from "../extensions/megapowers/prompts.js";
import type { PlanTask, AcceptanceCriterion } from "../extensions/megapowers/state-machine.js";

// ... existing tests ...

describe("PHASE_PROMPT_MAP — new phases", () => {
  it("maps code-review to a prompt file", () => {
    expect(PHASE_PROMPT_MAP["code-review"]).toBeDefined();
  });

  it("uses implement-task.md for implement phase", () => {
    expect(PHASE_PROMPT_MAP["implement"]).toBe("implement-task.md");
  });

  it("uses verify.md for verify phase", () => {
    expect(PHASE_PROMPT_MAP["verify"]).toBe("verify.md");
  });
});

describe("getPhasePromptTemplate — new templates", () => {
  it("returns non-empty string for code-review", () => {
    const template = getPhasePromptTemplate("code-review");
    expect(template.length).toBeGreaterThan(0);
  });

  it("returns non-empty string for implement (implement-task.md)", () => {
    const template = getPhasePromptTemplate("implement");
    expect(template.length).toBeGreaterThan(0);
    expect(template).toContain("{{current_task_description}}");
  });

  it("returns non-empty string for verify", () => {
    const template = getPhasePromptTemplate("verify");
    expect(template.length).toBeGreaterThan(0);
    expect(template).toContain("{{acceptance_criteria_list}}");
  });
});

describe("buildImplementTaskVars", () => {
  it("builds vars for current task", () => {
    const tasks: PlanTask[] = [
      { index: 1, description: "Set up DB schema", completed: true },
      { index: 2, description: "Create API endpoint", completed: false },
      { index: 3, description: "Write integration tests", completed: false },
    ];
    const vars = buildImplementTaskVars(tasks, 1);
    expect(vars.current_task_index).toBe("2");
    expect(vars.total_tasks).toBe("3");
    expect(vars.current_task_description).toContain("Create API endpoint");
    expect(vars.previous_task_summaries).toContain("Set up DB schema");
    expect(vars.previous_task_summaries).toContain("✓");
  });

  it("handles first task with no previous", () => {
    const tasks: PlanTask[] = [
      { index: 1, description: "First task", completed: false },
    ];
    const vars = buildImplementTaskVars(tasks, 0);
    expect(vars.current_task_index).toBe("1");
    expect(vars.total_tasks).toBe("1");
    expect(vars.previous_task_summaries).toBe("None — this is the first task.");
  });
});

describe("formatAcceptanceCriteriaList", () => {
  it("formats criteria as numbered list with status", () => {
    const { formatAcceptanceCriteriaList } = require("../extensions/megapowers/prompts.js");
    const criteria: AcceptanceCriterion[] = [
      { id: 1, text: "User can register", status: "pending" },
      { id: 2, text: "Email is validated", status: "pass" },
      { id: 3, text: "Error shown on invalid", status: "fail" },
    ];
    const result = formatAcceptanceCriteriaList(criteria);
    expect(result).toContain("1. User can register [pending]");
    expect(result).toContain("2. Email is validated [pass]");
    expect(result).toContain("3. Error shown on invalid [fail]");
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `bun test tests/prompts.test.ts`
Expected: FAIL — new exports not found, new phase mappings missing

**Step 3: Update the prompts module**

In `extensions/megapowers/prompts.ts`:

1. Update `PHASE_PROMPT_MAP`:

```typescript
export const PHASE_PROMPT_MAP: Record<Phase, string> = {
  brainstorm: "brainstorm.md",
  spec: "write-spec.md",
  plan: "write-plan.md",
  review: "review-plan.md",
  implement: "implement-task.md",
  verify: "verify.md",
  "code-review": "code-review.md",
  done: "generate-docs.md",
  reproduce: "diagnose-bug.md",
  diagnose: "diagnose-bug.md",
};
```

2. Add `buildImplementTaskVars`:

```typescript
import type { PlanTask, AcceptanceCriterion } from "./state-machine.js";

export function buildImplementTaskVars(
  tasks: PlanTask[],
  currentIndex: number
): Record<string, string> {
  const currentTask = tasks[currentIndex];
  const total = tasks.length;

  // Build previous task summaries
  let previousSummaries: string;
  if (currentIndex === 0) {
    previousSummaries = "None — this is the first task.";
  } else {
    previousSummaries = tasks
      .slice(0, currentIndex)
      .map(t => {
        const status = t.completed ? "✓" : "○";
        return `${status} Task ${t.index}: ${t.description}`;
      })
      .join("\n");
  }

  return {
    current_task_index: String(currentTask?.index ?? currentIndex + 1),
    total_tasks: String(total),
    current_task_description: currentTask
      ? `Task ${currentTask.index}: ${currentTask.description}`
      : "No more tasks.",
    previous_task_summaries: previousSummaries,
  };
}

export function formatAcceptanceCriteriaList(criteria: AcceptanceCriterion[]): string {
  return criteria
    .map(c => `${c.id}. ${c.text} [${c.status}]`)
    .join("\n");
}
```

**Step 4: Run tests to verify they pass**

Run: `bun test tests/prompts.test.ts`
Expected: All tests PASS

**Step 5: Commit**

```bash
git add -A
git commit -m "feat: prompt module with implement task vars, criteria formatting, new phase mappings"
```

---

## Checkpoint: Run all tests

```bash
bun test
```

Expected: All tests pass across all files. Fix any failures before continuing.

---

## Phase 3: Extension Logic (Tasks 6–8)

### Task 6: Artifact Routing + Gate Enforcement in Extension

Update `index.ts` to:
1. Capture artifacts for all phases (brainstorm.md, verify.md, code-review.md)
2. Extract acceptance criteria when spec is saved
3. Enforce gate conditions before allowing transitions
4. Inject richer context variables (brainstorm_content, acceptance_criteria_list, verify_content, code_review_content)

**Files:**
- Modify: `extensions/megapowers/index.ts`
- Modify: `extensions/megapowers/ui.ts` (gate enforcement in transition flow)

**Step 1: Update `index.ts` imports**

Add imports for the new modules:

```typescript
import { extractAcceptanceCriteria } from "./spec-parser.js";
import { checkGate } from "./gates.js";
import { buildImplementTaskVars, formatAcceptanceCriteriaList } from "./prompts.js";
```

**Step 2: Update `before_agent_start` handler for richer context**

Replace the existing `before_agent_start` handler body. The new handler builds a richer set of template variables:

```typescript
pi.on("before_agent_start", async (_event, _ctx) => {
  if (!state.activeIssue || !state.phase) return;

  const vars: Record<string, string> = {
    issue_slug: state.activeIssue,
    phase: state.phase,
  };

  // Load artifacts
  if (store) {
    const brainstorm = store.readPlanFile(state.activeIssue, "brainstorm.md");
    if (brainstorm) vars.brainstorm_content = brainstorm;

    const spec = store.readPlanFile(state.activeIssue, "spec.md");
    if (spec) vars.spec_content = spec;

    const plan = store.readPlanFile(state.activeIssue, "plan.md");
    if (plan) vars.plan_content = plan;

    const diagnosis = store.readPlanFile(state.activeIssue, "diagnosis.md");
    if (diagnosis) vars.diagnosis_content = diagnosis;

    const verify = store.readPlanFile(state.activeIssue, "verify.md");
    if (verify) vars.verify_content = verify;

    const codeReview = store.readPlanFile(state.activeIssue, "code-review.md");
    if (codeReview) vars.code_review_content = codeReview;
  }

  // Acceptance criteria formatting
  if (state.acceptanceCriteria.length > 0) {
    vars.acceptance_criteria_list = formatAcceptanceCriteriaList(state.acceptanceCriteria);
  }

  // Implement phase: inject per-task context
  if (state.phase === "implement" && state.planTasks.length > 0) {
    const taskVars = buildImplementTaskVars(state.planTasks, state.currentTaskIndex);
    Object.assign(vars, taskVars);
  }

  const prompt = buildPhasePrompt(state.phase, vars);
  if (!prompt) return;

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
```

**Step 3: Update `agent_end` handler for full artifact capture**

Replace the phase-specific artifact capture block in the `agent_end` handler:

```typescript
pi.on("agent_end", async (event, ctx) => {
  const activeIssue = state.activeIssue;
  const phase = state.phase;
  if (!activeIssue || !phase || !store) return;

  const lastAssistant = [...event.messages].reverse().find(isAssistantMessage);
  if (!lastAssistant) return;
  const text = getAssistantText(lastAssistant);
  if (!text) return;

  // --- Artifact capture per phase ---

  if (phase === "brainstorm" && text.length > 200) {
    // Detect brainstorm summary: look for key sections
    if (/##\s+(Approach|Key Decisions)/i.test(text)) {
      store.ensurePlanDir(activeIssue);
      store.writePlanFile(activeIssue, "brainstorm.md", text);
      if (ctx.hasUI) ctx.ui.notify("Brainstorm summary saved.", "info");
    }
  }

  if (phase === "spec" && text.length > 100) {
    store.ensurePlanDir(activeIssue);
    store.writePlanFile(activeIssue, "spec.md", text);
    // Extract acceptance criteria
    const criteria = extractAcceptanceCriteria(text);
    if (criteria.length > 0) {
      state = { ...state, acceptanceCriteria: criteria };
      store.saveState(state);
    }
    if (ctx.hasUI) ctx.ui.notify(`Spec saved. ${criteria.length} acceptance criteria extracted.`, "info");
  }

  if (phase === "plan" && text.length > 100) {
    store.ensurePlanDir(activeIssue);
    store.writePlanFile(activeIssue, "plan.md", text);
    const tasks = extractPlanTasks(text);
    state = { ...state, planTasks: tasks, currentTaskIndex: 0 };
    store.saveState(state);
    if (ctx.hasUI) ctx.ui.notify(`Plan saved. ${tasks.length} tasks extracted.`, "info");
  }

  if (phase === "diagnose" && text.length > 100) {
    store.ensurePlanDir(activeIssue);
    store.writePlanFile(activeIssue, "diagnosis.md", text);
    if (ctx.hasUI) ctx.ui.notify("Diagnosis saved.", "info");
  }

  if (phase === "review") {
    const passMatch = /\b(verdict|status)\b[:\s]*(pass|approved)/i.test(text);
    const reviseMatch = /\b(verdict|status)\b[:\s]*revise/i.test(text);
    if (passMatch && !reviseMatch) {
      state = { ...state, reviewApproved: true };
      store.saveState(state);
      if (ctx.hasUI) ctx.ui.notify("Review: plan approved.", "info");
    }
    // Save review artifact regardless
    if (text.length > 100) {
      store.ensurePlanDir(activeIssue);
      store.writePlanFile(activeIssue, "review.md", text);
    }
  }

  if (phase === "implement") {
    // Detect task completion checkpoint from LLM output
    // Look for patterns like "task complete", "task N done", or the report format
    const completionMatch = /(?:task\s+(?:complete|done|finished)|##?\s*(?:what was implemented|checkpoint))/i.test(text);
    if (completionMatch && state.currentTaskIndex < state.planTasks.length) {
      const tasks = [...state.planTasks];
      tasks[state.currentTaskIndex] = { ...tasks[state.currentTaskIndex], completed: true };
      const nextIncomplete = tasks.findIndex((t, i) => i > state.currentTaskIndex && !t.completed);
      const nextIndex = nextIncomplete >= 0 ? nextIncomplete : state.currentTaskIndex + 1;
      state = { ...state, planTasks: tasks, currentTaskIndex: nextIndex };
      store.saveState(state);
      if (ctx.hasUI) {
        const completed = tasks.filter(t => t.completed).length;
        ctx.ui.notify(`Task ${state.planTasks[state.currentTaskIndex - 1]?.index ?? "?"} complete. ${completed}/${tasks.length} done.`, "info");
        // If more tasks remain, send follow-up to start next task
        if (nextIndex < tasks.length) {
          pi.sendMessage({
            customType: "megapowers-context",
            content: `Great, task complete. Moving to the next task. The next prompt injection will scope you to task ${tasks[nextIndex].index}: ${tasks[nextIndex].description}`,
            display: true,
          }, { deliverAs: "followUp", triggerTurn: true });
        }
      }
    }
  }

  if (phase === "verify" && text.length > 100) {
    store.ensurePlanDir(activeIssue);
    store.writePlanFile(activeIssue, "verify.md", text);
    // Update acceptance criteria status based on verification output
    if (state.acceptanceCriteria.length > 0) {
      const updatedCriteria = state.acceptanceCriteria.map(c => {
        const criterionPattern = new RegExp(
          `criterion\\s+${c.id}[^]*?verdict[:\\s]*(pass|fail|partial)`,
          "i"
        );
        const match = text.match(criterionPattern);
        if (match) {
          return { ...c, status: match[1].toLowerCase() as "pass" | "fail" | "partial" };
        }
        return c;
      });
      state = { ...state, acceptanceCriteria: updatedCriteria };
      store.saveState(state);
    }
    if (ctx.hasUI) ctx.ui.notify("Verification report saved.", "info");
  }

  if (phase === "code-review" && text.length > 100) {
    store.ensurePlanDir(activeIssue);
    store.writePlanFile(activeIssue, "code-review.md", text);
    if (ctx.hasUI) ctx.ui.notify("Code review saved.", "info");
  }

  // --- Offer phase transition (interactive only) ---
  if (ctx.hasUI) {
    const validNext = getValidTransitions(state.workflow, phase);
    if (validNext.length > 0) {
      state = await ui.handlePhaseTransition(ctx, state, store, jj);
      pi.appendEntry("megapowers-state", state);
    }
    ui.renderDashboard(ctx, state, store);
  }
});
```

**Step 4: Update `handlePhaseTransition` in `ui.ts` to enforce gates**

In `extensions/megapowers/ui.ts`, import and use the gate checker:

```typescript
import { checkGate } from "./gates.js";
```

Update `handlePhaseTransition` to check gates before allowing a transition:

```typescript
async handlePhaseTransition(ctx, state, store, jj) {
  if (!state.workflow || !state.phase || !state.activeIssue) return state;

  const validNext = getValidTransitions(state.workflow, state.phase);
  if (validNext.length === 0) {
    ctx.ui.notify("No valid transitions from current phase.", "info");
    return state;
  }

  // Check gates for each valid transition and annotate
  const options: { phase: Phase; label: string; gated: boolean; reason?: string }[] = [];
  for (const p of validNext) {
    const gate = checkGate(state, p, store);
    let label = p as string;
    // Label backward transitions
    if (
      (state.phase === "review" && p === "plan") ||
      (state.phase === "verify" && p === "implement") ||
      (state.phase === "code-review" && p === "implement")
    ) {
      label = `← ${p} (go back)`;
    }
    // Label skip-review
    if (p === "implement" && state.phase === "plan") {
      label = `${p} (skip review)`;
    }
    if (!gate.pass) {
      label = `${label} ⛔ ${gate.reason}`;
    }
    options.push({ phase: p, label, gated: !gate.pass, reason: gate.reason });
  }

  const labels = options.map(o => o.label);
  const choice = await ctx.ui.select(`Phase "${state.phase}" — what next?`, labels);
  if (!choice) return state;

  const selected = options.find(o => o.label === choice);
  if (!selected) return state;

  // Block gated transitions
  if (selected.gated) {
    ctx.ui.notify(`Cannot advance: ${selected.reason}`, "error");
    return state;
  }

  const targetPhase = selected.phase;
  let newState = transition(state, targetPhase);

  // jj: describe current, create new change
  if (await jj.isJJRepo()) {
    await jj.describe(formatChangeDescription(state.activeIssue, state.phase!, "complete"));
    const changeId = await jj.newChange(formatChangeDescription(state.activeIssue, targetPhase));
    if (changeId) newState = { ...newState, jjChangeId: changeId };
  }

  store.saveState(newState);
  ctx.ui.notify(`Transitioned to: ${targetPhase}`, "info");
  this.renderDashboard(ctx, newState, store);
  return newState;
},
```

**Step 5: Run all tests to make sure nothing broke**

Run: `bun test`
Expected: All tests PASS

**Step 6: Commit**

```bash
git add -A
git commit -m "feat: full artifact routing, gate enforcement, richer prompt context"
```

---

### Task 7: Implement Phase Task Dashboard

Add a task progress display to the dashboard widget when in the implement phase, showing which task is current and the completion status of all tasks.

**Files:**
- Modify: `extensions/megapowers/ui.ts`
- Modify: `tests/ui.test.ts`

**Step 1: Write failing tests for task dashboard rendering**

Add to `tests/ui.test.ts`:

```typescript
describe("renderDashboardLines — implement phase with tasks", () => {
  it("shows per-task status with current task highlighted", () => {
    const state: MegapowersState = {
      ...createInitialState(),
      activeIssue: "001-auth",
      workflow: "feature",
      phase: "implement",
      planTasks: [
        { index: 1, description: "Set up schema", completed: true },
        { index: 2, description: "Create endpoint", completed: false },
        { index: 3, description: "Write tests", completed: false },
      ],
      currentTaskIndex: 1,
    };
    const lines = renderDashboardLines(state, [], plainTheme as any);
    const joined = lines.join("\n");
    expect(joined).toContain("1/3");
    // Current task indicator
    expect(joined).toContain("Create endpoint");
  });
});

describe("renderDashboardLines — verify phase with criteria", () => {
  it("shows acceptance criteria status", () => {
    const state: MegapowersState = {
      ...createInitialState(),
      activeIssue: "001-auth",
      workflow: "feature",
      phase: "verify",
      acceptanceCriteria: [
        { id: 1, text: "User can register", status: "pass" },
        { id: 2, text: "Email validated", status: "pending" },
      ],
    };
    const lines = renderDashboardLines(state, [], plainTheme as any);
    const joined = lines.join("\n");
    expect(joined).toContain("Criteria:");
    expect(joined).toContain("1/2");
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `bun test tests/ui.test.ts`
Expected: FAIL — no "Create endpoint" or "Criteria:" in dashboard output

**Step 3: Update `renderDashboardLines` in `ui.ts`**

Add task-level detail when in implement phase, and criteria status when in verify/code-review:

```typescript
export function renderDashboardLines(state: MegapowersState, _issues: Issue[], theme: ThemeLike): string[] {
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

  // Task progress (implement phase or whenever tasks exist)
  if (state.planTasks.length > 0) {
    const completed = state.planTasks.filter((t) => t.completed).length;
    lines.push(`${theme.fg("accent", "Tasks:")} ${completed}/${state.planTasks.length} complete`);

    // Show current task in implement phase
    if (state.phase === "implement" && state.currentTaskIndex < state.planTasks.length) {
      const current = state.planTasks[state.currentTaskIndex];
      lines.push(`${theme.fg("accent", "Current:")} Task ${current.index}: ${current.description}`);
    }
  }

  // Acceptance criteria status (verify and code-review phases)
  if (state.acceptanceCriteria.length > 0 && (state.phase === "verify" || state.phase === "code-review")) {
    const passed = state.acceptanceCriteria.filter(c => c.status === "pass").length;
    lines.push(`${theme.fg("accent", "Criteria:")} ${passed}/${state.acceptanceCriteria.length} passing`);
  }

  if (state.jjChangeId) {
    lines.push(`${theme.fg("accent", "jj:")} ${theme.fg("dim", state.jjChangeId)}`);
  }

  return lines;
}
```

**Step 4: Run tests to verify they pass**

Run: `bun test tests/ui.test.ts`
Expected: All tests PASS

**Step 5: Commit**

```bash
git add -A
git commit -m "feat: task dashboard and criteria status in UI"
```

---

### Task 8: Done Phase Wrap-Up Menu

Add the done phase wrap-up flow: present a multi-action menu (commit, squash, update docs, changelog, close issue), execute selected actions, and finalize the issue.

**Files:**
- Modify: `extensions/megapowers/ui.ts`
- Modify: `extensions/megapowers/index.ts`
- Modify: `tests/ui.test.ts`

**Step 1: Write failing tests for done phase rendering**

Add to `tests/ui.test.ts`:

```typescript
describe("renderDashboardLines — done phase", () => {
  it("shows wrap-up message", () => {
    const state: MegapowersState = {
      ...createInitialState(),
      activeIssue: "001-auth",
      workflow: "feature",
      phase: "done",
    };
    const lines = renderDashboardLines(state, [], plainTheme as any);
    const joined = lines.join("\n");
    expect(joined).toContain("done");
  });
});
```

**Step 2: Run tests to verify they fail (or pass — this is a light test)**

Run: `bun test tests/ui.test.ts`
Expected: PASS (the dashboard already shows the phase) or FAIL if we add specific done content.

**Step 3: Add `handleDonePhase` to `MegapowersUI`**

In `extensions/megapowers/ui.ts`, add to the `MegapowersUI` interface and implementation:

```typescript
// Add to MegapowersUI interface:
handleDonePhase(
  ctx: ExtensionContext,
  state: MegapowersState,
  store: Store,
  jj: JJ
): Promise<MegapowersState>;
```

Implementation:

```typescript
async handleDonePhase(ctx, state, store, jj) {
  if (!state.activeIssue) return state;

  const actions = [
    "Close issue",
    "Generate commit message",
    "Update docs (LLM generates from artifacts)",
    "Write changelog entry",
    "Done — finish without further actions",
  ];

  // If jj is available, add jj-specific options
  if (await jj.isJJRepo()) {
    actions.splice(1, 0, "Squash commits");
  }

  let continueMenu = true;
  let newState = state;

  while (continueMenu) {
    const choice = await ctx.ui.select("Wrap-up actions:", actions);
    if (!choice || choice.startsWith("Done")) {
      continueMenu = false;
      break;
    }

    if (choice === "Close issue") {
      store.updateIssueStatus(state.activeIssue, "done");
      newState = {
        ...newState,
        activeIssue: null,
        workflow: null,
        phase: null,
        planTasks: [],
        acceptanceCriteria: [],
        currentTaskIndex: 0,
        reviewApproved: false,
        jjChangeId: null,
      };
      store.saveState(newState);
      ctx.ui.notify("Issue closed.", "info");
      continueMenu = false;
      break;
    }

    if (choice === "Squash commits") {
      const ok = await ctx.ui.confirm("Squash", "Squash all changes into one commit?");
      if (ok) {
        await jj.squash();
        ctx.ui.notify("Changes squashed.", "info");
      }
    }

    if (choice.startsWith("Generate commit")) {
      // The LLM will handle this — send a message asking it to generate a commit message
      ctx.ui.notify("Ask the LLM to generate a commit message based on the spec and changes.", "info");
    }

    if (choice.startsWith("Update docs")) {
      ctx.ui.notify("Ask the LLM to generate/update docs. The done-phase prompt will guide it.", "info");
    }

    if (choice.startsWith("Write changelog")) {
      ctx.ui.notify("Ask the LLM to write a changelog entry. The done-phase prompt will guide it.", "info");
    }
  }

  return newState;
},
```

**Step 4: Wire done phase into `index.ts`**

In the `agent_end` handler, add a special case for the done phase that triggers the wrap-up menu:

```typescript
// After artifact capture, before the generic transition offer:
if (phase === "done" && ctx.hasUI) {
  state = await ui.handleDonePhase(ctx, state, store, jj);
  store.saveState(state);
  pi.appendEntry("megapowers-state", state);
  ui.renderDashboard(ctx, state, store);
  return; // Don't offer generic transition — done phase handles its own flow
}
```

Also add a `/done` command for manual trigger:

```typescript
pi.registerCommand("done", {
  description: "Trigger wrap-up menu (when in done phase)",
  handler: async (_args, ctx) => {
    if (state.phase !== "done") {
      ctx.ui.notify("Not in done phase. Use /phase next to advance.", "info");
      return;
    }
    if (!store) store = createStore(ctx.cwd);
    if (!jj) jj = createJJ(pi);
    if (!ui) ui = createUI();
    state = await ui.handleDonePhase(ctx, state, store, jj);
    store.saveState(state);
    pi.appendEntry("megapowers-state", state);
    ui.renderDashboard(ctx, state, store);
  },
});
```

**Step 5: Run all tests**

Run: `bun test`
Expected: All tests PASS

**Step 6: Commit**

```bash
git add -A
git commit -m "feat: done phase wrap-up menu with issue close, squash, and action prompts"
```

---

## Final Checkpoint

```bash
bun test
```

Expected: All tests pass across all test files:
- `tests/state-machine.test.ts` (updated for code-review phase + backward transitions)
- `tests/store.test.ts`
- `tests/jj.test.ts`
- `tests/plan-parser.test.ts`
- `tests/spec-parser.test.ts` (new)
- `tests/gates.test.ts` (new)
- `tests/ui.test.ts` (updated for task dashboard + criteria status)
- `tests/prompts.test.ts` (updated for new phase mappings)

Manual verification:
```bash
pi -e ./extensions/megapowers/index.ts
```

Verify the full feature mode flow:
1. `/issue new` → create a feature issue
2. Chat with LLM in brainstorm phase → brainstorm.md captured when summary produced
3. `/phase next` → spec (gate: none for brainstorm→spec)
4. LLM writes spec → spec.md saved, acceptance criteria extracted
5. `/phase next` → plan (gate: spec.md exists, no open questions)
6. LLM writes plan → plan.md saved, tasks extracted
7. `/phase next` → review or implement (gate: plan.md exists)
8. If review: LLM reviews → approved or revise. Can go back to plan.
9. `/phase next` → implement (gate: review approved)
10. Dashboard shows current task. LLM works task-by-task.
11. `/phase next` → verify (gate: all tasks complete)
12. LLM verifies against acceptance criteria → verify.md saved, criteria updated
13. `/phase next` → code-review (gate: verify.md exists)
14. LLM reviews code → code-review.md saved
15. `/phase next` → done (gate: code-review.md exists)
16. Done wrap-up menu: close issue, squash, etc.

---

## Summary

| Task | Module | Tests | Description |
|------|--------|-------|-------------|
| 1 | state-machine.ts | state-machine.test.ts | Code-review phase, backward transitions, acceptance criteria state |
| 2 | spec-parser.ts (new) | spec-parser.test.ts | Acceptance criteria extraction from spec markdown |
| 3 | gates.ts (new) | gates.test.ts | Gate conditions for phase transitions |
| 4 | prompts/*.md | — | Rich prompt templates for all 8 feature mode phases |
| 5 | prompts.ts | prompts.test.ts | New phase mappings, implement task vars, criteria formatting |
| 6 | index.ts + ui.ts | — | Artifact routing, gate enforcement, richer prompt context |
| 7 | ui.ts | ui.test.ts | Task dashboard, criteria status in widget |
| 8 | ui.ts + index.ts | — | Done phase wrap-up menu, /done command |
