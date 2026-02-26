/**
 * Reproduction tests for #084 — Quick Wins: Broken Interactions & Missing Guards
 *
 * Bug 1 (#069): Backward phase transitions unreachable via tool or command
 * Bug 2 (#041): Artifact overwrite silently destroys previous content (no versioning)
 * Bug 3 (#061): Already fixed — jj mismatch dialog frozen (kept as regression test)
 */
import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { handleSignal } from "../extensions/megapowers/tools/tool-signal.js";
import { handleSaveArtifact } from "../extensions/megapowers/tools/tool-artifact.js";
import { writeState } from "../extensions/megapowers/state/state-io.js";
import { createInitialState, type MegapowersState } from "../extensions/megapowers/state/state-machine.js";

function setState(tmp: string, overrides: Partial<MegapowersState>) {
  writeState(tmp, { ...createInitialState(), activeIssue: "001-test", workflow: "feature", ...overrides });
}

function writeArtifact(tmp: string, issue: string, filename: string, content: string) {
  const dir = join(tmp, ".megapowers", "plans", issue);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, filename), content);
}

// ---------------------------------------------------------------------------
// Bug 1 (#069): Backward phase transitions unreachable
// ---------------------------------------------------------------------------
describe("#069 — backward phase transitions via megapowers_signal", () => {
  let tmp: string;

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), "084-signal-"));
  });
  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  it("phase_next with no target always goes forward (done), never backward (implement)", () => {
    // Setup: feature workflow in code-review phase with completed tasks
    setState(tmp, {
      phase: "code-review",
      workflow: "feature",
      completedTasks: [1],
    });
    writeArtifact(tmp, "001-test", "plan.md", "## Tasks\n1. [x] Task one");
    writeArtifact(tmp, "001-test", "code-review.md", "# Code Review\nApproved.");

    // BUG: handleSignal does not accept a target parameter for phase_next
    // The tool schema only has `action`, no `target` field
    // So backward transitions (code-review → implement) are unreachable
    const result = handleSignal(tmp, "phase_next", undefined);

    // Without a target, phase_next picks the first valid transition from code-review,
    // which is "done" (forward), not "implement" (backward).
    // There's no way to specify we want to go backward to implement.
    expect(result.error).toBeUndefined();
    expect(result.message).toContain("done");
  });

  it("phase_next accepts target and can transition backward to implement", () => {
    setState(tmp, {
      phase: "code-review",
      workflow: "feature",
      completedTasks: [1],
    });
    writeArtifact(tmp, "001-test", "plan.md", "## Tasks\n1. [x] Task one");
    writeArtifact(tmp, "001-test", "code-review.md", "# Code Review\nApproved.");

    const result = handleSignal(tmp, "phase_next", undefined, "implement");

    expect(result.error).toBeUndefined();
    expect(result.message).toContain("implement");
  });
});

// ---------------------------------------------------------------------------
// Bug 2 (#041): Artifact overwrite — no versioning
// ---------------------------------------------------------------------------
describe("#041 — artifact overwrite protection and versioning", () => {
  let tmp: string;

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), "084-artifact-"));
  });
  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  it("creates spec.v1.md when overwriting an existing artifact", () => {
    setState(tmp, { phase: "spec", megaEnabled: true });

    // First save
    handleSaveArtifact(tmp, "spec", "# Original spec\nVersion 1 content");
    const path = join(tmp, ".megapowers", "plans", "001-test", "spec.md");
    expect(readFileSync(path, "utf-8")).toBe("# Original spec\nVersion 1 content");

    // Second save — previous content should be versioned
    handleSaveArtifact(tmp, "spec", "# Revised spec\nVersion 2 content");
    expect(readFileSync(path, "utf-8")).toBe("# Revised spec\nVersion 2 content");

    const dir = join(tmp, ".megapowers", "plans", "001-test");
    expect(readFileSync(join(dir, "spec.v1.md"), "utf-8")).toBe("# Original spec\nVersion 1 content");
  });

  it("third overwrite preserves both prior versions", () => {
    setState(tmp, { phase: "plan", megaEnabled: true });

    handleSaveArtifact(tmp, "plan", "# Plan v1");
    handleSaveArtifact(tmp, "plan", "# Plan v2");
    handleSaveArtifact(tmp, "plan", "# Plan v3");

    const dir = join(tmp, ".megapowers", "plans", "001-test");
    const files = readdirSync(dir).sort();

    expect(files).toEqual(["plan.md", "plan.v1.md", "plan.v2.md"]);
    expect(readFileSync(join(dir, "plan.md"), "utf-8")).toBe("# Plan v3");
    expect(readFileSync(join(dir, "plan.v1.md"), "utf-8")).toBe("# Plan v1");
    expect(readFileSync(join(dir, "plan.v2.md"), "utf-8")).toBe("# Plan v2");
  });
});

// ---------------------------------------------------------------------------
// Bug 3 (#061): jj mismatch — ALREADY FIXED (regression test)
// ---------------------------------------------------------------------------
describe("#061 — jj mismatch dialog (regression — already fixed)", () => {
  it("hooks.ts uses startsWith comparison, not strict equality", async () => {
    // Read the hooks source and verify the fix is in place
    const hooksSource = readFileSync(
      join(process.cwd(), "extensions/megapowers/hooks.ts"),
      "utf-8"
    );
    // The fix: uses startsWith instead of !== for change ID comparison
    expect(hooksSource).toContain("startsWith");
    // The fix: auto-updates instead of showing a frozen select dialog
    expect(hooksSource).not.toContain("ctx.ui.select");
  });
});
