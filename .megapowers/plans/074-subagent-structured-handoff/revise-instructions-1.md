# Revise Instructions — Iteration 1

## Task 2: Emit step-start and step-end events from runPipeline

### Problem: Duplicate verify step-end emissions

Step 3 has three verify step-end emission points, but instruction #1 and #3 overlap for the failure case.

**Current code structure** (pipeline-runner.ts):
```
// Lines 174-180: ONE writeLogEntry for BOTH pass and fail
writeLogEntry(projectRoot, pipelineId, {
    step: "verify",
    status: verify.passed ? "completed" : "failed",
    ...
});
// Line 181: if (!verify.passed) { retryCount++; ... continue; }
```

**What's wrong:** Instruction #1 places a step-end after line 180 with `error: verify.passed ? undefined : \`exit code ...\``, covering both pass and fail. Instruction #3 adds a SECOND step-end inside the `if (!verify.passed)` block. For failing verify, both fire → duplicate `step-end:verify` events.

**Fix:** Remove instruction #3 entirely. Instruction #1 already handles both cases correctly. The Step 3 verify section should have exactly TWO step-end emissions:

1. **Infrastructure failure** (catch block, ~line 154, before `retryCount++`):
```typescript
onProgress?.({ type: "step-end", step: "verify", durationMs: Date.now() - t1, error: verifyMsg });
```

2. **Normal pass/fail** (after writeLogEntry at line 180, before `if (!verify.passed)`):
```typescript
onProgress?.({ type: "step-end", step: "verify", durationMs: verify.durationMs, error: verify.passed ? undefined : `exit code ${verify.exitCode}` });
```

Delete the third instruction ("And after verify failed (not infrastructure, around line 180 after writeLogEntry for !verify.passed)") completely.

---

## Task 3: Emit retry events from runPipeline

### Problem: Retry events fire on final exhaustion cycle

Step 3 says: "After each `retryCount++` line, before `ctx = withRetryContext(...)`, add: `onProgress?.({ type: "retry", ... })`"

**What's wrong:** The actual code structure is:
```typescript
retryCount++;
if (cycle >= maxRetries) { return { status: "paused", ... }; }  // ← early return!
ctx = withRetryContext(ctx, { ... });
continue;
```

Placing the event after `retryCount++` means it fires even when `cycle >= maxRetries` and the function returns paused (no actual retry happens). With the test's `maxRetries: 1` + failing verify:
- cycle 0: retryCount=1 → event fired → continues ✓
- cycle 1: retryCount=2 → **event fired** → returns paused ✗

Result: **2 retry events**, but the test expects **1**.

**Fix:** Place the retry event AFTER the `if (cycle >= maxRetries)` check, not before it. The instruction should say:

"After the `if (cycle >= maxRetries) { ... return; }` check and before `ctx = withRetryContext(...)`, add the onProgress call."

The correct placement at each retry point:
```typescript
retryCount++;
if (cycle >= maxRetries) {
    // ... return paused (NO retry event here)
}
onProgress?.({ type: "retry", retryCount, reason: "..." });  // ← HERE
ctx = withRetryContext(ctx, { ... });
continue;
```

Apply this to all 5 retry locations listed in Step 3.
