import { describe, it, expect } from "bun:test";
import { resolveProjectRoot, isSatelliteMode } from "../extensions/megapowers/satellite.js";

describe("resolveProjectRoot", () => {
  it("returns MEGA_PROJECT_ROOT when set", () => {
    const root = resolveProjectRoot("/workspace/sa-001/workspace", { MEGA_PROJECT_ROOT: "/project" });
    expect(root).toBe("/project");
  });

  it("returns cwd when MEGA_PROJECT_ROOT is not set", () => {
    const root = resolveProjectRoot("/project", {});
    expect(root).toBe("/project");
  });

  it("returns cwd when MEGA_PROJECT_ROOT is empty string", () => {
    const root = resolveProjectRoot("/project", { MEGA_PROJECT_ROOT: "" });
    expect(root).toBe("/project");
  });
});

describe("satellite integration", () => {
  it("satellite mode with MEGA_PROJECT_ROOT resolves to project root", () => {
    const env = { PI_SUBAGENT: "1", MEGA_PROJECT_ROOT: "/real/project" };
    expect(isSatelliteMode({ isTTY: false, env })).toBe(true);
    const root = resolveProjectRoot("/workspace/sa-001/workspace", env);
    expect(root).toBe("/real/project");
  });

  it("index.ts imports resolveProjectRoot for satellite state reads", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const indexSource = readFileSync(join(import.meta.dir, "..", "extensions", "megapowers", "index.ts"), "utf-8");
    expect(indexSource).toContain("resolveProjectRoot");
  });

  it("index.ts mega off hides subagent tools", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const indexSource = readFileSync(join(import.meta.dir, "..", "extensions", "megapowers", "index.ts"), "utf-8");
    // The filter in /mega off should exclude subagent tools
    expect(indexSource).toContain('"subagent_status"');
    // Verify the off handler filters subagent tools (the filter callback itself mentions "subagent")
    expect(indexSource).toMatch(/filter\(\s*\n?\s*t\s*=>[^)]*"subagent"/);
  });

  it("index.ts registers subagent and subagent_status tools", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const indexSource = readFileSync(join(import.meta.dir, "..", "extensions", "megapowers", "index.ts"), "utf-8");
    expect(indexSource).toContain('name: "subagent"');
    expect(indexSource).toContain('name: "subagent_status"');
  });
});
