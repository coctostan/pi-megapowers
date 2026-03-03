import { describe, it, expect } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createMpRegistry } from "../extensions/megapowers/mp/mp-handlers.js";
import { dispatchMpCommand, mpArgumentCompletions } from "../extensions/megapowers/mp/mp-command.js";

function makeDeps() {
  const pi = {
    sendUserMessage: (_content: any, _opts?: any) => {},
    getActiveTools: () => [],
    setActiveTools: (_names: string[]) => {},
  } as any;

  return {
    pi,
    store: {} as any,
    ui: {} as any,
  } as any;
}

function makeCtx() {
  return {
    cwd: process.cwd(),
    hasUI: false,
    isIdle: () => true,
    ui: { notify: () => {} },
  } as any;
}

describe("/mp command hub dispatch", () => {
  it("/mp with no args dispatches to help (same as /mp help)", async () => {
    const deps = makeDeps();
    const ctx = makeCtx();
    const registry = createMpRegistry(deps);

    const a = await dispatchMpCommand("", ctx, registry);
    const b = await dispatchMpCommand("help", ctx, registry);

    expect(a).toBe(b);
    expect(a).toContain("Available subcommands");
  });

  it("unknown subcommand dispatches to help (same as /mp help)", async () => {
    const deps = makeDeps();
    const ctx = makeCtx();
    const registry = createMpRegistry(deps);

    const a = await dispatchMpCommand("nope", ctx, registry);
    const b = await dispatchMpCommand("help", ctx, registry);
    expect(a).toBe(b);
  });

  it("dispatch is case-insensitive for subcommand matching", async () => {
    const deps = makeDeps();
    const ctx = makeCtx();
    const registry = createMpRegistry(deps);

    const a = await dispatchMpCommand("HELP", ctx, registry);
    const b = await dispatchMpCommand("help", ctx, registry);

    expect(a).toBe(b);
  });
});

describe("/mp argument completions", () => {
  it("returns completions for all registered subcommand names", () => {
    const all = mpArgumentCompletions("");
    expect(all).not.toBeNull();
    const values = (all ?? []).map((i) => i.value);

    // Spot-check a few, including stubs
    expect(values).toContain("help");
    expect(values).toContain("new");
    expect(values).toContain("status");
  });
});

describe("/mp is registered in index.ts", () => {
  it("registers a single /mp command", () => {
    const source = readFileSync(join(process.cwd(), "extensions", "megapowers", "index.ts"), "utf-8");
    expect(source).toContain('pi.registerCommand("mp"');
  });
});
