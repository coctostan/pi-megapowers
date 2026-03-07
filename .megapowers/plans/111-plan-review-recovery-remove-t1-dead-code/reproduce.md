# Reproduction: T1 dead code remains after runtime disconnection

## Steps to Reproduce

1. Confirm files exist:
   ```
   ls -la extensions/megapowers/validation/plan-lint-model.ts prompts/lint-plan-prompt.md tests/plan-lint-model.test.ts
   ```
   All three exist.

2. Confirm no runtime code imports from the T1 module:
   ```
   grep -rn "from.*plan-lint-model" extensions/ --include="*.ts"
   ```
   Zero matches — the runtime wiring was removed in issue #110.

3. Confirm T1-specific test block in `tests/tool-signal.test.ts`:
   Lines 865-905, `describe("handlePlanDraftDone — no T1 model gating", ...)` — passes a `failFn` (mock completeFn) via `(handlePlanDraftDone as any)(tmp2, failFn)`. Since `handlePlanDraftDone` no longer accepts a `completeFn` parameter (removed in #110), the extra argument is silently ignored. The test passes but exercises dead behavior.

4. Run all T1 tests — they still pass:
   ```
   bun test tests/plan-lint-model.test.ts   # 8 pass
   bun test tests/tool-signal.test.ts        # 74 pass
   ```

## Expected Behavior

After issue #110 disconnected T1 from runtime, the now-dead T1 module, prompt, and tests should have been removed to prevent confusion and maintenance burden.

## Actual Behavior

Three dead files remain in the codebase:
- `extensions/megapowers/validation/plan-lint-model.ts` — T1 model-based lint module (2.4KB)
- `prompts/lint-plan-prompt.md` — T1 prompt template (1.3KB)
- `tests/plan-lint-model.test.ts` — T1 module tests (4.1KB, 8 tests)

One T1-specific test block remains in `tests/tool-signal.test.ts`:
- Lines 865-905: `handlePlanDraftDone — no T1 model gating` describe block uses `(handlePlanDraftDone as any)(tmp2, failFn)` to pass a `completeFn` that `handlePlanDraftDone` no longer accepts

## Evidence

### Dead files confirmed
```
$ ls -la extensions/megapowers/validation/plan-lint-model.ts prompts/lint-plan-prompt.md tests/plan-lint-model.test.ts
-rw-r--r--  2420 extensions/megapowers/validation/plan-lint-model.ts
-rw-r--r--  1252 prompts/lint-plan-prompt.md
-rw-r--r--  4099 tests/plan-lint-model.test.ts
```

### No runtime imports
```
$ grep -rn "from.*plan-lint-model" extensions/ --include="*.ts" | grep -v ".megapowers/"
(empty — exit code 1)
```

### T1-specific test in tool-signal.test.ts
```typescript
// Lines 865-905
describe("handlePlanDraftDone — no T1 model gating", () => {
  it("ignores failing model lint input and still transitions to review", async () => {
    // ...
    const failFn = async () => JSON.stringify({
      verdict: "fail",
      findings: ["AC1 is not covered by any task"],
    });

    const result = await (handlePlanDraftDone as any)(tmp2, failFn);
    // ^ casts to 'any' because handlePlanDraftDone(cwd: string) no longer accepts completeFn
    // failFn is silently ignored
    // ...
  });
});
```

### Current `handlePlanDraftDone` signature (no completeFn)
```typescript
export async function handlePlanDraftDone(cwd: string): Promise<SignalResult> {
```

### Existing coverage for `plan_draft_done` that must be preserved
Lines 266-331 in `tests/tool-signal.test.ts`, `describe("plan_draft_done signal", ...)`:
- wrong phase → error
- wrong planMode (review) → error  
- no task files → error
- draft → review transition ✓
- revise → review transition ✓
- task count in success message ✓
- triggerNewSession flag ✓

These cover all 4 acceptance criteria paths (wrong phase/mode, missing tasks, successful transition).

## Environment
- Bun v1.3.9
- macOS

## Failing Test

Not feasible as a traditional failing test — this is a dead-code cleanup issue. The "bug" is that dead files exist and tests exercise phantom behavior. Verification is structural: assert the files don't exist and no imports reference them.

## Reproducibility

Always — the dead files are checked into the repository.
