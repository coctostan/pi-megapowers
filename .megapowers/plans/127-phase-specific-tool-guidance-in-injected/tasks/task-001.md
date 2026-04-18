---
id: 1
title: Inline tool hints for brainstorm/spec prompts
status: approved
depends_on: []
no_test: false
files_to_modify:
  - prompts/brainstorm.md
  - prompts/write-spec.md
files_to_create:
  - tests/phase-tool-guidance.test.ts
---

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
