---
id: 6
title: Context debug report shows compact header
status: approved
depends_on:
  - 4
no_test: false
files_to_modify:
  - tests/context-summary.test.ts
files_to_create: []
---

**Files:**
- Modify: `tests/context-summary.test.ts`

Covers AC34. Adds a test that `renderContextReport(cwd, store, { debug: true })` includes the compact `## Megapowers` header for an active session. No implementation change is needed — `renderContextReport` already appends `buildInjectedPrompt(...)` in debug mode (context-summary.ts:188–192), and Task 4 makes that prompt contain `## Megapowers` instead of `## Megapowers Protocol`. This task isolates the behavioral assertion so failures in either direction surface here.

**Step 1 — Write the failing test**

Append inside `describe("context inspection debug report", ...)` in `tests/context-summary.test.ts`, right after the existing `it("includes an explicit rendered prompt section only in debug mode", ...)` test:

```ts
  it("debug report's rendered prompt section contains the compact `## Megapowers` header (AC34)", () => {
    const store = createStore(tmp);
    mkdirSync(join(tmp, ".megapowers", "plans", "001-test"), { recursive: true });
    setState(tmp, { phase: "plan", planMode: "draft", planIteration: 1 });

    const debug = renderContextReport(tmp, store, { debug: true });

    expect(debug).toContain("## Rendered prompt");
    expect(debug).toContain("## Megapowers");
    expect(debug).not.toContain("## Megapowers Protocol");
  });
```

**Step 2 — Run test, verify it fails (or passes after Task 4)**

Before Task 4: this test would fail with `expect(received).not.toContain("## Megapowers Protocol")` because the rendered prompt still contains the full protocol heading.

Run: `bun test tests/context-summary.test.ts`
Expected (with Task 4 already landed): PASS — `renderContextReport(..., {debug: true})` includes the compact header.

If running this task before Task 4, the expected failure is: `Expected substring: "## Megapowers" — Received: ... "## Megapowers Protocol" ...` (the assertion `not.toContain("## Megapowers Protocol")` fails).

**Step 3 — Write minimal implementation**

No implementation change. The test is satisfied by Task 4's compact-header refactor.

If the test fails because Task 4 has not yet been applied, complete Task 4 first; the listed dependency `[depends: 4]` enforces this.

**Step 4 — Run test, verify it passes**
Run: `bun test tests/context-summary.test.ts`
Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: all passing
