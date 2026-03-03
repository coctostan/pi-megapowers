---
id: 12
title: Delete jj modules and jj-specific tests
status: approved
depends_on:
  - 11
no_test: false
files_to_modify:
  - extensions/megapowers/jj.ts
  - extensions/megapowers/jj-messages.ts
  - tests/jj.test.ts
  - tests/index-integration.test.ts
files_to_create: []
---

### Task 12: Delete jj modules and jj-specific tests [depends: 11]
**Covers AC 1, AC 12**

**Step 1 — Write failing tests**

In `tests/index-integration.test.ts` (add `existsSync` import if not present):

```ts
import { existsSync } from "node:fs";
it("jj module files are removed", () => {
  expect(existsSync("extensions/megapowers/jj.ts")).toBe(false);
  expect(existsSync("extensions/megapowers/jj-messages.ts")).toBe(false);
});

it("jj test file is removed", () => {
  expect(existsSync("tests/jj.test.ts")).toBe(false);
});
```

Also remove old jj-availability assertions in this file (obsolete after Task 5).

**Step 2 — Run tests, verify RED**

Run:
- `bun test tests/index-integration.test.ts`

Expected failure message:
```
expect(received).toBe(expected)
Expected: false
Received: true
```
because `extensions/megapowers/jj.ts` still exists on disk.

**Step 3 — Implement (full code)**

1. Delete these files (use `rm` or equivalent):
   - `extensions/megapowers/jj.ts`
   - `extensions/megapowers/jj-messages.ts`
- `tests/jj.test.ts`
2. Verify no remaining imports reference the deleted modules:
   ```bash
   grep -R 'from.*["./]jj[".]' extensions/megapowers tests --include='*.ts'
   ```
   Expected: no matches (all imports were removed in Tasks 1–11).

3. Ensure no index/barrel file re-exports from the deleted modules.

**Step 4 — Run targeted tests, verify GREEN**

Run:
- `bun test tests/index-integration.test.ts`

Expected: PASS.

**Step 5 — Full regression**

Run:
- `bun test`
Expected: PASS.
