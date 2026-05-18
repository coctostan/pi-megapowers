import { describe, it, expect } from "bun:test";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { writeState } from "../extensions/megapowers/state/state-io.js";
import { createInitialState } from "../extensions/megapowers/state/state-machine.js";
import { createStore } from "../extensions/megapowers/state/store.js";
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


describe("/mp context", () => {
  it("renders the same default and debug context report through the /mp registry", async () => {
    const tmp = mkdtempSync(join(tmpdir(), "mp-context-"));
    try {
      mkdirSync(join(tmp, ".megapowers", "plans", "001-test"), { recursive: true });
      writeFileSync(join(tmp, ".megapowers", "plans", "001-test", "spec.md"), "# Spec");
      writeState(tmp, { ...createInitialState(), activeIssue: "001-test", workflow: "feature", phase: "plan", planMode: "draft", planIteration: 1, megaEnabled: true });
      const before = readFileSync(join(tmp, ".megapowers", "state.json"), "utf-8");
      const deps = { ...makeDeps(), store: createStore(tmp) } as any;
      const ctx = { ...makeCtx(), cwd: tmp } as any;
      const registry = createMpRegistry(deps);

      const normal = await dispatchMpCommand("context", ctx, registry);
      const debug = await dispatchMpCommand("context debug", ctx, registry);
      const after = readFileSync(join(tmp, ".megapowers", "state.json"), "utf-8");
      const completions = mpArgumentCompletions("con") ?? [];

      expect(after).toBe(before);
      expect(normal).toContain("Workflow: feature");
      expect(normal).toContain("Phase: plan");
      expect(normal).toContain("Plan mode: draft");
      expect(normal).not.toContain("## Rendered prompt");
      expect(debug).toContain("## Rendered prompt");
      expect(debug).toContain("You are writing a step-by-step implementation plan");
      expect(completions.map((item) => item.value)).toContain("context");
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });
});
