// tests/prompt-templates.test.ts
import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { readdirSync, mkdtempSync, rmSync, mkdirSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { buildInjectedPrompt } from "../extensions/megapowers/prompt-inject.js";
import { writeState } from "../extensions/megapowers/state-io.js";
import { createInitialState, type MegapowersState } from "../extensions/megapowers/state-machine.js";
import { createStore } from "../extensions/megapowers/store.js";

const PROMPTS_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "prompts");

// Templates that are not interpolated by buildInjectedPrompt (different code path or no vars)
const SKIP_TEMPLATES = new Set(["megapowers-protocol.md", "base.md", "triage.md"]);

// Map template filenames to the phase + state that triggers their interpolation
const TEMPLATE_PHASE_MAP: Record<string, { phase: string; extras?: Partial<MegapowersState> }> = {
  "brainstorm.md": { phase: "brainstorm" },
  "write-spec.md": { phase: "spec" },
  "write-plan.md": { phase: "plan" },
  "review-plan.md": { phase: "review" },
  "implement-task.md": { phase: "implement", extras: { currentTaskIndex: 0 } },
  "verify.md": { phase: "verify" },
  "code-review.md": { phase: "code-review" },
  "reproduce-bug.md": { phase: "reproduce", extras: { workflow: "bugfix" } },
  "diagnose-bug.md": { phase: "diagnose", extras: { workflow: "bugfix" } },
  "generate-docs.md": { phase: "done", extras: { doneMode: "generate-docs" } },
  "generate-bugfix-summary.md": { phase: "done", extras: { doneMode: "generate-bugfix-summary", workflow: "bugfix" } },
  "write-changelog.md": { phase: "done", extras: { doneMode: "write-changelog" } },
  "capture-learnings.md": { phase: "done", extras: { doneMode: "capture-learnings" } },
};

describe("prompt template variable coverage (AC10)", () => {
  let tmp: string;

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), "template-var-test-"));
    // Create minimal artifacts so derivation and store reads work
    const dir = join(tmp, ".megapowers", "plans", "001-test");
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "plan.md"), "# Plan\n\n### Task 1: Build it\n");
    writeFileSync(join(dir, "spec.md"), "# Spec\n\n## Acceptance Criteria\n1. It works\n");
    writeFileSync(join(dir, "brainstorm.md"), "# Brainstorm\n\nSome ideas.");
    writeFileSync(join(dir, "diagnosis.md"), "# Diagnosis\n\n## Fixed When\n1. Bug is gone\n");
    writeFileSync(join(dir, "reproduce.md"), "# Reproduce\n\nSteps to reproduce.");
    writeFileSync(join(dir, "verify.md"), "# Verification\n\nAll tests pass.");
    writeFileSync(join(dir, "code-review.md"), "# Code Review\n\nLGTM.");
    // Create roadmap and learnings files
    writeFileSync(join(tmp, "ROADMAP.md"), "# Roadmap\n\nSome plans.");
    mkdirSync(join(tmp, ".megapowers", "learnings"), { recursive: true });
    writeFileSync(join(tmp, ".megapowers", "learnings", "learnings.md"), "# Learnings\n\nSome learnings.");
  });

  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  const templates = readdirSync(PROMPTS_DIR).filter(f => f.endsWith(".md"));

  for (const filename of templates) {
    if (SKIP_TEMPLATES.has(filename)) continue;

    it(`${filename} has no uninterpolated {{var}} placeholders in output`, () => {
      const mapping = TEMPLATE_PHASE_MAP[filename];
      // Fail loudly if a new template is added without a mapping
      if (!mapping) {
        throw new Error(
          `No phase mapping for ${filename} — add it to TEMPLATE_PHASE_MAP in prompt-templates.test.ts`
        );
      }

      const store = createStore(tmp);

      writeState(tmp, {
        ...createInitialState(),
        activeIssue: "001-test",
        workflow: (mapping.extras?.workflow as any) ?? "feature",
        phase: mapping.phase as any,
        megaEnabled: true,
        ...mapping.extras,
      });

      const result = buildInjectedPrompt(tmp, store);
      if (!result) {
        throw new Error(
          `buildInjectedPrompt returned null for ${filename} (phase=${mapping.phase}) — check state/store setup`
        );
      }

      // Check for uninterpolated variables (literal {{word}} in output)
      const uninterpolated = result.match(/\{\{(\w+)\}\}/g) ?? [];
      expect(uninterpolated).toEqual([]);
    });
  }
});
