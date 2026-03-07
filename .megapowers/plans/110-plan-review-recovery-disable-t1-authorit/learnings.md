# Learnings — #110: Disable T1 Authority / Restore Plan Review Recovery

- **Advisory automation that blocks workflow creates hidden authority.** T1 was designed to help but ended up controlling the state machine. Any pre-gate that uses a nondeterministic model to block a human-facing transition will degrade reliability and erode trust in the workflow. If automation can't be deterministic + fail-safe, it should inform, not gate.

- **Prompt rewrites based on future behavior assumptions are dangerous.** `review-plan.md` was changed to trust T0/T1 before those systems were proven reliable. The right sequencing: verify the upstream guarantees first, then (optionally) reduce downstream redundancy. Never reduce reviewer scope based on what you plan to build.

- **Tests that lock in a bad contract make bugs self-perpetuating.** The T1-blocking behavior survived because both code and tests were updated together to match the new (flawed) design. When changing architecture, keep old tests as regression guards even if they fail — don't delete them until the new design is proven correct.

- **Simple state transitions are more trustworthy than model-gated ones.** `handlePlanDraftDone()` went from 5 lines to 40+ with async model calls, error handling, and T1 message formatting. After the fix it's back to 20 lines with no async dependencies. Simpler = fewer failure modes.

- **Batch issue discipline: diagnosing the root cause once covers all three sub-issues cleanly.** Issues #096, #099, #100 were all symptoms of the same `#092` architectural decision. Grouping them as a batch allowed a single diagnosis to drive all three fixes without duplicate root-cause analysis.

- **Source-text assertions in tests are a lightweight way to guard wiring contracts.** `tests/register-tools.test.ts` asserts that `buildLintCompleteFn` is absent from the source file. This is fragile to file moves but very effective at preventing silent re-introduction of deleted helpers — especially in files that are hard to unit-test due to pi API dependencies.

- **Recovery design docs (`095-...decomposition.md`) are worth writing.** The recovery doc written during diagnosis gave this implementation a clear target: revert `plan_draft_done` to a simple transition, restore full reviewer ownership. Without that artifact the fix direction would have been ambiguous.
