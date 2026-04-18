# Plan

### Task 1: Inline tool hints for brainstorm/spec prompts

**Covers:** AC 1, AC 2, AC 12, AC 14, AC 15.

**Files:**
- Create: `tests/phase-tool-guidance.test.ts`
- Modify: `prompts/brainstorm.md`
- Modify: `prompts/write-spec.md`

**Step 1 — Write the failing test**
Create `tests/phase-tool-guidance.test.ts` with the base helpers and the first two prompt assertions:

```ts
import { describe, it, expect } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

function readPrompt(name: string): string {
  return readFileSync(join(process.cwd(), "prompts", name), "utf-8");
}

function expectAll(content: string, snippets: string[]) {
  for (const snippet of snippets) {
    expect(content).toContain(snippet);
  }
}

describe("phase-specific tool guidance — brainstorm/write-spec", () => {
  it("brainstorm.md inlines the required Read first tool hints", () => {
    const content = readPrompt("brainstorm.md");
    expectAll(content, [
      "Use `read` with `map: true` on unfamiliar files to get a structural map instead of dumping full contents.",
      "Use `symbol_graph` when the request mentions a concrete function, class, or module, to confirm it exists and see what calls it.",
      "Use `symbol_graph` with `include: [\"contract\"]` on any existing symbol the request proposes to change, so the brainstorm preserves its current behavioral guarantees instead of silently dropping them.",
      "Use `grep` for text mentions; use `ast_search` for structural patterns (e.g. every call site of a specific API shape).",
      "When the request touches an area that might have prior attempts or recent churn, run `git log --oneline -20 -- <path>` via `bash` to skim recent history.",
    ]);
  });

  it("write-spec.md adds symbol grounding in Purpose and Legacy handling", () => {
    const content = readPrompt("write-spec.md");
    expectAll(content, [
      "When an acceptance criterion references an existing function, class, or module, use `symbol_graph` to confirm the symbol exists and the signature/naming in the AC matches reality.",
      "If the AC depends on current behavioral guarantees (error cases, guards, throws), use `symbol_graph` with `include: [\"contract\"]` to cite real behavior, not assumed behavior.",
      "When the prior artifact is prose-heavy and references code, use `symbol_graph` to verify every named symbol exists before extracting it as an implied requirement.",
    ]);
  });
});
```

**Step 2 — Run test, verify it fails**
Run: `bun test tests/phase-tool-guidance.test.ts`
Expected: FAIL — `expect(received).toContain(expected)` for the missing brainstorm/spec tool-hint strings.

**Step 3 — Write minimal implementation**
Update `prompts/brainstorm.md` so `## Read first` becomes:

```md
## Read first
Before asking substantive questions, scan the project — key files, docs, and recent commits.
Use `read` with `map: true` on unfamiliar files to get a structural map instead of dumping full contents.
Use `symbol_graph` when the request mentions a concrete function, class, or module, to confirm it exists and see what calls it.
Use `symbol_graph` with `include: ["contract"]` on any existing symbol the request proposes to change, so the brainstorm preserves its current behavioral guarantees instead of silently dropping them.
Use `grep` for text mentions; use `ast_search` for structural patterns (e.g. every call site of a specific API shape).
When the request touches an area that might have prior attempts or recent churn, run `git log --oneline -20 -- <path>` via `bash` to skim recent history.

Check whether the request is:
- already solved
- partially solved
- best handled by extending something that exists
- constrained by current architecture

Say so before proposing new work.
```

Update `prompts/write-spec.md` by inserting these two sentences under `## Purpose` after the numbered list:

```md
When an acceptance criterion references an existing function, class, or module, use `symbol_graph` to confirm the symbol exists and the signature/naming in the AC matches reality.
If the AC depends on current behavioral guarantees (error cases, guards, throws), use `symbol_graph` with `include: ["contract"]` to cite real behavior, not assumed behavior.
```

Then add this bullet inside `## Legacy handling` after the unstructured-artifact bullets:

```md
- When the prior artifact is prose-heavy and references code, use `symbol_graph` to verify every named symbol exists before extracting it as an implied requirement.
```

Keep the hint sentences inline and imperative; do not add a separate preferred-tools section.

**Step 4 — Run test, verify it passes**
Run: `bun test tests/phase-tool-guidance.test.ts`
Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: all passing

### Task 2: Inline tool hints for plan/review prompts [depends: 1]

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

### Task 3: Inline tool hints for revise/implement prompts [depends: 2]

**Covers:** AC 5, AC 6, AC 12, AC 14, AC 15.

**Files:**
- Modify: `prompts/revise-plan.md`
- Modify: `prompts/implement-task.md`
- Modify: `tests/phase-tool-guidance.test.ts`

**Step 1 — Write the failing test**
Append this block to `tests/phase-tool-guidance.test.ts`:

```ts
describe("phase-specific tool guidance — revise-plan/implement-task", () => {
  it("revise-plan.md adds symbol, read, ast_search, grep, and impact revision hints", () => {
    const content = readPrompt("revise-plan.md");
    expectAll(content, [
      "Use `symbol_graph` on every symbol the revised Step 3 will import or call, to confirm the signature matches the task's claim.",
      "Use `read` with `symbol: \"<name>\"` to pull the exact current signature into the task's test/implementation text.",
      "Use `ast_search` to confirm structural patterns used in Step 3 actually exist in the codebase.",
      "When the reviewer said 'missing coverage for AC N', use `grep` for the AC identifier across `spec.md` and the task files to confirm which task you added now covers it — don't just append a task and assume.",
      "When a revision changes a function signature in Step 3, run `impact` with `changeType: \"signature_change\"` on that symbol and update the task's **Files** list to include every dependent the impact call surfaces.",
      "**Coverage re-check:** if the revision addressed a missing-AC complaint, use `grep` across spec and task files to confirm the AC is now referenced.",
    ]);
  });

  it("implement-task.md adds signature, anchor, impact, and drift-recovery hints", () => {
    const content = readPrompt("implement-task.md");
    expectAll(content, [
      "When the plan's test references an existing symbol, use `read` with `symbol: \"<name>\"` or `symbol_graph` with `include: [\"source\"]` to confirm its real signature before pasting the test.",
      "Before editing, use `read` with `symbol: \"<name>\"` (or `symbol_graph` with `include: [\"source\"]`) to pull the exact current file state. Use the hashline anchors from that read directly with `edit`.",
      "Before patching, run `impact` on the changed symbol to see the full dependent set, so you fix all downstream tests in one pass rather than cascading.",
      "| Implementation doesn't match what the file looks like now | Run `read` with `symbol: \"<name>\"` or `symbol_graph` with `include: [\"source\"]` — the plan was based on an earlier snapshot; start from reality. |",
    ]);
  });
});
```

**Step 2 — Run test, verify it fails**
Run: `bun test tests/phase-tool-guidance.test.ts`
Expected: FAIL — `expect(received).toContain(expected)` for the new `revise-plan.md` / `implement-task.md` guidance strings.

**Step 3 — Write minimal implementation**
In `prompts/revise-plan.md`, insert these three bullets between instruction items 3 and 4:

```md
- Use `symbol_graph` on every symbol the revised Step 3 will import or call, to confirm the signature matches the task's claim.
- Use `read` with `symbol: "<name>"` to pull the exact current signature into the task's test/implementation text.
- Use `ast_search` to confirm structural patterns used in Step 3 actually exist in the codebase.
```

Add these bullets to `## Most Common Revision Failures` near the matching rows:

```md
- When the reviewer said 'missing coverage for AC N', use `grep` for the AC identifier across `spec.md` and the task files to confirm which task you added now covers it — don't just append a task and assume.
- When a revision changes a function signature in Step 3, run `impact` with `changeType: "signature_change"` on that symbol and update the task's **Files** list to include every dependent the impact call surfaces.
```

Add this item to `## Pre-Submit Checklist`:

```md
- [ ] **Coverage re-check:** if the revision addressed a missing-AC complaint, use `grep` across spec and task files to confirm the AC is now referenced.
```

In `prompts/implement-task.md`, insert these inline hints:

```md
#### RED — Write one failing test
1. Write the test from the plan (Step 1 of the task)
   When the plan's test references an existing symbol, use `read` with `symbol: "<name>"` or `symbol_graph` with `include: ["source"]` to confirm its real signature before pasting the test.
...
#### GREEN — Write minimal code to pass
1. Write the implementation from the plan (Step 3 of the task) — just enough to make the test pass, nothing more
   Before editing, use `read` with `symbol: "<name>"` (or `symbol_graph` with `include: ["source"]`) to pull the exact current file state. Use the hashline anchors from that read directly with `edit`.
...
5. If other tests break, fix them now before moving on
   Before patching, run `impact` on the changed symbol to see the full dependent set, so you fix all downstream tests in one pass rather than cascading.
```

Add this row to `## When Stuck`:

```md
| Implementation doesn't match what the file looks like now | Run `read` with `symbol: "<name>"` or `symbol_graph` with `include: ["source"]` — the plan was based on an earlier snapshot; start from reality. |
```

Keep the new guidance as short inline sentences; do not turn the sections into multi-paragraph tool docs.

**Step 4 — Run test, verify it passes**
Run: `bun test tests/phase-tool-guidance.test.ts`
Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: all passing

### Task 4: Inline tool hints for verify/code-review prompts [depends: 3]

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

### Task 5: Inline tool hints for reproduce/diagnose prompts [depends: 4]

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

### Task 6: Inline tool hints for done prompt [depends: 5]

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

### Task 7: Document tool mapping plus injected-prompt coverage [depends: 6]

**Covers:** AC 13, AC 15.

**Files:**
- Create: `docs/phase-tools.md`
- Modify: `tests/phase-tool-guidance.test.ts`
- Modify: `tests/prompt-inject.test.ts`

**Step 1 — Write the failing test**
First, extend `tests/phase-tool-guidance.test.ts` with a doc reader, a full expected prompt/step/rationale map, a renderer, and an exact doc-sync test:

```ts
function readPhaseToolsDoc(): string {
  return readFileSync(join(process.cwd(), "docs", "phase-tools.md"), "utf-8");
}

type DocRow = { tool: string; step: string; rationale: string };

const phaseToolDoc = [
  {
    prompt: "brainstorm.md",
    rows: [
      { tool: "read", step: "## Read first", rationale: "Prefer structural-map reads on unfamiliar files." },
      { tool: "symbol_graph", step: "## Read first", rationale: "Confirm named symbols exist and inspect callers." },
      { tool: "symbol_graph", step: "## Read first", rationale: "Preserve current contracts when brainstorming changes to existing symbols." },
      { tool: "grep", step: "## Read first", rationale: "Handle text mentions." },
      { tool: "ast_search", step: "## Read first", rationale: "Handle structural patterns." },
      { tool: "bash", step: "## Read first", rationale: "Skim recent history with `git log --oneline -20 -- <path>`." },
    ],
  },
  {
    prompt: "write-spec.md",
    rows: [
      { tool: "symbol_graph", step: "## Purpose", rationale: "Confirm named existing symbols and signatures in ACs." },
      { tool: "symbol_graph", step: "## Purpose", rationale: "Ground ACs in current guards, throws, and invariants." },
      { tool: "symbol_graph", step: "## Legacy handling", rationale: "Verify prose-named symbols exist before extracting implied requirements." },
    ],
  },
  {
    prompt: "write-plan.md",
    rows: [
      { tool: "code_execution", step: "## Read the Codebase First", rationale: "Batch many grounding lookups through a single script." },
      { tool: "symbol_graph", step: "## Read the Codebase First", rationale: "Confirm real symbol names, signatures, and call sites." },
      { tool: "symbol_graph", step: "## Read the Codebase First", rationale: "Preserve contracts for behavior-changing work." },
      { tool: "ast_search", step: "## Read the Codebase First", rationale: "Enumerate repeated structural edit sites once." },
      { tool: "impact", step: "## Read the Codebase First", rationale: "Surface dependents for public signature changes." },
      { tool: "trace", step: "## Read the Codebase First", rationale: "Order tasks along a real execution path." },
      { tool: "read", step: "## Read the Codebase First", rationale: "Lift exact current signatures into task steps." },
      { tool: "read", step: "Task template / Step 1", rationale: "Lift exact imported or mocked signatures into tests." },
      { tool: "symbol_graph", step: "Task template / Step 1", rationale: "Lift source-backed signatures into tests." },
      { tool: "bash", step: "Task template / Step 2", rationale: "Probe for real failure text instead of guessing." },
      { tool: "impact", step: "Task template / Step 3", rationale: "List dependent callers/tests for signature changes." },
      { tool: "grep", step: "Pre-Submit Checklist / Coverage", rationale: "Mechanically confirm every AC is referenced by at least one task." },
    ],
  },
  {
    prompt: "review-plan.md",
    rows: [
      { tool: "grep", step: "Criterion 1 / Coverage", rationale: "Mechanically confirm AC coverage." },
      { tool: "symbol_graph", step: "Criterion 2 / Ordering & Dependencies", rationale: "Verify imported symbols come from lower-index tasks." },
      { tool: "grep", step: "Criterion 2 / Ordering & Dependencies", rationale: "Cross-check task-file symbol definitions by index." },
      { tool: "symbol_graph", step: "Criterion 3 / TDD Completeness", rationale: "Reject fictional Step 3 APIs and imports." },
      { tool: "read", step: "Criterion 3 / TDD Completeness", rationale: "Compare quoted signatures against real signatures." },
      { tool: "symbol_graph", step: "Criterion 6 / Self-Containment", rationale: "Verify referenced APIs/imports exist as written." },
      { tool: "ast_search", step: "Criterion 6 / Self-Containment", rationale: "Verify repeated structural references exist." },
    ],
  },
  {
    prompt: "revise-plan.md",
    rows: [
      { tool: "symbol_graph", step: "## Instructions", rationale: "Confirm revised Step 3 imports/calls match reality." },
      { tool: "read", step: "## Instructions", rationale: "Lift exact current signatures into revised task text." },
      { tool: "ast_search", step: "## Instructions", rationale: "Confirm Step 3 structural patterns exist." },
      { tool: "grep", step: "Most Common Revision Failures / missing coverage", rationale: "Verify which task now covers the missing AC." },
      { tool: "impact", step: "Most Common Revision Failures / signature change", rationale: "Update dependent files after signature changes." },
      { tool: "grep", step: "Pre-Submit Checklist / Coverage re-check", rationale: "Confirm missing-AC complaints were actually fixed." },
    ],
  },
  {
    prompt: "implement-task.md",
    rows: [
      { tool: "read", step: "RED / step 1", rationale: "Confirm real signatures before pasting tests." },
      { tool: "symbol_graph", step: "RED / step 1", rationale: "Pull source-backed signature details into tests." },
      { tool: "read", step: "GREEN / step 1", rationale: "Re-read the exact current file state before editing." },
      { tool: "symbol_graph", step: "GREEN / step 1", rationale: "Pull source-backed current state before editing." },
      { tool: "edit", step: "GREEN / step 1", rationale: "Edit through hashline anchors from the read." },
      { tool: "impact", step: "GREEN / step 5", rationale: "Find all downstream regressions in one pass." },
      { tool: "read", step: "When Stuck", rationale: "Recover from plan/file drift by starting from reality." },
      { tool: "symbol_graph", step: "When Stuck", rationale: "Recover source-backed reality when the file drifted." },
    ],
  },
  {
    prompt: "verify.md",
    rows: [
      { tool: "impact", step: "Step 1", rationale: "Verify the regression sweep covers downstream dependents." },
      { tool: "symbol_graph", step: "Step 2 / code inspection", rationale: "Prove a symbol exists with the expected shape." },
      { tool: "ast_search", step: "Step 2 / code inspection", rationale: "Prove multi-site structural patterns." },
      { tool: "trace", step: "Step 2 / user-observable behavior", rationale: "Prove the new code is on the real executed path." },
      { tool: "trace", step: "What Actually Proves a Claim", rationale: "Define valid evidence that new behavior is reached." },
    ],
  },
  {
    prompt: "code-review.md",
    rows: [
      { tool: "/codex-review", step: "## Instructions", rationale: "Use codex review findings as cited input." },
      { tool: "/codex-adversarial-review", step: "## Instructions", rationale: "Add adversarial review for high-stakes changes." },
      { tool: "symbol_graph", step: "Code Quality / Correctness", rationale: "Inspect current contracts, guards, and throws." },
      { tool: "impact", step: "Architecture / Breaking changes", rationale: "Define the dependent breaking-change surface." },
      { tool: "symbol_graph", step: "## Rules", rationale: "Verify findings against real symbol names and signatures." },
      { tool: "read", step: "## Rules", rationale: "Prefer exact symbol reads over paraphrase." },
      { tool: "read", step: "If needs-fixes", rationale: "Re-read anchored source before inline fixes." },
      { tool: "impact", step: "If needs-fixes", rationale: "Update dependent files when fixes change signatures." },
    ],
  },
  {
    prompt: "reproduce-bug.md",
    rows: [
      { tool: "symbol_graph", step: "Step 1", rationale: "Resolve symbols mentioned in the stack trace." },
      { tool: "read", step: "Step 1", rationale: "Pull nearby anchored context and real signatures." },
      { tool: "bash", step: "Step 2", rationale: "Inspect recent commits and suspect diffs." },
      { tool: "trace", step: "Step 4", rationale: "Confirm which boundaries the real path crosses." },
      { tool: "read", step: "Step 5", rationale: "Pull the exact function signature into the failing test." },
    ],
  },
  {
    prompt: "diagnose-bug.md",
    rows: [
      { tool: "trace", step: "Phase 1", rationale: "Follow the real runtime call order backward from the symptom." },
      { tool: "symbol_graph", step: "Phase 1", rationale: "Enumerate callers of the first bad-value function." },
      { tool: "symbol_graph", step: "Phase 2 / Understand dependencies", rationale: "Inspect the broken function's current contract." },
      { tool: "impact", step: "Phase 2 / Understand dependencies", rationale: "Enumerate dependents of the broken function." },
      { tool: "impact", step: "After diagnosis — assess risk", rationale: "Define the risk surface the Fixed When criteria must cover." },
    ],
  },
  {
    prompt: "done.md",
    rows: [
      { tool: "symbol_graph", step: "generate-docs", rationale: "Pull real API names/signatures into generated docs." },
      { tool: "read", step: "generate-docs", rationale: "Pull exact current signatures into generated docs." },
      { tool: "symbol_graph", step: "generate-bugfix-summary", rationale: "Confirm real symbol names and locations in the summary." },
    ],
  },
] as const;
function renderPhaseToolsDoc(entries: typeof phaseToolDoc): string {
  return [
    "# Phase Tool Guidance Map",
    "",
    "Prompt markdown in `prompts/*.md` is the source of truth. This file is a review index for issue #127 and the drift-check target for the tests in `tests/phase-tool-guidance.test.ts`.",
    "",
    ...entries.flatMap(({ prompt, rows }) => [
      `## prompts/${prompt}`,
      "| Tool / command | Section / step | Rationale |",
      "| --- | --- | --- |",
      ...rows.map(({ tool, step, rationale }) => `| \`${tool}\` | \`${step}\` | ${rationale} |`),
      "",
    ]),
  ].join("\n").trim();
}
describe("phase-specific tool guidance — mapping doc", () => {
  it("docs/phase-tools.md stays exactly in sync with the expected prompt/tool map", () => {
    expect(readPhaseToolsDoc().trim()).toBe(renderPhaseToolsDoc(phaseToolDoc));
  });
});
```

Do **not** touch `tests/prompt-inject.test.ts` yet; let the missing-doc failure happen first.

**Step 2 — Run test, verify it fails**
Run: `bun test tests/phase-tool-guidance.test.ts`
Expected: FAIL — `ENOENT: no such file or directory, open '.../docs/phase-tools.md'`


**Step 3 — Write minimal implementation**
Create `docs/phase-tools.md` with one section per touched prompt file and a three-column table (`Tool / command`, `Section / step`, `Rationale`). Use this exact content:

```md
# Phase Tool Guidance Map

Prompt markdown in `prompts/*.md` is the source of truth. This file is a review index for issue #127 and the drift-check target for the tests in `tests/phase-tool-guidance.test.ts`.

## prompts/brainstorm.md
| Tool / command | Section / step | Rationale |
| --- | --- | --- |
| `read` | `## Read first` | Prefer structural-map reads on unfamiliar files. |
| `symbol_graph` | `## Read first` | Confirm named symbols exist and inspect callers. |
| `symbol_graph` | `## Read first` | Preserve current contracts when brainstorming changes to existing symbols. |
| `grep` | `## Read first` | Handle text mentions. |
| `ast_search` | `## Read first` | Handle structural patterns. |
| `bash` | `## Read first` | Skim recent history with `git log --oneline -20 -- <path>`. |

## prompts/write-spec.md
| Tool / command | Section / step | Rationale |
| --- | --- | --- |
| `symbol_graph` | `## Purpose` | Confirm named existing symbols and signatures in ACs. |
| `symbol_graph` | `## Purpose` | Ground ACs in current guards, throws, and invariants. |
| `symbol_graph` | `## Legacy handling` | Verify prose-named symbols exist before extracting implied requirements. |

## prompts/write-plan.md
| Tool / command | Section / step | Rationale |
| --- | --- | --- |
| `code_execution` | `## Read the Codebase First` | Batch many grounding lookups through a single script. |
| `symbol_graph` | `## Read the Codebase First` | Confirm real symbol names, signatures, and call sites. |
| `symbol_graph` | `## Read the Codebase First` | Preserve contracts for behavior-changing work. |
| `ast_search` | `## Read the Codebase First` | Enumerate repeated structural edit sites once. |
| `impact` | `## Read the Codebase First` | Surface dependents for public signature changes. |
| `trace` | `## Read the Codebase First` | Order tasks along a real execution path. |
| `read` | `## Read the Codebase First` | Lift exact current signatures into task steps. |
| `read` | `Task template / Step 1` | Lift exact imported or mocked signatures into tests. |
| `symbol_graph` | `Task template / Step 1` | Lift source-backed signatures into tests. |
| `bash` | `Task template / Step 2` | Probe for real failure text instead of guessing. |
| `impact` | `Task template / Step 3` | List dependent callers/tests for signature changes. |
| `grep` | `Pre-Submit Checklist / Coverage` | Mechanically confirm every AC is referenced by at least one task. |

## prompts/review-plan.md
| Tool / command | Section / step | Rationale |
| --- | --- | --- |
| `grep` | `Criterion 1 / Coverage` | Mechanically confirm AC coverage. |
| `symbol_graph` | `Criterion 2 / Ordering & Dependencies` | Verify imported symbols come from lower-index tasks. |
| `grep` | `Criterion 2 / Ordering & Dependencies` | Cross-check task-file symbol definitions by index. |
| `symbol_graph` | `Criterion 3 / TDD Completeness` | Reject fictional Step 3 APIs and imports. |
| `read` | `Criterion 3 / TDD Completeness` | Compare quoted signatures against real signatures. |
| `symbol_graph` | `Criterion 6 / Self-Containment` | Verify referenced APIs/imports exist as written. |
| `ast_search` | `Criterion 6 / Self-Containment` | Verify repeated structural references exist. |

## prompts/revise-plan.md
| Tool / command | Section / step | Rationale |
| --- | --- | --- |
| `symbol_graph` | `## Instructions` | Confirm revised Step 3 imports/calls match reality. |
| `read` | `## Instructions` | Lift exact current signatures into revised task text. |
| `ast_search` | `## Instructions` | Confirm Step 3 structural patterns exist. |
| `grep` | `Most Common Revision Failures / missing coverage` | Verify which task now covers the missing AC. |
| `impact` | `Most Common Revision Failures / signature change` | Update dependent files after signature changes. |
| `grep` | `Pre-Submit Checklist / Coverage re-check` | Confirm missing-AC complaints were actually fixed. |

## prompts/implement-task.md
| Tool / command | Section / step | Rationale |
| --- | --- | --- |
| `read` | `RED / step 1` | Confirm real signatures before pasting tests. |
| `symbol_graph` | `RED / step 1` | Pull source-backed signature details into tests. |
| `read` | `GREEN / step 1` | Re-read the exact current file state before editing. |
| `symbol_graph` | `GREEN / step 1` | Pull source-backed current state before editing. |
| `edit` | `GREEN / step 1` | Edit through hashline anchors from the read. |
| `impact` | `GREEN / step 5` | Find all downstream regressions in one pass. |
| `read` | `When Stuck` | Recover from plan/file drift by starting from reality. |
| `symbol_graph` | `When Stuck` | Recover source-backed reality when the file drifted. |

## prompts/verify.md
| Tool / command | Section / step | Rationale |
| --- | --- | --- |
| `impact` | `Step 1` | Verify the regression sweep covers downstream dependents. |
| `symbol_graph` | `Step 2 / code inspection` | Prove a symbol exists with the expected shape. |
| `ast_search` | `Step 2 / code inspection` | Prove multi-site structural patterns. |
| `trace` | `Step 2 / user-observable behavior` | Prove the new code is on the real executed path. |
| `trace` | `What Actually Proves a Claim` | Define valid evidence that new behavior is reached. |

## prompts/code-review.md
| Tool / command | Section / step | Rationale |
| --- | --- | --- |
| `/codex-review` | `## Instructions` | Use codex review findings as cited input. |
| `/codex-adversarial-review` | `## Instructions` | Add adversarial review for high-stakes changes. |
| `symbol_graph` | `Code Quality / Correctness` | Inspect current contracts, guards, and throws. |
| `impact` | `Architecture / Breaking changes` | Define the dependent breaking-change surface. |
| `symbol_graph` | `## Rules` | Verify findings against real symbol names and signatures. |
| `read` | `## Rules` | Prefer exact symbol reads over paraphrase. |
| `read` | `If needs-fixes` | Re-read anchored source before inline fixes. |
| `impact` | `If needs-fixes` | Update dependent files when fixes change signatures. |

## prompts/reproduce-bug.md
| Tool / command | Section / step | Rationale |
| --- | --- | --- |
| `symbol_graph` | `Step 1` | Resolve symbols mentioned in the stack trace. |
| `read` | `Step 1` | Pull nearby anchored context and real signatures. |
| `bash` | `Step 2` | Inspect recent commits and suspect diffs. |
| `trace` | `Step 4` | Confirm which boundaries the real path crosses. |
| `read` | `Step 5` | Pull the exact function signature into the failing test. |

## prompts/diagnose-bug.md
| Tool / command | Section / step | Rationale |
| --- | --- | --- |
| `trace` | `Phase 1` | Follow the real runtime call order backward from the symptom. |
| `symbol_graph` | `Phase 1` | Enumerate callers of the first bad-value function. |
| `symbol_graph` | `Phase 2 / Understand dependencies` | Inspect the broken function's current contract. |
| `impact` | `Phase 2 / Understand dependencies` | Enumerate dependents of the broken function. |
| `impact` | `After diagnosis — assess risk` | Define the risk surface the Fixed When criteria must cover. |

## prompts/done.md
| Tool / command | Section / step | Rationale |
| --- | --- | --- |
| `symbol_graph` | `generate-docs` | Pull real API names/signatures into generated docs. |
| `read` | `generate-docs` | Pull exact current signatures into generated docs. |
| `symbol_graph` | `generate-bugfix-summary` | Confirm real symbol names and locations in the summary. |
```

Then append this exact describe block to `tests/prompt-inject.test.ts`:

```ts
describe("buildInjectedPrompt — inline phase tool guidance", () => {
  let tmp: string;

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), "prompt-inject-phase-tools-"));
  });

  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  it("injects representative inline hints for feature phases", () => {
    setState(tmp, { phase: "brainstorm", megaEnabled: true });
    expect(buildInjectedPrompt(tmp)).toContain("Use `read` with `map: true` on unfamiliar files to get a structural map instead of dumping full contents.");

    setState(tmp, { phase: "spec", megaEnabled: true });
    expect(buildInjectedPrompt(tmp)).toContain("When an acceptance criterion references an existing function, class, or module, use `symbol_graph` to confirm the symbol exists and the signature/naming in the AC matches reality.");

    setState(tmp, { phase: "plan", planMode: "draft", planIteration: 1, megaEnabled: true });
    expect(buildInjectedPrompt(tmp)).toContain("When grounding spans many lookups (multiple `symbol_graph` calls, greps, and reads across ≥5 files), prefer batching them through `code_execution` in a single script rather than issuing many sequential tool calls.");

    setState(tmp, { phase: "plan", planMode: "review", planIteration: 1, megaEnabled: true });
    expect(buildInjectedPrompt(tmp)).toContain("Use `grep` across `spec.md` and the task files in `.megapowers/plans/<issue-slug>/tasks/` to confirm every acceptance-criterion identifier is referenced by at least one task.");

    setState(tmp, { phase: "plan", planMode: "revise", planIteration: 2, megaEnabled: true });
    expect(buildInjectedPrompt(tmp)).toContain("Use `symbol_graph` on every symbol the revised Step 3 will import or call, to confirm the signature matches the task's claim.");

    setState(tmp, { phase: "implement", megaEnabled: true, currentTaskIndex: 0 });
    expect(buildInjectedPrompt(tmp)).toContain("Before editing, use `read` with `symbol: \"<name>\"` (or `symbol_graph` with `include: [\"source\"]`) to pull the exact current file state. Use the hashline anchors from that read directly with `edit`.");

    setState(tmp, { phase: "verify", megaEnabled: true });
    expect(buildInjectedPrompt(tmp)).toContain("Before concluding the suite covers the change, use `impact` on the primary symbol you changed to list downstream dependents. Confirm every surfaced dependent's test ran.");

    setState(tmp, { phase: "code-review", megaEnabled: true });
    expect(buildInjectedPrompt(tmp)).toContain("Run `/codex-review --base <ref>` early (against `main` or the feature's base branch) and treat the findings as input.");
  });

  it("injects representative inline hints for bugfix and done prompts", () => {
    setState(tmp, { workflow: "bugfix", phase: "reproduce", megaEnabled: true });
    expect(buildInjectedPrompt(tmp)).toContain("When the error mentions a specific symbol or file, use `symbol_graph` with `include: [\"source\"]` on the symbol in the stack trace, and `read` with hashline anchors for nearby context. Copy real signatures into the reproduction report.");

    setState(tmp, { workflow: "bugfix", phase: "diagnose", megaEnabled: true });
    expect(buildInjectedPrompt(tmp)).toContain("Use `trace` from a known entry point to see the real call order the runtime follows, not the static call graph.");

    setState(tmp, { phase: "done", megaEnabled: true, doneActions: ["generate-docs"] });
    expect(buildInjectedPrompt(tmp)).toContain("When the document describes a new or modified API surface, use `symbol_graph` (or `read` with `symbol: \"<name>\"`) to pull the real signature into the doc. Do not paraphrase signatures from memory.");
  });
});
```

This keeps the test copy-pasteable, covers feature + bugfix + done injection, and makes the doc drift check fail in both directions.


**Step 4 — Run test, verify it passes**
Run: `bun test tests/phase-tool-guidance.test.ts tests/prompt-inject.test.ts`
Expected: PASS


**Step 5 — Verify no regressions**
Run: `bun test`
Expected: all passing
