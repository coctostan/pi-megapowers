---
id: 1
title: Restore reviewer ownership wording in review-plan prompt
status: approved
depends_on: []
no_test: false
files_to_modify:
  - prompts/review-plan.md
  - tests/prompt-inject.test.ts
files_to_create: []
---

### Task 1: Restore reviewer ownership wording in review-plan prompt

Covers Fixed When: 1

**Files:**
- Modify: `prompts/review-plan.md`
- Test: `tests/prompt-inject.test.ts`

**Step 1 — Write the failing test**
Add this test inside `describe("buildInjectedPrompt — plan mode routing", ...)` in `tests/prompt-inject.test.ts`:

```ts
it("review-plan prompt keeps reviewer ownership even after deterministic checks", () => {
  setState(tmp, { phase: "plan", planMode: "review", planIteration: 1, megaEnabled: true });

  const result = buildInjectedPrompt(tmp);

  expect(result).not.toBeNull();
  expect(result).toContain("Treat any deterministic checks or earlier validation as advisory hints, not as authoritative approval.");
  expect(result).toContain("You still own the full review verdict.");
  expect(result).toContain("Review each task in order: coverage, dependencies, TDD correctness, then self-containment/codebase realism.");
  expect(result).not.toContain("The plan has already passed deterministic structural lint (T0) and a fast-model coherence check (T1).");
  expect(result).not.toContain("Focus your review entirely on higher-order concerns");
});
```

**Step 2 — Run test, verify it fails**
Run: `bun test tests/prompt-inject.test.ts -t "review-plan prompt keeps reviewer ownership even after deterministic checks"`
Expected: FAIL — `expect(received).toContain(expected)` because the injected prompt still contains the old T0/T1-authoritative wording and does not contain `Treat any deterministic checks or earlier validation as advisory hints, not as authoritative approval.`

**Step 3 — Write minimal implementation**
In `prompts/review-plan.md`, replace the paragraph under `## Evaluate against these criteria:` and the self-containment note so the prompt says:

```md
Treat any deterministic checks or earlier validation as advisory hints, not as authoritative approval. You still own the full review verdict. Re-check coverage, dependency ordering, TDD completeness, self-containment, and codebase realism yourself before approving or requesting revisions.

Review each task in order: coverage, dependencies, TDD correctness, then self-containment/codebase realism.
```

Also replace the parenthetical at the end of `### 6. Self-Containment` with:

```md
(Earlier structural checks may be helpful hints, but you must still verify file paths, descriptions, imports, APIs, and error handling yourself.)
```

Keep the existing per-task assessment format, verdict section, and revise-instructions handoff text unchanged.

**Step 4 — Run test, verify it passes**
Run: `bun test tests/prompt-inject.test.ts -t "review-plan prompt keeps reviewer ownership even after deterministic checks"`
Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: all passing
