import { describe, it, expect } from "bun:test";
import { createMpRegistry, renderMpHelp } from "../extensions/megapowers/mp/mp-handlers.js";

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

describe("/mp help", () => {
  it("renders a formatted help listing that includes all registered subcommands and their descriptions", async () => {
    const deps = makeDeps();
    const registry = createMpRegistry(deps);

    const helpText = renderMpHelp(registry);

    // Must include all subcommands from the spec
    const expectedSubs = [
      "help",
      "new",
      "on",
      "off",
      "council",
      "audit",
      "health",
      "ship",
      "retro",
      "export",
      "quick",
      "back",
      "status",
    ];

    for (const sub of expectedSubs) {
      expect(helpText).toContain(`/mp ${sub}`);
      expect(helpText).toContain(registry[sub].description);
    }

    // Basic formatting contract
    expect(helpText).toContain("Megapowers");
    expect(helpText.split("\n").some((l) => l.includes("—"))).toBe(true);
  });

  it("stub handlers return Coming soon.", async () => {
    const deps = makeDeps();
    const registry = createMpRegistry(deps);

    const ctx = { hasUI: false, isIdle: () => true, ui: { notify: () => {} } } as any;
    const result = await registry.council.execute("", ctx);
    expect(result).toBe("Coming soon.");
  });
});
