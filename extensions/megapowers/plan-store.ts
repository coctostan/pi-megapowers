import { existsSync, mkdirSync, writeFileSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { parseFrontmatterEntity, serializeEntity } from "./entity-parser.js";
import { PlanTaskSchema, PlanSummarySchema, PlanReviewSchema, type PlanTask, type PlanSummary, type PlanReview } from "./plan-schemas.js";

function zeroPad(id: number): string {
  return String(id).padStart(2, "0");
}

function tasksDir(cwd: string, slug: string): string {
  return join(cwd, ".megapowers", "plans", slug, "tasks");
}

function planDir(cwd: string, slug: string): string {
  return join(cwd, ".megapowers", "plans", slug);
}


export interface EntityDoc<T> {
  data: T;
  content: string;
}

export function writePlanTask(cwd: string, slug: string, task: EntityDoc<PlanTask>): void {
  const dir = tasksDir(cwd, slug);
  mkdirSync(dir, { recursive: true });
  const filename = `task-${zeroPad(task.data.id)}.md`;
  const serialized = serializeEntity(task.data, task.content, PlanTaskSchema);
  writeFileSync(join(dir, filename), serialized, "utf-8");
}

export function readPlanTask(cwd: string, slug: string, id: number): EntityDoc<PlanTask> | null {
  const filepath = join(tasksDir(cwd, slug), `task-${zeroPad(id)}.md`);
  if (!existsSync(filepath)) return null;

  const raw = readFileSync(filepath, "utf-8");
  const result = parseFrontmatterEntity(raw, PlanTaskSchema);
  if (!result.success) return null;

  return { data: result.data, content: result.content };
}

export function listPlanTasks(cwd: string, slug: string): EntityDoc<PlanTask>[] | { error: string } {
  const dir = tasksDir(cwd, slug);
  if (!existsSync(dir)) return [];

  const files = readdirSync(dir)
    .filter((f) => f.startsWith("task-") && f.endsWith(".md"))
    .sort();

  const tasks: EntityDoc<PlanTask>[] = [];
  const seenIds = new Set<number>();
  for (const file of files) {
    const raw = readFileSync(join(dir, file), "utf-8");
    const result = parseFrontmatterEntity(raw, PlanTaskSchema);
    if (!result.success) continue;
    if (seenIds.has(result.data.id)) {
      return { error: `Duplicate task ID ${result.data.id} found in ${file}` };
    }
    seenIds.add(result.data.id);
    tasks.push({ data: result.data, content: result.content });
  }

  tasks.sort((a, b) => a.data.id - b.data.id);
  return tasks;
}


export function writePlanSummary(cwd: string, slug: string, summary: EntityDoc<PlanSummary>): void {
  const dir = planDir(cwd, slug);
  mkdirSync(dir, { recursive: true });
  const serialized = serializeEntity(summary.data, summary.content, PlanSummarySchema);
  writeFileSync(join(dir, "plan.md"), serialized, "utf-8");
}

export function readPlanSummary(cwd: string, slug: string): EntityDoc<PlanSummary> | null {
  const filepath = join(planDir(cwd, slug), "plan.md");
  if (!existsSync(filepath)) return null;

  const raw = readFileSync(filepath, "utf-8");
  const result = parseFrontmatterEntity(raw, PlanSummarySchema);
  if (!result.success) return null;

  return { data: result.data, content: result.content };
}

export function writePlanReview(cwd: string, slug: string, review: EntityDoc<PlanReview>): void {
  const dir = planDir(cwd, slug);
  mkdirSync(dir, { recursive: true });
  const serialized = serializeEntity(review.data, review.content, PlanReviewSchema);
  writeFileSync(join(dir, "review.md"), serialized, "utf-8");
}

export function readPlanReview(cwd: string, slug: string): EntityDoc<PlanReview> | null {
  const filepath = join(planDir(cwd, slug), "review.md");
  if (!existsSync(filepath)) return null;

  const raw = readFileSync(filepath, "utf-8");
  const result = parseFrontmatterEntity(raw, PlanReviewSchema);
  if (!result.success) return null;

  return { data: result.data, content: result.content };
}
