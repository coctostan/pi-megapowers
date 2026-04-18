---
id: 4
title: Inline tool hints for verify/code-review prompts
status: approved
depends_on:
  - 3
no_test: false
files_to_modify:
  - prompts/verify.md
  - prompts/code-review.md
  - tests/phase-tool-guidance.test.ts
files_to_create: []
---

**Covers:** AC 7, AC 8, AC 12, AC 14, AC 15.

**Files:**
- Modify: `prompts/verify.md`
- Modify: `prompts/code-review.md`
- Modify: `tests/phase-tool-guidance.test.ts`

**Step 1 — Write the failing test**
Append this block to `tests/phase-tool-guidance.test.ts`:

```ts
describe("phase-specific tool guidance — verify/code-review", () => {
  it("verify.md adds impact, symbol_graph, ast_search, and trace evidence hints", () => {
    const content = readPrompt("verify.md");
    expectAll(content, [
      "Before concluding the suite covers the change, use `impact` on the primary symbol you changed to list downstream dependents. Confirm every surfaced dependent's test ran.",
      "Use `symbol_graph` on the symbol the criterion describes to confirm it exists with the expected shape; paste the card output (or anchored source from `include: [\"source\"]`) into the evidence block.",
      "Use `ast_search` when the criterion is about a structural pattern across multiple sites.",
      "Use `trace` from the feature's real entry point to confirm the new code is on the executed path. Paste the trace output into the evidence block.",
      "| New behavior is actually reached | `trace` from the feature's entry point shows the new code on the path | Test that constructs the call directly, bypassing the real entry |",
    ]);
  });

  it("code-review.md adds codex-review, contract, impact, and anchored-fix hints", () => {
    const content = readPrompt("code-review.md");
    expectAll(content, [
      "Run `/codex-review --base <ref>` early (against `main` or the feature's base branch) and treat the findings as input.",
      "For high-stakes changes (security-sensitive code, data-loss risk, public API surface, or architecture-level changes), also run `/codex-adversarial-review --base <ref>` with focus text describing the risk area.",
      "Use `symbol_graph` with `include: [\"contract\"]` on the changed symbol to see its current guards, throws, and invariants. Flag any behavior in the contract that isn't covered by a test.",
      "Run `impact` with `changeType: \"signature_change\"` on every public symbol modified in the diff. The returned dependents are the 'breaking change' surface — the review must either confirm they're updated or call out the break explicitly.",
      "Prefer `symbol_graph` and `read` with `symbol: \"<name>\"` over paraphrasing.",
      "When applying fixes inline, re-read the changed symbols with `read` using hashline anchors and edit through those anchors. For any signature change you make during fixes, re-run `impact` and update dependent files in the same session.",
    ]);
  });
});
```

**Step 2 — Run test, verify it fails**
Run: `bun test tests/phase-tool-guidance.test.ts`
Expected: FAIL — `expect(received).toContain(expected)` for the new `verify.md` / `code-review.md` guidance strings.

**Step 3 — Write minimal implementation**
In `prompts/verify.md`, add these inline hints:

```md
### Step 1: Run the full test suite fresh
Not from memory. Run the actual commands now and show the output.
Before concluding the suite covers the change, use `impact` on the primary symbol you changed to list downstream dependents. Confirm every surfaced dependent's test ran.

### Step 2: For each acceptance criterion, follow the Gate Function:
...
Use `symbol_graph` on the symbol the criterion describes to confirm it exists with the expected shape; paste the card output (or anchored source from `include: ["source"]`) into the evidence block.
Use `ast_search` when the criterion is about a structural pattern across multiple sites.
Use `trace` from the feature's real entry point to confirm the new code is on the executed path. Paste the trace output into the evidence block.
```

Add this row to `## What Actually Proves a Claim`:

```md
| New behavior is actually reached | `trace` from the feature's entry point shows the new code on the path | Test that constructs the call directly, bypassing the real entry |
```

In `prompts/code-review.md`, add these sentences at the top of `## Instructions`:

```md
Run `/codex-review --base <ref>` early (against `main` or the feature's base branch) and treat the findings as input. Cite findings you adopt with file:line; explicitly reject findings you disagree with and say why. Do not silently ignore.
For high-stakes changes (security-sensitive code, data-loss risk, public API surface, or architecture-level changes), also run `/codex-adversarial-review --base <ref>` with focus text describing the risk area. Same citation rules.
```

Then add the anchored review hints inside the existing bullets/sections:

```md
**Code Quality:**
- Correctness — edge cases, error handling, race conditions
  Use `symbol_graph` with `include: ["contract"]` on the changed symbol to see its current guards, throws, and invariants. Flag any behavior in the contract that isn't covered by a test.
...
**Architecture:**
- Breaking changes identified and documented
  Run `impact` with `changeType: "signature_change"` on every public symbol modified in the diff. The returned dependents are the 'breaking change' surface — the review must either confirm they're updated or call out the break explicitly.
```

Tighten the rules line to read:

```md
- **Verify suggestions against codebase reality** before making them — read the actual code. Prefer `symbol_graph` and `read` with `symbol: "<name>"` over paraphrasing. When a finding references a symbol, its real name and signature must appear in the finding verbatim.
```

Add this sentence to `### If **needs-fixes**`:

```md
When applying fixes inline, re-read the changed symbols with `read` using hashline anchors and edit through those anchors. For any signature change you make during fixes, re-run `impact` and update dependent files in the same session.
```

Keep the review prompt readable by tightening nearby prose instead of creating a new tool appendix.

**Step 4 — Run test, verify it passes**
Run: `bun test tests/phase-tool-guidance.test.ts`
Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: all passing
