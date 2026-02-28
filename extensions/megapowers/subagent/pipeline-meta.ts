import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export interface PipelineMeta {
  pipelineId: string;
  workspacePath: string;
  createdAt: number;
}

function metaDir(projectRoot: string): string {
  return join(projectRoot, ".megapowers", "subagents");
}

function metaPath(projectRoot: string, taskIndex: number): string {
  return join(metaDir(projectRoot), `task-${taskIndex}-pipeline.json`);
}

export function writePipelineMeta(projectRoot: string, taskIndex: number, meta: PipelineMeta): void {
  const dir = metaDir(projectRoot);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(metaPath(projectRoot, taskIndex), JSON.stringify(meta, null, 2));
}

export function readPipelineMeta(projectRoot: string, taskIndex: number): PipelineMeta | null {
  const p = metaPath(projectRoot, taskIndex);
  if (!existsSync(p)) return null;
  return JSON.parse(readFileSync(p, "utf-8"));
}

export function clearPipelineMeta(projectRoot: string, taskIndex: number): void {
  const p = metaPath(projectRoot, taskIndex);
  if (existsSync(p)) rmSync(p, { force: true });
}
