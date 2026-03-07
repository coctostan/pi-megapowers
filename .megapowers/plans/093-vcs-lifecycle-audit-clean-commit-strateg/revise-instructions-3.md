## Task 2: Extract switch-away commit flow into a reusable helper

`switchAwayCommit()` currently returns:
- `{ committed: true }`
- `{ skipped: true }`
- `{ error: string }`

Step 3 currently checks `switchResult.ok`, which does not exist on that union and will not compile.

### Required fixes

1. Keep `switchAwayCommit()`’s existing contract unchanged in this task.
2. Update `maybeSwitchAwayFromIssue()` to use the real union shape with type guards.

Replace the helper body with this pattern:

```ts
export async function maybeSwitchAwayFromIssue(
  execGit: ExecGit | null,
  previousBranchName: string | null,
): Promise<{ ok: true; committed: boolean } | { ok: false; error: string }> {
  if (!execGit || !previousBranchName) {
    return { ok: true, committed: false };
  }

  const switchResult = await switchAwayCommit(execGit, previousBranchName);
  if ("error" in switchResult) {
    return { ok: false, error: switchResult.error };
  }

  return {
    ok: true,
    committed: "committed" in switchResult ? switchResult.committed : false,
  };
}
```

3. Ensure Step 1 test expectations match the real semantics:
- dirty path -> `{ ok: true, committed: true }`
- clean path -> `{ ok: true, committed: false }`
- error path -> `{ ok: false, error: ... }`


## Task 17: Lifecycle integration should not change `switchAwayCommit()` return type

Step 3 currently changes `switchAwayCommit()` to return `{ ok: true/false, ... }`. That breaks earlier tests and contracts (`tests/branch-manager.test.ts`, `commands.ts`) that rely on the existing union shape.

### Required fixes

1. Do **not** change `switchAwayCommit()`’s public return type in `branch-manager.ts`.
2. Update integration orchestration to consume the existing union safely.

Use this handling pattern in `runLifecycleScenario()`:

```ts
const switched = await switchAwayCommit(execGit, firstBranch.branchName);
if ("error" in switched) {
  return { ok: false, step: "switch", error: switched.error };
}
const switchedCommitted = "committed" in switched ? switched.committed : false;
```

3. Keep the final result shape controlled by `runLifecycleScenario()` itself (e.g. `switched: switchedCommitted`) rather than forcing `switchAwayCommit()` to expose an `ok` flag.

4. Update Step 1 expectations accordingly (assert lifecycle result fields, not `switchAwayCommit` internal `ok` properties).

5. Add explicit dependency annotation on Task 13 (ship orchestration) so Task 17’s integration scenario clearly depends on the shipping orchestration contract it validates.
- Update frontmatter `depends_on` to include `13`.
