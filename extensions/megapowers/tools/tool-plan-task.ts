import { readState } from "../state/state-io.js";
import { readPlanTask, writePlanTask, listPlanTasks } from "../state/plan-store.js";
import { PlanTaskSchema, type PlanTask } from "../state/plan-schemas.js";
import type { EntityDoc } from "../state/entity-parser.js";
import { lintTask } from "../validation/plan-task-linter.js";
import { validatePlanTaskMutation } from "../plan-orchestrator.js";
import { composeMessage } from "../feedback.js";

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

  const modeCheck = validatePlanTaskMutation(state);
  if (!modeCheck.ok) {
    return { error: modeCheck.error };
  }

  const slug = state.activeIssue!;
  const existing = readPlanTask(cwd, slug, params.id);

  if (existing && "error" in existing) {
    return { error: `❌ plan_task: Task ${params.id} existing file is corrupt (${existing.error}). Delete and recreate the corrupt task file.` };
  }

  if (existing) {
    return handleUpdate(cwd, slug, existing, params);
  }

  if (!params.title) {
    return { error: `❌ plan_task: Task ${params.id} invalid — title is required. Provide title when creating a new task.` };
  }

  if (!params.description) {
    return { error: `❌ plan_task: Task ${params.id} invalid — description is required. Provide description when creating a new task.` };
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
      error: `❌ plan_task: Task ${params.id} lint failed — fix lint errors:\n${lintResult.errors.map((e) => `  • ${e}`).join("\n")}`,
    };
  }

  const validation = PlanTaskSchema.safeParse(task);
  if (!validation.success) {
    const issues = validation.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    return { error: `❌ plan_task: Task ${params.id} invalid — ${issues}. Fix the listed validation errors.` };
  }

  writePlanTask(cwd, slug, task, params.description);

  const depsStr = task.depends_on.length > 0 ? task.depends_on.join(", ") : "none";
  const filesCount = task.files_to_modify.length + task.files_to_create.length;
  const taskPath = `.megapowers/plans/${slug}/tasks/task-${String(task.id).padStart(3, "0")}.md`;
  const fields = ["title", "description", "depends_on", "no_test", "files_to_modify", "files_to_create"];
  return {
    message: composeMessage({
      icon: "success",
      summary: `Task ${task.id} saved: "${task.title}"`,
      changes: [`Changed: Fields set: ${fields.join(", ")}`, `depends_on: [${depsStr}] | files: ${filesCount}`],
      artifactPath: taskPath,
    }),
  };
}

function sameArray<T>(a: T[], b: T[]): boolean {
  return a.length === b.length && a.every((value, index) => value === b[index]);
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
  if (params.depends_on !== undefined && !sameArray(params.depends_on, existing.data.depends_on)) {
    merged.depends_on = params.depends_on;
    changed.push("depends_on");
  }
  if (params.no_test !== undefined && params.no_test !== existing.data.no_test) {
    merged.no_test = params.no_test;
    changed.push("no_test");
  }
  if (params.files_to_modify !== undefined && !sameArray(params.files_to_modify, existing.data.files_to_modify)) {
    merged.files_to_modify = params.files_to_modify;
    changed.push("files_to_modify");
  }
  if (params.files_to_create !== undefined && !sameArray(params.files_to_create, existing.data.files_to_create)) {
    merged.files_to_create = params.files_to_create;
    changed.push("files_to_create");
  }

  const body = params.description ?? existing.content;
  if (params.description !== undefined && params.description !== existing.content) {
    changed.push("description");
  }

  const lintInput = { ...merged, description: body };
  const allTasks = listPlanTasks(cwd, slug).map((doc) => doc.data);
  const lintResult = lintTask(lintInput, allTasks);
  if (!lintResult.pass) {
    return {
      error: `❌ plan_task: Task ${params.id} lint failed — fix lint errors:\n${lintResult.errors.map((e) => `  • ${e}`).join("\n")}`,
    };
  }
  writePlanTask(cwd, slug, merged, body);

  const taskPath = `.megapowers/plans/${slug}/tasks/task-${String(merged.id).padStart(3, "0")}.md`;
  return {
    message: composeMessage({
      icon: "success",
      summary: `Task ${merged.id} updated: "${merged.title}"`,
      changes: [`Changed: ${changed.length > 0 ? changed.join(", ") : "no changes"}`],
      artifactPath: taskPath,
    }),
  };
}
