# Revise Instructions — Iteration 1

Three pre-existing tests will fail with the current task wording. Fix by either preserving the asserted substrings in your new strings, or by updating the listed tests in the same task that introduces the change.

## Task 5: Compact no-active-issue prompt

`tests/prompt-inject.test.ts` line 400 still expects `/mega on|off` in the idle prompt:

```ts
it("includes slash command hints (AC5)", () => {
  writeState(tmp, { ...createInitialState(), megaEnabled: true });
  const result = buildInjectedPrompt(tmp);
  expect(result).toContain("/issue new");
  expect(result).toContain("/issue list");
  expect(result).toContain("/triage");
  expect(result).toContain("/mega on|off");   // ← currently asserted
});
```

Your new `buildIdlePrompt` only emits `/issue list`, `/issue new`, `/triage`. Pick one:

**Option A (recommended) — add `/mega on|off` to the rules block** in the new `buildIdlePrompt` so the compact prompt still hints at it:

```ts
"Rules:",
"- Do not edit .megapowers/state.json.",
"- If a Megapowers tool errors, follow its message and retry rather than working around it.",
"",
"Commands: `/issue list`, `/issue new`, `/triage`, `/mega on|off`.",
```

(This matches the compact form already suggested in issue #128 and keeps AC29 plus the existing test.)

**Option B** — explicitly replace the `(AC5)` test in Task 5's Step 1 with a version that drops `/mega on|off`. If you take Option B, document why dropping that affordance is intentional.

Either way, update Task 5's Step 1 test-edit list to either keep the assertion passing or rewrite it.

## Task 15: Standardize plan_task feedback

Pre-existing tests assert capitalized `"Task 1 lint failed"`:

- `tests/tool-plan-task.test.ts:201` — `expect(result.error).toContain("Task 1 lint failed");`
- `tests/tool-plan-task.test.ts:218` — same
- `tests/tool-plan-task.test.ts:242` — same

Your new error text is `❌ plan_task task ${params.id} lint failed — ...` — lowercase `task`, so the existing substring no longer matches.

Fix the new error to keep the capitalized form **and** still name `plan_task`. For example:

```ts
return {
  error: `❌ plan_task: Task ${params.id} lint failed — fix lint errors:\n${lintResult.errors.map((e) => `  • ${e}`).join("\n")}`,
};
```

Apply the same pattern to the title/description/validation errors so AC46 (action name + corrective step) is satisfied without breaking the substring:

```ts
return { error: `❌ plan_task: Task ${params.id} invalid — title is required. Provide title when creating a new task.` };
return { error: `❌ plan_task: Task ${params.id} invalid — description is required. Provide description when creating a new task.` };
return { error: `❌ plan_task: Task ${params.id} invalid — ${issues}. Fix the listed validation errors.` };
return { error: `❌ plan_task: Task ${params.id} existing file is corrupt (${existing.error}). Delete and recreate the corrupt task file.` };
```

Then update Task 15's Step 3 with the corrected strings.

## Task 16: Standardize plan_review feedback

`tests/plan-orchestrator.test.ts:92` still expects capitalized `"Human intervention needed"`:

```ts
if (!capped.ok) {
  expect(capped.error).toContain("Human intervention needed");
}
```

Your composed `summary` is `plan_review: reached ${maxIterations} iterations without approval — human intervention needed` — lowercase `human`, breaks the existing assertion.

Fix the composed message to keep capital `H`:

```ts
error: composeMessage({
  icon: "warn",
  summary: `plan_review: reached ${maxIterations} iterations without approval — Human intervention needed`,
  nextStep: "Use /mega off to disable enforcement and manually advance, or revise the spec.",
}),
```

This also matches the original "Human intervention needed" phrasing already used in the codebase.

While you are in `transitionReviewToRevise`, double-check that the revise-success `summary` keeps the literal token `REVISE` (uppercase) — `tests/plan-orchestrator.test.ts:81` and `tests/tool-plan-review.test.ts:77, 279` assert `toContain("REVISE")`. The current draft does keep it (`Plan review: REVISE (iteration ...)`), so no extra change is required here, but please verify after the edit.

## Out of scope for this revision

Tasks 1, 2, 3, 4, 6, 7, 8, 9, 10, 11, 12, 13, 14, 17 pass review as written and do not need changes beyond what cascades from the three fixes above (no cascading edits expected — the three are self-contained string fixes).
