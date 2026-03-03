---
id: 3
title: Populate vars.plan_iteration in buildInjectedPrompt when phase is plan
status: approved
depends_on:
  - 2
no_test: false
files_to_modify:
  - extensions/megapowers/prompt-inject.ts
  - tests/prompt-inject.test.ts
files_to_create: []
---

### Task 3: Populate vars.plan_iteration in buildInjectedPrompt when phase is plan [depends: 2]

**Covers:** AC4 — `vars.plan_iteration` is populated with `String(state.planIteration)` whenever the phase is `"plan"`, regardless of plan mode

**Files:**
- Modify: `extensions/megapowers/prompt-inject.ts`
- Test: `tests/prompt-inject.test.ts`

**Step 1 — Write the failing test**

Add to `tests/prompt-inject.test.ts`, inside a new describe block after the "plan mode routing" block:

```typescript
describe("buildInjectedPrompt — plan phase variable injection", () => {
  let tmp: string;

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), "prompt-inject-plan-vars-"));
  });

  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  it("populates plan_iteration as string when phase is plan (AC4)", () => {
    setState(tmp, { phase: "plan", planMode: "review", planIteration: 3, megaEnabled: true });
    const store = createStore(tmp);
    // review-plan.md has {{plan_iteration}} after Task 2
    const result = buildInjectedPrompt(tmp, store);
    expect(result).not.toBeNull();
    // The template variable {{plan_iteration}} should be replaced with "3"
    expect(result).toContain("revise-instructions-3.md");
    // Verify it doesn't contain the un-interpolated template variable
    expect(result).not.toContain("{{plan_iteration}}");
  });
});
```

**Step 2 — Run test, verify it fails**
Run: `bun test tests/prompt-inject.test.ts --filter "populates plan_iteration"`
Expected: FAIL — `expect(received).toContain(expected)` — the output contains literal `{{plan_iteration}}` because `vars.plan_iteration` is not yet populated, so `interpolatePrompt` leaves the template variable un-replaced.

**Step 3 — Write minimal implementation**

In `extensions/megapowers/prompt-inject.ts`, add the following block before the plan mode template selection (before the `if (state.phase === "plan" && state.planMode)` block at line 137):

```typescript
  // Plan phase: inject plan_iteration for template variables (AC4)
  if (state.phase === "plan") {
    vars.plan_iteration = String(state.planIteration);
  }
```

Insert this between the learnings/roadmap block (line 128) and the plan mode template selection block (line 137).

**Step 4 — Run test, verify it passes**
Run: `bun test tests/prompt-inject.test.ts --filter "populates plan_iteration"`
Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: all passing
