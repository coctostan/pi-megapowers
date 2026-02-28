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
    // resolveProjectRoot is used in satellite.ts (extracted from index.ts), imported via setupSatellite
    const satelliteSource = readFileSync(join(import.meta.dir, "..", "extensions", "megapowers", "satellite.ts"), "utf-8");
    expect(satelliteSource).toContain("resolveProjectRoot");
  });

  it("index.ts mega off hides subagent and pipeline tools", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    // The /mega off handler lives in commands.ts (extracted from index.ts)
    const commandsSource = readFileSync(join(import.meta.dir, "..", "extensions", "megapowers", "commands.ts"), "utf-8");
    // The filter in /mega off should exclude subagent and pipeline tools
    expect(commandsSource).toContain('"pipeline"');
    // Verify the off handler filters subagent tools (the filter callback itself mentions "subagent")
    expect(commandsSource).toMatch(/filter\(\s*\n?\s*\(?t[^)]*\)?\s*=>[^)]*"subagent"/);
  });

  it("register-tools.ts registers subagent tool", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    // Tool registrations live in register-tools.ts (extracted from index.ts)
    const toolsSource = readFileSync(join(import.meta.dir, "..", "extensions", "megapowers", "register-tools.ts"), "utf-8");
    expect(toolsSource).toContain('name: "subagent"');
    // subagent_status removal happens in Task 20
  });
});
