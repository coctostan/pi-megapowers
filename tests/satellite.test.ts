import { describe, it, expect } from "bun:test";
import { isSatelliteMode } from "../extensions/megapowers/satellite.js";
import { readFileSync } from "node:fs";

describe("isSatelliteMode", () => {
  it("returns false when TTY is attached and no subagent signal", () => {
    expect(isSatelliteMode({ isTTY: true, env: {} })).toBe(false);
  });

  it("returns true when PI_SUBAGENT=1", () => {
    expect(isSatelliteMode({ isTTY: true, env: { PI_SUBAGENT: "1" } })).toBe(true);
  });

  it("returns false when no TTY but no subagent signal (could be CI or piped)", () => {
    expect(isSatelliteMode({ isTTY: false, env: {} })).toBe(false);
  });

  it("returns true when PI_SUBAGENT=1 even without TTY", () => {
    expect(isSatelliteMode({ isTTY: false, env: { PI_SUBAGENT: "1" } })).toBe(true);
  });

  it("returns false when isTTY is undefined (ambiguous — not satellite)", () => {
    expect(isSatelliteMode({ isTTY: undefined, env: {} })).toBe(false);
  });
});

describe("satellite module cleanup", () => {
  it("does not export loadSatelliteState or depend on createStore", () => {
    const source = readFileSync("extensions/megapowers/satellite.ts", "utf8");
    expect(source).not.toContain("loadSatelliteState");
    expect(source).not.toContain("createStore");
  });
});
