import { readState } from "../state/state-io.js";
import { readPlanTask, writePlanTask, listPlanTasks } from "../state/plan-store.js";
import { PlanTaskSchema, type PlanTask } from "../state/plan-schemas.js";
import type { EntityDoc } from "../state/entity-parser.js";
import { lintTask } from "../validation/plan-task-linter.js";

export interface PlanTaskParams {
  id: number;
  title?: string;
  description?: string;
  depends_on?: number[];
  no_test?: boolean;
  files_to_modify?: string[];
  files_to_create?: string[];
}

export interface PlanTaskResult {
  message?: string;
  error?: string;
}

export function handlePlanTask(cwd: string, params: PlanTaskParams): PlanTaskResult {
  const state = readState(cwd);

  if (state.phase !== "plan") {
    return { error: "megapowers_plan_task can only be called during the plan phase." };
  }

  if (state.planMode === "review") {
    return { error: "megapowers_plan_task is blocked during review mode. Use megapowers_plan_review to submit your verdict." };
  }

  if (state.planMode !== "draft" && state.planMode !== "revise") {
    return { error: `megapowers_plan_task requires planMode 'draft' or 'revise', got '${state.planMode}'.` };
  }

  const slug = state.activeIssue!;
  const existing = readPlanTask(cwd, slug, params.id);

  if (existing && "error" in existing) {
    return { error: `❌ Task ${params.id} is corrupt and cannot be updated: ${existing.error}. Delete the file and recreate it.` };
  }

  if (existing) {
    return handleUpdate(cwd, slug, existing, params);
  }

  if (!params.title) {
    return { error: `❌ Task ${params.id} invalid: title is required when creating a new task.` };
  }

  if (!params.description) {
    return { error: `❌ Task ${params.id} invalid: description is required when creating a new task.` };
  }

  const task: PlanTask = {
    id: params.id,
    title: params.title,
    status: "draft",
    depends_on: params.depends_on ?? [],
    no_test: params.no_test ?? false,
    files_to_modify: params.files_to_modify ?? [],
    files_to_create: params.files_to_create ?? [],
  };

  const lintInput = { ...task, description: params.description! };
  const existingTasks = listPlanTasks(cwd, slug).map((doc) => doc.data);
  const lintResult = lintTask(lintInput, existingTasks);
  if (!lintResult.pass) {
    return {
      error: `❌ Task ${params.id} lint failed:\n${lintResult.errors.map((e) => `  • ${e}`).join("\n")}`,
    };
  }

  const validation = PlanTaskSchema.safeParse(task);
  if (!validation.success) {
    const issues = validation.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    return { error: `❌ Task ${params.id} invalid: ${issues}` };
  }

  writePlanTask(cwd, slug, task, params.description);

  const depsStr = task.depends_on.length > 0 ? task.depends_on.join(", ") : "none";
  const filesCount = task.files_to_modify.length + task.files_to_create.length;
  const taskPath = `.megapowers/plans/${slug}/tasks/task-${String(task.id).padStart(3, "0")}.md`;
  return {
    message:
      `✅ Task ${task.id} saved: "${task.title}"\n` +
      `  → ${taskPath}\n` +
      "  Changed: title, description, status, depends_on, no_test, files_to_modify, files_to_create\n" +
      `  depends_on: [${depsStr}] | files: ${filesCount}`,
  };
}

function handleUpdate(
  cwd: string,
  slug: string,
  existing: EntityDoc<PlanTask>,
  params: PlanTaskParams,
): PlanTaskResult {
  const changed: string[] = [];
  const merged = { ...existing.data };

  if (params.title !== undefined && params.title !== existing.data.title) {
    merged.title = params.title;
    changed.push("title");
  }
  if (params.depends_on !== undefined) {
    merged.depends_on = params.depends_on;
    changed.push("depends_on");
  }
  if (params.no_test !== undefined) {
    merged.no_test = params.no_test;
    changed.push("no_test");
  }
  if (params.files_to_modify !== undefined) {
    merged.files_to_modify = params.files_to_modify;
    changed.push("files_to_modify");
  }
  if (params.files_to_create !== undefined) {
    merged.files_to_create = params.files_to_create;
    changed.push("files_to_create");
  }

  const body = params.description ?? existing.content;
  if (params.description !== undefined) {
    changed.push("description");
  }

  const lintInput = { ...merged, description: body };
  const allTasks = listPlanTasks(cwd, slug).map((doc) => doc.data);
  const lintResult = lintTask(lintInput, allTasks);
  if (!lintResult.pass) {
    return {
      error: `❌ Task ${params.id} lint failed:\n${lintResult.errors.map((e) => `  • ${e}`).join("\n")}`,
    };
  }
  writePlanTask(cwd, slug, merged, body);

  const taskPath = `.megapowers/plans/${slug}/tasks/task-${String(merged.id).padStart(3, "0")}.md`;
  return {
    message:
      `✅ Task ${merged.id} updated: "${merged.title}"\n` +
      `  → ${taskPath}\n` +
      `  Changed: ${changed.length > 0 ? changed.join(", ") : "no changes"}`,
  };
}
