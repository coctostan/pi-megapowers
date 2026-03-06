import { describe, it, expect } from "bun:test";
import {
  getPhasePromptTemplate,
  interpolatePrompt,
  PHASE_PROMPT_MAP,
  buildImplementTaskVars,
  formatAcceptanceCriteriaList,
  loadPromptFile,
  BRAINSTORM_PLAN_PHASES,
  allTasksComplete,
  buildSourceIssuesContext,
} from "../extensions/megapowers/prompts.js";
import type { Phase } from "../extensions/megapowers/state/state-machine.js";
import type { Issue } from "../extensions/megapowers/state/store.js";
import type { PlanTask, AcceptanceCriterion } from "../extensions/megapowers/state/state-machine.js";

describe("PHASE_PROMPT_MAP", () => {
  it("maps every feature phase to a prompt file", () => {
    const phases: Phase[] = ["brainstorm", "spec", "plan", "review", "implement", "verify", "done"];
    for (const phase of phases) {
      expect(PHASE_PROMPT_MAP[phase]).toBeDefined();
    }
  });

  it("maps every bugfix phase to a prompt file", () => {
    const phases: Phase[] = ["reproduce", "diagnose", "plan", "review", "implement", "verify", "done"];
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

describe("prompts module cleanup", () => {
  it("does not contain buildPhasePrompt helper", () => {
    const { readFileSync } = require("node:fs");
    const source = readFileSync("extensions/megapowers/prompts.ts", "utf8");
    expect(source).not.toContain("buildPhasePrompt(");
  });
});

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
      { index: 1, description: "Set up DB schema", completed: true, noTest: false },
      { index: 2, description: "Create API endpoint", completed: false, noTest: false },
      { index: 3, description: "Write integration tests", completed: false, noTest: false },
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
      { index: 1, description: "First task", completed: false, noTest: false },
    ];
    const vars = buildImplementTaskVars(tasks, 0);
    expect(vars.current_task_index).toBe("1");
    expect(vars.total_tasks).toBe("1");
    expect(vars.previous_task_summaries).toBe("None — this is the first task.");
  });

  it("handles all tasks complete — provides summary instead of task vars", () => {
    const tasks: PlanTask[] = [
      { index: 1, description: "Set up DB schema", completed: true, noTest: false },
      { index: 2, description: "Create API endpoint", completed: true, noTest: false },
      { index: 3, description: "Write integration tests", completed: true, noTest: false },
    ];
    const vars = buildImplementTaskVars(tasks, 3);
    expect(vars.current_task_description).toContain("All tasks complete");
    expect(vars.all_tasks_complete).toBe("true");
    expect(vars.previous_task_summaries).toContain("✓ Task 1");
    expect(vars.previous_task_summaries).toContain("✓ Task 2");
    expect(vars.previous_task_summaries).toContain("✓ Task 3");
  });
});

describe("allTasksComplete", () => {
  it("returns true when all tasks are completed", () => {
    const tasks: PlanTask[] = [
      { index: 1, description: "A", completed: true, noTest: false },
      { index: 2, description: "B", completed: true, noTest: false },
    ];
    expect(allTasksComplete(tasks)).toBe(true);
  });

  it("returns false when some tasks are incomplete", () => {
    const tasks: PlanTask[] = [
      { index: 1, description: "A", completed: true, noTest: false },
      { index: 2, description: "B", completed: false, noTest: false },
    ];
    expect(allTasksComplete(tasks)).toBe(false);
  });

  it("returns false for empty task list", () => {
    expect(allTasksComplete([])).toBe(false);
  });
});

describe("formatAcceptanceCriteriaList", () => {
  it("formats criteria as numbered list with status", () => {
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

describe("prompt templates — done phase template updates", () => {
  it("done (generate-docs) template contains {{files_changed}} placeholder", () => {
    const template = getPhasePromptTemplate("done");
    expect(template).toContain("{{files_changed}}");
  });

  it("done (generate-docs) template contains {{learnings}} placeholder", () => {
    const template = getPhasePromptTemplate("done");
    expect(template).toContain("{{learnings}}");
  });
});

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

describe("PHASE_PROMPT_MAP — bugfix phases", () => {
  it("maps reproduce to reproduce-bug.md", () => {
    expect(PHASE_PROMPT_MAP["reproduce"]).toBe("reproduce-bug.md");
  });
});

describe("prompt templates — reproduce-bug.md", () => {
  it("reproduce-bug template exists and contains {{issue_slug}}", () => {
    const template = getPhasePromptTemplate("reproduce");
    expect(template.length).toBeGreaterThan(0);
    expect(template).toContain("{{issue_slug}}");
  });
});

describe("prompt templates — diagnose-bug.md", () => {
  it("diagnose template contains {{reproduce_content}} placeholder", () => {
    const template = getPhasePromptTemplate("diagnose");
    expect(template).toContain("{{reproduce_content}}");
  });

  it("diagnose template contains {{issue_slug}} placeholder", () => {
    const template = getPhasePromptTemplate("diagnose");
    expect(template).toContain("{{issue_slug}}");
  });

  it("diagnose template mentions Fixed When section", () => {
    const template = getPhasePromptTemplate("diagnose");
    expect(template).toContain("Fixed When");
  });
});

describe("prompt templates — generate-bugfix-summary.md", () => {
  it("bugfix summary template exists and is loadable", () => {
    const content = loadPromptFile("generate-bugfix-summary.md");
    expect(content.length).toBeGreaterThan(0);
  });

  it("bugfix summary template contains expected placeholders", () => {
    const content = loadPromptFile("generate-bugfix-summary.md");
    expect(content).toContain("{{reproduce_content}}");
    expect(content).toContain("{{diagnosis_content}}");
    expect(content).toContain("{{plan_content}}");
    expect(content).toContain("{{files_changed}}");
    expect(content).toContain("{{learnings}}");
  });
});

describe("prompt templates — bugfix plan variable injection", () => {
  it("write-plan template contains {{spec_content}} (used for diagnosis in bugfix)", () => {
    const template = getPhasePromptTemplate("plan");
    expect(template).toContain("{{spec_content}}");
  });

  it("write-plan template contains {{brainstorm_content}} (used for reproduce in bugfix)", () => {
    const template = getPhasePromptTemplate("plan");
    expect(template).toContain("{{brainstorm_content}}");
  });
});

describe("implement prompt — subagent delegation instructions", () => {
  it("implement-task template explicitly prohibits subagent/pipeline tools", () => {
    const template = getPhasePromptTemplate("implement");
    // Since pipeline/subagent infrastructure was removed (#091), the prompt should
    // explicitly say NOT to use these tools rather than how to invoke them
    expect(template).toMatch(/do not use.*pipeline|do not use.*subagent|pipeline.*broken|subagent.*broken/i);
  });

  it("implement-task template specifies inline execution mode", () => {
    const template = getPhasePromptTemplate("implement");
    // The prompt should direct the LLM to work directly in the session
    expect(template).toMatch(/work directly|inline|this session/i);
  });

  it("buildImplementTaskVars includes information about independent tasks for delegation", () => {
    const tasks: PlanTask[] = [
      { index: 1, description: "Set up shared types", completed: true, noTest: false },
      { index: 2, description: "Build auth module", completed: false, noTest: false, dependsOn: [1] },
      { index: 3, description: "Build logging module", completed: false, noTest: false },
    ];
    const vars = buildImplementTaskVars(tasks, 1);
    expect(vars).toHaveProperty("remaining_tasks");
    // Task 3 is independent (no dependsOn, or all deps completed)
    expect(vars.remaining_tasks).toContain("Task 3");
  });

  it("remaining_tasks marks tasks with unmet dependencies", () => {
    const tasks: PlanTask[] = [
      { index: 1, description: "Types", completed: false, noTest: false },
      { index: 2, description: "Auth", completed: false, noTest: false, dependsOn: [1] },
      { index: 3, description: "Logging", completed: false, noTest: false },
    ];
    const vars = buildImplementTaskVars(tasks, 0);
    // Task 2 depends on incomplete task 1 — should be marked blocked
    expect(vars.remaining_tasks).toContain("Task 3");
    expect(vars.remaining_tasks).toMatch(/Task 2.*blocked|blocked.*Task 2/i);
  });

  it("remaining_tasks is sentinel when no tasks remain after current", () => {
    const tasks: PlanTask[] = [
      { index: 1, description: "Only task", completed: false, noTest: false },
    ];
    const vars = buildImplementTaskVars(tasks, 0);
    expect(vars.remaining_tasks).toBe("None — this is the only remaining task.");
  });

  it("remaining_tasks shows tasks as ready when their dependencies are complete", () => {
    const tasks: PlanTask[] = [
      { index: 1, description: "Types", completed: true, noTest: false },
      { index: 2, description: "Auth", completed: false, noTest: false, dependsOn: [1] },
      { index: 3, description: "Logging", completed: false, noTest: false, dependsOn: [1] },
    ];
    const vars = buildImplementTaskVars(tasks, 1);
    // Task 3 depends on task 1 which is complete — should be ready
    expect(vars.remaining_tasks).toContain("Task 3");
    expect(vars.remaining_tasks).not.toMatch(/Task 3.*blocked/i);
  });

  it("implement-task template instructs tests_failed signal after RED test failure", () => {
    const template = getPhasePromptTemplate("implement");
    expect(template).toContain('megapowers_signal({ action: "tests_failed" })');
  });

  it("implement-task template instructs tests_passed signal after GREEN test pass", () => {
    const template = getPhasePromptTemplate("implement");
    expect(template).toContain('megapowers_signal({ action: "tests_passed" })');
  });
});

describe("prompt templates — new template files exist", () => {
  it("capture-learnings.md exists and contains {{spec_content}}", () => {
    const { readFileSync } = require("node:fs");
    const { join, dirname } = require("node:path");
    const { fileURLToPath } = require("node:url");
    const thisDir = dirname(fileURLToPath(import.meta.url));
    const promptsDir = join(thisDir, "..", "prompts");
    const content = readFileSync(join(promptsDir, "capture-learnings.md"), "utf-8");
    expect(content.length).toBeGreaterThan(50);
    expect(content).toContain("{{spec_content}}");
  });

  it("write-changelog.md exists and contains {{spec_content}}", () => {
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
});

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
