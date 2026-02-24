// tests/write-policy.test.ts
import { describe, it, expect } from "bun:test";
import { canWrite } from "../extensions/megapowers/write-policy.js";
import type { TddTaskState } from "../extensions/megapowers/state-machine.js";

describe("canWrite — allowlisted files in all phases", () => {
  const BLOCKING_PHASES = ["brainstorm", "spec", "plan", "review", "verify", "done", "reproduce", "diagnose"] as const;
  const TDD_PHASES = ["implement", "code-review"] as const;
  const ALL_PHASES = [...BLOCKING_PHASES, ...TDD_PHASES] as const;

  // AC5: allowlisted files writable in every phase
  for (const phase of ALL_PHASES) {
    it(`allows README.md in ${phase} phase`, () => {
      const result = canWrite(phase, "README.md", true, false, null);
      expect(result.allowed).toBe(true);
    });

    it(`allows CHANGELOG.md in ${phase} phase`, () => {
      const result = canWrite(phase, "CHANGELOG.md", true, false, null);
      expect(result.allowed).toBe(true);
    });

    it(`allows docs/foo.md in ${phase} phase`, () => {
      const result = canWrite(phase, "docs/foo.md", true, false, null);
      expect(result.allowed).toBe(true);
    });

    it(`allows tsconfig.json in ${phase} phase`, () => {
      const result = canWrite(phase, "tsconfig.json", true, false, null);
      expect(result.allowed).toBe(true);
    });

    it(`allows .env in ${phase} phase`, () => {
      const result = canWrite(phase, ".env", true, false, null);
      expect(result.allowed).toBe(true);
    });

    it(`allows types.d.ts in ${phase} phase`, () => {
      const result = canWrite(phase, "types.d.ts", true, false, null);
      expect(result.allowed).toBe(true);
    });
  }

  // AC6: non-allowlisted source code blocked in all blocking phases (including bugfix phases)
  for (const phase of BLOCKING_PHASES) {
    it(`blocks src/app.ts in ${phase} phase`, () => {
      const result = canWrite(phase, "src/app.ts", true, false, null);
      expect(result.allowed).toBe(false);
    });

    it(`blocks lib/index.js in ${phase} phase`, () => {
      const result = canWrite(phase, "lib/index.js", true, false, null);
      expect(result.allowed).toBe(false);
    });
  }

  // AC7: TDD guard still enforced for source files during implement
  it("blocks source files in implement when TDD not satisfied", () => {
    const result = canWrite("implement", "src/app.ts", true, false, null);
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("TDD");
  });

  it("allows source files in implement when TDD impl-allowed", () => {
    const tdd: TddTaskState = { taskIndex: 1, state: "impl-allowed", skipped: false };
    const result = canWrite("implement", "src/app.ts", true, false, tdd);
    expect(result.allowed).toBe(true);
  });

  it("allows test files in implement without TDD", () => {
    const result = canWrite("implement", "tests/foo.test.ts", true, false, null);
    expect(result.allowed).toBe(true);
  });

  // mega off and no phase passthrough still work
  it("allows everything when mega is off", () => {
    const result = canWrite("spec", "src/app.ts", false, false, null);
    expect(result.allowed).toBe(true);
  });

  it("allows everything when phase is null", () => {
    const result = canWrite(null, "src/app.ts", true, false, null);
    expect(result.allowed).toBe(true);
  });
});
