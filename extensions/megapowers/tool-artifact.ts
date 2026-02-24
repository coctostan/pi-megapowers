// extensions/megapowers/tool-artifact.ts
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { readState } from "./state-io.js";

export interface ArtifactResult {
  message?: string;
  error?: string;
}

/**
 * Save a phase artifact (spec, plan, diagnosis, etc.) to disk.
 *
 * AC38: returns error immediately when megaEnabled is false — defense-in-depth
 * alongside setActiveTools() which hides tools from the LLM prompt.
 */
export function handleSaveArtifact(cwd: string, phase: string, content: string, overwrite?: boolean): ArtifactResult {
  const state = readState(cwd);

  // AC38: early-return guard — tools stay registered but are non-functional when mega off
  if (!state.megaEnabled) {
    return { error: "Megapowers is disabled. Use /mega on to re-enable." };
  }

  if (!state.activeIssue) {
    return { error: "No active issue. Use /issue to select or create one first." };
  }

  const dir = join(cwd, ".megapowers", "plans", state.activeIssue);
  const filePath = join(dir, `${phase}.md`);
  mkdirSync(dir, { recursive: true });

  if (existsSync(filePath) && !overwrite) {
    return { error: `File already exists: .megapowers/plans/${state.activeIssue}/${phase}.md. Pass overwrite: true to replace it.` };
  }

  writeFileSync(filePath, content);

  return { message: `Artifact saved: .megapowers/plans/${state.activeIssue}/${phase}.md` };
}
