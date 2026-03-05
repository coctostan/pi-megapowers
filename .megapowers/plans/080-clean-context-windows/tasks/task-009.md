---
id: 9
title: Simplify newSession call pattern in register-tools.ts
status: approved
depends_on:
  - 8
no_test: false
files_to_modify:
  - extensions/megapowers/register-tools.ts
  - tests/new-session-wiring.test.ts
files_to_create: []
---

### Task 9: Simplify newSession call pattern in register-tools.ts [depends: 8]

AC10 and AC11 require replacing the broken `(ctx.sessionManager as any)?.newSession?.(...)` call pattern with a cleaner approach. The `ExtensionContext` type (used in tool execute) does not expose `newSession` — that method lives on `ReadonlySessionManager` at runtime (as the full `SessionManager`). The improvement is to drop the unnecessary `parentSession` parameter (the new session inherits context via `buildInjectedPrompt`, not via session chaining), and simplify the cast.

**Files:**
- Modify: `extensions/megapowers/register-tools.ts`
- Modify: `tests/new-session-wiring.test.ts`

**Step 1 — Write the failing test**

In `tests/new-session-wiring.test.ts`, replace the existing test "uses a type-safe any-cast for sessionManager newSession access" (around line 101-105) with:

```ts
  it("calls newSession via sessionManager cast without parentSession arg", () => {
    const source = readFileSync(join(process.cwd(), "extensions/megapowers/register-tools.ts"), "utf8");
    // Should use the simplified cast pattern
    expect(source).toContain("(ctx.sessionManager as any)?.newSession?.()");
    // Should NOT use the old pattern with parentSession
    expect(source).not.toContain("parentSession");
    expect(source).not.toContain("getSessionFile");
  });
```

**Step 2 — Run test, verify it fails**

Run: `bun test tests/new-session-wiring.test.ts -t "calls newSession via sessionManager cast without parentSession arg"`

Expected: FAIL — `expect(string).not.toContain("parentSession")` fails because the current code includes `{ parentSession: parent ?? undefined }`.

**Step 3 — Write minimal implementation**

In `extensions/megapowers/register-tools.ts`, modify both `newSession` call sites.

For the **signal tool handler** (around lines 44-47), change from:
```ts
      if (result.triggerNewSession) {
        const parent = ctx.sessionManager?.getSessionFile?.();
        (ctx.sessionManager as any)?.newSession?.({ parentSession: parent ?? undefined });
      }
```

To:
```ts
      if (result.triggerNewSession) {
        (ctx.sessionManager as any)?.newSession?.();
      }
```

For the **plan-review tool handler** (around lines 98-101), change from:
```ts
      if (result.triggerNewSession) {
        const parent = ctx.sessionManager?.getSessionFile?.();
        (ctx.sessionManager as any)?.newSession?.({ parentSession: parent ?? undefined });
      }
```

To:
```ts
      if (result.triggerNewSession) {
        (ctx.sessionManager as any)?.newSession?.();
      }
```

**Step 4 — Run test, verify it passes**

Run: `bun test tests/new-session-wiring.test.ts -t "calls newSession via sessionManager cast without parentSession arg"`

Expected: PASS

**Step 5 — Verify no regressions**

Run: `bun test`

Expected: all passing
