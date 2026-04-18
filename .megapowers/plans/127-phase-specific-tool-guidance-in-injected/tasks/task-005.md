---
id: 5
title: Inline tool hints for reproduce/diagnose prompts
status: approved
depends_on:
  - 4
no_test: false
files_to_modify:
  - prompts/reproduce-bug.md
  - prompts/diagnose-bug.md
  - tests/phase-tool-guidance.test.ts
files_to_create: []
---

**Covers:** AC 9, AC 10, AC 12, AC 14, AC 15.

**Files:**
- Modify: `prompts/reproduce-bug.md`
- Modify: `prompts/diagnose-bug.md`
- Modify: `tests/phase-tool-guidance.test.ts`

**Step 1 — Write the failing test**
Append this block to `tests/phase-tool-guidance.test.ts`:

```ts
describe("phase-specific tool guidance — reproduce-bug/diagnose-bug", () => {
  it("reproduce-bug.md adds symbol, read, git, trace, and signature hints", () => {
    const content = readPrompt("reproduce-bug.md");
    expectAll(content, [
      "When the error mentions a specific symbol or file, use `symbol_graph` with `include: [\"source\"]` on the symbol in the stack trace, and `read` with hashline anchors for nearby context. Copy real signatures into the reproduction report.",
      "Use `bash` to run `git log --oneline -20 -- <path>` on the files from the stack trace, and `git diff <suspect-commit>` if one looks likely.",
      "Use `trace` from the entry point to confirm which boundaries the real execution path actually crosses (don't assume from architecture diagrams). Instrument those specific boundaries.",
      "Before writing the failing test, use `read` with `symbol: \"<name>\"` to pull the exact signature of the function you're calling into the test.",
    ]);
  });

  it("diagnose-bug.md adds trace, symbol_graph, contract, and impact hints", () => {
    const content = readPrompt("diagnose-bug.md");
    expectAll(content, [
      "Use `trace` from a known entry point to see the real call order the runtime follows, not the static call graph.",
      "Use `symbol_graph` (default compact card) on the function where the bad value first appears, to list its callers — those are your next candidates to inspect.",
      "Use `symbol_graph` with `include: [\"contract\"]` on the broken function to see its documented/tested guarantees and `impact` to see its dependents.",
      "Use `impact` on the function containing the root cause. The returned dependents are the risk surface the 'Fixed When' acceptance criteria must cover.",
    ]);
  });
});
```

**Step 2 — Run test, verify it fails**
Run: `bun test tests/phase-tool-guidance.test.ts`
Expected: FAIL — `expect(received).toContain(expected)` for the new `reproduce-bug.md` / `diagnose-bug.md` guidance strings.

**Step 3 — Write minimal implementation**
In `prompts/reproduce-bug.md`, add these inline hints at the matching steps:

```md
### Step 1 — Read error messages carefully
- Don't skip past errors or warnings — they often contain the answer
- Read stack traces completely: line numbers, file paths, error codes
- Note the exact error text (copy it, don't paraphrase)
- When the error mentions a specific symbol or file, use `symbol_graph` with `include: ["source"]` on the symbol in the stack trace, and `read` with hashline anchors for nearby context. Copy real signatures into the reproduction report.

### Step 2 — Check recent changes
...
- Use `bash` to run `git log --oneline -20 -- <path>` on the files from the stack trace, and `git diff <suspect-commit>` if one looks likely.

### Step 4 — Gather evidence in multi-component systems
...
Use `trace` from the entry point to confirm which boundaries the real execution path actually crosses (don't assume from architecture diagrams). Instrument those specific boundaries.

### Step 5 — Write a failing test (if feasible)
...
- Before writing the failing test, use `read` with `symbol: "<name>"` to pull the exact signature of the function you're calling into the test.
```

In `prompts/diagnose-bug.md`, add the new hints directly under the named phases:

```md
### Phase 1 — Trace to root cause
...
Use `trace` from a known entry point to see the real call order the runtime follows, not the static call graph.
Use `symbol_graph` (default compact card) on the function where the bad value first appears, to list its callers — those are your next candidates to inspect.

### Phase 2 — Pattern analysis
...
4. **Understand dependencies** — what other components, config, or state does this code depend on?
   Use `symbol_graph` with `include: ["contract"]` on the broken function to see its documented/tested guarantees and `impact` to see its dependents.

### After diagnosis — assess risk
- What else depends on the broken code?
- What could break if this is changed?
- Are there related bugs that share the same root cause?
- Use `impact` on the function containing the root cause. The returned dependents are the risk surface the 'Fixed When' acceptance criteria must cover.
```

Do not add the deferred Phase 2 `ast_search` pattern-analysis hint.

**Step 4 — Run test, verify it passes**
Run: `bun test tests/phase-tool-guidance.test.ts`
Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: all passing
