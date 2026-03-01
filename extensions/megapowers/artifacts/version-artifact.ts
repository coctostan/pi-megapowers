import { copyFileSync, existsSync, readdirSync } from "node:fs";
import { join, basename } from "node:path";

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Copy `<filename>` to `<basename>.v{N}.md` where N is 1 higher than the highest existing version.
 *
 * Returns the versioned filename, or null if the source file does not exist.
 */
export function versionArtifact(planDir: string, filename: string): string | null {
  const srcPath = join(planDir, filename);
  if (!existsSync(srcPath)) return null;

  const base = basename(filename, ".md");
  const files = readdirSync(planDir);
  const pattern = new RegExp(`^${escapeRegExp(base)}\\.v(\\d+)\\.md$`);

  let max = 0;
  for (const f of files) {
    const m = f.match(pattern);
    if (!m) continue;
    const v = Number.parseInt(m[1], 10);
    if (Number.isFinite(v) && v > max) max = v;
  }

  const next = max + 1;
  const versionedFilename = `${base}.v${next}.md`;
  const dstPath = join(planDir, versionedFilename);

  copyFileSync(srcPath, dstPath);
  return versionedFilename;
}
