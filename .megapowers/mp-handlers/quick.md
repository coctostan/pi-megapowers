# Quick Fix Handler

Lightweight workflow for small changes. Skip brainstorm/spec/plan/review ceremony.

## Parse Arguments

Everything after `quick` is the description. Examples:
- `/mp quick fix typo in README line 42`
- `/mp quick update lodash to 4.17.21`
- `/mp quick add missing null check in auth middleware`

## Execution

1. **Create issue** (same as `new` handler logic, but force `type: bugfix` and add `tags: [quick-fix]` to frontmatter).
2. **Inform the user:**
   ```
   Quick-fix mode: implement → verify → done (3 phases).
   No brainstorm, no spec, no plan, no review.
   TDD enforcement still applies unless you /tdd skip.
   ```
3. **Check if quick-fix workflow exists** in the state machine:
   - Read `.megapowers/state.json` — if the system supports a `quick-fix` workflow type, activate it.
   - If not (current state): tell the user honestly:
     ```
     The quick-fix workflow isn't in the state machine yet.
     Options:
     1. Use /mega off, do the work with discipline, /mega on when done
     2. Use the standard bugfix workflow (it'll add reproduce + diagnose phases)
     ```
4. **Either way**, guide them: describe the fix, write a test, make it pass, verify.

## Rules

- **This is for small stuff.** If the description implies significant architecture changes, suggest `/mp new` instead.
- **Be honest about limitations.** Don't pretend quick-fix workflow exists if it doesn't.
