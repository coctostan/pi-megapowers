# Verification Report: 082-reviewer-authored-revise-instructions-ha

## Test Suite Results

```
bun test v1.3.9 (cf6cdbbb)

 751 pass
 0 fail
 1657 expect() calls
Ran 751 tests across 72 files. [493.00ms]
```

Targeted test runs:
- `bun test tests/prompt-inject.test.ts`: 31 pass, 0 fail
- `bun test tests/tool-plan-review.test.ts`: 13 pass, 0 fail
- `bun test tests/reproduce-084-batch.test.ts`: 14 pass, 0 fail

---

## Per-Criterion Verification

### Criterion 1: `buildInjectedPrompt` populates `vars.revise_instructions` with file content when `planMode` is `"revise"` and `revise-instructions-{planIteration-1}.md` exists

**Evidence:**
- `extensions/megapowers/prompt-inject.ts:139-142`:
  ```ts
  if (state.planMode === "revise" && store) {
    const filename = `revise-instructions-${state.planIteration - 1}.md`;
    const content = store.readPlanFile(state.activeIssue!, filename);
    vars.revise_instructions = content ?? "";
  }
  ```
- Test: `tests/prompt-inject.test.ts:125` — "populates revise_instructions from file when planMode is revise (AC1)" — **pass**
- Corroborating test: `tests/reproduce-084-batch.test.ts` "#082 — FIX: buildInjectedPrompt injects revise-instructions content in revise mode (AC1)" — **pass**

**Verdict:** ✅ pass

---

### Criterion 2: `vars.revise_instructions` is set to empty string when `planMode` is `"revise"` and file does not exist

**Evidence:**
- `extensions/megapowers/prompt-inject.ts:142`: `vars.revise_instructions = content ?? ""` — `readPlanFile` returns `null` when file is absent → `null ?? ""` = `""`
- Test: `tests/prompt-inject.test.ts:137` — "sets revise_instructions to empty string when file is missing in revise mode (AC2)" — **pass**

**Verdict:** ✅ pass

---

### Criterion 3: `vars.revise_instructions` is not populated when `planMode` is `"draft"`

**Evidence:**
- `extensions/megapowers/prompt-inject.ts:139`: The `revise_instructions` assignment is inside `if (state.planMode === "revise")` — never executed in draft mode.
- Test: `tests/prompt-inject.test.ts:150` — "does not read revise-instructions-* files when planMode is draft (AC3)" — monitors `store.readPlanFile` calls and asserts no `revise-instructions-*` file was read — **pass**

**Verdict:** ✅ pass

---

### Criterion 4: `vars.plan_iteration` is populated with `String(state.planIteration)` whenever phase is `"plan"`

**Evidence:**
- `extensions/megapowers/prompt-inject.ts:137-138`:
  ```ts
  if (state.phase === "plan") {
    vars.plan_iteration = String(state.planIteration);
  ```
  This executes regardless of `planMode`.
- Test: `tests/prompt-inject.test.ts:113` — "populates plan_iteration as string when phase is plan (AC4)" — sets `planIteration: 3`, asserts result contains `"revise-instructions-3.md"` ({{plan_iteration}} → "3") — **pass**

**Verdict:** ✅ pass

---

### Criterion 5: `handlePlanReview` validates `revise-instructions-{planIteration}.md` exists before accepting `revise` verdict

**Evidence:**
- `extensions/megapowers/tools/tool-plan-review.ts:36-48`:
  ```ts
  // Gate: revise verdict requires revise-instructions file (AC5, AC6)
  if (params.verdict === "revise") {
    const filename = `revise-instructions-${state.planIteration}.md`;
    const filepath = join(cwd, ".megapowers", "plans", slug, filename);
    if (!existsSync(filepath)) {
      return { error: `Missing revise-instructions file: ${filepath}\n...` };
    }
  }
  ```
- Test: `tests/tool-plan-review.test.ts:232` — "returns error when revise-instructions file is missing on revise verdict (AC5, AC6)" — **pass**
- Test: `tests/tool-plan-review.test.ts:250` — "succeeds when revise-instructions file exists on revise verdict (AC5 happy-path)" — **pass**

**Verdict:** ✅ pass

---

### Criterion 6: Error message contains expected filename and full path when revise-instructions file is missing

**Evidence:**
- `extensions/megapowers/tools/tool-plan-review.ts:42-46`:
  ```ts
  return {
    error:
      `Missing revise-instructions file: ${filepath}\n` +
      `Expected filename: ${filename}\n` +
      "Write it before submitting a revise verdict.",
  };
  ```
  `filepath` = full path, `filename` = e.g. `revise-instructions-1.md`
- Test: `tests/tool-plan-review.test.ts:246-247`:
  ```ts
  expect(result.error).toContain("revise-instructions-1.md");   // filename
  expect(result.error).toContain(expectedFilepath);              // full path
  ```
  — **pass**

**Verdict:** ✅ pass

---

### Criterion 7: No revise-instructions file check when `verdict` is `"approve"`

**Evidence:**
- `extensions/megapowers/tools/tool-plan-review.ts:37`: The `existsSync` check is guarded by `if (params.verdict === "revise")` — approve path never enters it.
- Test: `tests/tool-plan-review.test.ts:269` — "does not check for revise-instructions file on approve verdict (AC7)" — no `revise-instructions-1.md` written, approve verdict succeeds without error — **pass**

**Verdict:** ✅ pass

---

### Criterion 8: `revise-plan.md` contains `{{revise_instructions}}` in its "Reviewer's Instructions" section

**Evidence:**
```
$ grep -n "revise_instructions\|Reviewer" prompts/revise-plan.md
8:## Reviewer's Instructions
9:{{revise_instructions}}
```
`{{revise_instructions}}` appears on line 9, directly under the `## Reviewer's Instructions` heading (line 8).
- Test: `tests/reproduce-084-batch.test.ts:198` — "FIX: revise-plan.md contains {{revise_instructions}} in Reviewer's Instructions section (AC8)" — **pass**

**Verdict:** ✅ pass

---

### Criterion 9: `review-plan.md` contains `{{plan_iteration}}` in its revise-instructions handoff section and "After Review" section

**Evidence:**
```
$ grep -n "plan_iteration\|After Review" prompts/review-plan.md
76:When your verdict is `revise`, you MUST write a `revise-instructions-{{plan_iteration}}.md` file ...
78:Save it to: `.megapowers/plans/{{issue_slug}}/revise-instructions-{{plan_iteration}}.md` (where `{{plan_iteration}}` is the current plan iteration number).
111:## After Review
124:First, write `revise-instructions-{{plan_iteration}}.md` as described above. Then:
```
`{{plan_iteration}}` appears in the revise-instructions handoff section (lines 76, 78 — before "## After Review") and in the "After Review" section (line 124, under heading at line 111).
- Test: `tests/reproduce-084-batch.test.ts:204` — "FIX: review-plan.md instructs reviewer to write revise-instructions file with {{plan_iteration}} (AC9)" — asserts `template.toContain("revise-instructions-{{plan_iteration}}.md")` — **pass**

**Verdict:** ✅ pass

---

## Overall Verdict

**PASS**

All 9 acceptance criteria are met. The implementation in `extensions/megapowers/prompt-inject.ts` correctly injects `plan_iteration` for all plan modes and `revise_instructions` (file content or empty string) for revise mode only. `extensions/megapowers/tools/tool-plan-review.ts` gates revise verdicts on the presence of the revise-instructions file and returns an informative error with filename + path when missing. Both prompt templates (`revise-plan.md`, `review-plan.md`) contain the required `{{revise_instructions}}` and `{{plan_iteration}}` template variables in the specified sections. All targeted tests pass and the full 751-test suite has 0 failures.
