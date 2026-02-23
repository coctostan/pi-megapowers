import { describe, it, expect } from "bun:test";
import { processAgentOutput } from "../extensions/megapowers/artifact-router.js";
import { createInitialState, type MegapowersState } from "../extensions/megapowers/state-machine.js";

function makeState(overrides: Partial<MegapowersState> = {}): MegapowersState {
  return {
    ...createInitialState(),
    activeIssue: "001-test",
    workflow: "feature",
    ...overrides,
  };
}

describe("processAgentOutput — brainstorm phase", () => {
  it("captures brainstorm summary when text has ## Approach section", () => {
    const text = "Here's the design.\n\n## Approach\nWe'll build a widget that does X. It handles user input, validates it against the schema, and persists the result to the database.\n\n## Key Decisions\n- Use React for the frontend\n- PostgreSQL for storage";
    const result = processAgentOutput(text, "brainstorm", makeState({ phase: "brainstorm" }));

    expect(result.artifacts).toHaveLength(1);
    expect(result.artifacts[0].filename).toBe("brainstorm.md");
    expect(result.artifacts[0].content).toBe(text);
  });

  it("ignores short brainstorm text", () => {
    const text = "OK sounds good.";
    const result = processAgentOutput(text, "brainstorm", makeState({ phase: "brainstorm" }));
    expect(result.artifacts).toHaveLength(0);
  });

  it("ignores brainstorm text without summary sections", () => {
    const text = "A".repeat(300); // long but no ## Approach or ## Key Decisions
    const result = processAgentOutput(text, "brainstorm", makeState({ phase: "brainstorm" }));
    expect(result.artifacts).toHaveLength(0);
  });
});

describe("processAgentOutput — spec phase", () => {
  it("saves spec and extracts acceptance criteria", () => {
    const text = "## Goal\nBuild X.\n\n## Acceptance Criteria\n1. User can log in\n2. User sees dashboard\n\n## Out of Scope\n- Nothing";
    const result = processAgentOutput(text, "spec", makeState({ phase: "spec" }));

    expect(result.artifacts).toHaveLength(1);
    expect(result.artifacts[0].filename).toBe("spec.md");
    expect(result.stateUpdate.acceptanceCriteria).toHaveLength(2);
    expect(result.stateUpdate.acceptanceCriteria![0].text).toBe("User can log in");
    expect(result.stateUpdate.acceptanceCriteria![0].status).toBe("pending");
    expect(result.notifications).toContain("Spec saved. 2 acceptance criteria extracted.");
  });

  it("saves spec even with zero criteria", () => {
    const text = "## Goal\nBuild X.\n\nSome long spec content that is over 100 chars for sure because we need enough length to pass the threshold check.";
    const result = processAgentOutput(text, "spec", makeState({ phase: "spec" }));

    expect(result.artifacts).toHaveLength(1);
    expect(result.stateUpdate.acceptanceCriteria).toBeUndefined();
    expect(result.notifications).toContain("Spec saved. 0 acceptance criteria extracted.");
  });

  it("rejects conversational responses without structural markers", () => {
    const text = "The spec has 17 acceptance criteria and covers all the required functionality. Ready to move to the plan phase whenever you are. Let me know if you'd like me to revise anything.";
    const result = processAgentOutput(text, "spec", makeState({ phase: "spec" }));

    expect(result.artifacts).toHaveLength(0);
    expect(result.notifications).toHaveLength(0);
  });
});

describe("processAgentOutput — plan phase", () => {
  it("saves plan and extracts tasks", () => {
    const text = "## Implementation\n\n### Task 1: Setup\nDo the setup.\n\n### Task 2: Build\nBuild it.\n\nMore text to get over 100 chars threshold.";
    const result = processAgentOutput(text, "plan", makeState({ phase: "plan" }));

    expect(result.artifacts).toHaveLength(1);
    expect(result.artifacts[0].filename).toBe("plan.md");
    expect(result.stateUpdate.planTasks).toBeDefined();
    expect(result.stateUpdate.planTasks!.length).toBeGreaterThan(0);
    expect(result.stateUpdate.currentTaskIndex).toBe(0);
  });

  it("resets tddTaskState when plan tasks are replaced", () => {
    const state = makeState({
      phase: "plan",
      tddTaskState: { taskIndex: 1, state: "impl-allowed", skipped: false },
    });
    const text = "## Implementation\n\n### Task 1: New task\nDo it.\n\n### Task 2: Another\nBuild it.\n\nMore text to get over 100 chars threshold for artifact.";
    const result = processAgentOutput(text, "plan", state);

    expect(result.stateUpdate.planTasks).toBeDefined();
    expect(result.stateUpdate.tddTaskState).toBeNull();
  });

  it("rejects conversational responses without task headers", () => {
    const text = "Here's a summary of the plan: 8 tasks covering setup, implementation, and testing. The plan looks comprehensive and should take about 3 days. Ready to start implementation whenever you are.";
    const result = processAgentOutput(text, "plan", makeState({ phase: "plan" }));

    expect(result.artifacts).toHaveLength(0);
    expect(result.stateUpdate.planTasks).toBeUndefined();
  });
});

describe("processAgentOutput — review phase", () => {
  it("detects approval via verdict: pass", () => {
    const text = "The plan looks solid. All tasks are well-defined and dependencies are clear.\n\nVerdict: pass\n\nReady to implement. No issues found.";
    const result = processAgentOutput(text, "review", makeState({ phase: "review" }));

    expect(result.stateUpdate.reviewApproved).toBe(true);
    expect(result.artifacts).toHaveLength(1);
    expect(result.artifacts[0].filename).toBe("review.md");
  });

  it("detects approval via status: approved", () => {
    const text = "All good.\n\nStatus: approved\n\nNo issues found. This is more than 100 chars total for sure because we need length.";
    const result = processAgentOutput(text, "review", makeState({ phase: "review" }));

    expect(result.stateUpdate.reviewApproved).toBe(true);
  });

  it("does not approve on verdict: revise", () => {
    const text = "Issues found.\n\nVerdict: revise\n\nTask 3 needs rework. This is long enough to get over 100 chars total for the artifact save.";
    const result = processAgentOutput(text, "review", makeState({ phase: "review" }));

    expect(result.stateUpdate.reviewApproved).toBeUndefined();
  });
});

describe("processAgentOutput — implement phase", () => {
  it("marks current task complete on 'task complete' signal", () => {
    const text = "Implemented the handler.\n\nTask complete.\n\nFiles changed: foo.ts";
    const state = makeState({
      phase: "implement",
      planTasks: [
        { index: 1, description: "A", completed: false },
        { index: 2, description: "B", completed: false },
      ],
      currentTaskIndex: 0,
    });
    const result = processAgentOutput(text, "implement", state);

    expect(result.stateUpdate.planTasks![0].completed).toBe(true);
    expect(result.stateUpdate.currentTaskIndex).toBe(1);
  });

  it("skips already-completed tasks when advancing", () => {
    const text = "Done.\n\n## What was implemented\nStuff";
    const state = makeState({
      phase: "implement",
      planTasks: [
        { index: 1, description: "A", completed: true },
        { index: 2, description: "B", completed: false },
        { index: 3, description: "C", completed: true },
        { index: 4, description: "D", completed: false },
      ],
      currentTaskIndex: 1,
    });
    const result = processAgentOutput(text, "implement", state);

    expect(result.stateUpdate.planTasks![1].completed).toBe(true);
    expect(result.stateUpdate.currentTaskIndex).toBe(3); // skips completed task 3
  });

  it("does nothing without completion signal", () => {
    const text = "I'm working on it, here's what I've done so far...";
    const state = makeState({
      phase: "implement",
      planTasks: [{ index: 1, description: "A", completed: false }],
      currentTaskIndex: 0,
    });
    const result = processAgentOutput(text, "implement", state);

    expect(result.stateUpdate.planTasks).toBeUndefined();
  });
});

describe("processAgentOutput — verify phase", () => {
  it("saves verify artifact", () => {
    const text = "## Test Suite Results\nAll pass.\n\n## Overall Verdict\npass\n\nAll criteria met. Extra text to pad over 100 chars threshold.";
    const result = processAgentOutput(text, "verify", makeState({ phase: "verify" }));

    expect(result.artifacts).toHaveLength(1);
    expect(result.artifacts[0].filename).toBe("verify.md");
  });

  it("updates acceptance criteria status from verification output", () => {
    const text = `## Per-Criterion Verification

### Criterion 1: User can log in
**Evidence:** test passes
**Verdict:** pass

### Criterion 2: Dashboard loads
**Evidence:** test fails
**Verdict:** fail

Extra padding to get over the 100 char threshold for artifact saving.`;

    const state = makeState({
      phase: "verify",
      acceptanceCriteria: [
        { id: 1, text: "User can log in", status: "pending" },
        { id: 2, text: "Dashboard loads", status: "pending" },
      ],
    });
    const result = processAgentOutput(text, "verify", state);

    expect(result.stateUpdate.acceptanceCriteria![0].status).toBe("pass");
    expect(result.stateUpdate.acceptanceCriteria![1].status).toBe("fail");
  });
});

describe("processAgentOutput — code-review phase", () => {
  it("saves code-review artifact", () => {
    const text = "## Findings\n\n### Critical\nNone\n\n### Important\nNone\n\n### Minor\nNone\n\n## Assessment\nready\n\nNo issues found. Code is clean and well-tested.";
    const result = processAgentOutput(text, "code-review", makeState({ phase: "code-review" }));

    expect(result.artifacts).toHaveLength(1);
    expect(result.artifacts[0].filename).toBe("code-review.md");
  });
});

describe("processAgentOutput — diagnose phase", () => {
  it("saves diagnosis artifact", () => {
    const text = "## Root Cause\nThe bug is in the parser.\n\n## Fix\nUpdate the regex. Extra padding to get over the 100 char minimum.";
    const result = processAgentOutput(text, "diagnose", makeState({ phase: "diagnose" }));

    expect(result.artifacts).toHaveLength(1);
    expect(result.artifacts[0].filename).toBe("diagnosis.md");
  });
});

describe("processAgentOutput — reproduce phase", () => {
  it("saves reproduce.md when text is long enough", () => {
    const text = "## Steps to Reproduce\n1. Run the app\n2. Click button\n3. See error\n\n## Expected\nNo error\n\n## Actual\nCrash. Extra padding for length.";
    const result = processAgentOutput(text, "reproduce", makeState({ phase: "reproduce", workflow: "bugfix" }));
    expect(result.artifacts).toHaveLength(1);
    expect(result.artifacts[0].filename).toBe("reproduce.md");
    expect(result.notifications).toContain("Reproduction report saved.");
  });

  it("ignores short reproduce text", () => {
    const text = "I see the bug.";
    const result = processAgentOutput(text, "reproduce", makeState({ phase: "reproduce", workflow: "bugfix" }));
    expect(result.artifacts).toHaveLength(0);
  });

  it("rejects conversational responses without structural markers", () => {
    const text = "I've confirmed the bug exists and can reproduce it reliably. The issue happens when the user clicks the submit button with an empty form. It occurs on both Chrome and Firefox. Ready to diagnose.";
    const result = processAgentOutput(text, "reproduce", makeState({ phase: "reproduce", workflow: "bugfix" }));
    expect(result.artifacts).toHaveLength(0);
  });
});

describe("processAgentOutput — diagnose phase rejection", () => {
  it("rejects conversational responses without structural markers", () => {
    const text = "I've identified the issue. The parser is failing because the regex doesn't handle multi-line input correctly. The fix should be straightforward — we need to update the regex flags. Ready to plan.";
    const result = processAgentOutput(text, "diagnose", makeState({ phase: "diagnose", workflow: "bugfix" }));
    expect(result.artifacts).toHaveLength(0);
  });
});

describe("processAgentOutput — review phase rejection", () => {
  it("rejects conversational review responses without verdict", () => {
    const text = "The plan looks solid overall. I've reviewed all 8 tasks and the dependencies are well-ordered. The testing approach is comprehensive. No major concerns — this should be ready to implement. Just let me know when you want to proceed.";
    const result = processAgentOutput(text, "review", makeState({ phase: "review" }));
    expect(result.artifacts).toHaveLength(0);
    expect(result.stateUpdate.reviewApproved).toBeUndefined();
  });
});

describe("processAgentOutput — diagnose phase with Fixed When", () => {
  it("extracts acceptance criteria from ## Fixed When section", () => {
    const text = `## Root Cause\nThe regex is wrong.\n\n## Fixed When\n1. Parser handles multi-line input\n2. Empty string returns empty array\n\nExtra padding to exceed the 100 character minimum for artifact saving threshold.`;
    const result = processAgentOutput(text, "diagnose", makeState({ phase: "diagnose", workflow: "bugfix" }));
    expect(result.artifacts[0].filename).toBe("diagnosis.md");
    expect(result.stateUpdate.acceptanceCriteria).toHaveLength(2);
    expect(result.stateUpdate.acceptanceCriteria![0].text).toBe("Parser handles multi-line input");
  });

  it("clears acceptanceCriteria when no Fixed When section (prevents stale criteria)", () => {
    const text = "## Root Cause\nThe bug is in the parser.\n\n## Fix\nUpdate the regex. Extra padding to get over the 100 char minimum.";
    const stateWithOldCriteria = makeState({
      phase: "diagnose",
      workflow: "bugfix",
      acceptanceCriteria: [{ id: "old-1", text: "stale criterion", status: "pending" as const }],
    });
    const result = processAgentOutput(text, "diagnose", stateWithOldCriteria);
    expect(result.artifacts).toHaveLength(1);
    expect(result.stateUpdate.acceptanceCriteria).toEqual([]);
  });
});
