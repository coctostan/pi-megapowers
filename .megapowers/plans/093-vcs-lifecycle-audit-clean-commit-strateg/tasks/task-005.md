---
id: 5
title: Reject invalid shipping branch targets before squashing or pushing
status: approved
depends_on:
  - 3
  - 4
no_test: false
files_to_modify:
  - extensions/megapowers/vcs/shipping.ts
  - tests/shipping.test.ts
files_to_create: []
---

### Task 5: Reject invalid shipping branch targets before squashing or pushing [depends: 3, 4]

**Covers:** AC11
Dependency note: this task depends on Task 3 for shipment data model continuity and Task 4 for finalization pipeline context, but `validateShipTarget()` itself is intentionally independent of finalization internals and must run first in orchestration.

**Files:**
- Modify: `extensions/megapowers/vcs/shipping.ts`
- Test: `tests/shipping.test.ts`

**Step 1 — Write the failing test**
In `tests/shipping.test.ts`, update the existing header import:

```ts
import {
  auditShipment,
  finalizeShipment,
  validateShipTarget,
  type ExecGit,
} from "../extensions/megapowers/vcs/shipping.js";
```

Then append this test:

```ts
it("rejects missing, empty, and base-branch ship targets before any push attempt", () => {
  expect(validateShipTarget(null, "main")).toEqual({ ok: false, error: "Cannot ship: branchName is missing." });
  expect(validateShipTarget("", "main")).toEqual({ ok: false, error: "Cannot ship: branchName is empty." });
  expect(validateShipTarget("feat/093-vcs-lifecycle-audit-clean-commit-strateg", null)).toEqual({ ok: false, error: "Cannot ship: baseBranch is missing." });
  expect(validateShipTarget("feat/093-vcs-lifecycle-audit-clean-commit-strateg", "")).toEqual({ ok: false, error: "Cannot ship: baseBranch is missing." });
  expect(validateShipTarget("main", "main")).toEqual({ ok: false, error: "Cannot ship: branchName must differ from baseBranch (main)." });
  expect(validateShipTarget("feat/093-vcs-lifecycle-audit-clean-commit-strateg", "main")).toEqual({ ok: true });
});
```

**Step 2 — Run test, verify it fails**
Run: `bun test tests/shipping.test.ts -t "rejects missing, empty, and base-branch ship targets before any push attempt"`
Expected: FAIL — `SyntaxError: Export named 'validateShipTarget' not found in module '../extensions/megapowers/vcs/shipping.js'`

**Step 3 — Write minimal implementation**
This task defines the validator contract; Task 9 wires it into `shipAndCreatePR()` so invalid targets abort at `step: "validate"` before any squash/push/PR operations.
Add this helper to `extensions/megapowers/vcs/shipping.ts`:

```ts
export type ShipTargetResult = { ok: true } | { ok: false; error: string };

export function validateShipTarget(branchName: string | null, baseBranch: string | null): ShipTargetResult {
  if (branchName === null) return { ok: false, error: "Cannot ship: branchName is missing." };
  if (branchName.trim() === "") return { ok: false, error: "Cannot ship: branchName is empty." };
  if (!baseBranch || baseBranch.trim() === "") return { ok: false, error: "Cannot ship: baseBranch is missing." };
  if (branchName === baseBranch) {
    return { ok: false, error: `Cannot ship: branchName must differ from baseBranch (${baseBranch}).` };
  }
  return { ok: true };
// Exporting `ShipTargetResult` keeps the orchestration contract explicit for downstream callers/tests.
}
```
Error-format note: validation errors are clear and step-specific (`Cannot ship: ...`). Other steps may use equally clear step-specific phrasing (e.g., blocked files, PR failure) without requiring identical prefixes.

**Step 4 — Run test, verify it passes**
Run: `bun test tests/shipping.test.ts -t "rejects missing, empty, and base-branch ship targets before any push attempt"`
Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: all passing
