import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

export interface PipelineLogEntry {
  step: "implement" | "verify" | "review";
  status: "completed" | "failed" | "rejected";
  durationMs: number;
  summary: string;
  error?: string;
}

function logDir(projectRoot: string, pipelineId: string): string {
  return join(projectRoot, ".megapowers", "subagents", pipelineId);
}

function logPath(projectRoot: string, pipelineId: string): string {
  return join(logDir(projectRoot, pipelineId), "log.jsonl");
}

export function writeLogEntry(projectRoot: string, pipelineId: string, entry: PipelineLogEntry): void {
  const dir = logDir(projectRoot, pipelineId);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  appendFileSync(logPath(projectRoot, pipelineId), JSON.stringify(entry) + "\n");
}

export function readPipelineLog(projectRoot: string, pipelineId: string): PipelineLogEntry[] {
  const p = logPath(projectRoot, pipelineId);
  if (!existsSync(p)) return [];
  const content = readFileSync(p, "utf-8").trim();
  if (!content) return [];
  return content.split("\n").map((l) => JSON.parse(l));
}
