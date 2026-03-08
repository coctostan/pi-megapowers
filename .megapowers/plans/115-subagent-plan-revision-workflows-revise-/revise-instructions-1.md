## Task 1: Add project revise-helper agent definition

Add explicit acceptance-criteria coverage mapping to the task body. Right now the task content does not identify which AC IDs it satisfies, which makes plan-review coverage auditing ambiguous.

Insert a short section near the top of the task (after **Files:** is fine):

```md
**Covers AC:** 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13
```

Keep the existing Step 1/Step 2 content as-is; it already contains concrete file content and verification commands.

## Task 2: Add project draft-assist chain definition

Add explicit acceptance-criteria coverage mapping to the task body. The task currently implements the right changes but does not name AC IDs directly.

Insert:

```md
**Covers AC:** 14, 15, 16, 17, 18, 19, 20, 21, 22, 23
```

Do not broaden scope. Keep this task advisory-only and chain-definition-only.

## Task 3: Document reusable review-fanout planning pattern

Add explicit acceptance-criteria coverage mapping to the task body so reviewers can verify traceability directly from the task file.

Insert:

```md
**Covers AC:** 24, 25, 26, 27, 28, 29
```

No other structural changes are required. Existing doc content and verify command are already aligned with scope and no-test justification.
