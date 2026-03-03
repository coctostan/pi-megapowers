---
id: 4
title: Inject vars.revise_instructions from file when planMode is revise (AC1)
status: approved
depends_on:
  - 1
  - 3
no_test: false
files_to_modify:
  - extensions/megapowers/prompt-inject.ts
  - tests/prompt-inject.test.ts
files_to_create: []
---

### Task 4: Inject vars.revise_instructions from file when planMode is revise (AC1) [depends: 1, 3]
**Covers:**
- AC1 — When `planMode` is `"revise"` and `revise-instructions-{planIteration - 1}.md` exists, `buildInjectedPrompt` populates `vars.revise_instructions` with the file's full content

**Files:**
- Modify: `extensions/megapowers/prompt-inject.ts`
- Test: `tests/prompt-inject.test.ts`
**Step 1 — Write the failing test**

Add to the `"buildInjectedPrompt — plan phase variable injection"` describe block in `tests/prompt-inject.test.ts` (created in Task 3):

```typescript
  it("populates revise_instructions from file when planMode is revise (AC1)", () => {
    setState(tmp, { phase: "plan", planMode: "revise", planIteration: 2, megaEnabled: true });
    const store = createStore(tmp);
    // planIteration - 1 = 1; reviewer at iteration 1 wrote revise-instructions-1.md
    store.writePlanFile("001-test", "revise-instructions-1.md", "## Task 3: Fix test\n\nStep 2 needs specific error message.");
    const result = buildInjectedPrompt(tmp, store);
    expect(result).not.toBeNull();
    expect(result).toContain("## Task 3: Fix test");
    expect(result).toContain("Step 2 needs specific error message.");
    expect(result).not.toContain("{{revise_instructions}}");
  });
```

**Step 2 — Run test, verify it fails**

Run: `bun test tests/prompt-inject.test.ts --filter "populates revise_instructions from file"`

Expected: FAIL —
```
expect(received).toContain(expected)
Expected substring: "## Task 3: Fix test"
Received: "...{{revise_instructions}}..."
```
(`vars.revise_instructions` is not yet populated so `interpolatePrompt` leaves the token unreplaced)

**Step 3 — Write minimal implementation**

In `extensions/megapowers/prompt-inject.ts`, expand the plan-phase block added in Task 3. This block must live **before** `const phasePrompt = interpolatePrompt(template, vars)` so the token is replaced during interpolation. Change:

```typescript
  // Plan phase: inject plan_iteration for template variables (AC4)
  if (state.phase === "plan") {
    vars.plan_iteration = String(state.planIteration);
  }
```

To:

```typescript
  // Plan phase: inject plan_iteration and revise_instructions (AC1-4)
  if (state.phase === "plan") {
    vars.plan_iteration = String(state.planIteration);

    if (state.planMode === "revise" && store) {
      const filename = `revise-instructions-${state.planIteration - 1}.md`;
      const content = store.readPlanFile(state.activeIssue!, filename);
      if (content !== null) {
        vars.revise_instructions = content;
      }
      // AC2 empty-string fallback is added in Task 6
    }
  }
```

The iteration math is intentional: reviewer at iteration `N` writes `revise-instructions-N.md`; reviser at iteration `N+1` reads `revise-instructions-{N+1-1}.md` = `revise-instructions-N.md`.

**Step 4 — Run test, verify it passes**

Run: `bun test tests/prompt-inject.test.ts --filter "populates revise_instructions from file"`

Expected: PASS

**Step 5 — Verify no regressions**

Run: `bun test`
Expected: all passing
