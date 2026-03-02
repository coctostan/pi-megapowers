import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parseFrontmatterEntity, serializeEntity, type EntityDoc } from "./entity-parser.js";
import { PlanTaskSchema, PlanReviewSchema, PlanSummarySchema, type PlanTask, type PlanReview, type PlanSummary } from "./plan-schemas.js";

export function zeroPad(n: number): string {
  return String(n).padStart(3, "0");
}

function tasksDir(cwd: string, slug: string): string {
  return join(cwd, ".megapowers", "plans", slug, "tasks");
}

function taskFilePath(cwd: string, slug: string, id: number): string {
  return join(tasksDir(cwd, slug), `task-${zeroPad(id)}.md`);
}

function reviewFilePath(cwd: string, slug: string, iteration: number): string {
  return join(cwd, ".megapowers", "plans", slug, `review-${zeroPad(iteration)}.md`);
}

function summaryFilePath(cwd: string, slug: string): string {
  return join(cwd, ".megapowers", "plans", slug, "summary.md");
}

export function writePlanTask(cwd: string, slug: string, task: PlanTask, body: string): void {
  const dir = tasksDir(cwd, slug);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const md = serializeEntity(task as unknown as Record<string, unknown>, body);
  writeFileSync(taskFilePath(cwd, slug, task.id), md);
}

export function readPlanTask(cwd: string, slug: string, id: number): EntityDoc<PlanTask> | { error: string } | null {
  const filePath = taskFilePath(cwd, slug, id);
  if (!existsSync(filePath)) return null;
  const content = readFileSync(filePath, "utf-8");
  return parseFrontmatterEntity(content, PlanTaskSchema);
}

export function listPlanTasks(cwd: string, slug: string): EntityDoc<PlanTask>[] {
  const dir = tasksDir(cwd, slug);
  if (!existsSync(dir)) return [];
  const files = readdirSync(dir)
    .filter((f) => f.startsWith("task-") && f.endsWith(".md"))
    .sort();

  const results: EntityDoc<PlanTask>[] = [];
  for (const file of files) {
    const content = readFileSync(join(dir, file), "utf-8");
    const parsed = parseFrontmatterEntity(content, PlanTaskSchema);
    if (parsed && !("error" in parsed)) {
      results.push(parsed);
    }
  }
  return results;
}

export function writePlanReview(cwd: string, slug: string, review: PlanReview, feedback: string): void {
  const dir = join(cwd, ".megapowers", "plans", slug);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const md = serializeEntity(review as unknown as Record<string, unknown>, feedback);
  writeFileSync(reviewFilePath(cwd, slug, review.iteration), md);
}

export function readPlanReview(
  cwd: string,
  slug: string,
  iteration: number,
): EntityDoc<PlanReview> | { error: string } | null {
  const filePath = reviewFilePath(cwd, slug, iteration);
  if (!existsSync(filePath)) return null;
  const content = readFileSync(filePath, "utf-8");
  return parseFrontmatterEntity(content, PlanReviewSchema);
}

export function readPlanSummary(cwd: string, slug: string): EntityDoc<PlanSummary> | { error: string } | null {
  const filePath = summaryFilePath(cwd, slug);
  if (!existsSync(filePath)) return null;
  const content = readFileSync(filePath, "utf-8");
  return parseFrontmatterEntity(content, PlanSummarySchema);
}
