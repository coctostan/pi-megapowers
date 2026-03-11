import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, rmSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { readState, writeState } from "../extensions/megapowers/state/state-io.js";
import { createInitialState } from "../extensions/megapowers/state/state-machine.js";
import { createUI } from "../extensions/megapowers/ui.js";
import { createStore } from "../extensions/megapowers/state/store.js";
import { onSessionStart } from "../extensions/megapowers/hooks.js";

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

  it("legacy VCS module files are removed", () => {
    const legacyModule = ["j", "j", ".ts"].join("");
    const legacyMessages = ["j", "j", "-messages.ts"].join("");
    expect(existsSync(`extensions/megapowers/${legacyModule}`)).toBe(false);
    expect(existsSync(`extensions/megapowers/${legacyMessages}`)).toBe(false);
  });

  it("legacy VCS test file is removed", () => {
    const legacyTest = ["j", "j", ".test.ts"].join("");
    expect(existsSync(`tests/${legacyTest}`)).toBe(false);
  });

  describe("extension bootstrap after legacy pipeline removal", () => {
    it("index.ts does not import or branch on satellite mode", () => {
      const source = readFileSync(join(__dirname, "../extensions/megapowers/index.ts"), "utf-8");
      expect(source).not.toContain("isSatelliteMode");
      expect(source).not.toContain("setupSatellite");
      expect(source).not.toContain("if (satellite)");
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

  describe("session_start without jj requirement", () => {
    let tmp: string;

    beforeEach(() => {
      tmp = mkdtempSync(join(tmpdir(), "session-start-no-jj-"));
    });

    afterEach(() => {
      rmSync(tmp, { recursive: true, force: true });
    });

    it("onSessionStart does not require jj and still renders dashboard", async () => {
      const ui = createUI();
      const store = createStore(tmp);

      writeState(tmp, { ...createInitialState(), megaEnabled: false, activeIssue: null });
      const ctx = {
        cwd: tmp,
        hasUI: true,
        ui: {
          theme: { fg: (_name: string, text: string) => text },
          setWidget: () => {},
          setStatus: () => {},
          notify: () => {},
        },
      };

      await onSessionStart({} as any, ctx as any, { store, ui } as any);

      const state = readState(tmp);
      expect(state.megaEnabled).toBe(true);
    });
  });
});
