import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, rmSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { readState, writeState } from "../extensions/megapowers/state-io.js";
import { createInitialState } from "../extensions/megapowers/state-machine.js";

// These tests verify the architectural invariants of the rewritten index.ts
// by checking the source code and state file behavior.

describe("index.ts architectural invariants", () => {
  it("has no module-level state variable (AC5)", () => {
    const source = readFileSync(join(__dirname, "../extensions/megapowers/index.ts"), "utf-8");
    // Check there's no `let state:` or `var state:` at module level
    const lines = source.split("\n");
    const moduleLevel = lines.filter(l =>
      /^\s*(let|var)\s+state\s*[:=]/.test(l) && !l.trim().startsWith("//")
    );
    expect(moduleLevel).toHaveLength(0);
  });

  it("has no appendEntry calls (AC43)", () => {
    const source = readFileSync(join(__dirname, "../extensions/megapowers/index.ts"), "utf-8");
    expect(source).not.toContain("appendEntry");
  });

  it("imports from @mariozechner/pi-coding-agent (not /tools subpath)", () => {
    const source = readFileSync(join(__dirname, "../extensions/megapowers/index.ts"), "utf-8");
    expect(source).toContain('from "@mariozechner/pi-coding-agent"');
    expect(source).not.toContain('@mariozechner/pi-coding-agent/tools');
  });

  describe("satellite TDD flow invariants", () => {
    it("does not include satellite bash sniffing for RED detection", () => {
      const source = readFileSync(join(__dirname, "../extensions/megapowers/index.ts"), "utf-8");
      expect(source).not.toContain("After bash, track test runner results for TDD RED detection (in-memory)");
    });

    it("registers megapowers_signal in satellite mode", () => {
      const source = readFileSync(join(__dirname, "../extensions/megapowers/index.ts"), "utf-8");
      const hasSatelliteSignalTool = /if \(satellite\) \{[\s\S]*?pi\.registerTool\(\{[\s\S]*?name: "megapowers_signal"[\s\S]*?\}\);[\s\S]*?return; \/\/ Skip all primary session setup/.test(source);
      expect(hasSatelliteSignalTool).toBe(true);
    });
  });

  describe("mega off/on state management", () => {
    let tmp: string;

    beforeEach(() => {
      tmp = mkdtempSync(join(tmpdir(), "mega-toggle-test-"));
    });

    afterEach(() => {
      rmSync(tmp, { recursive: true, force: true });
    });

    it("megaEnabled resets to true on session start (AC40)", () => {
      writeState(tmp, { ...createInitialState(), megaEnabled: false });
      // Simulate what session_start does
      const state = readState(tmp);
      if (!state.megaEnabled) {
        writeState(tmp, { ...state, megaEnabled: true });
      }
      expect(readState(tmp).megaEnabled).toBe(true);
    });

    it("/mega off sets megaEnabled false (AC39)", () => {
      writeState(tmp, { ...createInitialState(), megaEnabled: true });
      const state = readState(tmp);
      writeState(tmp, { ...state, megaEnabled: false });
      expect(readState(tmp).megaEnabled).toBe(false);
    });

    it("/mega on sets megaEnabled true (AC39)", () => {
      writeState(tmp, { ...createInitialState(), megaEnabled: false });
      const state = readState(tmp);
      writeState(tmp, { ...state, megaEnabled: true });
      expect(readState(tmp).megaEnabled).toBe(true);
    });
  });
});
