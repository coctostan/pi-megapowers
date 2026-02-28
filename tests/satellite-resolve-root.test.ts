import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { resolveProjectRoot } from "../extensions/megapowers/satellite.js";

describe("resolveProjectRoot walks up to find .megapowers/state.json", () => {
  let root: string;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "mega-root-"));
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it("returns MEGA_PROJECT_ROOT when set", () => {
    const resolved = resolveProjectRoot("/some/cwd", { MEGA_PROJECT_ROOT: "/project" });
    expect(resolved).toBe("/project");
  });

  it("walks up from cwd to find .megapowers/state.json when MEGA_PROJECT_ROOT is not set", () => {
    mkdirSync(join(root, ".megapowers"), { recursive: true });
    writeFileSync(join(root, ".megapowers", "state.json"), "{}", "utf-8");

    const cwd = join(root, ".megapowers", "subagents", "p1", "workspace");
    mkdirSync(cwd, { recursive: true });

    const resolved = resolveProjectRoot(cwd, {});
    expect(resolved).toBe(root);
  });

  it("falls back to cwd when no state.json exists in parents", () => {
    const cwd = join(root, "no-state", "deep");
    mkdirSync(cwd, { recursive: true });

    const resolved = resolveProjectRoot(cwd, {});
    expect(resolved).toBe(cwd);
  });
});
