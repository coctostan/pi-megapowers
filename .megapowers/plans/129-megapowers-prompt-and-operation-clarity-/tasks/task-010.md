---
id: 10
title: Standardize handleSignal phase_back feedback
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

Covers AC36, AC39. Updates `handlePhaseBack` success message to start with `⚠️`, name the new phase, and state "rework needed" / next-step phrase.

**Step 1 — Write the failing test**

Append inside `describe("phase_back", ...)` in `tests/tool-signal.test.ts`:

```ts
    it("phase_back success message uses ⚠️ icon, names new phase, and includes rework / next-step phrase (AC36, AC39)", () => {
      setState(tmp, { phase: "verify" });
      const r = handleSignal(tmp, "phase_back");
      expect(r.error).toBeUndefined();
      expect(r.message!.startsWith("⚠️")).toBe(true);
      expect(r.message).toContain("implement");
      expect(r.message!.toLowerCase()).toContain("rework");
    });
```

**Step 2 — Run test, verify it fails**
Run: `bun test tests/tool-signal.test.ts -t "phase_back success message uses"`
Expected: FAIL — `expect(r.message.startsWith("⚠️")).toBe(true)` — current message is `Phase moved back to implement. Rework needed — continue with the implement phase.` (no leading icon).

**Step 3 — Write minimal implementation**

In `extensions/megapowers/tools/tool-signal.ts`, in `handlePhaseBack` (line 254), replace the final return block (lines 293–296):

```ts
  return {
    message: composeMessage({
      icon: "warn",
      summary: `Phase moved back to ${result.newPhase}`,
      changes: ["Rework needed"],
      nextStep: `Continue with the ${result.newPhase} phase.`,
    }),
    triggerNewSession: true,
  };
```

Pre-existing tests asserting `toContain("implement")` continue to pass — the substring is preserved.

**Step 4 — Run test, verify it passes**
Run: `bun test tests/tool-signal.test.ts -t "phase_back"`
Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: all passing
