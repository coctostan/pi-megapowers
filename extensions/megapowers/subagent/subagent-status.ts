import { existsSync, readFileSync, writeFileSync, mkdirSync, renameSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";

export type SubagentState = "running" | "completed" | "failed" | "timed-out";

const TERMINAL_STATES: ReadonlySet<SubagentState> = new Set(["completed", "failed", "timed-out"]);

export interface SubagentStatus {
  id: string;
  state: SubagentState;
  turnsUsed: number;
  startedAt: number;
  completedAt?: number;
  phase?: string;
  filesChanged?: string[];
  diff?: string;
  diffPath?: string;
  testsPassed?: boolean;
  error?: string;
  detectedErrors?: string[];
}

export function subagentDir(cwd: string, id: string): string {
  return join(cwd, ".megapowers", "subagents", id);
}

export function writeSubagentStatus(cwd: string, id: string, status: SubagentStatus): void {
  const dir = subagentDir(cwd, id);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const filePath = join(dir, "status.json");
  const tmpPath = join(dir, `.status-${randomUUID().slice(0, 8)}.tmp`);
  writeFileSync(tmpPath, JSON.stringify(status, null, 2) + "\n");
  renameSync(tmpPath, filePath);
}

export function readSubagentStatus(cwd: string, id: string): SubagentStatus | null {
  const filepath = join(subagentDir(cwd, id), "status.json");
  if (!existsSync(filepath)) return null;
  try {
    return JSON.parse(readFileSync(filepath, "utf-8"));
  } catch {
    return null;
  }
}

export function updateSubagentStatus(
  cwd: string,
  id: string,
  patch: Partial<SubagentStatus>,
): boolean {
  const existing = readSubagentStatus(cwd, id);
  if (!existing) return false;
  if (TERMINAL_STATES.has(existing.state)) return false;
  const merged: SubagentStatus = { ...existing, ...patch };
  writeSubagentStatus(cwd, id, merged);
  return true;
}
