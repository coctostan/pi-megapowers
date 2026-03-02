---
id: 3
title: Remove unused jj parameter from prompt injection path
status: approved
depends_on:
  - 2
no_test: false
files_to_modify:
  - extensions/megapowers/prompt-inject.ts
  - extensions/megapowers/hooks.ts
  - tests/prompt-inject.test.ts
files_to_create: []
---

### Task 3: Remove unused jj parameter from prompt injection path [depends: 2]
**Covers AC 10**

#### Step 1 — Write failing tests

In `tests/prompt-inject.test.ts`, add a signature guard test (self-contained imports included):

```ts
import { readFileSync } from "node:fs";
import { join } from "node:path";

it("buildInjectedPrompt signature no longer includes _jj", () => {
  const source = readFileSync(
    join(process.cwd(), "extensions", "megapowers", "prompt-inject.ts"),
    "utf-8",
  );
  expect(source).not.toContain("_jj?:");
  expect(source).toContain("export function buildInjectedPrompt(cwd: string, store?: Store)");
});
```

#### Step 2 — Run tests, verify RED
Run:
- `bun test tests/prompt-inject.test.ts`

Expected failure: the test fails because `_jj?:` is still present in `buildInjectedPrompt`.

#### Step 3 — Implement (surgical edits)

In `extensions/megapowers/prompt-inject.ts`:
1. Delete: `import type { JJ } from "./jj.js";`
2. Change signature from:
   - `export function buildInjectedPrompt(cwd: string, store?: Store, _jj?: JJ): string | null {`
   to:
   - `export function buildInjectedPrompt(cwd: string, store?: Store): string | null {`

In `extensions/megapowers/hooks.ts`:
- In `onBeforeAgentStart`, remove `jj` from deps destructure and call `buildInjectedPrompt(ctx.cwd, store)`.

#### Step 4 — Run targeted tests, verify GREEN
Run:
- `bun test tests/prompt-inject.test.ts`

Expected: PASS.

#### Step 5 — Full regression
Run:
- `bun test`

Expected: all tests pass.
