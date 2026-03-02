---
id: 6
title: Drop jj parameter threading from signal handling and tool wiring
status: approved
depends_on:
  - 5
no_test: false
files_to_modify:
  - extensions/megapowers/tools/tool-signal.ts
  - extensions/megapowers/register-tools.ts
  - extensions/megapowers/commands.ts
  - tests/tool-signal.test.ts
files_to_create: []
---

### Task 6: Drop jj parameter threading from signal handling and tool wiring [depends: 5]
**Covers AC 7**

#### Step 1 — Write failing tests

In `tests/tool-signal.test.ts`:
- Remove any `JJ` type imports.
- Update any calls that pass a jj argument to `handleSignal` to match the new signature.
- Add wiring assertions:

```ts
import { readFileSync } from "node:fs";
import { join } from "node:path";

it("handleSignal signature has no jj parameter", () => {
  const source = readFileSync(join(process.cwd(), "extensions/megapowers/tools/tool-signal.ts"), "utf-8");
  expect(source).not.toContain("jj?:");
  expect(source).toContain("export function handleSignal(");
});

it("register-tools wires handleSignal without jj", () => {
  const source = readFileSync(join(process.cwd(), "extensions/megapowers/register-tools.ts"), "utf-8");
  expect(source).toContain("handleSignal(ctx.cwd, params.action, params.target)");
  expect(source).not.toContain("handleSignal(ctx.cwd, params.action, jj");
});
```

#### Step 2 — Run tests, verify RED
Run:
- `bun test tests/tool-signal.test.ts`

Expected failure: the signature assertion fails because `handleSignal` still mentions `jj`.

#### Step 3 — Implement (surgical edits)

In `extensions/megapowers/tools/tool-signal.ts`:
1. Remove `import type { JJ } from "../jj.js";`.
2. Change signature to:

```ts
export function handleSignal(
  cwd: string,
  action: "task_done" | "review_approve" | "phase_next" | "phase_back" | "tests_failed" | "tests_passed" | "plan_draft_done" | string,
  target?: string,
): SignalResult {
```

3. Update switch dispatch to call helpers without jj.
4. Update helper signatures accordingly:
   - `handleTaskDone(cwd)`
   - `handlePhaseNext(cwd, target?)`
   - `handlePhaseBack(cwd)`

In `extensions/megapowers/register-tools.ts`:
- In the `megapowers_signal` tool execute block, call:
  - `handleSignal(ctx.cwd, params.action, params.target)`

In `extensions/megapowers/commands.ts`:
- Update all `handleSignal` call sites to drop the jj argument.

#### Step 4 — Run targeted tests, verify GREEN
Run:
- `bun test tests/tool-signal.test.ts`

Expected: PASS.

#### Step 5 — Full regression
Run:
- `bun test`

Expected: all tests pass.
