import { describe, it, expect } from "bun:test";
import { isSatelliteMode } from "../extensions/megapowers/satellite.js";

describe("isSatelliteMode with PI_SUBAGENT_DEPTH", () => {
  it("treats PI_SUBAGENT=1 as satellite mode (legacy)", () => {
    expect(isSatelliteMode({ isTTY: false, env: { PI_SUBAGENT: "1" } })).toBe(true);
  });

  it("treats PI_SUBAGENT_DEPTH=1 as satellite mode", () => {
    expect(isSatelliteMode({ isTTY: false, env: { PI_SUBAGENT_DEPTH: "1" } })).toBe(true);
  });

  it("does not treat PI_SUBAGENT_DEPTH=0 as satellite mode", () => {
    expect(isSatelliteMode({ isTTY: false, env: { PI_SUBAGENT_DEPTH: "0" } })).toBe(false);
  });
});
