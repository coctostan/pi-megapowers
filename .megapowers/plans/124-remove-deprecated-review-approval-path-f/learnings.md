## Learnings — #124 Remove Deprecated review_approve Path

- **Source-level regression tests are effective for deprecation cleanup.** Reading actual source files in tests (`readFileSync` on `register-tools.ts`, `commands.ts`, `index.ts`) and asserting `.not.toContain()` catches re-introduction of deprecated patterns more reliably than behavioral tests alone, which might not exercise the specific code path.

- **Suppressing derived instructions is cleaner than removing dead code.** Rather than deleting the `needsReviewApproval` branch in `tool-instructions.ts` (which would require type changes), suppressing the derived tool instructions in the prompt injection layer during review mode was minimal and targeted. The dead code is harmless when unreachable and guarded by tests.

- **Prompt template layering can create conflicting instructions.** The `review-plan.md` template correctly directed approval through `megapowers_plan_review`, but the generic `deriveToolInstructions` layer was appending `phase_next`/artifact instructions on top. The fix was suppressing the generic layer during review mode rather than modifying either template.

- **Deprecation errors should name the replacement explicitly.** The preserved `handleSignal(cwd, "review_approve")` error message includes both "deprecated" and "megapowers_plan_review", making it actionable for any stale caller without requiring documentation lookup.

- **Small, well-scoped cleanup issues ship fast.** Three focused tasks (prompt routing, tool schema, command surface) with clear acceptance criteria made this a clean single-session implementation with no surprises.
