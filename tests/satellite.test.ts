import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { isSatelliteMode, loadSatelliteState } from "../extensions/megapowers/satellite.js";
import { createInitialState } from "../extensions/megapowers/state-machine.js";
import { createStore } from "../extensions/megapowers/store.js";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

describe("isSatelliteMode", () => {
  it("returns false when TTY is attached and no subagent signal", () => {
    expect(isSatelliteMode({ isTTY: true, env: {} })).toBe(false);
  });

  it("returns true when PI_SUBAGENT=1", () => {
    expect(isSatelliteMode({ isTTY: true, env: { PI_SUBAGENT: "1" } })).toBe(true);
  });

  it("returns true when no TTY attached (isTTY is false)", () => {
    expect(isSatelliteMode({ isTTY: false, env: {} })).toBe(true);
  });

  it("returns false when isTTY is undefined (ambiguous — not satellite)", () => {
    expect(isSatelliteMode({ isTTY: undefined, env: {} })).toBe(false);
  });
});

describe("loadSatelliteState", () => {
  let tmp: string;

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), "megapowers-satellite-test-"));
  });

  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  it("returns frozen state from store", () => {
    const store = createStore(tmp);
    const state = createInitialState();
    state.activeIssue = "001-test";
    state.phase = "implement";
    store.saveState(state);

    const loaded = loadSatelliteState(tmp);
    expect(loaded.activeIssue).toBe("001-test");
    expect(loaded.phase).toBe("implement");
    expect(() => { (loaded as any).phase = "plan"; }).toThrow();
  });

  it("returns frozen initial state when no state file exists", () => {
    const loaded = loadSatelliteState(tmp);
    expect(loaded.activeIssue).toBeNull();
    expect(() => { (loaded as any).phase = "plan"; }).toThrow();
  });
});
