---
id: 6
title: Inline tool hints for done prompt
status: approved
depends_on:
  - 5
no_test: false
files_to_modify:
  - prompts/done.md
  - tests/phase-tool-guidance.test.ts
files_to_create: []
---

**Covers:** AC 11, AC 12, AC 14, AC 15.

**Files:**
- Modify: `prompts/done.md`
- Modify: `tests/phase-tool-guidance.test.ts`

**Step 1 — Write the failing test**
Append this block to `tests/phase-tool-guidance.test.ts`:

```ts
describe("phase-specific tool guidance — done", () => {
  it("done.md adds signature and symbol-name grounding to docs/summary actions", () => {
    const content = readPrompt("done.md");
    expectAll(content, [
      "When the document describes a new or modified API surface, use `symbol_graph` (or `read` with `symbol: \"<name>\"`) to pull the real signature into the doc. Do not paraphrase signatures from memory.",
      "When describing the fix's root cause or affected code, use `symbol_graph` to confirm the symbol names and locations before including them in the summary.",
    ]);
  });
});
```

**Step 2 — Run test, verify it fails**
Run: `bun test tests/phase-tool-guidance.test.ts`
Expected: FAIL — `expect(received).toContain(expected)` for the missing `done.md` tool-hint strings.

**Step 3 — Write minimal implementation**
Update `prompts/done.md` inline at the two wrap-up actions:

```md
### generate-docs
Generate a feature document summarizing what was built and why. Use the spec, plan, and verify artifacts. Inspect actual changed files via `bash("git diff --stat")` when needed.
When the document describes a new or modified API surface, use `symbol_graph` (or `read` with `symbol: "<name>"`) to pull the real signature into the doc. Do not paraphrase signatures from memory.
Write the document directly:
```

```md
### generate-bugfix-summary
Generate a bugfix summary document including root cause, fix approach, files changed, and how to verify the fix.
When describing the fix's root cause or affected code, use `symbol_graph` to confirm the symbol names and locations before including them in the summary.
Write it directly:
```

Keep the additions inline within the existing action instructions; do not create a separate guidance section under `## Action Instructions`.

**Step 4 — Run test, verify it passes**
Run: `bun test tests/phase-tool-guidance.test.ts`
Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: all passing
