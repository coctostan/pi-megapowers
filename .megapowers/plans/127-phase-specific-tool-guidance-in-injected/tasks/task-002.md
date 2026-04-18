---
id: 2
title: Inline tool hints for plan/review prompts
status: approved
depends_on:
  - 1
no_test: false
files_to_modify:
  - prompts/write-plan.md
  - prompts/review-plan.md
  - tests/phase-tool-guidance.test.ts
files_to_create: []
---

**Covers:** AC 3, AC 4, AC 12, AC 14, AC 15.

**Files:**
- Modify: `prompts/write-plan.md`
- Modify: `prompts/review-plan.md`
- Modify: `tests/phase-tool-guidance.test.ts`

**Step 1 — Write the failing test**
Append this block to `tests/phase-tool-guidance.test.ts`:

```ts
describe("phase-specific tool guidance — write-plan/review-plan", () => {
  it("write-plan.md adds batching, symbol, trace, impact, and signature-lifting hints", () => {
    const content = readPrompt("write-plan.md");
    expectAll(content, [
      "When grounding spans many lookups (multiple `symbol_graph` calls, greps, and reads across ≥5 files), prefer batching them through `code_execution` in a single script rather than issuing many sequential tool calls.",
      "Use `symbol_graph` to list the functions/classes/types each task will touch and confirm their real names, signatures, and call sites. Don't invent symbols.",
      "Use `symbol_graph` with `include: [\"contract\"]` on any symbol whose behavior you're changing, so the plan accounts for existing throws, guards, and invariants.",
      "Use `ast_search` when multiple tasks will modify the same structural pattern (e.g. every usage of a framework API) — get the full list of sites once, distribute them across tasks.",
      "Use `impact` with `changeType: \"signature_change\"` on any symbol whose public signature will change. The returned blast radius names dependent tests the plan must update.",
      "Use `trace` from a known entry point when ordering tasks on a real execution path — the trace order is a good first pass at task order.",
      "Use `read` with `symbol: \"<name>\"` to pull the exact current signature into Step 1 / Step 3 of each task (prevents fabricated-signature bugs).",
      "When the test imports or mocks an existing symbol, use `read` with `symbol: \"<name>\"` or `symbol_graph` with `include: [\"source\"]` to lift the exact current signature into the test.",
      "Before committing the expected-error text to the plan, use `bash` to run a minimal probe — e.g. a one-line call to the target symbol — and paste the real error text the runner emits.",
      "If Step 3 changes a symbol's public signature, run `impact` with `changeType: \"signature_change\"` on that symbol first and list the dependent callers/tests in the task's **Files** section.",
      "*How to verify:* use `grep` to scan `spec.md` for acceptance-criterion numbering, then cross-check against the task list — every AC must be referenced by at least one task.",
    ]);
  });

  it("review-plan.md adds criterion-anchored grep, symbol_graph, read, and ast_search hints", () => {
    const content = readPrompt("review-plan.md");
    expectAll(content, [
      "Use `grep` across `spec.md` and the task files in `.megapowers/plans/<issue-slug>/tasks/` to confirm every acceptance-criterion identifier is referenced by at least one task.",
      "For each task that imports a symbol or type from a prior task, use `symbol_graph` or `grep` against the relevant task files to confirm the symbol is actually defined in a task with a lower index.",
      "For Step 3's implementation code, use `symbol_graph` on every symbol the task claims it imports or calls — if the symbol doesn't resolve, Step 3 is referencing fiction. Use `read` with `symbol: \"<name>\"` to compare the task's quoted signature against the real one.",
      "Use `symbol_graph` and `ast_search` to verify every API, signature, and import referenced in a task exists as written. Fabricated APIs are the highest-impact defect this criterion catches.",
    ]);
  });
});
```

**Step 2 — Run test, verify it fails**
Run: `bun test tests/phase-tool-guidance.test.ts`
Expected: FAIL — `expect(received).toContain(expected)` for the new `write-plan.md` / `review-plan.md` guidance strings.

**Step 3 — Write minimal implementation**
In `prompts/write-plan.md`, replace `## Read the Codebase First` with this tighter, tool-specific block:

```md
## Read the Codebase First

When grounding spans many lookups (multiple `symbol_graph` calls, greps, and reads across ≥5 files), prefer batching them through `code_execution` in a single script rather than issuing many sequential tool calls.
Before writing any tasks, inspect every file you plan to modify. Verify:
- Use `symbol_graph` to list the functions/classes/types each task will touch and confirm their real names, signatures, and call sites. Don't invent symbols.
- Use `symbol_graph` with `include: ["contract"]` on any symbol whose behavior you're changing, so the plan accounts for existing throws, guards, and invariants.
- Use `ast_search` when multiple tasks will modify the same structural pattern (e.g. every usage of a framework API) — get the full list of sites once, distribute them across tasks.
- Use `impact` with `changeType: "signature_change"` on any symbol whose public signature will change. The returned blast radius names dependent tests the plan must update.
- Use `trace` from a known entry point when ordering tasks on a real execution path — the trace order is a good first pass at task order.
- Use `read` with `symbol: "<name>"` to pull the exact current signature into Step 1 / Step 3 of each task (prevents fabricated-signature bugs).
```

Then insert these inline hints into the task template and checklist:

```md
**Step 1 — Write the failing test**
When the test imports or mocks an existing symbol, use `read` with `symbol: "<name>"` or `symbol_graph` with `include: ["source"]` to lift the exact current signature into the test.
[Full, copy-pasteable test code]

**Step 2 — Run test, verify it fails**
Before committing the expected-error text to the plan, use `bash` to run a minimal probe — e.g. a one-line call to the target symbol — and paste the real error text the runner emits. Never guess the error phrasing; runners differ (Bun vs Jest vs Vitest print different messages for the same failure).
Run: `exact command to run this specific test`
Expected: FAIL — [specific error message the runner will print]

**Step 3 — Write minimal implementation**
If Step 3 changes a symbol's public signature, run `impact` with `changeType: "signature_change"` on that symbol first and list the dependent callers/tests in the task's **Files** section.
[Full, copy-pasteable implementation code]
```

Add this sub-hint immediately under the checklist's Coverage line:

```md
  *How to verify:* use `grep` to scan `spec.md` for acceptance-criterion numbering, then cross-check against the task list — every AC must be referenced by at least one task.
```

In `prompts/review-plan.md`, add one inline hint under each anchored criterion:

```md
### 1. Coverage
Does every acceptance criterion have at least one task addressing it? List any gaps. Check that tasks explicitly call out which AC they cover.
Use `grep` across `spec.md` and the task files in `.megapowers/plans/<issue-slug>/tasks/` to confirm every acceptance-criterion identifier is referenced by at least one task. Missing coverage is the most common approve-error; verify it mechanically.

### 2. Ordering & Dependencies
Are dependencies respected? Will task N have everything it needs from tasks 1..N-1? Are `[depends: N]` annotations present and correct? Flag cycles or missing prereqs.
For each task that imports a symbol or type from a prior task, use `symbol_graph` or `grep` against the relevant task files to confirm the symbol is actually defined in a task with a lower index.

### 3. TDD Completeness
...
Flag any task where the code won't actually work — wrong function signatures, incorrect import paths, missing error handling.
For Step 3's implementation code, use `symbol_graph` on every symbol the task claims it imports or calls — if the symbol doesn't resolve, Step 3 is referencing fiction. Use `read` with `symbol: "<name>"` to compare the task's quoted signature against the real one.

### 6. Self-Containment
Can a developer execute each task from the plan alone? Focus on: Are the APIs and function signatures correct? Do the imports exist? Is the error handling complete? (Earlier structural checks may be helpful hints, but you must still verify file paths, descriptions, imports, APIs, and error handling yourself.)
Use `symbol_graph` and `ast_search` to verify every API, signature, and import referenced in a task exists as written. Fabricated APIs are the highest-impact defect this criterion catches.
```

Keep everything inline with the relevant step/criterion; do not add a summary block elsewhere.

**Step 4 — Run test, verify it passes**
Run: `bun test tests/phase-tool-guidance.test.ts`
Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: all passing
