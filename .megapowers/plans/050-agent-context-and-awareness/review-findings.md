# Review Findings — Plan 050-agent-context-and-awareness

This review is a quick sanity check against the spec acceptance criteria (AC1–AC10), focusing on **coverage**, **ordering**, and **completeness**.

## 1) Coverage

- **AC1–AC4 (base prompt injection / base.md):** Covered by Tasks 2–3.
- **AC5–AC7 (write policy allowlist + TDD guard):** Covered by Task 1.
- **AC8–AC9 (prompt guidance updates):** Covered by Tasks 4–5.
- **AC10 (template var coverage regression test):** Covered by Task 6.

**Gap / risk:**
- **Bugfix phases** (`reproduce`, `diagnose`) are not included in Task 1’s test matrix. AC5/AC6 say “every workflow phase”; those phases should be treated as “blocking” for source writes as well.

## 2) Ordering

- Task 3 correctly depends on Task 2 (`base.md` must exist before the injection path can load it).
- Task 6 depends on Task 3; that’s reasonable because the injection logic is needed for the template-var test to execute meaningfully.

No ordering issues beyond the above.

## 3) Completeness / Executability

### Task 1 issues (must revise)

1) **Current behavior bug likely exists today:** `extensions/megapowers/write-policy.ts` defines `BLOCKING_PHASES` as:
   - `brainstorm`, `spec`, `plan`, `review`, `verify`, `done`

   It **does not include** bugfix phases `reproduce` and `diagnose`, which means **source code writes are currently allowed in those phases** (since they’re neither in `BLOCKING_PHASES` nor `TDD_PHASES`). That is inconsistent with the intended “non-implement phases block source writes” policy and conflicts with AC6 (“blocked in phases where source changes are not permitted”).

   **Plan fix:** Update `BLOCKING_PHASES` to include `reproduce` and `diagnose`.

2) **Tests should include bugfix phases** in both:
   - allowlisted write checks (AC5)
   - source-code blocked checks (AC6)

3) Minor: The proposed test imports `isAllowlisted` and `isTestFile` but does not use them. (Not fatal, but it will fail lint if you add linting later; better to remove.)

### Task 3 test assertion is brittle (should revise)

The test:
- `expect(result).toContain("spec")`

is likely to fail because `prompts/write-spec.md` does **not** contain the literal word `spec`. A stable assertion should check for an exact phrase that exists in that template, e.g.:
- `"You are writing an executable specification"`

### Task 6 test code will not run as written (must revise)

1) `expect(...).withContext(...)` is not a Bun `expect` API. This will fail at runtime.

2) The test currently calls `buildInjectedPrompt(tmp)` **without a Store**, but several templates include `{{learnings}}` and `{{roadmap}}` which are only populated when a `store` is passed.

   As written, those templates will likely render literal `{{learnings}}` / `{{roadmap}}`, causing false failures.

   **Plan fix options (choose one):**
   - **Option A (recommended):** Pass a minimal in-memory/mock `store` object implementing the subset of the `Store` interface used by `buildInjectedPrompt()` (`readPlanFile`, `getLearnings`, `readRoadmap`, `getIssue`, `getSourceIssues`). Return deterministic dummy strings.
   - **Option B:** Maintain an explicit allowlist of “store-dependent vars” and ignore them in the placeholder scan. (More brittle.)

3) The test includes unused imports and an unused `extractVars()` helper; remove them to keep it copy/paste-executable.

4) Missing template mapping should be a **test failure**, not `console.warn + return`, otherwise new templates can be added without coverage and AC10 becomes toothless.

## Verdict: revise

The plan is directionally correct and covers the spec, but it needs specific edits before implementation:

1) **Revise Task 1** to include `reproduce`/`diagnose` in blocking policy and tests.
2) **Revise Task 3’s tests** to assert on stable template text (not the word `spec`).
3) **Rewrite Task 6’s test** so it actually runs under Bun and does not generate false failures (mock Store or ignore store-only vars).

If you want, I can propose exact patched snippets for Tasks 1/3/6 (without touching `plan.md`) and you can manually apply them to the plan.