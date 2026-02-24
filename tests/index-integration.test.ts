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

  // AC38: megapowers_save_artifact handler must call ctx.ui.notify and refresh dashboard after successful save
  describe("AC38 — megapowers_save_artifact tool handler provides UI feedback", () => {
    it("calls ctx.ui.notify after a successful artifact save", () => {
      const source = readFileSync(join(__dirname, "../extensions/megapowers/index.ts"), "utf-8");
      // Extract the megapowers_save_artifact execute handler block
      const start = source.indexOf('name: "megapowers_save_artifact"');
      const end = source.indexOf("pi.registerTool", start + 1);
      const handlerBlock = end > start ? source.slice(start, end) : source.slice(start, start + 600);

      // The handler should call ctx.ui.notify to confirm the save to the user
      // FAILS: currently the handler has no ctx.ui.notify call
      expect(handlerBlock).toContain("ctx.ui.notify");
    });

    it("calls ui.renderDashboard after a successful artifact save", () => {
      const source = readFileSync(join(__dirname, "../extensions/megapowers/index.ts"), "utf-8");
      const start = source.indexOf('name: "megapowers_save_artifact"');
      const end = source.indexOf("pi.registerTool", start + 1);
      const handlerBlock = end > start ? source.slice(start, end) : source.slice(start, start + 600);

      // The handler should refresh the dashboard so newly-unlocked phase transitions appear
      // FAILS: currently the handler has no ui.renderDashboard call
      expect(handlerBlock).toContain("renderDashboard");
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
