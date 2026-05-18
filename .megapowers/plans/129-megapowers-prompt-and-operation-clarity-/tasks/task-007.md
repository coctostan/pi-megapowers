---
id: 7
title: Allowed-actions ↔ deriveToolInstructions parity test
status: approved
depends_on:
  - 1
no_test: false
files_to_modify: []
files_to_create:
  - tests/allowed-actions-parity.test.ts
---

**Files:**
- Create: `tests/allowed-actions-parity.test.ts`

Covers AC25, AC58. Asserts that the compact-header's allowed-action mapping does not contradict what `deriveToolInstructions` says for the same phases. Per AC25 the two views must agree for `implement`, `verify`, `code-review`, `done`, and each plan mode.

`deriveToolInstructions` (extensions/megapowers/workflows/tool-instructions.ts:9–48) produces text instructions, not a structured action list, so parity here is the rule: any `megapowers_signal({ action: "X" })` literal mentioned by `deriveToolInstructions` for the phase must appear in `getAllowedActions(phase, planMode).signalActions`, and vice versa (modulo plan-review which suppresses `deriveToolInstructions`).

**Step 1 — Write the failing test**

Create `tests/allowed-actions-parity.test.ts`:

```ts
import { describe, it, expect } from "bun:test";
import { getAllowedActions } from "../extensions/megapowers/workflows/allowed-actions.js";
import { deriveToolInstructions } from "../extensions/megapowers/workflows/tool-instructions.js";
import { getWorkflowConfig } from "../extensions/megapowers/workflows/registry.js";
import type { Phase, PlanMode } from "../extensions/megapowers/state/state-machine.js";

function extractSignalActions(text: string): Set<string> {
  const out = new Set<string>();
  // Match patterns like: action: "task_done"  /  action `"phase_next"`  /  action \"close_issue\"
  const re = /action[`"\\\s:]*"([a-z_]+)"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) out.add(m[1]);
  return out;
}

function instructionFor(phase: Phase): string {
  const config = getWorkflowConfig("feature");
  const phaseConfig = config.phases.find(p => p.name === phase);
  if (!phaseConfig) return "";
  const isTerminal = config.phases[config.phases.length - 1].name === phase;
  return deriveToolInstructions(phaseConfig, "001-test", { isTerminal });
}

describe("allowed-actions ↔ deriveToolInstructions parity (AC25, AC58)", () => {
  const cases: Array<{ phase: Phase; planMode: PlanMode }> = [
    { phase: "implement", planMode: null },
    { phase: "verify", planMode: null },
    { phase: "code-review", planMode: null },
    { phase: "done", planMode: null },
  ];

  for (const { phase, planMode } of cases) {
    it(`derived instructions for ${phase} only mention actions that allowed-actions also lists`, () => {
      const allowed = new Set(getAllowedActions(phase, planMode).signalActions);
      const mentioned = extractSignalActions(instructionFor(phase));
      for (const a of mentioned) {
        expect(allowed.has(a)).toBe(true);
      }
    });
  }

  it("plan-modes are covered by the structured mapping (no derived instructions for plan-review)", () => {
    // Plan-review suppresses derived tool instructions in prompt-inject;
    // verify the structured mapping itself covers all three modes.
    expect(getAllowedActions("plan", "draft").signalActions).toContain("plan_draft_done");
    expect(getAllowedActions("plan", "revise").signalActions).toContain("plan_draft_done");
    expect(getAllowedActions("plan", "review").planReview).toBe(true);
  });

  it("no allowed action set contains the deprecated review_approve", () => {
    for (const { phase, planMode } of [...cases, { phase: "plan" as Phase, planMode: "draft" as PlanMode }, { phase: "plan" as Phase, planMode: "review" as PlanMode }, { phase: "plan" as Phase, planMode: "revise" as PlanMode }]) {
      expect(getAllowedActions(phase, planMode).signalActions).not.toContain("review_approve");
    }
  });
});
```

**Step 2 — Run test, verify it fails (or passes immediately)**

Before Task 1: the import fails with `Cannot find module '.../allowed-actions.js'`. Verified via `bun test tests/allowed-actions-parity.test.ts`.

After Task 1: the parity assertions should pass because `deriveToolInstructions` for `implement`/`verify`/`code-review`/`done` either does not mention specific `action: "..."` literals or mentions only `task_done`/`phase_next`, all of which are in the mapping. If `deriveToolInstructions` mentions an action not in the mapping, the test fails with a clear `expect(allowed.has("X")).toBe(true)` failure.

Run: `bun test tests/allowed-actions-parity.test.ts`
Expected: PASS (when Task 1 has landed).

**Step 3 — Write minimal implementation**

No implementation change is required if Task 1's mapping is correct. If a parity assertion fails, fix the mapping in `extensions/megapowers/workflows/allowed-actions.ts` to add the missing action (do NOT widen `deriveToolInstructions`; the mapping is the single source of truth per AC25 and the new compact header).

**Step 4 — Run test, verify it passes**
Run: `bun test tests/allowed-actions-parity.test.ts`
Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: all passing
