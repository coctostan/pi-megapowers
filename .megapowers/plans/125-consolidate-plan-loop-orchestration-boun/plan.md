# Plan

### Task 1: Create plan-orchestrator prompt helper module

### Task 1: Create `extensions/megapowers/plan-orchestrator.ts` prompt helpers

**Files:**
- Create: `extensions/megapowers/plan-orchestrator.ts`
- Test: `tests/plan-orchestrator.test.ts`

**Step 1 — Write the failing test**
Create `tests/plan-orchestrator.test.ts` with this exact content:

```ts
import { describe, it, expect } from "bun:test";
import {
  resolvePlanTemplate,
  shouldRunFocusedReview,
} from "../extensions/megapowers/plan-orchestrator.js";

describe("plan-orchestrator — prompt helpers", () => {
  it("maps plan modes to prompt templates and only enables focused review in review mode at threshold", () => {
    expect(resolvePlanTemplate("draft")).toBe("write-plan.md");
    expect(resolvePlanTemplate("review")).toBe("review-plan.md");
    expect(resolvePlanTemplate("revise")).toBe("revise-plan.md");

    expect(shouldRunFocusedReview("draft", 10)).toBe(false);
    expect(shouldRunFocusedReview("revise", 10)).toBe(false);
    expect(shouldRunFocusedReview("review", 4)).toBe(false);
    expect(shouldRunFocusedReview("review", 5)).toBe(true);
  });
});
```

**Step 2 — Run test, verify it fails**
Run: `bun test tests/plan-orchestrator.test.ts`
Expected: FAIL — `Could not resolve "../extensions/megapowers/plan-orchestrator.js"`

**Step 3 — Write minimal implementation**
Create `extensions/megapowers/plan-orchestrator.ts` with this exact content:

```ts
import type { PlanMode } from "./state/state-machine.js";
import { FOCUSED_REVIEW_THRESHOLD } from "./plan-review/focused-review.js";

export type PlanTemplateName = "write-plan.md" | "review-plan.md" | "revise-plan.md";

export function resolvePlanTemplate(planMode: Exclude<PlanMode, null>): PlanTemplateName {
  switch (planMode) {
    case "draft":
      return "write-plan.md";
    case "review":
      return "review-plan.md";
    case "revise":
      return "revise-plan.md";
  }
}

export function shouldRunFocusedReview(planMode: PlanMode, taskCount: number): boolean {
  return planMode === "review" && taskCount >= FOCUSED_REVIEW_THRESHOLD;
}
```

**Step 4 — Run test, verify it passes**
Run: `bun test tests/plan-orchestrator.test.ts`
Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: all passing

### Task 2: Add plan entry and draft-submission transitions to plan-orchestrator [depends: 1]

### Task 2: Add plan entry and draft-submission transitions to plan-orchestrator [depends: 1]

**Files:**
- Modify: `extensions/megapowers/plan-orchestrator.ts`
- Test: `tests/plan-orchestrator.test.ts`

**Step 1 — Write the failing test**
Replace `tests/plan-orchestrator.test.ts` with this exact content:

```ts
import { describe, it, expect } from "bun:test";
import {
  initializePlanLoopState,
  resolvePlanTemplate,
  shouldRunFocusedReview,
  transitionDraftToReview,
} from "../extensions/megapowers/plan-orchestrator.js";
import {
  createInitialState,
  type MegapowersState,
} from "../extensions/megapowers/state/state-machine.js";

function makeState(overrides: Partial<MegapowersState> = {}): MegapowersState {
  return {
    ...createInitialState(),
    activeIssue: "001-test",
    workflow: "feature",
    phase: "plan",
    ...overrides,
  };
}

describe("plan-orchestrator — prompt helpers", () => {
  it("maps plan modes to prompt templates and only enables focused review in review mode at threshold", () => {
    expect(resolvePlanTemplate("draft")).toBe("write-plan.md");
    expect(resolvePlanTemplate("review")).toBe("review-plan.md");
    expect(resolvePlanTemplate("revise")).toBe("revise-plan.md");

    expect(shouldRunFocusedReview("draft", 10)).toBe(false);
    expect(shouldRunFocusedReview("revise", 10)).toBe(false);
    expect(shouldRunFocusedReview("review", 4)).toBe(false);
    expect(shouldRunFocusedReview("review", 5)).toBe(true);
  });
});

describe("plan-orchestrator — plan entry and draft submission", () => {
  it("initializes plan loop state and only allows draft submission from draft or revise mode", () => {
    const entered = initializePlanLoopState({
      ...createInitialState(),
      activeIssue: "001-test",
      workflow: "feature",
      phase: "spec",
    } as MegapowersState);
    expect(entered.planMode).toBe("draft");
    expect(entered.planIteration).toBe(1);

    const draft = transitionDraftToReview(makeState({ planMode: "draft", planIteration: 1 }), 2);
    expect(draft.ok).toBe(true);
    if (draft.ok) {
      expect(draft.value.nextState.planMode).toBe("review");
      expect(draft.value.message).toContain("2 tasks");
    }

    const revise = transitionDraftToReview(makeState({ planMode: "revise", planIteration: 2 }), 1);
    expect(revise.ok).toBe(true);

    const wrongMode = transitionDraftToReview(makeState({ planMode: "review", planIteration: 2 }), 1);
    expect(wrongMode.ok).toBe(false);
    if (!wrongMode.ok) {
      expect(wrongMode.error).toContain("draft");
    }

    const wrongPhase = transitionDraftToReview(
      makeState({ phase: "implement", planMode: null }),
      1,
    );
    expect(wrongPhase.ok).toBe(false);
    if (!wrongPhase.ok) {
      expect(wrongPhase.error).toContain("plan phase");
    }
  });
});
```

**Step 2 — Run test, verify it fails**
Run: `bun test tests/plan-orchestrator.test.ts`
Expected: FAIL — `SyntaxError: Export named 'initializePlanLoopState' not found`

**Step 3 — Write minimal implementation**
Replace `extensions/megapowers/plan-orchestrator.ts` with this exact content:

```ts
import type { MegapowersState, PlanMode } from "./state/state-machine.js";
import { FOCUSED_REVIEW_THRESHOLD } from "./plan-review/focused-review.js";

export type PlanTemplateName = "write-plan.md" | "review-plan.md" | "revise-plan.md";

export interface OrchestratorSuccess<T> {
  ok: true;
  value: T;
}

export interface OrchestratorFailure {
  ok: false;
  error: string;
}

export type OrchestratorResult<T> = OrchestratorSuccess<T> | OrchestratorFailure;

export interface PlanTransitionResult {
  nextState: MegapowersState;
  message: string;
}

export function resolvePlanTemplate(planMode: Exclude<PlanMode, null>): PlanTemplateName {
  switch (planMode) {
    case "draft":
      return "write-plan.md";
    case "review":
      return "review-plan.md";
    case "revise":
      return "revise-plan.md";
  }
}

export function shouldRunFocusedReview(planMode: PlanMode, taskCount: number): boolean {
  return planMode === "review" && taskCount >= FOCUSED_REVIEW_THRESHOLD;
}

export function initializePlanLoopState(state: MegapowersState): MegapowersState {
  return {
    ...state,
    planMode: "draft",
    planIteration: 1,
  };
}

export function transitionDraftToReview(
  state: MegapowersState,
  taskCount: number,
): OrchestratorResult<PlanTransitionResult> {
  if (state.phase !== "plan") {
    return { ok: false, error: "plan_draft_done can only be called during the plan phase." };
  }

  if (state.planMode !== "draft" && state.planMode !== "revise") {
    return {
      ok: false,
      error: `plan_draft_done requires planMode 'draft' or 'revise', got '${state.planMode}'.`,
    };
  }

  return {
    ok: true,
    value: {
      nextState: { ...state, planMode: "review" },
      message:
        `📝 Draft complete: ${taskCount} task${taskCount === 1 ? "" : "s"} saved\n` +
        "  → Transitioning to review mode.",
    },
  };
}
```

**Step 4 — Run test, verify it passes**
Run: `bun test tests/plan-orchestrator.test.ts`
Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: all passing

### Task 3: Add plan review validators to plan-orchestrator [depends: 1, 2]

### Task 3: Add plan review validators to plan-orchestrator [depends: 1, 2]

**Files:**
- Modify: `extensions/megapowers/plan-orchestrator.ts`
- Test: `tests/plan-orchestrator.test.ts`

**Step 1 — Write the failing test**
Replace `tests/plan-orchestrator.test.ts` with this exact content:

```ts
import { describe, it, expect } from "bun:test";
import {
  initializePlanLoopState,
  resolvePlanTemplate,
  shouldRunFocusedReview,
  transitionDraftToReview,
  transitionReviewToRevise,
  validatePlanTaskMutation,
} from "../extensions/megapowers/plan-orchestrator.js";
import {
  MAX_PLAN_ITERATIONS,
  createInitialState,
  type MegapowersState,
} from "../extensions/megapowers/state/state-machine.js";

function makeState(overrides: Partial<MegapowersState> = {}): MegapowersState {
  return {
    ...createInitialState(),
    activeIssue: "001-test",
    workflow: "feature",
    phase: "plan",
    ...overrides,
  };
}

describe("plan-orchestrator — prompt helpers", () => {
  it("maps plan modes to prompt templates and only enables focused review in review mode at threshold", () => {
    expect(resolvePlanTemplate("draft")).toBe("write-plan.md");
    expect(resolvePlanTemplate("review")).toBe("review-plan.md");
    expect(resolvePlanTemplate("revise")).toBe("revise-plan.md");

    expect(shouldRunFocusedReview("draft", 10)).toBe(false);
    expect(shouldRunFocusedReview("revise", 10)).toBe(false);
    expect(shouldRunFocusedReview("review", 4)).toBe(false);
    expect(shouldRunFocusedReview("review", 5)).toBe(true);
  });
});

describe("plan-orchestrator — plan entry and review transitions", () => {
  it("validates task mutation modes and review-loop transitions", () => {
    const entered = initializePlanLoopState({
      ...createInitialState(),
      activeIssue: "001-test",
      workflow: "feature",
      phase: "spec",
    } as MegapowersState);
    expect(entered.planMode).toBe("draft");
    expect(entered.planIteration).toBe(1);

    expect(validatePlanTaskMutation(makeState({ planMode: "draft", planIteration: 1 }))).toEqual({
      ok: true,
      value: "draft",
    });
    expect(validatePlanTaskMutation(makeState({ planMode: "revise", planIteration: 2 }))).toEqual({
      ok: true,
      value: "revise",
    });

    const blocked = validatePlanTaskMutation(makeState({ planMode: "review", planIteration: 2 }));
    expect(blocked.ok).toBe(false);

    const review = transitionDraftToReview(makeState({ planMode: "draft", planIteration: 1 }), 2);
    expect(review.ok).toBe(true);
    if (review.ok) {
      expect(review.value.nextState.planMode).toBe("review");
      expect(review.value.message).toContain("2 tasks");
    }

    const revise = transitionReviewToRevise(
      makeState({ planMode: "review", planIteration: 1 }),
      [1],
      [2],
      MAX_PLAN_ITERATIONS,
    );
    expect(revise.ok).toBe(true);
    if (revise.ok) {
      expect(revise.value.nextState.planMode).toBe("revise");
      expect(revise.value.nextState.planIteration).toBe(2);
      expect(revise.value.message).toContain("REVISE");
    }

    const capped = transitionReviewToRevise(
      makeState({ planMode: "review", planIteration: MAX_PLAN_ITERATIONS }),
      [],
      [1],
      MAX_PLAN_ITERATIONS,
    );
    expect(capped.ok).toBe(false);
    if (!capped.ok) {
      expect(capped.error).toContain("Human intervention needed");
    }
  });
});
```

**Step 2 — Run test, verify it fails**
Run: `bun test tests/plan-orchestrator.test.ts`
Expected: FAIL — `SyntaxError: Export named 'transitionReviewToRevise' not found`

**Step 3 — Write minimal implementation**
Replace `extensions/megapowers/plan-orchestrator.ts` with this exact content:

```ts
import type { MegapowersState, PlanMode } from "./state/state-machine.js";
import { FOCUSED_REVIEW_THRESHOLD } from "./plan-review/focused-review.js";

export type PlanTemplateName = "write-plan.md" | "review-plan.md" | "revise-plan.md";

export interface OrchestratorSuccess<T> {
  ok: true;
  value: T;
}

export interface OrchestratorFailure {
  ok: false;
  error: string;
}

export type OrchestratorResult<T> = OrchestratorSuccess<T> | OrchestratorFailure;

export interface PlanTransitionResult {
  nextState: MegapowersState;
  message: string;
}

export function resolvePlanTemplate(planMode: Exclude<PlanMode, null>): PlanTemplateName {
  switch (planMode) {
    case "draft":
      return "write-plan.md";
    case "review":
      return "review-plan.md";
    case "revise":
      return "revise-plan.md";
  }
}

export function shouldRunFocusedReview(planMode: PlanMode, taskCount: number): boolean {
  return planMode === "review" && taskCount >= FOCUSED_REVIEW_THRESHOLD;
}

export function initializePlanLoopState(state: MegapowersState): MegapowersState {
  return {
    ...state,
    planMode: "draft",
    planIteration: 1,
  };
}

export function validatePlanTaskMutation(
  state: Pick<MegapowersState, "phase" | "planMode">,
): OrchestratorResult<"draft" | "revise"> {
  if (state.phase !== "plan") {
    return { ok: false, error: "megapowers_plan_task can only be called during the plan phase." };
  }

  if (state.planMode === "review") {
    return {
      ok: false,
      error: "megapowers_plan_task is blocked during review mode. Use megapowers_plan_review to submit your verdict.",
    };
  }

  if (state.planMode !== "draft" && state.planMode !== "revise") {
    return {
      ok: false,
      error: `megapowers_plan_task requires planMode 'draft' or 'revise', got '${state.planMode}'.`,
    };
  }

  return { ok: true, value: state.planMode };
}

export function transitionDraftToReview(
  state: MegapowersState,
  taskCount: number,
): OrchestratorResult<PlanTransitionResult> {
  if (state.phase !== "plan") {
    return { ok: false, error: "plan_draft_done can only be called during the plan phase." };
  }

  if (state.planMode !== "draft" && state.planMode !== "revise") {
    return {
      ok: false,
      error: `plan_draft_done requires planMode 'draft' or 'revise', got '${state.planMode}'.`,
    };
  }

  return {
    ok: true,
    value: {
      nextState: { ...state, planMode: "review" },
      message:
        `📝 Draft complete: ${taskCount} task${taskCount === 1 ? "" : "s"} saved\n` +
        "  → Transitioning to review mode.",
    },
  };
}

export function transitionReviewToRevise(
  state: MegapowersState,
  approvedIds: number[],
  needsRevisionIds: number[],
  maxIterations: number,
): OrchestratorResult<PlanTransitionResult> {
  if (state.planMode !== "review") {
    return {
      ok: false,
      error: `megapowers_plan_review requires planMode 'review', got '${state.planMode}'.`,
    };
  }

  if (state.planIteration >= maxIterations) {
    return {
      ok: false,
      error:
        `⚠️ Plan review reached ${maxIterations} iterations without approval. Human intervention needed.\n` +
        "  Use /mega off to disable enforcement and manually advance, or revise the spec.",
    };
  }

  return {
    ok: true,
    value: {
      nextState: {
        ...state,
        planMode: "revise",
        planIteration: state.planIteration + 1,
      },
      message:
        `📋 Plan review: REVISE (iteration ${state.planIteration + 1} of ${maxIterations})\n` +
        `  ✅ Tasks ${approvedIds.join(", ") || "none"} approved\n` +
        `  ⚠️ Tasks ${needsRevisionIds.join(", ") || "none"} need revision\n` +
        "  → Transitioning to revise mode. A new review session will start.",
    },
  };
}
```

**Step 4 — Run test, verify it passes**
Run: `bun test tests/plan-orchestrator.test.ts`
Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: all passing

### Task 4: Add approve-path effect planning to plan-orchestrator [depends: 1, 2, 3]

### Task 4: Add approve-path effect planning to plan-orchestrator [depends: 1, 2, 3]

**Files:**
- Modify: `extensions/megapowers/plan-orchestrator.ts`
- Test: `tests/plan-orchestrator.test.ts`

**Step 1 — Write the failing test**
Replace `tests/plan-orchestrator.test.ts` with this exact content:

```ts
import { describe, it, expect } from "bun:test";
import {
  approvePlan,
  initializePlanLoopState,
  resolvePlanTemplate,
  shouldRunFocusedReview,
  transitionDraftToReview,
  transitionReviewToRevise,
  validatePlanTaskMutation,
} from "../extensions/megapowers/plan-orchestrator.js";
import {
  MAX_PLAN_ITERATIONS,
  createInitialState,
  type MegapowersState,
  type PlanTask,
} from "../extensions/megapowers/state/state-machine.js";
import type { EntityDoc } from "../extensions/megapowers/state/entity-parser.js";
import type { PlanTask as PlanTaskDoc } from "../extensions/megapowers/state/plan-schemas.js";

function makeState(overrides: Partial<MegapowersState> = {}): MegapowersState {
  return {
    ...createInitialState(),
    activeIssue: "001-test",
    workflow: "feature",
    phase: "plan",
    ...overrides,
  };
}

describe("plan-orchestrator — prompt helpers", () => {
  it("maps plan modes to prompt templates and only enables focused review in review mode at threshold", () => {
    expect(resolvePlanTemplate("draft")).toBe("write-plan.md");
    expect(resolvePlanTemplate("review")).toBe("review-plan.md");
    expect(resolvePlanTemplate("revise")).toBe("revise-plan.md");

    expect(shouldRunFocusedReview("draft", 10)).toBe(false);
    expect(shouldRunFocusedReview("revise", 10)).toBe(false);
    expect(shouldRunFocusedReview("review", 4)).toBe(false);
    expect(shouldRunFocusedReview("review", 5)).toBe(true);
  });
});

describe("plan-orchestrator — review loop transitions", () => {
  it("validates task-mutation modes and review-loop transitions", () => {
    const entered = initializePlanLoopState({
      ...createInitialState(),
      activeIssue: "001-test",
      workflow: "feature",
      phase: "spec",
    } as MegapowersState);
    expect(entered.planMode).toBe("draft");
    expect(entered.planIteration).toBe(1);

    expect(validatePlanTaskMutation(makeState({ planMode: "draft", planIteration: 1 }))).toEqual({
      ok: true,
      value: "draft",
    });
    expect(validatePlanTaskMutation(makeState({ planMode: "revise", planIteration: 2 }))).toEqual({
      ok: true,
      value: "revise",
    });
    expect(validatePlanTaskMutation(makeState({ planMode: "review", planIteration: 2 })).ok).toBe(false);

    const review = transitionDraftToReview(makeState({ planMode: "draft", planIteration: 1 }), 2);
    expect(review.ok).toBe(true);
    if (review.ok) {
      expect(review.value.nextState.planMode).toBe("review");
      expect(review.value.message).toContain("2 tasks");
    }

    const revise = transitionReviewToRevise(
      makeState({ planMode: "review", planIteration: 1 }),
      [1],
      [2],
      MAX_PLAN_ITERATIONS,
    );
    expect(revise.ok).toBe(true);
    if (revise.ok) {
      expect(revise.value.nextState.planMode).toBe("revise");
      expect(revise.value.nextState.planIteration).toBe(2);
      expect(revise.value.message).toContain("REVISE");
    }

    const capped = transitionReviewToRevise(
      makeState({ planMode: "review", planIteration: MAX_PLAN_ITERATIONS }),
      [],
      [1],
      MAX_PLAN_ITERATIONS,
    );
    expect(capped.ok).toBe(false);
    if (!capped.ok) {
      expect(capped.error).toContain("Human intervention needed");
    }
  });
});

describe("plan-orchestrator — approve effects", () => {
  it("returns approved task updates, legacy plan.md text, and the next implement state", () => {
    const taskDocs: EntityDoc<PlanTaskDoc>[] = [
      {
        data: {
          id: 1,
          title: "First task",
          status: "draft",
          depends_on: [],
          no_test: false,
          files_to_modify: ["extensions/megapowers/tools/tool-plan-review.ts"],
          files_to_create: [],
        },
        content: "Task body 1",
      },
      {
        data: {
          id: 2,
          title: "Second task",
          status: "draft",
          depends_on: [1],
          no_test: false,
          files_to_modify: ["extensions/megapowers/tools/tool-signal.ts"],
          files_to_create: [],
        },
        content: "Task body 2",
      },
    ];

    const derivedTasks: PlanTask[] = [
      { index: 1, description: "First task", completed: false, noTest: false },
      { index: 2, description: "Second task", completed: false, noTest: false, dependsOn: [1] },
    ];

    const result = approvePlan(
      makeState({ planMode: "review", planIteration: 2 }),
      taskDocs,
      derivedTasks,
      (state, tasks) => ({
        ...state,
        phase: "implement",
        planMode: null,
        currentTaskIndex: tasks[0]?.index === 1 ? 0 : 99,
      }),
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.statusUpdates).toEqual([
        { taskId: 1, status: "approved" },
        { taskId: 2, status: "approved" },
      ]);
      expect(result.value.legacyPlanMd).toContain("### Task 1: First task");
      expect(result.value.legacyPlanMd).toContain("### Task 2: Second task [depends: 1]");
      expect(result.value.nextState.phase).toBe("implement");
      expect(result.value.nextState.planMode).toBeNull();
      expect(result.value.message).toContain("Plan approved");
    }
  });
});
```

**Step 2 — Run test, verify it fails**
Run: `bun test tests/plan-orchestrator.test.ts`
Expected: FAIL — `SyntaxError: Export named 'approvePlan' not found`

**Step 3 — Write minimal implementation**
Replace `extensions/megapowers/plan-orchestrator.ts` with this exact content:

```ts
import type { EntityDoc } from "./state/entity-parser.js";
import { generateLegacyPlanMd } from "./state/legacy-plan-bridge.js";
import type { PlanTask as PlanTaskDoc } from "./state/plan-schemas.js";
import type { MegapowersState, PlanMode, PlanTask } from "./state/state-machine.js";
import { FOCUSED_REVIEW_THRESHOLD } from "./plan-review/focused-review.js";

export type PlanTemplateName = "write-plan.md" | "review-plan.md" | "revise-plan.md";

export interface OrchestratorSuccess<T> {
  ok: true;
  value: T;
}

export interface OrchestratorFailure {
  ok: false;
  error: string;
}

export type OrchestratorResult<T> = OrchestratorSuccess<T> | OrchestratorFailure;

export interface PlanTransitionResult {
  nextState: MegapowersState;
  message: string;
}

export interface ApprovePlanEffects {
  statusUpdates: Array<{ taskId: number; status: "approved" }>;
  legacyPlanMd: string;
  nextState: MegapowersState;
  message: string;
}

export function resolvePlanTemplate(planMode: Exclude<PlanMode, null>): PlanTemplateName {
  switch (planMode) {
    case "draft":
      return "write-plan.md";
    case "review":
      return "review-plan.md";
    case "revise":
      return "revise-plan.md";
  }
}

export function shouldRunFocusedReview(planMode: PlanMode, taskCount: number): boolean {
  return planMode === "review" && taskCount >= FOCUSED_REVIEW_THRESHOLD;
}

export function initializePlanLoopState(state: MegapowersState): MegapowersState {
  return {
    ...state,
    planMode: "draft",
    planIteration: 1,
  };
}

export function validatePlanTaskMutation(
  state: Pick<MegapowersState, "phase" | "planMode">,
): OrchestratorResult<"draft" | "revise"> {
  if (state.phase !== "plan") {
    return { ok: false, error: "megapowers_plan_task can only be called during the plan phase." };
  }

  if (state.planMode === "review") {
    return {
      ok: false,
      error: "megapowers_plan_task is blocked during review mode. Use megapowers_plan_review to submit your verdict.",
    };
  }

  if (state.planMode !== "draft" && state.planMode !== "revise") {
    return {
      ok: false,
      error: `megapowers_plan_task requires planMode 'draft' or 'revise', got '${state.planMode}'.`,
    };
  }

  return { ok: true, value: state.planMode };
}

export function transitionDraftToReview(
  state: MegapowersState,
  taskCount: number,
): OrchestratorResult<PlanTransitionResult> {
  if (state.phase !== "plan") {
    return { ok: false, error: "plan_draft_done can only be called during the plan phase." };
  }

  if (state.planMode !== "draft" && state.planMode !== "revise") {
    return {
      ok: false,
      error: `plan_draft_done requires planMode 'draft' or 'revise', got '${state.planMode}'.`,
    };
  }

  return {
    ok: true,
    value: {
      nextState: { ...state, planMode: "review" },
      message:
        `📝 Draft complete: ${taskCount} task${taskCount === 1 ? "" : "s"} saved\n` +
        "  → Transitioning to review mode.",
    },
  };
}

export function transitionReviewToRevise(
  state: MegapowersState,
  approvedIds: number[],
  needsRevisionIds: number[],
  maxIterations: number,
): OrchestratorResult<PlanTransitionResult> {
  if (state.planMode !== "review") {
    return {
      ok: false,
      error: `megapowers_plan_review requires planMode 'review', got '${state.planMode}'.`,
    };
  }

  if (state.planIteration >= maxIterations) {
    return {
      ok: false,
      error:
        `⚠️ Plan review reached ${maxIterations} iterations without approval. Human intervention needed.\n` +
        "  Use /mega off to disable enforcement and manually advance, or revise the spec.",
    };
  }

  return {
    ok: true,
    value: {
      nextState: {
        ...state,
        planMode: "revise",
        planIteration: state.planIteration + 1,
      },
      message:
        `📋 Plan review: REVISE (iteration ${state.planIteration + 1} of ${maxIterations})\n` +
        `  ✅ Tasks ${approvedIds.join(", ") || "none"} approved\n` +
        `  ⚠️ Tasks ${needsRevisionIds.join(", ") || "none"} need revision\n` +
        "  → Transitioning to revise mode. A new review session will start.",
    },
  };
}

export function approvePlan(
  state: MegapowersState,
  tasks: EntityDoc<PlanTaskDoc>[],
  derivedTasks: PlanTask[],
  transitionToImplement: (state: MegapowersState, tasks: PlanTask[]) => MegapowersState,
): OrchestratorResult<ApprovePlanEffects> {
  if (state.planMode !== "review") {
    return {
      ok: false,
      error: `megapowers_plan_review requires planMode 'review', got '${state.planMode}'.`,
    };
  }

  return {
    ok: true,
    value: {
      statusUpdates: tasks.map((task) => ({ taskId: task.data.id, status: "approved" as const })),
      legacyPlanMd: generateLegacyPlanMd(tasks),
      nextState: transitionToImplement(state, derivedTasks),
      message:
        `📋 Plan approved (iteration ${state.planIteration})\n` +
        `  ✅ All ${tasks.length} tasks approved\n` +
        "  → Generated plan.md for downstream consumers\n" +
        "  → Advancing to implement phase",
    },
  };
}
```

**Step 4 — Run test, verify it passes**
Run: `bun test tests/plan-orchestrator.test.ts`
Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: all passing

### Task 5: Delegate plan review verdict handling to plan-orchestrator [depends: 3, 4]

### Task 5: Delegate plan review verdict handling to plan-orchestrator [depends: 3, 4]

**Files:**
- Modify: `extensions/megapowers/tools/tool-plan-review.ts`
- Create: `tests/tool-plan-review-delegation.test.ts`

**Step 1 — Write the failing test**
Create `tests/tool-plan-review-delegation.test.ts` with this exact content:

```ts
import { describe, it, expect } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("tool-plan-review delegation", () => {
  it("delegates revise and approve flows to plan-orchestrator", () => {
    const source = readFileSync(
      join(process.cwd(), "extensions", "megapowers", "tools", "tool-plan-review.ts"),
      "utf-8",
    );

    expect(source).toContain("transitionReviewToRevise");
    expect(source).toContain("approvePlan");
    expect(source).not.toContain("generateLegacyPlanMd(");
    expect(source).not.toContain('planMode: "revise"');
    expect(source).not.toContain('planIteration: state.planIteration + 1');
  });
});
```

**Step 2 — Run test, verify it fails**
Run: `bun test tests/tool-plan-review-delegation.test.ts`
Expected: FAIL — `expect(received).toContain("transitionReviewToRevise")`

**Step 3 — Write minimal implementation**
In `extensions/megapowers/tools/tool-plan-review.ts`, update the imports to this exact block:

```ts
import { existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { readState, writeState } from "../state/state-io.js";
import { readPlanTask, writePlanTask, listPlanTasks, writePlanReview } from "../state/plan-store.js";
import { approvePlan, transitionReviewToRevise } from "../plan-orchestrator.js";
import { MAX_PLAN_ITERATIONS, transition, type Phase } from "../state/state-machine.js";
import { deriveTasks } from "../state/derived.js";
import type { PlanTask, PlanReview } from "../state/plan-schemas.js";
```

Then replace the entire `handleReviseVerdict(...)` function with:

```ts
function handleReviseVerdict(
  cwd: string,
  state: ReturnType<typeof readState>,
  approvedIds: number[],
  needsRevisionIds: number[],
): PlanReviewResult {
  const orchestrated = transitionReviewToRevise(
    state,
    approvedIds,
    needsRevisionIds,
    MAX_PLAN_ITERATIONS,
  );
  if (!orchestrated.ok) {
    return { error: orchestrated.error };
  }

  writeState(cwd, orchestrated.value.nextState);
  return {
    message: orchestrated.value.message,
    triggerNewSession: true,
  };
}
```

Then replace the entire `handleApproveVerdict(...)` function with:

```ts
function handleApproveVerdict(
  cwd: string,
  state: ReturnType<typeof readState>,
  slug: string,
): PlanReviewResult {
  const tasks = listPlanTasks(cwd, slug);
  const derivedTasks = deriveTasks(cwd, slug);
  const orchestrated = approvePlan(state, tasks, derivedTasks, (currentState, nextTasks) =>
    transition(currentState, "implement" as Phase, nextTasks),
  );

  if (!orchestrated.ok) {
    return { error: orchestrated.error };
  }

  updateTaskStatuses(
    cwd,
    slug,
    orchestrated.value.statusUpdates.map((update) => update.taskId),
    "approved",
  );

  const planDir = join(cwd, ".megapowers", "plans", slug);
  writeFileSync(join(planDir, "plan.md"), orchestrated.value.legacyPlanMd);
  writeState(cwd, orchestrated.value.nextState);

  return {
    message: orchestrated.value.message,
    triggerNewSession: true,
  };
}
```

**Step 4 — Run test, verify it passes**
Run: `bun test tests/tool-plan-review-delegation.test.ts`
Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: all passing

### Task 6: Delegate plan_draft_done and remove review_approve from tool-signal [depends: 2]

### Task 6: Delegate `plan_draft_done` and remove `review_approve` from tool-signal [depends: 2]

**Files:**
- Modify: `extensions/megapowers/tools/tool-signal.ts`
- Test: `tests/tool-signal.test.ts`

**Step 1 — Write the failing test**
In `tests/tool-signal.test.ts`, replace the existing `describe("review_approve deprecation", ...)` block with this exact code:

```ts
describe("review_approve removal", () => {
  it("treats review_approve as an unknown signal action and removes the old switch case", () => {
    const source = readFileSync(join(process.cwd(), "extensions/megapowers/tools/tool-signal.ts"), "utf-8");
    expect(source).not.toContain('| "review_approve"');
    expect(source).not.toContain('case "review_approve"');

    setState(tmp, { phase: "plan", planMode: "review", planIteration: 1 });
    const result = handleSignal(tmp, "review_approve");
    expect(result.error).toBe("Unknown signal action: review_approve");
  });
});
```

Then replace the existing test named `it("does not clear reviewApproved when review → plan transition is invalid", ...)` with this exact code:

```ts
it("leaves phase state untouched when review → plan transition is invalid", () => {
  writeArtifact(tmp, "001-test", "plan.md", "# Plan\n");
  setState(tmp, { phase: "review" });
  const before = readState(tmp);

  const result = handleSignal(tmp, "phase_back");

  expect(result.error).toBeDefined();
  expect(result.error).toContain("No backward transition");
  expect(readState(tmp).phase).toBe("review");
  expect(readState(tmp).phaseHistory).toEqual(before.phaseHistory);
});
```

Then replace the existing schema assertion test named `it("does not advertise review_approve while the low-level deprecation error remains", ...)` with this exact code:

```ts
it("does not advertise review_approve and routes plan_draft_done through plan-orchestrator", async () => {
  const toolsSource = readFileSync(join(process.cwd(), "extensions/megapowers/register-tools.ts"), "utf8");
  const signalSource = readFileSync(join(process.cwd(), "extensions/megapowers/tools/tool-signal.ts"), "utf8");

  expect(toolsSource).not.toContain('Type.Literal("review_approve")');
  expect(signalSource).toContain("transitionDraftToReview");
  expect(signalSource).not.toContain('writeState(cwd, { ...state, planMode: "review" })');

  setState(tmp, { phase: "plan", planMode: "review", planIteration: 1 });
  const result = handleSignal(tmp, "review_approve");
  expect(result.error).toBe("Unknown signal action: review_approve");
});
```

**Step 2 — Run test, verify it fails**
Run: `bun test tests/tool-signal.test.ts`
Expected: FAIL — `expect(received).not.toContain('| "review_approve"')`

**Step 3 — Write minimal implementation**
In `extensions/megapowers/tools/tool-signal.ts`, add this import near the top:

```ts
import { transitionDraftToReview } from "../plan-orchestrator.js";
```

Then change the `handleSignal(...)` action union so it reads:

```ts
export function handleSignal(
  cwd: string,
  action:
    | "task_done"
    | "phase_next"
    | "phase_back"
    | "tests_failed"
    | "tests_passed"
    | "plan_draft_done"
    | "close_issue"
    | string,
  target?: string,
): SignalResult {
```

Then remove the `case "review_approve":` branch from the switch entirely so the switch reads:

```ts
  switch (action) {
    case "task_done":
      return handleTaskDone(cwd);
    case "phase_next":
      return handlePhaseNext(cwd, target);
    case "phase_back":
      return handlePhaseBack(cwd);
    case "tests_failed":
      return handleTestsFailed(cwd);
    case "tests_passed":
      return handleTestsPassed(cwd);
    case "plan_draft_done":
      return { error: "plan_draft_done must be called via the async handlePlanDraftDone export." };
    case "close_issue":
      return handleCloseIssue(cwd);
    default:
      return { error: `Unknown signal action: ${String(action)}` };
  }
```

Then replace `handlePlanDraftDone(...)` with this exact function:

```ts
export async function handlePlanDraftDone(cwd: string): Promise<SignalResult> {
  const state = readState(cwd);
  if (state.phase !== "plan") {
    return { error: "plan_draft_done can only be called during the plan phase." };
  }
  if (state.planMode !== "draft" && state.planMode !== "revise") {
    return { error: `plan_draft_done requires planMode 'draft' or 'revise', got '${state.planMode}'.` };
  }
  const tasks = listPlanTasks(cwd, state.activeIssue!);
  if (tasks.length === 0) {
    return { error: "No task files found. Use megapowers_plan_task to create tasks before signaling draft done." };
  }

  const orchestrated = transitionDraftToReview(state, tasks.length);
  if (!orchestrated.ok) {
    return { error: orchestrated.error };
  }

  writeState(cwd, orchestrated.value.nextState);
  return {
    message: orchestrated.value.message,
    triggerNewSession: true,
  };
}
```

Finally, delete the entire `handleReviewApprove(...)` function.

**Step 4 — Run test, verify it passes**
Run: `bun test tests/tool-signal.test.ts`
Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: all passing

### Task 7: Delegate plan task mode validation to plan-orchestrator [depends: 3]

### Task 7: Delegate plan task mode validation to plan-orchestrator [depends: 3]

**Files:**
- Modify: `extensions/megapowers/tools/tool-plan-task.ts`
- Create: `tests/tool-plan-task-delegation.test.ts`

**Step 1 — Write the failing test**
Create `tests/tool-plan-task-delegation.test.ts` with this exact content:

```ts
import { describe, it, expect } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("tool-plan-task delegation", () => {
  it("uses validatePlanTaskMutation instead of inline planMode checks", () => {
    const source = readFileSync(
      join(process.cwd(), "extensions", "megapowers", "tools", "tool-plan-task.ts"),
      "utf-8",
    );

    expect(source).toContain("validatePlanTaskMutation");
    expect(source).not.toContain('state.planMode === "review"');
    expect(source).not.toContain('state.planMode !== "draft" && state.planMode !== "revise"');
  });
});
```

**Step 2 — Run test, verify it fails**
Run: `bun test tests/tool-plan-task-delegation.test.ts`
Expected: FAIL — `expect(received).toContain("validatePlanTaskMutation")`

**Step 3 — Write minimal implementation**
In `extensions/megapowers/tools/tool-plan-task.ts`, add this import near the top:

```ts
import { validatePlanTaskMutation } from "../plan-orchestrator.js";
```

Then replace the current phase / planMode guard block inside `handlePlanTask(...)` with this exact code:

```ts
  const modeCheck = validatePlanTaskMutation(state);
  if (!modeCheck.ok) {
    return { error: modeCheck.error };
  }
```

Do not keep the old inline `state.phase !== "plan"`, `state.planMode === "review"`, or `state.planMode !== "draft" && state.planMode !== "revise"` checks.

**Step 4 — Run test, verify it passes**
Run: `bun test tests/tool-plan-task-delegation.test.ts`
Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: all passing

### Task 8: Use plan-orchestrator for prompt-inject plan-mode routing [depends: 1]

### Task 8: Use plan-orchestrator for prompt-inject plan-mode routing [depends: 1]

**Files:**
- Modify: `extensions/megapowers/prompt-inject.ts`
- Create: `tests/prompt-inject-plan-orchestrator.test.ts`

**Step 1 — Write the failing test**
Create `tests/prompt-inject-plan-orchestrator.test.ts` with this exact content:

```ts
import { describe, it, expect } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("prompt-inject plan-orchestrator wiring", () => {
  it("uses resolvePlanTemplate instead of a local plan-mode map", () => {
    const source = readFileSync(
      join(process.cwd(), "extensions", "megapowers", "prompt-inject.ts"),
      "utf-8",
    );

    expect(source).toContain("resolvePlanTemplate");
    expect(source).not.toContain("PLAN_MODE_TEMPLATES");
  });
});
```

**Step 2 — Run test, verify it fails**
Run: `bun test tests/prompt-inject-plan-orchestrator.test.ts`
Expected: FAIL — `expect(received).toContain("resolvePlanTemplate")`

**Step 3 — Write minimal implementation**
In `extensions/megapowers/prompt-inject.ts`, replace the focused-review import with:

```ts
import { resolvePlanTemplate } from "./plan-orchestrator.js";
```

Then replace the entire `else if (state.phase === "plan" && state.planMode) { ... }` branch inside `buildInjectedPrompt(...)` with this exact block:

```ts
  } else if (state.phase === "plan" && state.planMode) {
    const templateName = resolvePlanTemplate(state.planMode);
    const template = loadPromptFile(templateName);
    if (template) {
      const phasePrompt = interpolatePrompt(template, vars);
      if (phasePrompt) parts.push(phasePrompt);
    }
```

Do not keep the local `PLAN_MODE_TEMPLATES` map in `prompt-inject.ts`.

**Step 4 — Run test, verify it passes**
Run: `bun test tests/prompt-inject-plan-orchestrator.test.ts`
Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: all passing

### Task 9: Use orchestrator focused-review decisions in hooks [depends: 1]

### Task 9: Use orchestrator focused-review decisions in hooks [depends: 1]

**Files:**
- Modify: `extensions/megapowers/hooks.ts`
- Test: `tests/hooks-focused-review.test.ts`

**Step 1 — Write the failing test**
Add these two tests to `tests/hooks-focused-review.test.ts`:

```ts
it("does not invoke focused review fan-out when planMode is draft even with five or more tasks", async () => {
  setState(tmp, { phase: "plan", planMode: "draft" });
  createTaskFiles(tmp, 6);

  let called = 0;
  await preparePlanReviewContext(tmp, async () => {
    called += 1;
    return {
      ran: true,
      runtime: "pi-subagents",
      mode: "parallel",
      availableArtifacts: [],
      unavailableArtifacts: [],
      message: "should not run",
    };
  });

  expect(called).toBe(0);
});

it("hooks.ts uses shouldRunFocusedReview from plan-orchestrator", () => {
  const source = require("node:fs").readFileSync(
    require("node:path").join(process.cwd(), "extensions/megapowers/hooks.ts"),
    "utf-8",
  );

  expect(source).toContain('from "./plan-orchestrator.js"');
  expect(source).toContain("shouldRunFocusedReview(state.planMode, taskCount)");
  expect(source).not.toContain("shouldRunFocusedReviewFanout(taskCount)");
});
```

**Step 2 — Run test, verify it fails**
Run: `bun test tests/hooks-focused-review.test.ts`
Expected: FAIL — `expect(received).toContain("shouldRunFocusedReview(state.planMode, taskCount)")`

**Step 3 — Write minimal implementation**
Update `extensions/megapowers/hooks.ts`:

```ts
import { shouldRunFocusedReview } from "./plan-orchestrator.js";
```

Then change the decision block in `preparePlanReviewContext` to:

```ts
  const taskCount = deriveTasks(cwd, state.activeIssue).length;
  if (!shouldRunFocusedReview(state.planMode, taskCount)) return;
```

Keep the fan-out execution itself exactly where it is: still call `runFocusedReviewFanoutFn(...)`, still soft-fail on thrown errors, and still pass the same `cwd`, `issueSlug`, `workflow`, and `taskCount` payload.

**Step 4 — Run test, verify it passes**
Run: `bun test tests/hooks-focused-review.test.ts`
Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: all passing

### Task 10: Remove the dead requireReviewApproved gate type

### Task 10: Remove the dead requireReviewApproved gate type

**Files:**
- Modify: `extensions/megapowers/workflows/types.ts`
- Modify: `extensions/megapowers/workflows/gate-evaluator.ts`
- Test: `tests/gate-evaluator.test.ts`

**Step 1 — Write the failing test**
Replace the existing `evaluateGate — requireReviewApproved` describe block in `tests/gate-evaluator.test.ts` with this dead-code removal check:

```ts
describe("dead requireReviewApproved gate removal", () => {
  it("workflow types and gate evaluator source no longer mention requireReviewApproved", () => {
    const fs = require("node:fs");
    const path = require("node:path");
    const typesSource = fs.readFileSync(
      path.join(process.cwd(), "extensions/megapowers/workflows/types.ts"),
      "utf-8",
    );
    const evaluatorSource = fs.readFileSync(
      path.join(process.cwd(), "extensions/megapowers/workflows/gate-evaluator.ts"),
      "utf-8",
    );

    expect(typesSource).not.toContain("requireReviewApproved");
    expect(evaluatorSource).not.toContain("requireReviewApproved");
    expect(evaluatorSource).not.toContain("state.reviewApproved");
  });
});
```

**Step 2 — Run test, verify it fails**
Run: `bun test tests/gate-evaluator.test.ts`
Expected: FAIL — `expect(received).not.toContain("requireReviewApproved")`

**Step 3 — Write minimal implementation**
Remove the dead gate definition from `extensions/megapowers/workflows/types.ts`:

```ts
// delete
export interface RequireReviewApprovedGate {
  type: "requireReviewApproved";
}
```

and remove it from the `GateConfig` union.

Then delete the corresponding evaluator branch from `extensions/megapowers/workflows/gate-evaluator.ts`:

```ts
    case "requireReviewApproved": {
      if (!state.reviewApproved) {
        return { pass: false, message: "Plan review not approved yet. The LLM needs to approve the plan." };
      }
      return { pass: true };
    }
```

Leave the `requirePlanApproved` gate untouched; it is still the real gate for `plan -> implement` and must continue to check `state.planMode === null`.

**Step 4 — Run test, verify it passes**
Run: `bun test tests/gate-evaluator.test.ts`
Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: all passing

### Task 11: Initialize plan loop through the orchestrator and drop reviewApproved from state-machine [depends: 2]

### Task 11: Initialize plan loop through the orchestrator and drop reviewApproved from state-machine [depends: 2]

**Files:**
- Modify: `extensions/megapowers/state/state-machine.ts`
- Test: `tests/state-machine.test.ts`
- Test: `tests/phase-advance.test.ts`

**Step 1 — Write the failing test**
Update `tests/state-machine.test.ts` and `tests/phase-advance.test.ts` with these assertions:

```ts
// tests/state-machine.test.ts
it("createInitialState no longer includes reviewApproved", () => {
  const state = createInitialState();
  expect("reviewApproved" in state).toBe(false);
});

it("state-machine delegates plan entry initialization to plan-orchestrator", () => {
  const source = require("node:fs").readFileSync(
    require("node:path").join(process.cwd(), "extensions/megapowers/state/state-machine.ts"),
    "utf-8",
  );

  expect(source).toContain('from "../plan-orchestrator.js"');
  expect(source).toContain("initializePlanLoopState");
});
```

```ts
// tests/phase-advance.test.ts
it("spec→plan still initializes draft mode without reviewApproved bookkeeping", () => {
  setState({ phase: "spec" });
  writeArtifact("001-test", "spec.md", "# Spec\n\n## Acceptance Criteria\n1. Works\n\n## Open Questions\nNone\n");
  const result = advancePhase(tmp);
  expect(result.ok).toBe(true);
  const next = readState(tmp);
  expect(next.planMode).toBe("draft");
  expect(next.planIteration).toBe(1);
  expect((next as any).reviewApproved).toBeUndefined();
});
```

Remove the old tests that explicitly expect `reviewApproved` to reset when entering plan.

**Step 2 — Run test, verify it fails**
Run: `bun test tests/state-machine.test.ts tests/phase-advance.test.ts`
Expected: FAIL — `expect(received).toContain("initializePlanLoopState")`

**Step 3 — Write minimal implementation**
Edit `extensions/megapowers/state/state-machine.ts`:

1. add the helper import:

```ts
import { initializePlanLoopState } from "../plan-orchestrator.js";
```

2. remove `reviewApproved` from `MegapowersState`
3. remove `reviewApproved: false` from `createInitialState()`
4. replace the plan-entry branch in `transition(...)` with:

```ts
  if (to === "plan") {
    Object.assign(next, initializePlanLoopState(next));
  }
```

5. keep the existing non-plan behavior, `planMode` clearing on plan exit, implement-task index initialization, and done-action resets intact.

**Step 4 — Run test, verify it passes**
Run: `bun test tests/state-machine.test.ts tests/phase-advance.test.ts`
Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: all passing

### Task 12: Remove reviewApproved persistence and UI state write remnants [depends: 11]

### Task 12: Remove reviewApproved persistence and UI state write remnants [depends: 11]

**Files:**
- Modify: `extensions/megapowers/state/state-io.ts`
- Modify: `extensions/megapowers/ui.ts`
- Test: `tests/state-io.test.ts`

**Step 1 — Write the failing test**
Update `tests/state-io.test.ts` with these two concrete checks:

```ts
it("KNOWN_KEYS no longer preserves reviewApproved on read", () => {
  const dir = join(tmp, ".megapowers");
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    join(dir, "state.json"),
    JSON.stringify({ ...createInitialState(), activeIssue: "001-test", reviewApproved: true }),
  );

  const state = readState(tmp);
  expect((state as any).reviewApproved).toBeUndefined();
});

it("writeState output and ui.ts source no longer mention reviewApproved", () => {
  writeState(tmp, { ...createInitialState(), activeIssue: "001-test" } as any);
  const raw = readFileSync(join(tmp, ".megapowers", "state.json"), "utf-8");
  expect(raw).not.toContain("reviewApproved");

  const uiSource = readFileSync(
    join(process.cwd(), "extensions/megapowers/ui.ts"),
    "utf-8",
  );
  expect(uiSource).not.toContain("reviewApproved:");
});
```

Delete or rewrite the old round-trip assertion that expected `reviewApproved: true` to survive read/write.

**Step 2 — Run test, verify it fails**
Run: `bun test tests/state-io.test.ts`
Expected: FAIL — `expect(received).not.toContain("reviewApproved")`

**Step 3 — Write minimal implementation**
In `extensions/megapowers/state/state-io.ts`, remove `"reviewApproved"` from `KNOWN_KEYS`.

In `extensions/megapowers/ui.ts`, delete every explicit `reviewApproved: false,` property from the issue-activation and batch-activation state objects so those writes now rely on `createInitialState()` plus the remaining explicit fields only.

The changed UI snippets should look like this pattern after cleanup:

```ts
const newState: MegapowersState = {
  ...state,
  activeIssue: issue.slug,
  workflow: type,
  phase: firstPhase,
  phaseHistory: [],
  currentTaskIndex: 0,
  completedTasks: [],
  tddTaskState: null,
  doneActions: [],
};
```

**Step 4 — Run test, verify it passes**
Run: `bun test tests/state-io.test.ts`
Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: all passing

### Task 13: Remove review_approve instruction text from tool instructions

### Task 13: Remove review_approve instruction text from tool instructions

**Files:**
- Modify: `extensions/megapowers/workflows/tool-instructions.ts`
- Test: `tests/workflow-configs.test.ts`

**Step 1 — Write the failing test**
Add this source-level regression test to `tests/workflow-configs.test.ts` inside the `deriveToolInstructions` describe block:

```ts
it("tool-instructions source no longer contains needsReviewApproval or review_approve guidance", () => {
  const source = require("node:fs").readFileSync(
    require("node:path").join(process.cwd(), "extensions/megapowers/workflows/tool-instructions.ts"),
    "utf-8",
  );

  expect(source).not.toContain("needsReviewApproval");
  expect(source).not.toContain("review_approve");
});
```

**Step 2 — Run test, verify it fails**
Run: `bun test tests/workflow-configs.test.ts`
Expected: FAIL — `expect(received).not.toContain("needsReviewApproval")`

**Step 3 — Write minimal implementation**
Remove the dead review-approval branch from `extensions/megapowers/workflows/tool-instructions.ts`:

```ts
  // delete this entire block
  if (phase.needsReviewApproval) {
    parts.push(
      `If the plan is acceptable, call \`megapowers_signal\` with action \`"review_approve"\` to approve it.`,
      `Then call \`megapowers_signal\` with action \`"phase_next"\` to advance to implement.`,
      `If changes are needed, explain what to fix. The user will revise and re-submit.`,
    );
    return parts.join("\n");
  }
```

After this deletion, review-mode guidance comes only from the dedicated `review-plan.md` prompt and the `megapowers_plan_review` tool, while artifact phases and TDD phases keep their current instruction text.

**Step 4 — Run test, verify it passes**
Run: `bun test tests/workflow-configs.test.ts`
Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: all passing
