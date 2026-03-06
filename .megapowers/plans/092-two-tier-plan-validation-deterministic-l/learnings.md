# Learnings — Issue 092: Two-Tier Plan Validation

- **Subpath imports from packages with strict `exports` maps break silently at runtime.** `"@mariozechner/pi-ai/dist/stream.js"` worked in local dev (local package has `exports: {}`, allowing any subpath) but blew up in production (bundled package has a strict exports map with only `.`, `./oauth`, `./bedrock-provider`). The error message — "cannot find module …/dist/index.js/dist/stream.js" — was confusing but the fix was a one-liner. Lesson: always import from the canonical package root (`.`) when the target is re-exported from index.

- **`export type` before `import` is valid TypeScript but signals something wrong.** The original file had `export type CompleteFn = ...` on line 1, before any imports. TypeScript allows it, but it's a signal that the type was added as an afterthought. Standard practice is imports first. This was caught in code review.

- **Fail-open is the right default for LLM-gated workflow steps.** T1 uses a model that can be misconfigured, rate-limited, or return garbage JSON. Fail-open (treat any uncertainty as pass) ensures T1 never permanently blocks a drafter. This principle should be applied to any future LLM-as-guard usage — gates should have non-model fallbacks.

- **Pure functions with discriminated union return types are easier to test than boolean flags.** `lintTask` returns `{ pass: true } | { pass: false; errors: string[] }`. TypeScript narrows correctly in both branches. Tests can assert on exact error messages, not just pass/fail. The alternative (returning `string[]` of errors where empty means pass) would lose the explicit `pass: true` signal.

- **JSON extraction via `text.indexOf("{")` + `text.lastIndexOf("}")` is a practical heuristic but has edge cases.** If the model wraps JSON in a markdown code fence AND adds explanation text after the closing `}`, `lastIndexOf("}")` still finds the right brace. If the model's *finding strings* contain `}`, it still works (lastIndexOf finds the absolute last one in the full JSON object). The try/catch handles everything else. Good enough for a fast-screen, not for a contract.

- **Migrating existing synchronous test callers to async is mechanical but tedious.** When `handlePlanDraftDone` became async, all 8 existing test call sites (`handleSignal(tmp, "plan_draft_done")`) had to be migrated to `await handlePlanDraftDone(tmp)`. The plan should have called this out explicitly as a migration step, not buried it in the implementation task. Explicit migration steps reduce confusion during TDD.

- **`completeFn` injection as a simple `(prompt: string) => Promise<string>` is the right API shape for testability.** A more complex interface (model + options) would have tied tests to `pi-ai` types, requiring either mocks of the entire model system or real API keys. The thin adapter (`buildLintCompleteFn`) belongs in the integration layer (`register-tools.ts`), not the business logic layer (`tool-signal.ts`).
