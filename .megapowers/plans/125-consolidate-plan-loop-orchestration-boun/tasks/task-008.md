---
id: 8
title: Use plan-orchestrator for prompt-inject plan-mode routing
status: approved
depends_on:
  - 1
no_test: false
files_to_modify:
  - extensions/megapowers/prompt-inject.ts
files_to_create:
  - tests/prompt-inject-plan-orchestrator.test.ts
---

### Task 8: Use plan-orchestrator for prompt-inject plan-mode routing [depends: 1]

**Files:**
- Modify: `extensions/megapowers/prompt-inject.ts`
- Create: `tests/prompt-inject-plan-orchestrator.test.ts`

**Step 1 — Write the failing test**
Create `tests/prompt-inject-plan-orchestrator.test.ts` with this exact content:

```ts
import { describe, it, expect } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("prompt-inject plan-orchestrator wiring", () => {
  it("uses resolvePlanTemplate instead of a local plan-mode map", () => {
    const source = readFileSync(
      join(process.cwd(), "extensions", "megapowers", "prompt-inject.ts"),
      "utf-8",
    );

    expect(source).toContain("resolvePlanTemplate");
    expect(source).not.toContain("PLAN_MODE_TEMPLATES");
  });
});
```

**Step 2 — Run test, verify it fails**
Run: `bun test tests/prompt-inject-plan-orchestrator.test.ts`
Expected: FAIL — `expect(received).toContain("resolvePlanTemplate")`

**Step 3 — Write minimal implementation**
In `extensions/megapowers/prompt-inject.ts`, replace the focused-review import with:

```ts
import { resolvePlanTemplate } from "./plan-orchestrator.js";
```

Then replace the entire `else if (state.phase === "plan" && state.planMode) { ... }` branch inside `buildInjectedPrompt(...)` with this exact block:

```ts
  } else if (state.phase === "plan" && state.planMode) {
    const templateName = resolvePlanTemplate(state.planMode);
    const template = loadPromptFile(templateName);
    if (template) {
      const phasePrompt = interpolatePrompt(template, vars);
      if (phasePrompt) parts.push(phasePrompt);
    }
```

Do not keep the local `PLAN_MODE_TEMPLATES` map in `prompt-inject.ts`.

**Step 4 — Run test, verify it passes**
Run: `bun test tests/prompt-inject-plan-orchestrator.test.ts`
Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: all passing
