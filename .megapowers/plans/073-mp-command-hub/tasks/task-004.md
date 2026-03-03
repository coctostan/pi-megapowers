---
id: 4
title: Implement /mp new as an inject-tier handler that sends an issue-drafting prompt
status: approved
depends_on:
  - 1
  - 2
no_test: false
files_to_modify:
  - extensions/megapowers/mp/mp-handlers.ts
files_to_create: []
---

### Task 4: Implement /mp new as an inject-tier handler that sends an issue-drafting prompt

**Files:**
- Modify: `extensions/megapowers/mp/mp-handlers.ts`
- Test: `tests/mp-new-inject.test.ts`

**Step 1 — Write the failing test**
```ts
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
```

**Step 2 — Run test, verify it fails**
Run: `bun test tests/mp-new-inject.test.ts`
Expected: FAIL — `expected 0 to be 1` (because the placeholder handler does not call `pi.sendUserMessage()`)

**Step 3 — Write minimal implementation**
Update `extensions/megapowers/mp/mp-handlers.ts` by replacing the placeholder `new` handler with an inject implementation.

Add this helper near the top (or bottom) of the file:
```ts
function buildMpNewInjectPrompt(): string {
  return `You are drafting a new megapowers issue.

Conversation goals:
1) Ask the user for a short, specific title.
2) Ask for the type: feature or bugfix.
3) Ask for a detailed description.
4) Optionally ask for milestone (string) and priority (number).
5) Optionally ask for sources (array of issue IDs) if this is a batch.

Important rules:
- Do NOT create the issue directly.
- Once you have the information, call the tool \`create_issue\` exactly once.

When calling \`create_issue\`, pass:
- title: string (required)
- type: \"feature\" | \"bugfix\" (required)
- description: string (required)
- milestone: string (optional)
- priority: number (optional)
- sources: number[] (optional)
`;
}
```

Then update the handler:
```ts
registry.new = {
  tier: "inject",
  description: "Draft a new issue conversationally (will call create_issue)",
  execute: async (_args: string, ctx: ExtensionCommandContext) => {
    const prompt = buildMpNewInjectPrompt();

    if (ctx.isIdle()) {
      deps.pi.sendUserMessage(prompt);
    } else {
      // If the agent is busy streaming, queue as follow-up.
      deps.pi.sendUserMessage(prompt, { deliverAs: "followUp" });
      if (ctx.hasUI) ctx.ui.notify("Queued issue-drafting prompt as follow-up.", "info");
    }
  },
};
```

**Step 4 — Run test, verify it passes**
Run: `bun test tests/mp-new-inject.test.ts`
Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: all passing
