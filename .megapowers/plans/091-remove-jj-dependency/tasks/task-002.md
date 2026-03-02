---
id: 2
title: Remove jj automation from phase-advance
status: approved
depends_on:
  - 1
no_test: false
files_to_modify:
  - extensions/megapowers/policy/phase-advance.ts
  - extensions/megapowers/tools/tool-signal.ts
  - tests/phase-advance.test.ts
files_to_create: []
---

### Task 2: Remove jj automation from phase-advance [depends: 1]
**Covers AC 8**

#### Step 1 — Write failing tests

In `tests/phase-advance.test.ts`:
- Remove `import type { JJ } from "../extensions/megapowers/jj.js";` if present.
- Delete any suite dedicated to jj integration.
- Add a source-level guard + a minimal behavioral check:

```ts
import { readFileSync } from "node:fs";
import { join } from "node:path";

it("AC8: phase-advance has no jj import or jj parameter", () => {
  const source = readFileSync(join(process.cwd(), "extensions/megapowers/policy/phase-advance.ts"), "utf-8");
  expect(source).not.toContain("from \"../jj.js\"");
  expect(source).not.toMatch(/advancePhase\([^)]*jj\??/);
});

it("AC8: advancePhase can still advance spec → plan without jj", () => {
  writeArtifact(tmp, "001-test", "spec.md", "# Spec\n\nNo open questions.\n");
  setState(tmp, {
    activeIssue: "001-test",
    workflow: "feature",
    phase: "spec",
  });

  const result = advancePhase(tmp);
  expect(result.ok).toBe(true);
  expect(result.newPhase).toBe("plan");
});
```

#### Step 2 — Run tests, verify RED
Run:
- `bun test tests/phase-advance.test.ts`

Expected failure: the source-level guard fails because `phase-advance.ts` still imports from `../jj.js` and/or includes a `jj` parameter.

#### Step 3 — Implement (surgical edits)

In `extensions/megapowers/policy/phase-advance.ts`:
1. Delete `import { formatChangeDescription, type JJ } from "../jj.js";`.
2. Remove the `jj?: JJ` parameter from `advancePhase`.
3. Delete the entire `if (jj) { ... }` async fire-and-forget block that runs `jj describe/new/squash`.

In `extensions/megapowers/tools/tool-signal.ts`:
- Update `handlePhaseNext` and `handlePhaseBack` to call `advancePhase(cwd, ...)` **without** a jj argument.
- Keep `handleSignal`’s jj-parameter threading as-is for now; that’s removed in Task 6.

#### Step 4 — Run targeted tests, verify GREEN
Run:
- `bun test tests/phase-advance.test.ts`

Expected: PASS.

#### Step 5 — Full regression
Run:
- `bun test`

Expected: all tests pass.
