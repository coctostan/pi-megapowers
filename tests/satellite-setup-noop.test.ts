import { describe, it, expect } from "bun:test";
import { setupSatellite } from "../extensions/megapowers/satellite.js";

describe("setupSatellite", () => {
  it("does not install write-blocking hooks or register megapowers_signal (audit-only TDD)", () => {
    const events: string[] = [];
    const tools: string[] = [];

    const pi: any = {
      on: (event: string) => {
        events.push(event);
      },
      registerTool: (t: any) => {
        tools.push(t?.name);
      },
    };

    setupSatellite(pi);
    expect(events).not.toContain("tool_call");
    expect(events).not.toContain("tool_result");
    expect(tools).not.toContain("megapowers_signal");
  });
});
