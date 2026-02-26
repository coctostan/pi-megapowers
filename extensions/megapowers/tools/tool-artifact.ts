// extensions/megapowers/tools/tool-artifact.ts
import { mkdirSync, writeFileSync, existsSync, renameSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { readState } from "../state/state-io.js";

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
export function handleSaveArtifact(cwd: string, phase: string, content: string): ArtifactResult {
  const state = readState(cwd);

  // AC38: early-return guard — tools stay registered but are non-functional when mega off
  if (!state.megaEnabled) {
    return { error: "Megapowers is disabled. Use /mega on to re-enable." };
  }

  if (!state.activeIssue) {
    return { error: "No active issue. Use /issue to select or create one first." };
  }

  const dir = join(cwd, ".megapowers", "plans", state.activeIssue);
  mkdirSync(dir, { recursive: true });

  const filePath = join(dir, `${phase}.md`);

  // Version existing artifact before overwriting
  if (existsSync(filePath)) {
    const existing = readdirSync(dir);
    const versionPattern = new RegExp(`^${phase}\\.v(\\d+)\\.md$`);
    let maxVersion = 0;
    for (const f of existing) {
      const match = f.match(versionPattern);
      if (match) {
        const v = parseInt(match[1], 10);
        if (v > maxVersion) maxVersion = v;
      }
    }
    const nextVersion = maxVersion + 1;
    renameSync(filePath, join(dir, `${phase}.v${nextVersion}.md`));
  }

  writeFileSync(filePath, content);

  return { message: `Artifact saved: .megapowers/plans/${state.activeIssue}/${phase}.md` };
}
