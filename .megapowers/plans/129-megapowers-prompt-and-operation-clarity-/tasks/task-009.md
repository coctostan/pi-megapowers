---
id: 9
title: Standardize handleSignal phase_next feedback
status: approved
depends_on:
  - 2
no_test: false
files_to_modify:
  - extensions/megapowers/tools/tool-signal.ts
  - tests/tool-signal.test.ts
files_to_create: []
---

**Files:**
- Modify: `extensions/megapowers/tools/tool-signal.ts`
- Modify: `tests/tool-signal.test.ts`

Covers AC36, AC38. Updates `handlePhaseNext` success message to start with `📋`, name the new phase, and give an explicit next-step phrase.

**Step 1 — Write the failing test**

Append inside `describe("phase_next", ...)` in `tests/tool-signal.test.ts`:

```ts
    it("phase_next success message uses 📋 icon and names new phase + next-step phrase (AC36, AC38)", () => {
      setState(tmp, { phase: "brainstorm" });
      const r = handleSignal(tmp, "phase_next");
      expect(r.error).toBeUndefined();
      expect(r.message!.startsWith("📋")).toBe(true);
      expect(r.message).toContain("spec");
      expect(r.message).toMatch(/Next:/);
    });
```

**Step 2 — Run test, verify it fails**
Run: `bun test tests/tool-signal.test.ts -t "phase_next success message uses"`
Expected: FAIL — `expect(r.message.startsWith("📋")).toBe(true)`, actual message is `Phase advanced to spec. Proceed with spec phase work.` (no leading icon).

**Step 3 — Write minimal implementation**

In `extensions/megapowers/tools/tool-signal.ts`, in `handlePhaseNext` (line 239), replace the return block:

```ts
  return {
    message: composeMessage({
      icon: "info",
      summary: `Phase advanced to ${result.newPhase}`,
      nextStep: `Proceed with ${result.newPhase} phase work.`,
    }),
    triggerNewSession: true,
  };
```

(Assume the `composeMessage` import from Task 8 is already present; if Task 8 is applied first there is no second import to add.)

**Step 4 — Run test, verify it passes**
Run: `bun test tests/tool-signal.test.ts -t "phase_next"`
Expected: PASS (existing `toContain("spec")` assertions continue to pass — the substring is preserved).

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: all passing
