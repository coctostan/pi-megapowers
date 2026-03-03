import { describe, it, expect } from "bun:test";
import { createMpRegistry } from "../extensions/megapowers/mp/mp-handlers.js";

describe("/mp new (inject)", () => {
  it("sends a conversational prompt that gathers title/type/description and optional milestone/priority, then instructs to call create_issue (AC6, AC7)", async () => {
    const sent: { content: any; opts?: any }[] = [];

    const pi = {
      sendUserMessage: (content: any, opts?: any) => sent.push({ content, opts }),
      getActiveTools: () => [],
      setActiveTools: (_names: string[]) => {},
    } as any;

    const deps = { pi, store: {} as any, ui: {} as any } as any;

    const ctx = {
      cwd: process.cwd(),
      hasUI: false,
      isIdle: () => true,
      ui: { notify: () => {} },
    } as any;

    const registry = createMpRegistry(deps);
    await registry.new.execute("", ctx);

    expect(sent.length).toBe(1);

    const prompt = typeof sent[0].content === "string" ? sent[0].content : JSON.stringify(sent[0].content);

    expect(prompt).toContain("title");
    expect(prompt).toContain("type");
    expect(prompt).toContain("description");
    expect(prompt).toContain("milestone");
    expect(prompt).toContain("priority");

    // Must instruct the model to call the tool (not create the issue directly)
    expect(prompt).toContain("create_issue");
    expect(prompt.toLowerCase()).toContain("call");
  });
});
