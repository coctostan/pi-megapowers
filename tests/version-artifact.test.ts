import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, rmSync, mkdirSync, readdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { versionArtifact } from "../extensions/megapowers/artifacts/version-artifact.js";

describe("versionArtifact", () => {
  let tmp: string;
  let planDir: string;

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), "version-artifact-"));
    planDir = join(tmp, ".megapowers", "plans", "001-test");
    mkdirSync(planDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  it("returns null and creates no files when the source artifact does not exist (AC11)", () => {
    const result = versionArtifact(planDir, "plan.md");
    expect(result).toBeNull();
    expect(readdirSync(planDir)).toEqual([]);
  });

  it("copies <filename> to <basename>.v1.md and returns the versioned filename (AC10)", () => {
    const src = join(planDir, "plan.md");
    writeFileSync(src, "plan v0");
    const versioned = versionArtifact(planDir, "plan.md");
    expect(versioned).toBe("plan.v1.md");
    expect(existsSync(join(planDir, "plan.v1.md"))).toBe(true);
    expect(readFileSync(join(planDir, "plan.v1.md"), "utf-8")).toBe("plan v0");
    expect(readFileSync(src, "utf-8")).toBe("plan v0");
  });

  it("creates sequential versions when called twice (v1, then v2) and preserves v1 (AC12)", () => {
    writeFileSync(join(planDir, "plan.md"), "p1");
    expect(versionArtifact(planDir, "plan.md")).toBe("plan.v1.md");
    expect(readFileSync(join(planDir, "plan.v1.md"), "utf-8")).toBe("p1");
    // change the source content to prove v2 is a new snapshot
    writeFileSync(join(planDir, "plan.md"), "p2");
    expect(versionArtifact(planDir, "plan.md")).toBe("plan.v2.md");
    expect(readFileSync(join(planDir, "plan.v2.md"), "utf-8")).toBe("p2");
    expect(readFileSync(join(planDir, "plan.v1.md"), "utf-8")).toBe("p1");
  });

  it("uses the highest existing version + 1 (v3 when v2 exists) (AC12/AC16)", () => {
    writeFileSync(join(planDir, "plan.md"), "p1");
    expect(versionArtifact(planDir, "plan.md")).toBe("plan.v1.md");

    writeFileSync(join(planDir, "plan.md"), "p2");
    expect(versionArtifact(planDir, "plan.md")).toBe("plan.v2.md");

    writeFileSync(join(planDir, "plan.md"), "p3");
    expect(versionArtifact(planDir, "plan.md")).toBe("plan.v3.md");
    expect(readFileSync(join(planDir, "plan.v3.md"), "utf-8")).toBe("p3");
    // older versions remain
    expect(readFileSync(join(planDir, "plan.v1.md"), "utf-8")).toBe("p1");
    expect(readFileSync(join(planDir, "plan.v2.md"), "utf-8")).toBe("p2");
  });
});
