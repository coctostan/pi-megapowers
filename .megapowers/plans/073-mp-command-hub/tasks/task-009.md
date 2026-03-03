---
id: 9
title: Verify existing standalone commands remain registered alongside /mp
status: approved
depends_on:
  - 2
no_test: true
files_to_modify: []
files_to_create:
  - tests/mp-existing-commands.test.ts
---

### Task 9: Verify existing standalone commands remain registered alongside /mp
**[no-test] justification:** This is a verification-only task with no production code. It depends on Task 2 which adds `/mp` registration. By the time this task runs, the test should already pass. The test exists as a guard rail to confirm AC19.
**Files:**
- Create: `tests/mp-existing-commands.test.ts`

**Verification step:**

1) Create `tests/mp-existing-commands.test.ts`:
```ts
import { describe, it, expect } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
  it("keeps existing standalone commands while adding /mp", () => {
    const source = readFileSync(join(process.cwd(), "extensions", "megapowers", "index.ts"), "utf-8");
    expect(source).toContain('pi.registerCommand("mp"');
    for (const cmd of ["mega", "issue", "triage", "phase", "done", "learn", "tdd", "task", "review"]) {
      expect(source).toContain(`pi.registerCommand("${cmd}"`);
    }
  });
});
```

2) Run: `bun test tests/mp-existing-commands.test.ts`
   Expected: PASS (Task 2 already added `/mp` registration; existing commands were never removed)

3) Run: `bun test`
   Expected: all passing
