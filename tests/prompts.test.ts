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
} from "../extensions/megapowers/prompts.js";
import type { Phase } from "../extensions/megapowers/state-machine.js";
import type { PlanTask, AcceptanceCriterion } from "../extensions/megapowers/state-machine.js";

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

  it("handles all tasks complete — provides summary instead of task vars", () => {
    const tasks: PlanTask[] = [
      { index: 1, description: "Set up DB schema", completed: true },
      { index: 2, description: "Create API endpoint", completed: true },
      { index: 3, description: "Write integration tests", completed: true },
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
      { index: 1, description: "A", completed: true },
      { index: 2, description: "B", completed: true },
    ];
    expect(allTasksComplete(tasks)).toBe(true);
  });

  it("returns false when some tasks are incomplete", () => {
    const tasks: PlanTask[] = [
      { index: 1, description: "A", completed: true },
      { index: 2, description: "B", completed: false },
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
