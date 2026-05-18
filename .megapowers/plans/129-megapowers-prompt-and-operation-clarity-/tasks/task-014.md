---
id: 14
title: Standardize close_issue feedback
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

Covers AC36, AC43. `close_issue` success message starts with `✅`, names the closed issue slug, and includes the count of source issues closed when applicable.

**Step 1 — Write the failing test**

Append inside `describe("close_issue signal", ...)` in `tests/tool-signal.test.ts`:

```ts
    it("close_issue success message starts with ✅ and names slug; includes source count when batch (AC36, AC43)", () => {
      const issuesDir = join(tmp, ".megapowers", "issues");
      mkdirSync(issuesDir, { recursive: true });
      writeFileSync(
        join(issuesDir, "010-source-a.md"),
        "---\nid: 10\ntype: feature\nstatus: in-progress\ncreated: 2026-01-01T00:00:00.000Z\n---\n# Source A\nDesc",
      );
      writeFileSync(
        join(issuesDir, "020-batch.md"),
        "---\nid: 20\ntype: feature\nstatus: in-progress\ncreated: 2026-01-01T00:00:00.000Z\nsources: [10]\n---\n# Batch\nC",
      );
      setState(tmp, { activeIssue: "020-batch", phase: "done" });
      const r = handleSignal(tmp, "close_issue");
      expect(r.error).toBeUndefined();
      expect(r.message!.startsWith("✅")).toBe(true);
      expect(r.message).toContain("020-batch");
      expect(r.message).toContain("1 source");
    });

    it("close_issue success message starts with ✅ when no sources (AC36, AC43)", () => {
      const issuesDir = join(tmp, ".megapowers", "issues");
      mkdirSync(issuesDir, { recursive: true });
      writeFileSync(
        join(issuesDir, "001-test.md"),
        "---\nid: 1\ntype: feature\nstatus: in-progress\ncreated: 2026-01-01T00:00:00.000Z\n---\n# T\nD",
      );
      setState(tmp, { phase: "done" });
      const r = handleSignal(tmp, "close_issue");
      expect(r.error).toBeUndefined();
      expect(r.message!.startsWith("✅")).toBe(true);
      expect(r.message).toContain("001-test");
    });
```

**Step 2 — Run test, verify it fails**
Run: `bun test tests/tool-signal.test.ts -t "close_issue success message starts"`
Expected: FAIL — current message is `Issue 020-batch marked as done (+ 1 source issues).` — `startsWith("✅")` fails.

**Step 3 — Write minimal implementation**

In `extensions/megapowers/tools/tool-signal.ts`, replace the final return in `handleCloseIssue` (line 321):

```ts
  const changes = sources.length > 0
    ? [`Closed ${sources.length} source issue${sources.length === 1 ? "" : "s"} (batch)`]
    : undefined;
  return {
    message: composeMessage({
      icon: "success",
      summary: `Issue ${state.activeIssue} marked as done`,
      changes,
    }),
  };
```

Pre-existing tests asserting `toContain("done")` and `toContain("2 source issues")` continue to pass (substring `"2 source"` still appears via `"Closed 2 source issues"`).

**Step 4 — Run test, verify it passes**
Run: `bun test tests/tool-signal.test.ts -t "close_issue"`
Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: all passing
