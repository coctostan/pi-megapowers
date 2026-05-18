---
id: 3
title: Add renderFullProtocolPrompt export
status: approved
depends_on: []
no_test: false
files_to_modify:
  - extensions/megapowers/prompt-inject.ts
  - tests/prompt-inject.test.ts
files_to_create: []
---

**Files:**
- Modify: `extensions/megapowers/prompt-inject.ts`
- Modify: `tests/prompt-inject.test.ts`

Covers AC33, AC35 — expose a callable code path that renders the canonical full `## Megapowers Protocol` block from `prompts/megapowers-protocol.md`, independent of `buildInjectedPrompt`.

**Step 1 — Write the failing test**

Append to `tests/prompt-inject.test.ts`:

```ts
import { renderFullProtocolPrompt } from "../extensions/megapowers/prompt-inject.js";

describe("renderFullProtocolPrompt", () => {
  it("returns the canonical `## Megapowers Protocol` content (AC33, AC35)", () => {
    const out = renderFullProtocolPrompt();
    expect(out).toContain("## Megapowers Protocol");
    expect(out).toContain("megapowers_signal");
    expect(out).toContain("megapowers_plan_task");
    expect(out).toContain("megapowers_plan_review");
  });
});
```

**Step 2 — Run test, verify it fails**
Run: `bun test tests/prompt-inject.test.ts`
Expected: FAIL — `error: Export named 'renderFullProtocolPrompt' not found in module '.../prompt-inject.ts'`

**Step 3 — Write minimal implementation**

In `extensions/megapowers/prompt-inject.ts`, add this exported function (anywhere at module scope, e.g. directly after the imports):

```ts
/**
 * Render the canonical full Megapowers protocol block from prompts/megapowers-protocol.md.
 * Reachable from tests and debug paths without going through buildInjectedPrompt.
 */
export function renderFullProtocolPrompt(): string {
  return loadPromptFile("megapowers-protocol.md");
}
```

(`loadPromptFile` is already imported.)

**Step 4 — Run test, verify it passes**
Run: `bun test tests/prompt-inject.test.ts`
Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: all passing
