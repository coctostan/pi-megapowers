# Verification Report: 082 — Reviewer-Authored Revise Instructions Handoff

## Test Suite Results

```
bun test 2>&1
 748 pass
   3 fail
1656 expect() calls
Ran 751 tests across 72 files. [446.00ms]
```

The suite has **3 failures**, all in `tests/reproduce-084-batch.test.ts`. See analysis below.

---

## Per-Criterion Verification

### Criterion 1: `revise_instructions` populated from file when `planMode` is `"revise"` and file exists
**Evidence:**
- Code: `prompt-inject.ts` lines 137–143:
  ```ts
  if (state.phase === "plan") {
    vars.plan_iteration = String(state.planIteration);
    if (state.planMode === "revise" && store) {
      const filename = `revise-instructions-${state.planIteration - 1}.md`;
      const content = store.readPlanFile(state.activeIssue!, filename);
      vars.revise_instructions = content ?? "";
    }
  }
  ```
- Test: `tests/prompt-inject.test.ts` → "populates revise_instructions from file when planMode is revise (AC1)"
  - State: `planMode: "revise", planIteration: 2`; writes `revise-instructions-1.md` (= planIteration - 1)
  - Asserts `result.toContain("## Task 3: Fix test")` and `result.not.toContain("{{revise_instructions}}")`
  - **Result: PASS** (31/31 tests in prompt-inject.test.ts)

**Verdict: ✅ PASS**

---

### Criterion 2: `vars.revise_instructions` set to empty string when file is missing in revise mode
**Evidence:**
- Code: `vars.revise_instructions = content ?? ""` (line 142, prompt-inject.ts) — nullish coalesces to `""` when file absent
- Test: "sets revise_instructions to empty string when file is missing in revise mode (AC2)"
  - No file written; asserts `result.not.toContain("{{revise_instructions}}")` and heading structure preserved
  - **Result: PASS**

**Verdict: ✅ PASS**

---

### Criterion 3: In `draft` mode, `vars.revise_instructions` is not populated
**Evidence:**
- Code: The `if (state.planMode === "revise" && store)` guard (line 139) means the block is entirely skipped when `planMode === "draft"` — no `vars.revise_instructions` assignment occurs
- Test: "does not read revise-instructions-* files when planMode is draft (AC3)"
  - Spy on `store.readPlanFile`; checks `calls.some(f => f.startsWith("revise-instructions-"))` is `false`
  - **Result: PASS**

**Verdict: ✅ PASS**

---

### Criterion 4: `vars.plan_iteration` populated with `String(state.planIteration)` whenever phase is `"plan"`
**Evidence:**
- Code: `vars.plan_iteration = String(state.planIteration)` at line 138, inside `if (state.phase === "plan")` — applies regardless of `planMode`
- Test: "populates plan_iteration as string when phase is plan (AC4)"
  - State: `planMode: "review", planIteration: 3`
  - Asserts `result.toContain("revise-instructions-3.md")` (template uses `{{plan_iteration}}` = "3") and `result.not.toContain("{{plan_iteration}}")`
  - **Result: PASS**

**Verdict: ✅ PASS**

---

### Criterion 5: `handlePlanReview` validates `revise-instructions-{planIteration}.md` exists before accepting `"revise"` verdict
**Evidence:**
- Code: `tool-plan-review.ts` lines 36–48:
  ```ts
  if (params.verdict === "revise") {
    const filename = `revise-instructions-${state.planIteration}.md`;
    const filepath = join(cwd, ".megapowers", "plans", slug, filename);
    if (!existsSync(filepath)) {
      return { error: `Missing revise-instructions file: ${filepath}\n...` };
    }
  }
  ```
- Test: "returns error when revise-instructions file is missing on revise verdict (AC5, AC6)" → `result.error` is defined, PASS
- Test: "succeeds when revise-instructions file exists on revise verdict (AC5 happy-path)" → `result.error` is undefined, `result.message` contains "REVISE", PASS
- **Result: 13/13 tests in tool-plan-review.test.ts pass**

**Verdict: ✅ PASS**

---

### Criterion 6: Error message contains expected filename and full path when revise-instructions file is missing
**Evidence:**
- Code: error string is `"Missing revise-instructions file: ${filepath}\nExpected filename: ${filename}\n..."` where `filepath` is the absolute path and `filename` is `revise-instructions-{n}.md`
- Test: asserts `result.error.toContain("revise-instructions-1.md")` and `result.error.toContain(expectedFilepath)` where `expectedFilepath = join(tmp, ".megapowers", "plans", "001-test", "revise-instructions-1.md")`
- **Result: PASS**

**Verdict: ✅ PASS**

---

### Criterion 7: On `"approve"` verdict, no revise-instructions file check is performed
**Evidence:**
- Code: The `if (params.verdict === "revise")` guard means the file check is skipped entirely for approve
- Test: "does not check for revise-instructions file on approve verdict (AC7)"
  - No `revise-instructions-1.md` written; calls `handlePlanReview` with `verdict: "approve"`
  - Asserts `result.error` is undefined and `result.message.toContain("approved")`
  - **Result: PASS**

**Verdict: ✅ PASS**

---

### Criterion 8: `revise-plan.md` contains `{{revise_instructions}}` in "Reviewer's Instructions" section
**Evidence:**
```
$ grep -n "revise_instructions\|Reviewer.*Instruct" prompts/revise-plan.md
8:## Reviewer's Instructions
9:{{revise_instructions}}
```
- File `prompts/revise-plan.md` lines 8–9 show `{{revise_instructions}}` is directly under the "## Reviewer's Instructions" heading.

**Verdict: ✅ PASS**

---

### Criterion 9: `review-plan.md` contains `{{plan_iteration}}` in revise-instructions handoff section and "After Review" section
**Evidence:**
```
$ grep -n "plan_iteration\|revise-instructions" prompts/review-plan.md
76: ...write a `revise-instructions-{{plan_iteration}}.md` file...
78: Save it to: `.megapowers/plans/{{issue_slug}}/revise-instructions-{{plan_iteration}}.md`...
124: First, write `revise-instructions-{{plan_iteration}}.md` as described above. Then:
```
- `{{plan_iteration}}` appears in the "Revise-Instructions Handoff" section (line 76, 78) and in the "After Review" section (line 124).

**Verdict: ✅ PASS**

---

## Failing Tests: Stale Gap-Documentation Tests

The 3 failing tests are in `tests/reproduce-084-batch.test.ts`, inside the `describe("#082 — ...")` block. They were written **to document the original gap state** using `.not.toContain()` assertions:

| Test | Was testing for gap... | Status |
|---|---|---|
| "GAP: revise-plan.md template does not contain a revise_instructions variable" | `expect(template).not.toContain("{{revise_instructions}}")` | ❌ FAIL — template now DOES contain it (AC8 met) |
| "GAP: review-plan.md does not instruct reviewer to write revise-instructions file" | `expect(template).not.toContain("revise-instructions")` | ❌ FAIL — template now DOES contain it (AC9 met) |
| "GAP: tool-plan-review does not validate revise-instructions file exists" | `expect(source).not.toContain("revise-instructions")` | ❌ FAIL — source now DOES contain it (AC5/AC6 met) |

These failures are **direct evidence the implementation is correct** — the gaps are closed. However, the plan had no task to remove or convert these stale tests to positive assertions. The positive behavior is correctly tested by `tests/prompt-inject.test.ts` (31 tests) and `tests/tool-plan-review.test.ts` (13 tests), but the test suite still reports 3 failures.

**The test suite must pass cleanly before advancing to code-review.**

---

## Overall Verdict

**FAIL — test suite has 3 failures**

All 9 acceptance criteria are met by the implementation:
- `buildInjectedPrompt` correctly injects `vars.plan_iteration` (AC4) and `vars.revise_instructions` (AC1, AC2, AC3)
- `handlePlanReview` correctly gates on revise-instructions file existence (AC5, AC6, AC7)
- Template files are updated (`revise-plan.md` AC8, `review-plan.md` AC9)

However, **3 stale gap-documentation tests in `tests/reproduce-084-batch.test.ts` were not cleaned up** as part of the implementation. Their failure proves the fix is in place, but the test suite cannot report failures.

**Required fix (go back to implement):**
In `tests/reproduce-084-batch.test.ts`, inside `describe("#082 — revise-instructions not auto-injected into revise prompt", ...)`, remove or convert the 3 failing GAP tests:
1. Remove "GAP: revise-plan.md template does not contain a revise_instructions variable" (or invert to `toContain`)
2. Remove "GAP: review-plan.md does not instruct reviewer to write revise-instructions file" (or invert to `toContain`)
3. Remove "GAP: tool-plan-review does not validate revise-instructions file exists before accepting revise verdict" (or invert to `toContain`)

The 4th GAP test ("buildInjectedPrompt does not load revise-instructions file in revise mode") is accidentally passing due to a planIteration mismatch (uses `planIteration: 1` so lookup seeks `revise-instructions-0.md`, but the file created is `revise-instructions-1.md`). It should also be removed or corrected.
