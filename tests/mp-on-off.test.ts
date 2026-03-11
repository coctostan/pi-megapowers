import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { createMpRegistry } from "../extensions/megapowers/mp/mp-handlers.js";
import { writeState, readState } from "../extensions/megapowers/state/state-io.js";
import { createInitialState } from "../extensions/megapowers/state/state-machine.js";

function makeMockPi() {
  let active = ["megapowers_signal", "other"];
  return {
    getActiveTools: () => active,
    setActiveTools: (names: string[]) => {
      active = names;
    },
    sendUserMessage: (_c: any, _o?: any) => {},
  } as any;
}

describe("/mp on|off", () => {
  let tmp: string;

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), "mp-on-off-"));
  });

  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  it("/mp off disables mega enforcement and hides megapowers_signal (AC17)", async () => {
    writeState(tmp, { ...createInitialState(), megaEnabled: true });

    const pi = makeMockPi();
    const deps = { pi, store: {} as any, ui: {} as any } as any;
    const ctx = { cwd: tmp, hasUI: false, isIdle: () => true, ui: { notify: () => {} } } as any;

    const registry = createMpRegistry(deps);
    await registry.off.execute("", ctx);

    const state = readState(tmp);
    expect(state.megaEnabled).toBe(false);
    expect(pi.getActiveTools()).not.toContain("megapowers_signal");
    expect(pi.getActiveTools()).not.toContain("subagent");
    expect(pi.getActiveTools()).not.toContain("pipeline");
  });

  it("/mp on enables mega enforcement and restores megapowers_signal (AC17)", async () => {
    writeState(tmp, { ...createInitialState(), megaEnabled: false });

    const pi = makeMockPi();
    // simulate that tools were hidden
    pi.setActiveTools(["other"]);

    const deps = { pi, store: {} as any, ui: {} as any } as any;
    const ctx = { cwd: tmp, hasUI: false, isIdle: () => true, ui: { notify: () => {} } } as any;

    const registry = createMpRegistry(deps);
    await registry.on.execute("", ctx);

    const state = readState(tmp);
    expect(state.megaEnabled).toBe(true);
    expect(pi.getActiveTools()).toContain("megapowers_signal");
    expect(pi.getActiveTools()).not.toContain("pipeline");
    expect(pi.getActiveTools()).not.toContain("subagent");
  });
});
